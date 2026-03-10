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
		if (!character) {
			log(`[MOVEMENT] ${player.Name} - No character found for action: ${movementAction}`, "WARN");
			return;
		}

		const humanoid = character.FindFirstChildOfClass("Humanoid");
		const rootPart = character.FindFirstChild("HumanoidRootPart");

		if (!humanoid || !rootPart) {
			log(`[MOVEMENT] ${player.Name} - Missing humanoid or rootPart for action: ${movementAction}`, "WARN");
			return;
		}

		if (humanoid.Health <= 0) {
			log(`[MOVEMENT] ${player.Name} - Player is dead, ignoring action: ${movementAction}`, "WARN");
			return;
		}

		// Handle different movement actions
		switch (movementAction) {
			case "StartRun": {
				log(`[MOVEMENT] ${player.Name} started running`);
				applySpeed(SPEEDS.RUN, humanoid);
				break;
			}

			case "StopRun": {
				log(`[MOVEMENT] ${player.Name} stopped running`);
				applySpeed(SPEEDS.WALK, humanoid);
				break;
			}

			case "Walk": {
				log(`[MOVEMENT] ${player.Name} is walking`);
				applySpeed(SPEEDS.WALK, humanoid);
				break;
			}

			case "Stealth": {
				log(`[MOVEMENT] ${player.Name} is stealthing`);
				applySpeed(SPEEDS.STEALTH, humanoid);
				break;
			}

			case "Jump": {
				log(`[MOVEMENT] ${player.Name} performing double jump`);

				// Apply upward velocity for double jump
				const currentVelocity = (rootPart as BasePart).AssemblyLinearVelocity;
				(rootPart as BasePart).AssemblyLinearVelocity = new Vector3(
					currentVelocity.X,
					DOUBLE_JUMP_POWER,
					currentVelocity.Z,
				);
				break;
			}

			default: {
				log(`[MOVEMENT] ${player.Name} - Unknown action: ${action}`, "WARN");
			}
		}
	});
}

export { initializeMovementSystem };
