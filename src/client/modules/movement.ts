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

	// Reset air jump when player touches ground
	humanoid.StateChanged.Connect((oldState, newState) => {
		if (newState === Enum.HumanoidStateType.Running || newState === Enum.HumanoidStateType.Landed) {
			hasAirJump = true;
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
			movementRemote.FireServer("StartRun");
		}

		// Q - Toggle Stealth Mode
		if (input.KeyCode === Enum.KeyCode.Q) {
			isStealthMode = !isStealthMode;
			setStealthing(isStealthMode);
			movementRemote.FireServer(isStealthMode ? "Stealth" : "Walk");
			// Broadcast stealth state as an attribute so other LocalScripts
			// (e.g. user-ui-block) can react without needing a shared module.
			Players.LocalPlayer.SetAttribute("IsStealthing", isStealthMode);
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
