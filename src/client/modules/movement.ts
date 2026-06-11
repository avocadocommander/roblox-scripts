import { Players, UserInputService, Workspace } from "@rbxts/services";
import { getOrCreateMovementRemote } from "shared/remotes/movement-remote";
import { log } from "shared/helpers";
import { getEffectSyncRemote, EffectSyncPayload } from "shared/remotes/effect-remote";
import { ELIXIRS } from "shared/config/elixirs";
import {
	getBountyAssignedRemote,
	getBountyCompletedRemote,
	getBountyListSyncRemote,
	getMyNPCBountyRemote,
	NPCBountyPayload,
} from "shared/remotes/bounty-remote";

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

// Wallhack (hunter's sight) state
let wallhackActive = false;
const WALLHACK_HIGHLIGHT_NAME = "WallhackHighlight";
const wallhackHighlights = new Map<Model, Highlight>();
let wallhackBountyName: string | undefined;
let wallhackDescendantAddedConn: RBXScriptConnection | undefined;
let wallhackDescendantRemovingConn: RBXScriptConnection | undefined;
const wallhackNameWatchers = new Map<Model, RBXScriptConnection>();
let wallhackPollToken = 0;

// Current active elixir def — used to read tier-specific params
let activeElixirDef: import("shared/config/elixirs").ElixirDef | undefined;

function setupMovementInput() {
	const character = players?.Character;
	if (!character) return;

	const humanoid =
		character.FindFirstChildOfClass("Humanoid") ?? (character.WaitForChild("Humanoid", 5) as Humanoid | undefined);
	if (!humanoid) return;

	// Kill Roblox's auto-jump-near-obstacle behaviour. We want jumps to
	// happen only when the player explicitly taps our mobile jump button.
	humanoid.AutoJumpEnabled = false;

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

	// Disable Roblox's auto-jump default for any future-spawned characters.
	// `setupMovementInput()` also sets this on the live humanoid, but this
	// covers the very first character before our hook attaches.
	player.AutoJumpEnabled = false;

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
		// ── Wallhack (Hunter's Sight) ───────────────────────────
		const hasWallhack = elixirAlive && elixirDef!.elixirEffect === "wallhack";
		if (hasWallhack && !wallhackActive) {
			wallhackActive = true;
			startWallhack();
			log("[MOVEMENT] Wallhack activated");
		} else if (!hasWallhack && wallhackActive) {
			wallhackActive = false;
			stopWallhack();
			log("[MOVEMENT] Wallhack expired");
		}	});
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

// ── Wallhack (Hunter's Sight) ────────────────────────────────────────

function wallhackApply(model: Model): void {
	if (wallhackHighlights.has(model)) return;
	const h = new Instance("Highlight");
	h.Name = WALLHACK_HIGHLIGHT_NAME;
	h.FillColor = Color3.fromRGB(255, 60, 60);
	h.OutlineColor = Color3.fromRGB(255, 200, 200);
	h.FillTransparency = 0.55;
	h.OutlineTransparency = 0;
	h.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop;
	h.Adornee = model;
	h.Parent = model;
	wallhackHighlights.set(model, h);
}

function wallhackRemove(model: Model): void {
	const h = wallhackHighlights.get(model);
	if (!h) return;
	h.Destroy();
	wallhackHighlights.delete(model);
}

function wallhackClearAll(): void {
	for (const [m] of wallhackHighlights) wallhackRemove(m);
}

function wallhackIsPlayerCharacter(model: Model): boolean {
	for (const player of Players.GetPlayers()) {
		if (player.Character === model) return true;
	}
	return false;
}

function wallhackRefresh(): void {
	if (!wallhackActive) return;
	const target = wallhackBountyName;
	if (target === undefined || target === "") {
		wallhackClearAll();
		return;
	}
	for (const [m] of wallhackHighlights) {
		if (!m.IsDescendantOf(Workspace) || m.Name !== target) wallhackRemove(m);
	}
	for (const d of Workspace.GetDescendants()) {
		if (!d.IsA("Model")) continue;
		if (d.Name !== target) continue;
		if (wallhackIsPlayerCharacter(d)) continue;
		wallhackApply(d);
	}
}

/** Always pull the *authoritative* current bounty target from the server. */
function wallhackRefetchTarget(): void {
	if (!wallhackActive) return;
	task.spawn(() => {
		const [ok, result] = pcall(() => getMyNPCBountyRemote().InvokeServer());
		if (ok) {
			const payload = result as NPCBountyPayload | undefined;
			wallhackBountyName =
				payload !== undefined && payload.npcName !== undefined && payload.npcName !== ""
					? payload.npcName
					: undefined;
		}
		wallhackRefresh();
	});
}

function startWallhack(): void {
	// Initial fetch + scan.
	wallhackRefetchTarget();

	// Re-apply when targets spawn / despawn or get renamed.
	wallhackDescendantAddedConn = Workspace.DescendantAdded.Connect((inst) => {
		if (!inst.IsA("Model")) return;
		// Watch the name -- NPCs can be parented as empty Models and renamed later.
		const conn = inst.GetPropertyChangedSignal("Name").Connect(() => wallhackRefresh());
		wallhackNameWatchers.set(inst, conn);
		wallhackRefresh();
	});
	wallhackDescendantRemovingConn = Workspace.DescendantRemoving.Connect((inst) => {
		if (!inst.IsA("Model")) return;
		const h = wallhackHighlights.get(inst);
		if (h) {
			h.Destroy();
			wallhackHighlights.delete(inst);
		}
		const w = wallhackNameWatchers.get(inst);
		if (w) {
			w.Disconnect();
			wallhackNameWatchers.delete(inst);
		}
	});

	// Watch already-present models so renames are caught.
	for (const inst of Workspace.GetDescendants()) {
		if (!inst.IsA("Model")) continue;
		const conn = inst.GetPropertyChangedSignal("Name").Connect(() => wallhackRefresh());
		wallhackNameWatchers.set(inst, conn);
	}

	// Periodic safety re-fetch -- bounty events can race / be missed, and the
	// target NPC model may not have its Name set when DescendantAdded fires.
	wallhackPollToken += 1;
	const token = wallhackPollToken;
	task.spawn(() => {
		while (wallhackActive && token === wallhackPollToken) {
			task.wait(2);
			if (!wallhackActive || token !== wallhackPollToken) break;
			wallhackRefetchTarget();
		}
	});
}

function stopWallhack(): void {
	wallhackClearAll();
	wallhackPollToken += 1; // invalidate any running poller
	if (wallhackDescendantAddedConn) wallhackDescendantAddedConn.Disconnect();
	wallhackDescendantAddedConn = undefined;
	if (wallhackDescendantRemovingConn) wallhackDescendantRemovingConn.Disconnect();
	wallhackDescendantRemovingConn = undefined;
	for (const [, conn] of wallhackNameWatchers) conn.Disconnect();
	wallhackNameWatchers.clear();
}

// Track bounty target changes for the wallhack module. We don't trust event
// payloads alone (BountyCompleted can arrive *after* BountyAssigned in some
// cases and wipe the new name) -- every event re-fetches authoritatively.
task.spawn(() => {
	getBountyAssignedRemote().OnClientEvent.Connect(() => wallhackRefetchTarget());
	getBountyCompletedRemote().OnClientEvent.Connect(() => wallhackRefetchTarget());
	getBountyListSyncRemote().OnClientEvent.Connect(() => wallhackRefetchTarget());
});

export { initializeMovementSystem };
