/**
 * tutorial-direction-arrow - screen-space pointer for the active tutorial target.
 *
 * Uses the same target semantics as tutorial-highlight, but renders a compact
 * arrow at the screen edge so players can orient toward Thorne or their mark.
 */

import { Players, RunService, Workspace } from "@rbxts/services";
import { FACTIONS } from "shared/config/factions";
import { log } from "shared/helpers";
import {
	getBountyAssignedRemote,
	getBountyCompletedRemote,
	getBountyListSyncRemote,
	getMyNPCBountyRemote,
	NPCBountyPayload,
} from "shared/remotes/bounty-remote";
import { getCurrentOnboardingStep, onBoardStateChanged } from "./board-state";

const ARROW_NAME = "TutorialDirectionArrow";
const EDGE_MARGIN = 58;
const TARGET_OFFSET = new Vector3(0, 3, 0);

let arrowLabel: TextLabel | undefined;
let currentBountyName: string | undefined;
let pendingBountyFetch = false;
let initialized = false;

function getScreenGui(): ScreenGui | undefined {
	const playerGui = Players.LocalPlayer.FindFirstChildOfClass("PlayerGui");
	return playerGui?.FindFirstChild("ScreenGui") as ScreenGui | undefined;
}

function ensureArrow(): TextLabel | undefined {
	if (arrowLabel && arrowLabel.Parent !== undefined) return arrowLabel;
	const screenGui = getScreenGui();
	if (!screenGui) return undefined;

	const label = new Instance("TextLabel");
	label.Name = ARROW_NAME;
	label.Size = new UDim2(0, 46, 0, 46);
	label.AnchorPoint = new Vector2(0.5, 0.5);
	label.BackgroundColor3 = Color3.fromRGB(10, 8, 12);
	label.BackgroundTransparency = 0.35;
	label.BorderSizePixel = 0;
	label.Text = ">";
	label.TextColor3 = Color3.fromRGB(245, 210, 80);
	label.Font = Enum.Font.GothamBlack;
	label.TextSize = 34;
	label.Visible = false;
	label.ZIndex = 80;
	label.Parent = screenGui;

	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(1, 0);
	corner.Parent = label;

	const stroke = new Instance("UIStroke");
	stroke.Name = "Stroke";
	stroke.Color = Color3.fromRGB(255, 235, 140);
	stroke.Thickness = 2;
	stroke.Transparency = 0.1;
	stroke.Parent = label;

	arrowLabel = label;
	return label;
}

function fetchBountyFromServer(): void {
	if (pendingBountyFetch) return;
	pendingBountyFetch = true;
	task.spawn(() => {
		const [ok, result] = pcall(() => getMyNPCBountyRemote().InvokeServer());
		pendingBountyFetch = false;
		if (!ok) {
			log("[TUTORIAL-ARROW] GetMyNPCBounty invoke failed: " + tostring(result));
			return;
		}
		const payload = result as NPCBountyPayload | undefined;
		currentBountyName = payload?.npcName;
	});
}

function getTargetName(): string | undefined {
	const step = getCurrentOnboardingStep();
	if (!step || step.highlightType === undefined) return undefined;
	if (step.highlightType === "nightGuildLeader") return FACTIONS.Night.leaderNPC;
	if (step.highlightType === "dawnGuildLeader") return FACTIONS.Dawn.leaderNPC;
	if (step.highlightType === "bountyTarget") {
		if (currentBountyName === undefined || currentBountyName === "") fetchBountyFromServer();
		return currentBountyName;
	}
	return undefined;
}

function findTargetModel(targetName: string): Model | undefined {
	for (const descendant of Workspace.GetDescendants()) {
		if (!descendant.IsA("Model")) continue;
		if (descendant.Name !== targetName) continue;
		if (Players.GetPlayerFromCharacter(descendant) !== undefined) continue;
		return descendant;
	}
	return undefined;
}

function getTargetPosition(model: Model): Vector3 {
	const part = model.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
	return (part ? part.Position : model.GetPivot().Position).add(TARGET_OFFSET);
}

function hideArrow(): void {
	if (arrowLabel) arrowLabel.Visible = false;
}

function updateArrow(): void {
	const label = ensureArrow();
	const camera = Workspace.CurrentCamera;
	const targetName = getTargetName();
	if (!label || !camera || targetName === undefined) {
		hideArrow();
		return;
	}

	const target = findTargetModel(targetName);
	if (!target) {
		hideArrow();
		return;
	}

	const viewport = camera.ViewportSize;
	const center = new Vector2(viewport.X / 2, viewport.Y / 2);
	const [screenPos] = camera.WorldToViewportPoint(getTargetPosition(target));
	let delta = new Vector2(screenPos.X - center.X, screenPos.Y - center.Y);
	if (screenPos.Z < 0) delta = delta.mul(-1);
	if (delta.Magnitude < 1) {
		hideArrow();
		return;
	}

	const unit = delta.Unit;
	const maxX = viewport.X / 2 - EDGE_MARGIN;
	const maxY = viewport.Y / 2 - EDGE_MARGIN;
	const scale = math.min(maxX / math.abs(unit.X === 0 ? 0.001 : unit.X), maxY / math.abs(unit.Y === 0 ? 0.001 : unit.Y));
	const pos = center.add(unit.mul(scale));
	const step = getCurrentOnboardingStep();
	const isBountyTarget = step?.highlightType === "bountyTarget";

	label.Position = UDim2.fromOffset(pos.X, pos.Y);
	label.Rotation = math.deg(math.atan2(unit.Y, unit.X));
	label.TextColor3 = isBountyTarget ? Color3.fromRGB(255, 0, 0) : Color3.fromRGB(245, 210, 80);
	const stroke = label.FindFirstChild("Stroke") as UIStroke | undefined;
	if (stroke) stroke.Color = isBountyTarget ? Color3.fromRGB(255, 235, 235) : Color3.fromRGB(255, 235, 140);
	label.Visible = true;
}

function setCurrentBounty(payload: NPCBountyPayload | undefined): void {
	currentBountyName = payload?.npcName;
	updateArrow();
}

export function initializeTutorialDirectionArrow(): void {
	if (initialized) return;
	initialized = true;

	onBoardStateChanged(updateArrow);
	getBountyAssignedRemote().OnClientEvent.Connect((payload: unknown) => setCurrentBounty(payload as NPCBountyPayload));
	getBountyCompletedRemote().OnClientEvent.Connect(() => setCurrentBounty(undefined));
	getBountyListSyncRemote().OnClientEvent.Connect((npcBounty: unknown) => {
		setCurrentBounty(npcBounty as NPCBountyPayload | undefined);
	});

	RunService.Heartbeat.Connect(updateArrow);
	fetchBountyFromServer();
	log("[TUTORIAL-ARROW] initialized");
}
