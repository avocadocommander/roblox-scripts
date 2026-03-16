import { Players } from "@rbxts/services";
import { getOrCreateMovementRemote, MovementAction } from "shared/remotes/movement-remote";
import { log, applySpeed, SPEEDS } from "shared/helpers";

const movementRemote = getOrCreateMovementRemote();
const DOUBLE_JUMP_POWER = 80; // Adjust this to make jump higher/lower

function initializeMovementSystem() {
	log("[MOVEMENT] Initializing server-side movement system");

	movementRemote.OnServerEvent.Connect((player: Player, action: unknown) => {
		const movementAction = action as MovementAction;
		const character = player.Character;
		if (!character) return;

		const humanoid = character.FindFirstChildOfClass("Humanoid");
		const rootPart = character.FindFirstChild("HumanoidRootPart");

		if (!humanoid || !rootPart) return;
		if (humanoid.Health <= 0) return;

		switch (movementAction) {
			case "StartRun": {
				applySpeed(SPEEDS.RUN, humanoid);
				break;
			}

			case "StopRun": {
				applySpeed(SPEEDS.WALK, humanoid);
				break;
			}

			case "Walk": {
				applySpeed(SPEEDS.WALK, humanoid);
				break;
			}

			case "Stealth": {
				applySpeed(SPEEDS.STEALTH, humanoid);
				break;
			}

			case "Jump": {
				const currentVelocity = (rootPart as BasePart).AssemblyLinearVelocity;
				(rootPart as BasePart).AssemblyLinearVelocity = new Vector3(
					currentVelocity.X,
					DOUBLE_JUMP_POWER,
					currentVelocity.Z,
				);
				break;
			}
		}
	});
}

export { initializeMovementSystem };
