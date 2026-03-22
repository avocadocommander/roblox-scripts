import { Players, RunService, Workspace, CollectionService, UserInputService } from "@rbxts/services";
import { log } from "shared/helpers";
import { getOrCreateAssassinationRemote } from "shared/remotes/assassination-remote";
import { getOrCreateStealthRemote } from "shared/remotes/stealth-remote";
import { UI_THEME } from "shared/ui-theme";
import { MEDIEVAL_NPCS } from "shared/module";
import { RARITY_COLORS } from "shared/inventory";
import { TITLES } from "shared/config/titles";
import { getTitleSyncRemote, getAllTitlesRemote } from "shared/remotes/title-remote";
import { requestOpenDialog, isDialogOpen } from "./npc-dialog";
import {
	getPlayerAssassinationRemote,
	getPlayerWantedRemote,
	getPlayerWantedClearedRemote,
	getBountyListSyncRemote,
	PlayerWantedPayload,
} from "shared/remotes/bounty-remote";

// ── Status → rarity colour mapping ───────────────────────────────────────────
const STATUS_COLORS: Record<string, Color3> = {
	Serf: RARITY_COLORS["common"],
	Commoner: RARITY_COLORS["uncommon"],
	Merchant: RARITY_COLORS["rare"],
	Nobility: RARITY_COLORS["epic"],
	Royalty: RARITY_COLORS["legendary"],
};

function getNPCStatusColor(npcName: string): Color3 {
	const data = MEDIEVAL_NPCS[npcName];
	if (!data) return UI_THEME.textPrimary;
	return STATUS_COLORS[data.status] ?? UI_THEME.textPrimary;
}

function getNPCStatus(npcName: string): string {
	const data = MEDIEVAL_NPCS[npcName];
	if (!data) return "";
	return data.status;
}

const assassinationRemote = getOrCreateAssassinationRemote();
const stealthRemote = getOrCreateStealthRemote();
const PROXIMITY_RANGE = 5; // Only show when very close to NPC
const NAME_VISIBLE_RANGE = 15; // Distance at which NPC names become visible
let isCurrentlyStealthing = false;
let closestNPCInRange: Model | undefined = undefined;

// ── Wanted Player Tracking ──────────────────────────────────────────────────────
const wantedPlayerInfo = new Map<string, { gold: number; displayName: string }>();
const wantedBillboards = new Map<string, BillboardGui>();
let closestWantedPlayerInRange: Model | undefined = undefined;

// ── Regular (non-wanted) Player Billboards ──────────────────────────────────────
const playerBillboards = new Map<string, BillboardGui>();
const playerTitles = new Map<string, string>(); // playerName -> equipped title ID

function createPlayerBillboard(character: Model, playerName: string, titleId?: string): void {
	removePlayerBillboard(playerName);
	const head = character.FindFirstChild("Head") as BasePart | undefined;
	if (!head) return;

	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (humanoid) {
		humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None;
	}

	const titleDef = titleId !== undefined ? TITLES[titleId] : undefined;
	const isWanted = wantedPlayerInfo.has(playerName);
	const borderColor = isWanted ? UI_THEME.danger : Color3.fromRGB(0, 0, 0);

	const billboard = new Instance("BillboardGui");
	billboard.Name = "PlayerBillboard";
	billboard.Size = new UDim2(5, 0, 1.1, 0);
	billboard.MaxDistance = 60;
	billboard.StudsOffset = new Vector3(0, 2, 0);
	billboard.AlwaysOnTop = false;
	billboard.Parent = head;

	const card = new Instance("Frame");
	card.Size = new UDim2(1, 0, 1, 0);
	card.BackgroundColor3 = UI_THEME.bg;
	card.BackgroundTransparency = 0.15;
	card.BorderSizePixel = 0;
	card.Parent = billboard;

	const cardCorner = new Instance("UICorner");
	cardCorner.CornerRadius = new UDim(0, 5);
	cardCorner.Parent = card;

	const cardStroke = new Instance("UIStroke");
	cardStroke.Color = borderColor;
	cardStroke.Thickness = 1.2;
	cardStroke.Parent = card;

	// Single-line: "Symbol TitleName PlayerName" or just "PlayerName"
	const displayText =
		titleDef !== undefined
			? titleDef.symbol + " " + titleDef.name + " " + playerName
			: playerName;
	const textColor = titleDef !== undefined ? titleDef.color : UI_THEME.gold;

	const nameLabel = new Instance("TextLabel");
	nameLabel.Size = new UDim2(1, -6, 1, 0);
	nameLabel.Position = new UDim2(0, 3, 0, 0);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.TextColor3 = textColor;
	nameLabel.Font = UI_THEME.fontDisplay;
	nameLabel.TextSize = 13;
	nameLabel.Text = displayText;
	nameLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	nameLabel.BorderSizePixel = 0;
	nameLabel.Parent = card;

	playerBillboards.set(playerName, billboard);
}

