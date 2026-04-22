/**
 * tutorial-ui-pulse — pulses on-screen UI elements for the active
 * onboarding step.
 *
 * Drives attention toward UI interactions that cannot be represented
 * by a world-space Highlight. Currently supports:
 *   - "equipDagger" — pulses the mobile-hud InventoryButton AND the
 *                     Item_dagger tile inside the inventory grid.
 *
 * Target instances are discovered by Name via PlayerGui descendant
 * scanning + DescendantAdded, so it's resilient to UI being built
 * after this module initialises and to tiles being rebuilt on
 * inventory sync.
 *
 * Implementation: parents a dedicated UIStroke named "TutorialPulseStroke"
 * on each target. Does NOT touch the element's own stroke. Removed
 * automatically when the active step no longer pulses that target.
 */

import { Players, RunService } from "@rbxts/services";
import { getCurrentOnboardingStep, onBoardStateChanged } from "./board-state";
import { log } from "shared/helpers";

const PULSE_STROKE_NAME = "TutorialPulseStroke";
const PULSE_COLOR = Color3.fromRGB(245, 210, 80);
const PULSE_THICK_MIN = 2;
const PULSE_THICK_MAX = 5;
const PULSE_PERIOD = 0.9; // seconds

/** Names of GuiObjects that should pulse for the given step type. */
function getPulseTargetNames(): string[] {
	const step = getCurrentOnboardingStep();
	if (!step || step.uiPulseTarget === undefined) return [];
	if (step.uiPulseTarget === "equipDagger") {
		return ["InventoryButton", "Item_dagger"];
	}
	return [];
}

// ── State ───────────────────────────────────────────────────────────────────

const activeStrokes = new Map<GuiObject, UIStroke>();
let heartbeatConn: RBXScriptConnection | undefined;
let descendantConn: RBXScriptConnection | undefined;
let descendantRemovingConn: RBXScriptConnection | undefined;

// ── Stroke management ───────────────────────────────────────────────────────

function applyPulseStroke(target: GuiObject): void {
	if (activeStrokes.has(target)) return;
	// Remove any stale pulse stroke from a previous session.
	const existing = target.FindFirstChild(PULSE_STROKE_NAME);
	if (existing) existing.Destroy();

	const stroke = new Instance("UIStroke");
	stroke.Name = PULSE_STROKE_NAME;
	stroke.Color = PULSE_COLOR;
	stroke.Thickness = PULSE_THICK_MIN;
	stroke.Transparency = 0;
	stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border;
	stroke.Parent = target;
	activeStrokes.set(target, stroke);
}

function removePulseStroke(target: GuiObject): void {
	const stroke = activeStrokes.get(target);
	if (stroke) stroke.Destroy();
	activeStrokes.delete(target);
}

function clearAllStrokes(): void {
	for (const [target] of activeStrokes) removePulseStroke(target);
}

// ── Target discovery ────────────────────────────────────────────────────────

function matchesAny(name: string, targets: string[]): boolean {
	for (const t of targets) if (t === name) return true;
	return false;
}

function getPlayerGui(): PlayerGui | undefined {
	const player = Players.LocalPlayer;
	return player ? (player.FindFirstChildOfClass("PlayerGui") as PlayerGui | undefined) : undefined;
}

function scanAndAttach(targets: string[]): void {
	const gui = getPlayerGui();
	if (!gui) return;
	for (const descendant of gui.GetDescendants()) {
		if (!descendant.IsA("GuiObject")) continue;
		if (!matchesAny(descendant.Name, targets)) continue;
		applyPulseStroke(descendant);
	}
}

// ── Main refresh ────────────────────────────────────────────────────────────

function refresh(): void {
	const targets = getPulseTargetNames();
	if (targets.size() === 0) {
		stopHeartbeat();
		clearAllStrokes();
		return;
	}

	// Prune strokes on instances that no longer match.
	for (const [target] of activeStrokes) {
		if (!target.IsDescendantOf(game) || !matchesAny(target.Name, targets)) {
			removePulseStroke(target);
		}
	}

	scanAndAttach(targets);
	startHeartbeat();
}

// ── Animation loop ──────────────────────────────────────────────────────────

function startHeartbeat(): void {
	if (heartbeatConn) return;
	let t = 0;
	heartbeatConn = RunService.Heartbeat.Connect((dt) => {
		t += dt;
		const phase = (t % PULSE_PERIOD) / PULSE_PERIOD;
		const sinVal = math.sin(phase * math.pi * 2) * 0.5 + 0.5; // 0..1
		const thickness = PULSE_THICK_MIN + (PULSE_THICK_MAX - PULSE_THICK_MIN) * sinVal;
		const transparency = 0.15 + 0.4 * (1 - sinVal);
		for (const [, stroke] of activeStrokes) {
			stroke.Thickness = thickness;
			stroke.Transparency = transparency;
		}
	});
}

function stopHeartbeat(): void {
	if (heartbeatConn) {
		heartbeatConn.Disconnect();
		heartbeatConn = undefined;
	}
}

// ── Init ────────────────────────────────────────────────────────────────────

let initialized = false;

export function initializeTutorialUIPulse(): void {
	if (initialized) return;
	initialized = true;

	onBoardStateChanged(refresh);

	const gui = getPlayerGui();
	if (gui) {
		descendantConn = gui.DescendantAdded.Connect((inst) => {
			if (!inst.IsA("GuiObject")) return;
			const targets = getPulseTargetNames();
			if (targets.size() === 0) return;
			if (matchesAny(inst.Name, targets)) applyPulseStroke(inst);
		});
		descendantRemovingConn = gui.DescendantRemoving.Connect((inst) => {
			if (!inst.IsA("GuiObject")) return;
			if (activeStrokes.has(inst)) {
				activeStrokes.delete(inst); // Roblox will destroy stroke with parent
			}
		});
	}

	refresh();
	log("[TUTORIAL-UI-PULSE] initialized");
}
