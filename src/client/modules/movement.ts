import { Players, UserInputService, Workspace } from "@rbxts/services";
import { getOrCreateMovementRemote } from "shared/remotes/movement-remote";
import { log } from "shared/helpers";
import { getEffectSyncRemote, EffectSyncPayload } from "shared/remotes/effect-remote";
import { ELIXIRS } from "shared/config/elixirs";

const movementRemote = getOrCreateMovementRemote();
const players = Players.LocalPlayer;

// Movement state tracking
let hasAirJump = true;
const lastJumpTime = 0;
let isRunning = false;
const isStealthMode = false;

// Speed boost state
const BASE_WALK_SPEED = 16;
const DEFAULT_SPEED_MULTIPLIER = 1.2;
let speedBoostActive = false;

// Slow-fall state
let slowFallActive = false;
let slowFallForce: BodyForce | undefined;
const DEFAULT_GRAVITY_REDUCTION = 0.65;

// Invisibility state
let invisibilityActive = false;
let invisibilityBurstRunning = false;

// Current active elixir def — used to read tier-specific params
let activeElixirDef: import("shared/config/elixirs").ElixirDef | undefined;

function setupMovementInput() {
	const character = players?.Character;
	if (!character) return;

	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (!humanoid) return;

	// Reset air jump when player touches ground
	humanoid.StateChanged.Connect((oldState, newState) => {
		if (newState === Enum.HumanoidStateType.Running || newState === Enum.HumanoidStateType.Landed) {
			hasAirJump = true;
		}
	});

	// [DISABLED] Keyboard hotkeys disabled — all interaction via mobile HUD
	// Shift (sprint), Q (stealth), Space (double jump), Shift release handled by mobile HUD
}

function initializeMovementSystem() {
	const player = Players.LocalPlayer;
	if (!player) return;

	log("[MOVEMENT] Initializing movement system");

	// Setup for initial character
	if (player.Character) {
		setupMovementInput();
	}

	// Re-setup every time character respawns
	player.CharacterAdded.Connect(() => {
		hasAirJump = true;
		isRunning = false;
		setupMovementInput();
		// Re-apply persistent effects after respawn
		if (speedBoostActive) {
			applySpeedBoost(true);
		}
		if (slowFallActive) {
			applySlowFall(true);
		}
	});

	// Listen for effect sync to apply/remove elixir effects
	const effectSyncRemote = getEffectSyncRemote();
	effectSyncRemote.OnClientEvent.Connect((data: unknown) => {
		const payload = data as EffectSyncPayload;
		const elixirId = payload.activeElixirId;
		const elixirDef = elixirId !== undefined ? ELIXIRS[elixirId] : undefined;
		const elixirAlive = elixirDef !== undefined && payload.elixirRemainingSecs > 0;

		// Store the active def so effect functions can read tier-specific params
		activeElixirDef = elixirAlive ? elixirDef : undefined;

		// ── Speed Boost ──────────────────────────────────────────────
		const hasSpeed = elixirAlive && elixirDef!.elixirEffect === "speed_boost";
		if (hasSpeed && !speedBoostActive) {
			speedBoostActive = true;
			applySpeedBoost(true);
			log("[MOVEMENT] Speed boost activated");
		} else if (!hasSpeed && speedBoostActive) {
			speedBoostActive = false;
			applySpeedBoost(false);
			log("[MOVEMENT] Speed boost expired");
		}

		// ── Slow Fall ────────────────────────────────────────────────
		const hasSlowFall = elixirAlive && elixirDef!.elixirEffect === "slow_fall";
		if (hasSlowFall && !slowFallActive) {
			slowFallActive = true;
			applySlowFall(true);
			log("[MOVEMENT] Slow fall activated");
		} else if (!hasSlowFall && slowFallActive) {
			slowFallActive = false;
			applySlowFall(false);
			log("[MOVEMENT] Slow fall expired");
		}

		// ── Invisibility (one-shot 5s burst on first sync) ───────────
		const hasInvis = elixirAlive && elixirDef!.elixirEffect === "invisibility";
		if (hasInvis && !invisibilityActive) {
			invisibilityActive = true;
			task.spawn(() => triggerInvisibilityBurst());
			log("[MOVEMENT] Invisibility burst triggered");
		} else if (!hasInvis && invisibilityActive) {
			invisibilityActive = false;
			log("[MOVEMENT] Invisibility elixir expired");
		}
	});
}

function applySpeedBoost(active: boolean): void {
	const character = Players.LocalPlayer?.Character;
	if (!character) return;
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (!humanoid) return;
	const mult = activeElixirDef?.speedMultiplier ?? DEFAULT_SPEED_MULTIPLIER;
	humanoid.WalkSpeed = active ? BASE_WALK_SPEED * mult : BASE_WALK_SPEED;
}

/**
 * Slow-fall: attach a BodyForce to HumanoidRootPart that counteracts most
 * of gravity, giving the player a floaty, feather-like descent.
 */
function applySlowFall(active: boolean): void {
	const character = Players.LocalPlayer?.Character;
	if (!character) return;
	const rootPart = character.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
	if (!rootPart) return;

	if (active) {
		// Remove any stale force first
		if (slowFallForce && slowFallForce.Parent) slowFallForce.Destroy();
		const bf = new Instance("BodyForce");
		bf.Name = "SlowFallForce";
		// Workspace.Gravity defaults to 196.2; counteract a tier-specific fraction
		const mass = rootPart.AssemblyMass;
		const reduction = activeElixirDef?.gravityReduction ?? DEFAULT_GRAVITY_REDUCTION;
		bf.Force = new Vector3(0, mass * Workspace.Gravity * reduction, 0);
		bf.Parent = rootPart;
		slowFallForce = bf;
	} else {
		if (slowFallForce && slowFallForce.Parent) {
			slowFallForce.Destroy();
		}
		slowFallForce = undefined;
	}
}

/**
 * Invisibility: 5-second burst of full transparency on character, then
 * restore. Only triggers once per activation (won't re-fire on every
 * EffectSync tick).
 */
function triggerInvisibilityBurst(): void {
	if (invisibilityBurstRunning) return;
	invisibilityBurstRunning = true;

	const character = Players.LocalPlayer?.Character;
	if (!character) {
		invisibilityBurstRunning = false;
		return;
	}

	// Store original transparency values
	const originals = new Map<BasePart, number>();
	character.GetDescendants().forEach((d) => {
		if (d.IsA("BasePart")) {
			const part = d as BasePart;
			originals.set(part, part.Transparency);
			part.Transparency = 1;
		}
	});

	// Also hide any face decals / surface guis
	character.GetDescendants().forEach((d) => {
		if (d.IsA("Decal") || d.IsA("Texture")) {
			(d as Decal).Transparency = 1;
		}
	});

	const burstSecs = activeElixirDef?.burstDurationSecs ?? 5;
	task.wait(burstSecs);

	// Restore original transparency
	if (Players.LocalPlayer?.Character === character) {
		originals.forEach((orig, part) => {
			if (part.Parent) part.Transparency = orig;
		});
		character.GetDescendants().forEach((d) => {
			if (d.IsA("Decal") || d.IsA("Texture")) {
				(d as Decal).Transparency = 0;
			}
		});
	}

	invisibilityBurstRunning = false;
}

export { initializeMovementSystem };