function removePlayerBillboard(playerName: string): void {
	const billboard = playerBillboards.get(playerName);
	if (billboard) {
		billboard.Destroy();
		playerBillboards.delete(playerName);
	}
}

function setupRegularPlayerBillboards(): void {
	const localPlayer = Players.LocalPlayer;
	for (const player of Players.GetPlayers()) {
		if (player === localPlayer) continue;
		if (wantedPlayerInfo.has(player.Name)) continue; // wanted billboard takes over
		if (player.Character) {
			createPlayerBillboard(player.Character, player.Name, playerTitles.get(player.Name));
		}
		player.CharacterAdded.Connect((char) => {
			// Wait briefly for Head to exist
			task.wait(0.1);
			if (!wantedPlayerInfo.has(player.Name)) {
				createPlayerBillboard(char, player.Name, playerTitles.get(player.Name));
			}
		});
	}

	Players.PlayerAdded.Connect((player) => {
		if (player === localPlayer) return;
		player.CharacterAdded.Connect((char) => {
			task.wait(0.1);
			if (!wantedPlayerInfo.has(player.Name)) {
				createPlayerBillboard(char, player.Name, playerTitles.get(player.Name));
			}
		});
	});

	Players.PlayerRemoving.Connect((player) => {
		removePlayerBillboard(player.Name);
	});
}

interface NPCProximityUI {
	billboard: BillboardGui;
	nameLabel: TextLabel;
	assassinateButton?: TextButton;
	talkButton?: TextButton;
}

const npcUIMap = new Map<Model, NPCProximityUI>();

function createNPCBillboard(npc: Model): BillboardGui {
	const billboard = new Instance("BillboardGui");
	billboard.Size = new UDim2(5, 0, 1.6, 0);
	billboard.MaxDistance = math.huge;
	billboard.StudsOffset = new Vector3(0, 6.5, 0);
	billboard.AlwaysOnTop = false;
	billboard.Parent = npc;

	const statusColor = getNPCStatusColor(npc.Name);
	const statusText = getNPCStatus(npc.Name);

	// Outer card frame
	const card = new Instance("Frame");
	card.Name = "NPCCard";
	card.Size = new UDim2(1, 0, 0.7, 0);
	card.Position = new UDim2(0, 0, 0, 0);
	card.BackgroundColor3 = UI_THEME.bg;
	card.BackgroundTransparency = 0.15;
	card.BorderSizePixel = 0;
	card.Parent = billboard;

	const cardCorner = new Instance("UICorner");
	cardCorner.CornerRadius = new UDim(0, 5);
	cardCorner.Parent = card;

	const cardStroke = new Instance("UIStroke");
	cardStroke.Color = statusColor;
	cardStroke.Thickness = 1.2;
	cardStroke.Parent = card;

	// NPC name — always white text, rarity colour is shown via the card border
	const isMerchant = statusText === "Merchant";
	const displayName = isMerchant ? "(G) " + npc.Name : npc.Name;

	const nameLabel = new Instance("TextLabel");
	nameLabel.Name = "TextLabel";
	nameLabel.Size = new UDim2(1, -6, 1, 0);
	nameLabel.Position = new UDim2(0, 3, 0, 0);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.TextColor3 = Color3.fromRGB(255, 255, 255);
	nameLabel.Font = UI_THEME.fontDisplay;
	nameLabel.TextSize = 13;
	nameLabel.Text = displayName;
	nameLabel.BorderSizePixel = 0;
	nameLabel.Parent = card;

	return billboard;
}

