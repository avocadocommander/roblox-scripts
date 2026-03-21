import { ReplicatedStorage, Workspace } from "@rbxts/services";
import { log } from "shared/helpers";
import { onPlayerInitialized } from "../modules/client-init";

onPlayerInitialized(() => {
	initializeFaeRings();
});

function configureFaeParticles(emitter: ParticleEmitter): void {
	// ── Lifecycle ──────────────────────────────────────────────────────────
	emitter.Lifetime = new NumberRange(4, 8);
	emitter.Rate = 5;
	emitter.Speed = new NumberRange(0.2, 0.6);
	emitter.SpreadAngle = new Vector2(360, 360);

	// ── Size: gentle swell then fade ──────────────────────────────────────
	emitter.Size = new NumberSequence([
		new NumberSequenceKeypoint(0, 0),
		new NumberSequenceKeypoint(0.2, 0.15),
		new NumberSequenceKeypoint(0.5, 0.2),
		new NumberSequenceKeypoint(0.8, 0.12),
		new NumberSequenceKeypoint(1, 0),
	]);

	// ── Transparency: fade in softly, linger, vanish ──────────────────────
	emitter.Transparency = new NumberSequence([
		new NumberSequenceKeypoint(0, 1),
		new NumberSequenceKeypoint(0.15, 0.4),
		new NumberSequenceKeypoint(0.5, 0.2),
		new NumberSequenceKeypoint(0.85, 0.5),
		new NumberSequenceKeypoint(1, 1),
	]);

	// ── Colour: moonlit fae palette — soft gold -> pale green -> cool lilac
	emitter.Color = new ColorSequence([
		new ColorSequenceKeypoint(0, Color3.fromRGB(255, 230, 140)),
		new ColorSequenceKeypoint(0.3, Color3.fromRGB(180, 255, 180)),
		new ColorSequenceKeypoint(0.6, Color3.fromRGB(160, 200, 255)),
		new ColorSequenceKeypoint(1, Color3.fromRGB(200, 160, 255)),
	]);

	// ── Light & glow ──────────────────────────────────────────────────────
	emitter.LightEmission = 1;
	emitter.LightInfluence = 0;
	emitter.Brightness = 2;

	// ── Movement: slow lazy drift ─────────────────────────────────────────
	emitter.Rotation = new NumberRange(-180, 180);
	emitter.RotSpeed = new NumberRange(-20, 20);
	emitter.Drag = 1.5;
	emitter.Acceleration = new Vector3(0, 0.05, 0);

	// ── Shape ─────────────────────────────────────────────────────────────
	emitter.EmissionDirection = Enum.NormalId.Top;
	emitter.Shape = Enum.ParticleEmitterShape.Sphere;
	emitter.ShapeInOut = Enum.ParticleEmitterShapeInOut.Outward;
	emitter.ShapeStyle = Enum.ParticleEmitterShapeStyle.Surface;

	emitter.Squash = new NumberSequence([
		new NumberSequenceKeypoint(0, 0),
		new NumberSequenceKeypoint(0.5, 0.3),
		new NumberSequenceKeypoint(1, 0),
	]);

	// ── Texture ───────────────────────────────────────────────────────────
	emitter.Texture = "rbxasset://textures/particles/sparkles_main.dds";
	emitter.ZOffset = 0.5;
}

function initializeFaeRings(): void {
	const template = ReplicatedStorage.FindFirstChild("Fae Ring");
	if (!template) {
		log("[FAE-RING] Fae Ring not found in ReplicatedStorage");
		return;
	}

	// Find all placed Fae Ring markers in the workspace (tagged or named)
	const placed = Workspace.GetDescendants().filter((inst) => inst.Name === "Fae Ring");

	if (placed.size() === 0) {
		log("[FAE-RING] No Fae Ring placements found in Workspace");
		return;
	}

	for (const marker of placed) {
		const attachment = marker.FindFirstChild("Flying") as Attachment | undefined;
		if (!attachment) continue;

		const emitter = attachment.FindFirstChildOfClass("ParticleEmitter");
		if (!emitter) continue;

		configureFaeParticles(emitter);
		emitter.Enabled = true;
		log("[FAE-RING] Configured fae particles at " + marker.GetFullName());
	}

	log("[FAE-RING] Initialized " + placed.size() + " Fae Ring(s)");
}
