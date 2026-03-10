import { getOrCreateAssassinationRemote } from "shared/remotes/assassination-remote";
import { isPlayerStealthing } from "./stealth-tracker";
import { log } from "shared/helpers";
import { DEATH_TYPES } from "shared/npc-manager";

const assassinationRemote = getOrCreateAssassinationRemote();
const DEATH_STYLES = ["DEFAULT", "EVAPORATE", "SMOKE", "POISON"];

function initializeAssassinationHandler() {
	log("[ASSASSINATION] Initializing assassination handler");

	assassinationRemote.OnServerEvent.Connect((player: Player, npcModel: unknown) => {
		const model = npcModel as Model;
		if (!model || !model.Parent) {
			log(`[ASSASSINATION] ${player.Name} attempted assassination on invalid NPC`, "WARN");
			return;
		}

		log(`[ASSASSINATION] ${player.Name} attempting to assassinate ${model.Name}`);

		// Validate player is stealthing
		if (!isPlayerStealthing(player)) {
			log(`[ASSASSINATION] ${player.Name} is not stealthing, assassination denied`, "WARN");
			return;
		}

		// Validate player character exists
		const character = player.Character;
		if (!character) {
			log(`[ASSASSINATION] ${player.Name} has no character`, "WARN");
			return;
		}

		// Validate proximity
		const playerPosition = (character.FindFirstChild("HumanoidRootPart") as BasePart)?.Position;

		// Try to get NPC position with multiple fallbacks
		let npcPosition: Vector3 | undefined;
		const modelAsUnknown = model as unknown as { PrimaryPart: BasePart | undefined };
		if (modelAsUnknown.PrimaryPart) {
			npcPosition = modelAsUnknown.PrimaryPart.Position;
		} else {
			const hrp = model.FindFirstChild("HumanoidRootPart") as BasePart;
			if (hrp) {
				npcPosition = hrp.Position;
			} else {
				const bp = model.FindFirstChildOfClass("BasePart") as BasePart;
				if (bp) {
					npcPosition = bp.Position;
				}
			}
		}

		if (!playerPosition || !npcPosition) {
			log(`[ASSASSINATION] Missing position data for assassination`, "WARN");
			return;
		}

		const distance = playerPosition.sub(npcPosition).Magnitude;
		const MAX_ASSASSINATION_DISTANCE = 15;

		if (distance > MAX_ASSASSINATION_DISTANCE) {
			log(
				`[ASSASSINATION] ${player.Name} too far away to assassinate ${model.Name} (distance: ${math.floor(distance * 10) / 10} studs)`,
				"WARN",
			);
			return;
		}

		// Perform the assassination
		log(`[ASSASSINATION] ${player.Name} assassinated ${model.Name}!`);

		// Kill the NPC with a random death style
		const selectedStyle = DEATH_STYLES[math.random(0, DEATH_STYLES.size() - 1)];
		const deathFunction = DEATH_TYPES[selectedStyle];

		if (deathFunction) {
			task.spawn(() => deathFunction(model));
		}
	});
}

export { initializeAssassinationHandler };
