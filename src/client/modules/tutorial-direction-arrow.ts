/**
 * tutorial-direction-arrow - screen-space pointer for the active tutorial target.
 *
 * Uses the same target semantics as tutorial-highlight, but renders a classic
 * screen-space arrow path so players can orient toward Thorne or their mark.
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
import { UI_THEME } from "shared/ui-theme";
import { getCurrentOnboardingStep, onBoardStateChanged } from "./board-state";

const ARROW_NAME = "TutorialDirectionArrow";
const ARROW_COUNT = 7;
const PATH_START_DISTANCE = 88;
const PATH_END_MARGIN = 64;
const PATH_PULSE_SECONDS = 0.9;
const TARGET_OFFSET = new Vector3(0, 3, 0);

let arrowLabels = new Array<TextLabel>();
let currentBountyName: string | undefined;
let pendingBountyFetch = false;
let initialized = false;

function getScreenGui(): ScreenGui | undefined {
	const playerGui = Players.LocalPlayer.FindFirstChildOfClass("PlayerGui");
	return playerGui?.FindFirstChild("ScreenGui") as ScreenGui | undefined;
}

function ensureArrowPath(): TextLabel[] | undefined {
	if (arrowLabels.size() === ARROW_COUNT && arrowLabels.every((label) => label.Parent !== undefined)) {
		return arrowLabels;
	}

	const screenGui = getScreenGui();
	if (!screenGui) return undefined;

	for (const label of arrowLabels) {
		if (label.Parent !== undefined) label.Destroy();
	}

	arrowLabels = new Array<TextLabel>();

	for (let i = 0; i < ARROW_COUNT; i++) {
		const label = new Instance("TextLabel");
		label.Name = `${ARROW_NAME}${i + 1}`;
		label.Size = new UDim2(0, 38, 0, 38);
		label.AnchorPoint = new Vector2(0.5, 0.5);
		label.BackgroundColor3 = UI_THEME.bg;
		label.BackgroundTransparency = 0.62;
		label.BorderSizePixel = 0;
		label.Text = ">";
		label.TextColor3 = UI_THEME.gold;
		label.Font = Enum.Font.GothamBlack;
		label.TextSize = 30;
		label.TextStrokeColor3 = UI_THEME.headerBg;
		label.TextStrokeTransparency = 0.18;
		label.Visible = false;
		label.ZIndex = 80;
		label.Parent = screenGui;

		const corner = new Instance("UICorner");
		corner.CornerRadius = new UDim(1, 0);
		corner.Parent = label;

		const stroke = new Instance("UIStroke");
		stroke.Name = "Stroke";
		stroke.Color = UI_THEME.border;
		stroke.Thickness = 1.5;
		stroke.Transparency = 0.2;
		stroke.Parent = label;

		arrowLabels.push(label);
	}

	return arrowLabels;
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

function hideArrowPath(): void {
	for (const label of arrowLabels) label.Visible = false;
}

function updateArrow(): void {
	const labels = ensureArrowPath();
	const camera = Workspace.CurrentCamera;
	const targetName = getTargetName();
	if (!labels || !camera || targetName === undefined) {
		hideArrowPath();
		return;
	}

	const target = findTargetModel(targetName);
	if (!target) {
		hideArrowPath();
		return;
	}

	const viewport = camera.ViewportSize;
	const center = new Vector2(viewport.X / 2, viewport.Y / 2);
	const [screenPos] = camera.WorldToViewportPoint(getTargetPosition(target));
	let delta = new Vector2(screenPos.X - center.X, screenPos.Y - center.Y);
	if (screenPos.Z < 0) delta = delta.mul(-1);
	if (delta.Magnitude < 1) {
		hideArrowPath();
		return;
	}

	const unit = delta.Unit;
	const maxX = viewport.X / 2 - PATH_END_MARGIN;
	const maxY = viewport.Y / 2 - PATH_END_MARGIN;
	const edgeDistance = math.min(
		maxX / math.abs(unit.X === 0 ? 0.001 : unit.X),
		maxY / math.abs(unit.Y === 0 ? 0.001 : unit.Y),
	);
	const targetDistance = screenPos.Z > 0 ? math.min(delta.Magnitude, edgeDistance) : edgeDistance;
	const startDistance = math.min(PATH_START_DISTANCE, targetDistance * 0.45);
	const pathDistance = math.max(targetDistance - startDistance, 1);
	const pulseHead = (os.clock() % PATH_PULSE_SECONDS) / PATH_PULSE_SECONDS;
	const step = getCurrentOnboardingStep();
	const isBountyTarget = step?.highlightType === "bountyTarget";
	const arrowColor = isBountyTarget ? UI_THEME.danger : UI_THEME.gold;
	const strokeColor = isBountyTarget ? Color3.fromRGB(96, 24, 18) : UI_THEME.border;
	const rotation = math.deg(math.atan2(unit.Y, unit.X));

	for (let i = 0; i < labels.size(); i++) {
		const label = labels[i];
		const alpha = labels.size() === 1 ? 1 : i / (labels.size() - 1);
		const pulseDistance = math.abs(alpha - pulseHead);
		const wrappedPulseDistance = math.min(pulseDistance, 1 - pulseDistance);
		const pulse = math.clamp(1 - wrappedPulseDistance * 4, 0, 1);
		const pos = center.add(unit.mul(startDistance + pathDistance * alpha));

		label.Position = UDim2.fromOffset(pos.X, pos.Y);
		label.Rotation = rotation;
		label.TextColor3 = arrowColor;
		label.TextTransparency = 0.35 - pulse * 0.25;
		label.TextStrokeTransparency = 0.45 - pulse * 0.25;
		label.BackgroundTransparency = 0.78 - pulse * 0.16;
		label.Visible = true;

		const stroke = label.FindFirstChild("Stroke") as UIStroke | undefined;
		if (stroke) {
			stroke.Color = strokeColor;
			stroke.Transparency = 0.48 - pulse * 0.22;
		}
	}
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
