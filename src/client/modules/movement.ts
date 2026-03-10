import { Players, UserInputService } from "@rbxts/services";
import { getOrCreateMovementRemote } from "shared/remotes/movement-remote";
import { log } from "shared/helpers";
import { setStealthing } from "./npc-proximity";

const movementRemote = getOrCreateMovementRemote();
const players = Players.LocalPlayer;

// Movement state tracking
let hasAirJump = true;
let lastJumpTime = 0;
let isRunning = false;
let isStealthMode = false;

function setupMovementInput() {
	const character = players?.Character;
	if (!character) return;

	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (!humanoid) return;

	log("[MOVEMENT] Setting up movement input for new character");

	// Reset air jump when player touches ground
	humanoid.StateChanged.Connect((oldState, newState) => {
		if (newState === Enum.HumanoidStateType.Running || newState === Enum.HumanoidStateType.Landed) {
			hasAirJump = true;
			log("[MOVEMENT] Air jump reset - player grounded");
		}
	});

	// Handle keyboard input for run/jump and stealth toggle
	UserInputService.InputBegan.Connect((input, gameProcessed) => {
		if (gameProcessed) return;

		const currentCharacter = players?.Character;
		if (!currentCharacter) return;

		const currentHumanoid = currentCharacter.FindFirstChildOfClass("Humanoid");
		if (!currentHumanoid || currentHumanoid.Health <= 0) return;

		// Left Shift - Start Running
		if (input.KeyCode === Enum.KeyCode.LeftShift) {
			isRunning = true;
			log("[MOVEMENT] Starting run - firing remote");
			movementRemote.FireServer("StartRun");
		}

		// Q - Toggle Stealth Mode
		if (input.KeyCode === Enum.KeyCode.Q) {
			isStealthMode = !isStealthMode;
			log(`[MOVEMENT] Toggling stealth mode: ${isStealthMode}`);
			setStealthing(isStealthMode);
			movementRemote.FireServer(isStealthMode ? "Stealth" : "Walk");
		}

		// Space - Double Jump
		if (input.KeyCode === Enum.KeyCode.Space) {
			// Prevent spam
			if (tick() - lastJumpTime < 0.2) return;

			// Check if player is in air and hasn't used air jump yet
			if (
				hasAirJump &&
				(currentHumanoid.GetState() === Enum.HumanoidStateType.Freefall ||
					currentHumanoid.GetState() === Enum.HumanoidStateType.Flying)
			) {
				hasAirJump = false;
				lastJumpTime = tick();

				log("[MOVEMENT] Performing double jump");
				movementRemote.FireServer("Jump");
			}
		}
	});

	// Handle key release for run only (stealth is now toggled with R)
	UserInputService.InputEnded.Connect((input, gameProcessed) => {
		if (gameProcessed) return;

		const currentCharacter = players?.Character;
		if (!currentCharacter) return;

		const currentHumanoid = currentCharacter.FindFirstChildOfClass("Humanoid");
		if (!currentHumanoid) return;

		// Left Shift - Stop Running, go back to Walk or Stealth
		if (input.KeyCode === Enum.KeyCode.LeftShift) {
			isRunning = false;
			log("[MOVEMENT] Stopping run");
			// If stealth is active, go back to stealth speed. Otherwise walk.
			movementRemote.FireServer(isStealthMode ? "Stealth" : "Walk");
		}
	});
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
	});
}

export { initializeMovementSystem };