function createAssassinateButton(billboard: BillboardGui, npc: Model): TextButton {
	const button = new Instance("TextButton");
	button.Size = new UDim2(1, 0, 0.42, 0);
	button.Position = new UDim2(0, 0, 0.72, 0);
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

function createTalkButton(billboard: BillboardGui, npc: Model): TextButton {
	const button = new Instance("TextButton");
	button.Size = new UDim2(1, 0, 0.42, 0);
	button.Position = new UDim2(0, 0, 0.72, 0);
	button.BackgroundColor3 = UI_THEME.bgInset;
	button.BackgroundTransparency = 0.1;
	button.TextColor3 = UI_THEME.textPrimary;
	button.Font = UI_THEME.fontBold;
	button.TextSize = 11;
	button.Text = "TALK  [F]";
	button.BorderSizePixel = 0;
	button.Parent = billboard;

	const btnCorner = new Instance("UICorner");
	btnCorner.CornerRadius = new UDim(0, 4);
	btnCorner.Parent = button;

	const btnStroke = new Instance("UIStroke");
	btnStroke.Color = UI_THEME.border;
	btnStroke.Thickness = 0.8;
	btnStroke.Parent = button;

	button.MouseButton1Click.Connect(() => {
		requestOpenDialog(npc);
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

// ── Wanted Player Billboards ────────────────────────────────────────────────────

function createWantedBillboard(character: Model, playerName: string, gold: number): void {
	removeWantedBillboard(playerName);
	const head = character.FindFirstChild("Head") as BasePart;
	if (!head) return;

	// Hide default Roblox name display
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (humanoid) {
		humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None;
	}

	const billboard = new Instance("BillboardGui");
	billboard.Name = "WantedBillboard";
	billboard.Size = new UDim2(5, 0, 2.0, 0);
	billboard.MaxDistance = 100;
	billboard.StudsOffset = new Vector3(0, 2.5, 0);
	billboard.AlwaysOnTop = false;
	billboard.Parent = head;

	// Info frame — dark themed
	const info = new Instance("Frame");
	info.Name = "Info";
	info.Size = new UDim2(1, 0, 0.75, 0);
	info.Position = new UDim2(0, 0, 0.25, 0);
	info.BackgroundColor3 = UI_THEME.bg;
	info.BackgroundTransparency = 0.15;
	info.BorderSizePixel = 0;
	info.Parent = billboard;

	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(0, 4);
	corner.Parent = info;

	const stroke = new Instance("UIStroke");
	stroke.Color = UI_THEME.danger;
	stroke.Thickness = UI_THEME.strokeThickness;
	stroke.Parent = info;

	// "WANTED" header
	const wantedTag = new Instance("TextLabel");
	wantedTag.Name = "WantedTag";
	wantedTag.Size = new UDim2(1, 0, 0.28, 0);
	wantedTag.Position = new UDim2(0, 0, 0.02, 0);
	wantedTag.BackgroundTransparency = 1;
	wantedTag.TextColor3 = UI_THEME.danger;
	wantedTag.Font = UI_THEME.fontBold;
	wantedTag.TextSize = 9;
	wantedTag.Text = "WANTED";
	wantedTag.Parent = info;

	// Player name — RED
	const nameLabel = new Instance("TextLabel");
	nameLabel.Name = "NameLabel";
	nameLabel.Size = new UDim2(1, 0, 0.38, 0);
	nameLabel.Position = new UDim2(0, 0, 0.28, 0);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.TextColor3 = UI_THEME.danger;
	nameLabel.Font = UI_THEME.fontDisplay;
	nameLabel.TextSize = 14;
	nameLabel.Text = playerName;
	nameLabel.Parent = info;

	// Gold reward
	const goldLabel = new Instance("TextLabel");
	goldLabel.Name = "GoldLabel";
	goldLabel.Size = new UDim2(1, 0, 0.28, 0);
	goldLabel.Position = new UDim2(0, 0, 0.68, 0);
	goldLabel.BackgroundTransparency = 1;
	goldLabel.TextColor3 = UI_THEME.gold;
	goldLabel.Font = UI_THEME.fontBold;
	goldLabel.TextSize = 11;
	goldLabel.Text = gold + " Gold";
	goldLabel.Parent = info;

	wantedBillboards.set(playerName, billboard);
}

function updateWantedGold(playerName: string, gold: number): void {
	const billboard = wantedBillboards.get(playerName);
	if (!billboard) return;
	const info = billboard.FindFirstChild("Info") as Frame;
	if (!info) return;
	const goldLabel = info.FindFirstChild("GoldLabel") as TextLabel;
	if (goldLabel) goldLabel.Text = gold + " Gold";
}

function removeWantedBillboard(playerName: string): void {
	const billboard = wantedBillboards.get(playerName);
	if (billboard) {
		billboard.Destroy();
		wantedBillboards.delete(playerName);
	}
}

function handlePlayerWanted(payload: PlayerWantedPayload): void {
	if (payload.playerName === Players.LocalPlayer.Name) return;
	wantedPlayerInfo.set(payload.playerName, { gold: payload.gold, displayName: payload.displayName });
	// Remove the regular gold billboard — wanted one takes over
	removePlayerBillboard(payload.playerName);
	const targetPlayer = Players.FindFirstChild(payload.playerName) as Player | undefined;
	if (targetPlayer && targetPlayer.IsA("Player") && targetPlayer.Character) {
		if (wantedBillboards.has(payload.playerName)) {
			updateWantedGold(payload.playerName, payload.gold);
		} else {
			createWantedBillboard(targetPlayer.Character, payload.playerName, payload.gold);
		}
	}
}

function handlePlayerWantedCleared(playerName: string): void {
	wantedPlayerInfo.delete(playerName);
	removeWantedBillboard(playerName);
	// Restore regular gold billboard
	const targetPlayer = Players.FindFirstChild(playerName) as Player | undefined;
	if (targetPlayer && targetPlayer.IsA("Player") && targetPlayer.Character) {
		const humanoid = targetPlayer.Character.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None;
		}
		createPlayerBillboard(targetPlayer.Character, playerName, playerTitles.get(playerName));
	}
}

/** Re-create billboards for wanted players after respawn or late join. */
function ensureWantedBillboards(): void {
	for (const [playerName, info] of wantedPlayerInfo) {
		if (playerName === Players.LocalPlayer.Name) continue;
		const targetPlayer = Players.FindFirstChild(playerName) as Player | undefined;
		if (!targetPlayer || !targetPlayer.IsA("Player") || !targetPlayer.Character) {
			if (wantedBillboards.has(playerName)) removeWantedBillboard(playerName);
			continue;
		}
		const existing = wantedBillboards.get(playerName);
		if (!existing || !existing.Parent) {
			createWantedBillboard(targetPlayer.Character, playerName, info.gold);
		}
	}
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

		// Update card visibility based on distance
		const nameVisible = distance <= NAME_VISIBLE_RANGE;
		const npcCard = ui.billboard.FindFirstChild("NPCCard") as Frame | undefined;
		if (npcCard) {
			npcCard.Visible = nameVisible;
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

	// ── Wanted player proximity ─────────────────────────────────────────────────────
	closestWantedPlayerInRange = undefined;
	ensureWantedBillboards();

	for (const [wantedName] of wantedPlayerInfo) {
		if (wantedName === player.Name) continue;
		const wantedPlayer = Players.FindFirstChild(wantedName) as Player | undefined;
		if (!wantedPlayer || !wantedPlayer.IsA("Player") || !wantedPlayer.Character) continue;
		const hrp = wantedPlayer.Character.FindFirstChild("HumanoidRootPart") as BasePart;
		if (!hrp) continue;
		const dist = playerPosition.sub(hrp.Position).Magnitude;
		if (dist <= PROXIMITY_RANGE && dist < closestDistance) {
			closestDistance = dist;
			closestWantedPlayerInRange = wantedPlayer.Character;
			closestNPC = undefined; // wanted player takes priority
		}
	}

	// Update global closest NPC for E key handling
	closestNPCInRange = closestNPC;

	// Second pass: update assassinate buttons and talk buttons (only on closest NPC)
	for (const [npc, ui] of npcUIMap) {
		const shouldShowAssassinate = isCurrentlyStealthing && npc === closestNPC;
		const shouldShowTalk = !isCurrentlyStealthing && npc === closestNPC && !isDialogOpen();

		if (shouldShowAssassinate) {
			if (!ui.assassinateButton) {
				ui.assassinateButton = createAssassinateButton(ui.billboard, npc);
			}
		} else {
			if (ui.assassinateButton) {
				ui.assassinateButton.Destroy();
				ui.assassinateButton = undefined;
			}
		}

		if (shouldShowTalk) {
			if (!ui.talkButton) {
				ui.talkButton = createTalkButton(ui.billboard, npc);
			}
		} else {
			if (ui.talkButton) {
				ui.talkButton.Destroy();
				ui.talkButton = undefined;
			}
		}
	}

	// Third pass: show/hide assassination prompt on wanted players
	for (const [wantedName] of wantedPlayerInfo) {
		const billboard = wantedBillboards.get(wantedName);
		if (!billboard) continue;

		const wantedPlayer = Players.FindFirstChild(wantedName) as Player | undefined;
		const shouldShow =
			isCurrentlyStealthing &&
			wantedPlayer !== undefined &&
			wantedPlayer.IsA("Player") &&
			wantedPlayer.Character === closestWantedPlayerInRange;

		const existingBtn = billboard.FindFirstChild("AssassinateBtn") as TextButton | undefined;

		if (shouldShow && !existingBtn) {
			const btn = new Instance("TextButton");
			btn.Name = "AssassinateBtn";
			btn.Size = new UDim2(1, 0, 0.22, 0);
			btn.Position = new UDim2(0, 0, 0, 0);
			btn.BackgroundColor3 = UI_THEME.headerBg;
			btn.BackgroundTransparency = 0.1;
			btn.TextColor3 = UI_THEME.danger;
			btn.Font = UI_THEME.fontBold;
			btn.TextSize = 11;
			btn.Text = "[E] ASSASSINATE";
			btn.BorderSizePixel = 0;
			btn.Parent = billboard;

			const btnCorner = new Instance("UICorner");
			btnCorner.CornerRadius = new UDim(0, 4);
			btnCorner.Parent = btn;

			const btnStroke = new Instance("UIStroke");
			btnStroke.Color = UI_THEME.danger;
			btnStroke.Thickness = 0.8;
			btnStroke.Parent = btn;

			btn.MouseButton1Click.Connect(() => {
				if (wantedPlayer && wantedPlayer.IsA("Player") && wantedPlayer.Character) {
					playerAssassinationRemote.FireServer(wantedPlayer.Character);
				}
			});
		} else if (!shouldShow && existingBtn) {
			existingBtn.Destroy();
		}
	}
}

// Resolved lazily inside initializeNPCProximity once the server is ready
let playerAssassinationRemote: RemoteEvent;

function initializeNPCProximity() {
	const player = Players.LocalPlayer;
	if (!player) return;

	// Resolve now — server has created all bounty remotes by this point
	playerAssassinationRemote = getPlayerAssassinationRemote();

	// Gold billboards for all non-wanted players
	setupRegularPlayerBillboards();

	// Fetch all players' current titles, then rebuild billboards
	task.spawn(() => {
		const allTitles = getAllTitlesRemote().InvokeServer() as Record<string, string>;
		for (const [pName, tId] of pairs(allTitles)) {
			playerTitles.set(pName as string, tId as string);
		}
		for (const p of Players.GetPlayers()) {
			if (p === player) continue;
			if (p.Character && !wantedPlayerInfo.has(p.Name)) {
				createPlayerBillboard(p.Character, p.Name, playerTitles.get(p.Name));
			}
		}
	});

	// Listen for title changes broadcast from the server
	getTitleSyncRemote().OnClientEvent.Connect((pNameRaw: unknown, tIdRaw: unknown) => {
		const pName = pNameRaw as string;
		const tId = tIdRaw as string;
		playerTitles.set(pName, tId);
		if (!wantedPlayerInfo.has(pName)) {
			const targetPlayer = Players.FindFirstChild(pName) as Player | undefined;
			if (targetPlayer && targetPlayer.IsA("Player") && targetPlayer.Character) {
				createPlayerBillboard(targetPlayer.Character, pName, tId);
			}
		}
	});

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

	// ── Wanted player remote listeners ──────────────────────────────────────────
	getPlayerWantedRemote().OnClientEvent.Connect((data: unknown) => {
		handlePlayerWanted(data as PlayerWantedPayload);
	});

	getPlayerWantedClearedRemote().OnClientEvent.Connect((playerName: unknown) => {
		handlePlayerWantedCleared(playerName as string);
	});

	getBountyListSyncRemote().OnClientEvent.Connect((_npcBounty: unknown, wanted: unknown) => {
		for (const entry of (wanted ?? []) as PlayerWantedPayload[]) {
			handlePlayerWanted(entry);
		}
	});

	Players.PlayerRemoving.Connect((leavingPlayer) => {
		handlePlayerWantedCleared(leavingPlayer.Name);
	});

	// Update proximity UI every frame
	RunService.RenderStepped.Connect(() => {
		updateNPCProximityUI();
	});

	// Listen for E key to assassinate closest target (wanted player or NPC)
	UserInputService.InputBegan.Connect((input, gameProcessed) => {
		if (gameProcessed) return;

		if (input.KeyCode === Enum.KeyCode.E) {
			if (!isCurrentlyStealthing) return;
			if (closestWantedPlayerInRange) {
				log("[ASSASSINATION] Player attempting to assassinate wanted player via E key");
				playerAssassinationRemote.FireServer(closestWantedPlayerInRange);
			} else if (closestNPCInRange) {
				log(`[ASSASSINATION] Player attempting to assassinate ${closestNPCInRange.Name} via E key`);
				assassinationRemote.FireServer(closestNPCInRange);
			}
		}

		// F key — open dialog with nearest NPC (non-stealth)
		if (input.KeyCode === Enum.KeyCode.F) {
			if (isDialogOpen()) return;
			if (closestNPCInRange) {
				requestOpenDialog(closestNPCInRange);
			}
		}
	});
}

function setStealthing(stealthing: boolean) {
	isCurrentlyStealthing = stealthing;
	stealthRemote.FireServer(stealthing);
}

export { initializeNPCProximity, setStealthing };
