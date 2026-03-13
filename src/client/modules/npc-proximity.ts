import { Players, RunService, Workspace, CollectionService, UserInputService } from "@rbxts/services";
import { log } from "shared/helpers";
import { getOrCreateAssassinationRemote } from "shared/remotes/assassination-remote";
import { getOrCreateStealthRemote } from "shared/remotes/stealth-remote";
import { UI_THEME } from "shared/ui-theme";

const assassinationRemote = getOrCreateAssassinationRemote();
const stealthRemote = getOrCreateStealthRemote();
const PROXIMITY_RANGE = 5; // Only show when very close to NPC
const NAME_VISIBLE_RANGE = 15; // Distance at which NPC names become visible
let isCurrentlyStealthing = false;
let closestNPCInRange: Model | undefined = undefined;

interface NPCProximityUI {
	billboard: BillboardGui;
	nameLabel: TextLabel;
	assassinateButton?: TextButton;
}

const npcUIMap = new Map<Model, NPCProximityUI>();

function createNPCBillboard(npc: Model): BillboardGui {
	const billboard = new Instance("BillboardGui");
	billboard.Size = new UDim2(4.5, 0, 1.2, 0);
	billboard.MaxDistance = math.huge;
	billboard.StudsOffset = new Vector3(0, 6.5, 0);
	billboard.AlwaysOnTop = false;
	billboard.Parent = npc;

	// Name label — sits below the assassinate prompt
	const nameLabel = new Instance("TextLabel");
	nameLabel.Size = new UDim2(1, 0, 0.55, 0);
	nameLabel.Position = new UDim2(0, 0, 0.45, 0);
	nameLabel.BackgroundColor3 = UI_THEME.bg;
	nameLabel.BackgroundTransparency = 0.25;
	nameLabel.TextColor3 = UI_THEME.textPrimary;
	nameLabel.Font = UI_THEME.fontDisplay;
	nameLabel.TextSize = 13;
	nameLabel.Text = npc.Name;
	nameLabel.BorderSizePixel = 0;
	nameLabel.Parent = billboard;

	const nameCorner = new Instance("UICorner");
	nameCorner.CornerRadius = new UDim(0, 4);
	nameCorner.Parent = nameLabel;

	const nameStroke = new Instance("UIStroke");
	nameStroke.Color = UI_THEME.border;
	nameStroke.Thickness = 0.8;
	nameStroke.Parent = nameLabel;

	return billboard;
}

function createAssassinateButton(billboard: BillboardGui, npc: Model): TextButton {
	const button = new Instance("TextButton");
	button.Size = new UDim2(1, 0, 0.42, 0);
	button.Position = new UDim2(0, 0, 0, 0);
	button.BackgroundColor3 = UI_THEME.headerBg;
	button.BackgroundTransparency = 0.1;
	button.TextColor3 = UI_THEME.danger;
	button.Font = UI_THEME.fontBold;
	button.TextSize = 11;
	button.Text = "[⚔] ASSASSINATE  [E]";
	button.BorderSizePixel = 0;
	button.Parent = billboard;

	const btnCorner = new Instance("UICorner");
	btnCorner.CornerRadius = new UDim(0, 4);
	btnCorner.Parent = button;

	const btnStroke = new Instance("UIStroke");
	btnStroke.Color = UI_THEME.danger;
	btnStroke.Thickness = 0.8;
	btnStroke.Parent = button;

	button.MouseButton1Click.Connect(() => {
		assassinationRemote.FireServer(npc);
	});

	return button;
}

function setupNPCProximity(npc: Model) {
	if (npcUIMap.has(npc)) return; // Already setup

	const billboard = createNPCBillboard(npc);
	const nameLabel = billboard.FindFirstChild("TextLabel") as TextLabel;

	const ui: NPCProximityUI = {
		billboard,
		nameLabel,
	};

	npcUIMap.set(npc, ui);
}

function isNPCInCameraFrame(camera: Instance, npcPosition: Vector3): boolean {
	// Simplified: just check if NPC is close enough (proximity-based button show)
	// Camera frame checks were causing issues, so we rely on proximity range instead
	return true;
}

