/**
 * Player Quip Display — floating text over the local player's head.
 *
 * Works like NPC floating text but:
 *   - Only visible to the local player (BillboardGui on PlayerGui)
 *   - Adornee is the player's own Head
 *   - Rate-limited to avoid spam
 */

import { Players, RunService } from "@rbxts/services";
import { UI_THEME, scaleUI } from "shared/ui-theme";
import { PLAYER_QUIPS, QuipCategory } from "shared/config/player-quips";

// ── Config ────────────────────────────────────────────────────────────────────

const FLOAT_LIFETIME = 2.5;
const FADE_START = 1.2;
const DRIFT_SPEED = 0.5;
const SWAY_AMPLITUDE = 0.3;
const SWAY_FREQUENCY = 1.6;
const FONT_SIZE = scaleUI(20);
const COOLDOWN = 1.5; // seconds between quips

// ── State ─────────────────────────────────────────────────────────────────────

let lastQuipTime = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickRandom(lines: string[]): string {
	return lines[math.random(0, lines.size() - 1)];
}

function getLocalHead(): BasePart | undefined {
	const character = Players.LocalPlayer.Character;
	if (!character) return undefined;
	return character.FindFirstChild("Head") as BasePart | undefined;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Show a random quip from the given category floating above the player's head.
 * Rate-limited — repeated calls within the cooldown are silently ignored.
 */
export function showPlayerQuip(category: QuipCategory): void {
	const now = tick();
	if (now - lastQuipTime < COOLDOWN) return;

	const lines = PLAYER_QUIPS[category];
	if (!lines || lines.size() === 0) return;

	const head = getLocalHead();
	if (!head) return;

	lastQuipTime = now;
	spawnQuipText(head, pickRandom(lines));
}

/**
 * Show an arbitrary string as a player quip (for one-off messages).
 */
export function showPlayerQuipRaw(message: string): void {
	const now = tick();
	if (now - lastQuipTime < COOLDOWN) return;

	const head = getLocalHead();
	if (!head) return;

	lastQuipTime = now;
	spawnQuipText(head, message);
}

// ── Renderer ──────────────────────────────────────────────────────────────────

function spawnQuipText(head: BasePart, message: string): void {
	const playerGui = Players.LocalPlayer.FindFirstChildOfClass("PlayerGui");
	if (!playerGui) return;

	// Billboard parented to PlayerGui so only the local player sees it
	const billboard = new Instance("BillboardGui");
	billboard.Name = "PlayerQuip";
	billboard.Size = new UDim2(8, 0, 1.2, 0);
	billboard.StudsOffset = new Vector3(0, 2.5, 0);
	billboard.AlwaysOnTop = false;
	billboard.MaxDistance = 50;
	billboard.Adornee = head;
	billboard.Parent = playerGui;

	const label = new Instance("TextLabel");
	label.Size = new UDim2(1, 0, 1, 0);
	label.BackgroundTransparency = 1;
	label.Text = message;
	label.TextColor3 = UI_THEME.textPrimary;
	label.Font = Enum.Font.Antique;
	label.TextSize = FONT_SIZE;
	label.TextTransparency = 0.1;
	label.TextStrokeColor3 = Color3.fromRGB(10, 8, 6);
	label.TextStrokeTransparency = 0.35;
	label.TextWrapped = false;
	label.TextScaled = false;
	label.Parent = billboard;

	// Drift animation
	const birthTime = tick();
	const phaseOffset = math.random() * math.pi * 2;
	let currentOffset = new Vector3(0, 2.5, 0);

	const connection = RunService.RenderStepped.Connect((dt: number) => {
		const elapsed = tick() - birthTime;

		if (elapsed >= FLOAT_LIFETIME) {
			connection.Disconnect();
			billboard.Destroy();
			return;
		}

		// Rise
		const rise = DRIFT_SPEED * (1 - (elapsed / FLOAT_LIFETIME) * 0.4) * dt;
		const swayX = math.sin((elapsed * SWAY_FREQUENCY + phaseOffset) * math.pi * 2) * SWAY_AMPLITUDE * dt;

		currentOffset = currentOffset.add(new Vector3(swayX, rise, 0));
		billboard.StudsOffset = currentOffset;

		// Fade
		if (elapsed > FADE_START) {
			const fadeProgress = (elapsed - FADE_START) / (FLOAT_LIFETIME - FADE_START);
			const transparency = 0.1 + fadeProgress * 0.9;
			const strokeTransparency = 0.35 + fadeProgress * 0.65;
			label.TextTransparency = transparency;
			label.TextStrokeTransparency = strokeTransparency;
		}
	});
}
