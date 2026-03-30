import { Players, UserInputService } from "@rbxts/services";
import { getOrCreateMovementRemote } from "shared/remotes/movement-remote";
import { log } from "shared/helpers";
import { setStealthing } from "./npc-proximity";
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
const SPEED_BOOST_MULTIPLIER = 1.2; // +20%
let speedBoostActive = false;

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
		// Re-apply speed boost if active after respawn
		if (speedBoostActive) {
			applySpeedBoost(true);
		}
	});

	// Listen for effect sync to apply/remove speed boost
	const effectSyncRemote = getEffectSyncRemote();
	effectSyncRemote.OnClientEvent.Connect((data: unknown) => {
		const payload = data as EffectSyncPayload;
		const hasSpeed =
			payload.activeElixirId !== undefined &&
			payload.elixirRemainingSecs > 0 &&
			ELIXIRS[payload.activeElixirId]?.elixirEffect === "speed_boost";

		if (hasSpeed && !speedBoostActive) {
			speedBoostActive = true;
			applySpeedBoost(true);
			log("[MOVEMENT] Speed boost activated");
		} else if (!hasSpeed && speedBoostActive) {
			speedBoostActive = false;
			applySpeedBoost(false);
			log("[MOVEMENT] Speed boost expired");
		}
	});
}

function applySpeedBoost(active: boolean): void {
	const character = Players.LocalPlayer?.Character;
	if (!character) return;
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (!humanoid) return;
	humanoid.WalkSpeed = active ? BASE_WALK_SPEED * SPEED_BOOST_MULTIPLIER : BASE_WALK_SPEED;
}

export { initializeMovementSystem };
