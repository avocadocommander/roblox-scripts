import { getOrCreateAssassinationRemote } from "shared/remotes/assassination-remote";
import { isPlayerStealthing } from "./stealth-tracker";
import { log } from "shared/helpers";
import { DEATH_EFFECTS, isNPCActive } from "shared/npc-manager";
import { addCoins, addExperience, addKill, addScore, savePlayerData } from "shared/player-state";
import { bountyService } from "shared/bounty";
import { MEDIEVAL_NPCS } from "shared/module";

const assassinationRemote = getOrCreateAssassinationRemote();
// POISON is a status effect, not a death animation — keep it out of this list.
const DEATH_STYLES: Array<keyof typeof DEATH_EFFECTS> = ["DEFAULT", "EVAPORATE", "SMOKE"];

/** Base rewards granted for every assassination regardless of bounty. */
const BASE_SCORE = 100;
const BASE_XP = 250;
const BASE_COINS = 50;

function initializeAssassinationHandler() {
	log("[ASSASSINATION] Initializing assassination handler");

	assassinationRemote.OnServerEvent.Connect((player: Player, npcModel: unknown) => {
		const model = npcModel as Model;
		if (!model || !model.Parent) {
			log(`[ASSASSINATION] ${player.Name} attempted assassination on invalid NPC`, "WARN");
			return;
		}

		// Reject if the NPC is already dying or has a status effect running
		if (isNPCActive(model) === false) {
			log(`[ASSASSINATION] ${player.Name} targeted ${model.Name} but it is already dying`, "WARN");
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
		const deathFunction = DEATH_EFFECTS[selectedStyle];

		if (deathFunction) {
			task.spawn(() => deathFunction(model));
		}

		// --- Reward the player ---
		let scoreGain = BASE_SCORE;
		let xpGain = BASE_XP;
		let coinGain = BASE_COINS;

		// Check if this NPC had an active bounty and stack those rewards on top
		const bounty = bountyService.getBounty();
		if (bounty && bounty.npc.model === model) {
			xpGain += bounty.xpReward;
			coinGain += bounty.goldReward;
			scoreGain += bounty.goldReward; // bounty gold also counts toward score
			bountyService.clearBounty(bounty.npc);
			log(
				`[ASSASSINATION] ${player.Name} claimed bounty on ${model.Name} (+${bounty.goldReward} gold, +${bounty.xpReward} XP)`,
			);
		}

		addScore(player, scoreGain);
		addExperience(player, xpGain);
		addCoins(player, coinGain);

		// Record the kill in the player's per-NPC kill log
		const npcData = MEDIEVAL_NPCS[model.Name];
		if (npcData) {
			addKill(player, model.Name, { status: npcData.status, race: npcData.race });
			log(`[ASSASSINATION] ${player.Name} kill log: ${model.Name} x${1} (${npcData.status} ${npcData.race})`);
		}

		log(`[ASSASSINATION] Rewarded ${player.Name}: +${scoreGain} score, +${xpGain} XP, +${coinGain} coins`);

		// Persist immediately so data is not lost if the server crashes
		task.spawn(() => savePlayerData(player));
	});
}

export { initializeAssassinationHandler };