function updateNPCProximityUI() {
	const player = Players.LocalPlayer;
	if (!player || !player.Character) return;

	const playerPosition = (player.Character.FindFirstChild("HumanoidRootPart") as BasePart)?.Position;
	if (!playerPosition) return;

	const camera = Workspace.CurrentCamera;
	if (!camera) return;
	let closestNPC: Model | undefined;
	let closestDistance = PROXIMITY_RANGE + 1;
	let npcCount = 0;
	let inRangeCount = 0;

	// First pass: find closest NPC in range and in camera frame
	for (const [npc, ui] of npcUIMap) {
		npcCount = npcCount + 1;
		if (!npc.Parent) {
			npcUIMap.delete(npc);
			ui.billboard.Destroy();
			continue;
		}

		// Get NPC position
		let npcPosition: Vector3 | undefined;
		if (npc.PrimaryPart) {
			npcPosition = npc.PrimaryPart.Position;
		} else {
			const hrp = npc.FindFirstChild("HumanoidRootPart") as BasePart;
			if (hrp) {
				npcPosition = hrp.Position;
			} else {
				const bp = npc.FindFirstChildOfClass("BasePart") as BasePart;
				if (bp) {
					npcPosition = bp.Position;
				}
			}
		}

		if (!npcPosition) continue;

		const distance = playerPosition.sub(npcPosition).Magnitude;

		// Update name label visibility based on distance
		const nameVisible = distance <= NAME_VISIBLE_RANGE;
		const nameLabel = ui.billboard.FindFirstChild("TextLabel") as TextLabel;
		if (nameLabel) {
			nameLabel.Visible = nameVisible;
		}

		// Track closest NPC in range (camera frame check optional for tracking)
		if (distance <= PROXIMITY_RANGE) {
			inRangeCount = inRangeCount + 1;
			const inCameraFrame = isNPCInCameraFrame(camera, npcPosition);
			if (inCameraFrame && distance < closestDistance) {
				closestDistance = distance;
				closestNPC = npc;
			}
		}
	}

	// Update global closest NPC for E key handling
	closestNPCInRange = closestNPC;

	// Second pass: update assassinate buttons (only on closest NPC)
	for (const [npc, ui] of npcUIMap) {
		const shouldShowButton = isCurrentlyStealthing && npc === closestNPC;

		if (shouldShowButton) {
			if (!ui.assassinateButton) {
				ui.assassinateButton = createAssassinateButton(ui.billboard, npc);
			}
		} else {
			if (ui.assassinateButton) {
				ui.assassinateButton.Destroy();
				ui.assassinateButton = undefined;
			}
		}
	}
}

function initializeNPCProximity() {
	const player = Players.LocalPlayer;
	if (!player) return;

	// Find existing NPCs in workspace (exclude player characters)
	const existingNPCs = Workspace.GetDescendants().filter((inst): inst is Model => {
		if (!inst.IsA("Model") || inst.FindFirstChild("Humanoid") === undefined) return false;
		// Exclude player characters by checking if they're in Players
		const playerObj = Players.FindFirstChild(inst.Name);
		if (playerObj && playerObj.IsA("Player")) {
			const playerChar = (playerObj as Player).Character;
			if (playerChar === inst) return false;
		}
		return true;
	});
	existingNPCs.forEach((npc) => {
		setupNPCProximity(npc as Model);
	});

	// Listen for new NPCs being added (excluding player characters)
	Workspace.DescendantAdded.Connect((descendant) => {
		if (descendant.IsA("Model") && descendant.FindFirstChild("Humanoid")) {
			// Exclude player characters
			const playerObj = Players.FindFirstChild(descendant.Name);
			if (playerObj && playerObj.IsA("Player")) {
				const playerChar = (playerObj as Player).Character;
				if (playerChar === descendant) return;
			}
			task.wait(0.1);
			setupNPCProximity(descendant as Model);
		}
	});

	// Update proximity UI every frame
	RunService.RenderStepped.Connect(() => {
		updateNPCProximityUI();
	});

	// Listen for E key to assassinate closest NPC
	UserInputService.InputBegan.Connect((input, gameProcessed) => {
		if (gameProcessed) return;

		if (input.KeyCode === Enum.KeyCode.E) {
			if (isCurrentlyStealthing && closestNPCInRange) {
				log(`[ASSASSINATION] Player attempting to assassinate ${closestNPCInRange.Name} via E key`);
				assassinationRemote.FireServer(closestNPCInRange);
			}
		}
	});
}

function setStealthing(stealthing: boolean) {
	isCurrentlyStealthing = stealthing;
	stealthRemote.FireServer(stealthing);
}

export { initializeNPCProximity, setStealthing };
