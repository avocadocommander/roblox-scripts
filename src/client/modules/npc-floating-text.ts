/**
 * NPC Floating Text — ambient speech bubbles that drift with physics.
 *
 * Short messages (guard grunts, commoner quips) appear as 3D BillboardGuis
 * attached to a Part near the NPC's head. The Part is given a random velocity
 * and the text drifts organically while fading out — like ambient world text,
 * not a traditional chat bubble.
 */

import { Workspace, TweenService, RunService } from "@rbxts/services";
import { UI_THEME } from "shared/ui-theme";

// ── Config ────────────────────────────────────────────────────────────────────

const FLOAT_LIFETIME = 3.0; // seconds before fully gone
const FADE_START = 1.4; // seconds before fade begins
const DRIFT_SPEED = 0.6; // base upward studs/sec
const SWAY_AMPLITUDE = 0.4; // horizontal sway in studs
const SWAY_FREQUENCY = 1.8; // oscillations per second
const FONT_SIZE = 14;
const MAX_SIMULTANEOUS = 3; // per NPC, avoid spam stacking

// Track active floaters per NPC to cap spam
const activeFloaters = new Map<string, number>(); // npcName -> count

/**
 * Spawn a short floating text near an NPC's head that drifts upward
 * with sine-wave horizontal sway, then fades and self-destructs.
 */
export function spawnFloatingText(npcName: string, message: string): void {
	const npcModel = Workspace.FindFirstChild(npcName) as Model | undefined;
	if (!npcModel) return;

	const head = npcModel.FindFirstChild("Head") as BasePart | undefined;
	if (!head) return;

	// Cap simultaneous floaters per NPC
	const currentCount = activeFloaters.get(npcName) ?? 0;
	if (currentCount >= MAX_SIMULTANEOUS) return;
	activeFloaters.set(npcName, currentCount + 1);

	// Randomised spawn offset so multiple texts don't stack perfectly
	const offsetX = (math.random() - 0.5) * 2.0;
	const offsetZ = (math.random() - 0.5) * 1.5;
	const startOffset = new Vector3(offsetX, 2.5, offsetZ);
	const startPos = head.Position.add(startOffset);

	// Anchor part — unanchored but with no collision, driven per-frame
	const anchor = new Instance("Part");
	anchor.Name = "FloatTextAnchor";
	anchor.Size = new Vector3(0.05, 0.05, 0.05);
	anchor.Position = startPos;
	anchor.Anchored = true;
	anchor.CanCollide = false;
	anchor.CanQuery = false;
	anchor.CanTouch = false;
	anchor.Transparency = 1;
	anchor.Parent = Workspace;

	// Billboard
	const billboard = new Instance("BillboardGui");
	billboard.Name = "FloatingNPCText";
	billboard.Size = new UDim2(6, 0, 1, 0);
	billboard.StudsOffset = new Vector3(0, 0, 0);
	billboard.AlwaysOnTop = false;
	billboard.MaxDistance = 40;
	billboard.Adornee = anchor;
	billboard.Parent = anchor;

	// Text label — italic, slightly transparent, organic feel
	const label = new Instance("TextLabel");
	label.Size = new UDim2(1, 0, 1, 0);
	label.BackgroundTransparency = 1;
	label.Text = message;
	label.TextColor3 = UI_THEME.textPrimary;
	label.Font = Enum.Font.Antique;
	label.TextSize = FONT_SIZE;
	label.TextTransparency = 0.15;
	label.TextStrokeColor3 = Color3.fromRGB(10, 8, 6);
	label.TextStrokeTransparency = 0.4;
	label.TextWrapped = false;
	label.TextScaled = false;
	label.Parent = billboard;

	// Physics-like drift — driven by RenderStepped for smooth motion
	const birthTime = tick();
	const phaseOffset = math.random() * math.pi * 2; // randomise sway phase
	const driftAngle = math.random() * math.pi * 2; // random horizontal drift direction
	const driftDirX = math.cos(driftAngle) * 0.15; // slight lateral drift
	const driftDirZ = math.sin(driftAngle) * 0.15;

	const connection = RunService.RenderStepped.Connect((dt: number) => {
		const elapsed = tick() - birthTime;

		if (elapsed >= FLOAT_LIFETIME) {
			connection.Disconnect();
			anchor.Destroy();
			const count = activeFloaters.get(npcName) ?? 1;
			activeFloaters.set(npcName, math.max(0, count - 1));
			return;
		}

		// Vertical rise — slight deceleration over time
		const riseSpeed = DRIFT_SPEED * (1 - elapsed / FLOAT_LIFETIME * 0.4);
		const newY = anchor.Position.Y + riseSpeed * dt;

		// Horizontal sine sway
		const swayX = math.sin((elapsed * SWAY_FREQUENCY + phaseOffset) * math.pi * 2) * SWAY_AMPLITUDE;

		// Gradual lateral drift
		const lateralX = anchor.Position.X + driftDirX * dt;
		const lateralZ = anchor.Position.Z + driftDirZ * dt;

		anchor.Position = new Vector3(lateralX + swayX * dt, newY, lateralZ);

		// Fade — starts after FADE_START seconds
		if (elapsed > FADE_START) {
			const fadeProgress = (elapsed - FADE_START) / (FLOAT_LIFETIME - FADE_START);
			const transparency = 0.15 + fadeProgress * 0.85;
			const strokeTransparency = 0.4 + fadeProgress * 0.6;
			label.TextTransparency = transparency;
			label.TextStrokeTransparency = strokeTransparency;
		}
	});
}
