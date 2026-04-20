import { Players } from "@rbxts/services";
import { getOrCreateAssassinationRemote } from "shared/remotes/assassination-remote";
import { getPlayerAssassinationRemote } from "shared/remotes/bounty-remote";
import { log } from "shared/helpers";
import { getPlayerEquippedWeapon } from "./inventory-handler";
import { executeDelivery } from "./delivery-handler";
import { DEATH_EFFECTS, isNPCActive } from "shared/npc-manager";
import { getActivePoison, consumePoisonCharge } from "./effect-handler";
import { POISONS } from "shared/config/poisons";
import {
	addCoins,
	addExperience,
	addKill,
	addPlayerDeath,
	addPlayerKill,
	addScore,
	savePlayerData,
} from "shared/player-state";
import {
	getPlayerNPCBounty,
	onNPCKilled,
	setPlayerWanted,
	isPlayerWanted,
	clearPlayerWanted,
	getWantedPlayerGold,
} from "./bounty-manager";
import { transferBountyScrolls, addPlayerBountyScroll, addBountyScrollFromKill } from "./inventory-handler";
import { MEDIEVAL_NPCS, Status } from "shared/module";
import { awardAchievement } from "./achievement-handler";
import { isNPCKillable } from "shared/config/npcs";
import { getAssassinationFeedbackRemote } from "shared/remotes/assassination-feedback-remote";

const assassinationRemote = getOrCreateAssassinationRemote();

/** Base rewards granted for every assassination regardless of bounty. */
const BASE_SCORE = 100;
const BASE_XP = 250;
const BASE_COINS = 50;

/** Gold placed on the PLAYER's head when they make an illegal kill. */
const WANTED_GOLD_BY_STATUS: Record<Status, number> = {
	Serf: 150,
	Commoner: 300,
	Merchant: 550,
	Nobility: 900,
	Royalty: 2000,
};

/** Flavour text for the royal decree, keyed by the victim's status. */
const DECREE_BY_STATUS: Record<Status, string> = {
	Serf: "Slew an innocent serf — by royal decree",
	Commoner: "Slew a commoner in cold blood — by royal decree",
	Merchant: "Murdered a merchant of the realm — by royal decree",
	Nobility: "Cut down a noble of the court — by royal decree",
	Royalty: "Committed regicide — by decree of the crown",
};

function initializeAssassinationHandler() {
	log("[ASSASSINATION] Initializing assassination handler");

	// Eagerly create the feedback remote so clients don't infinite-yield on WaitForChild
	getAssassinationFeedbackRemote();

	assassinationRemote.OnServerEvent.Connect((player: Player, npcModel: unknown) => {
		const model = npcModel as Model;
		if (!model || !model.Parent) {
			log(`[ASSASSINATION] ${player.Name} attempted assassination on invalid NPC`, "WARN");
			return;
		}

		// Reject if this NPC cannot be killed
		if (!isNPCKillable(model.Name)) {
			log(`[ASSASSINATION] ${player.Name} tried to kill unkillable NPC ${model.Name} -- blocked`, "WARN");
			return;
		}

		// Reject if the NPC is already dying or has a status effect running
		if (isNPCActive(model) === false) {
			log(`[ASSASSINATION] ${player.Name} targeted ${model.Name} but it is already dying`, "WARN");
			return;
		}

		log(`[ASSASSINATION] ${player.Name} attempting to assassinate ${model.Name}`);

		// Require a real weapon — fists cannot assassinate
		if (getPlayerEquippedWeapon(player) === "fists") {
			log(`[ASSASSINATION] ${player.Name} has no weapon equipped, assassination denied`, "WARN");
			getAssassinationFeedbackRemote().FireClient(player, "no_weapon");
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

		// Resolve kill: poison ALWAYS does the killing blow.
		// No poison = weapon handles everything.
		// With poison = weapon delivery, then poison's death effect.
		const activePoisonId = getActivePoison(player);
		const poisonDef = activePoisonId ? POISONS[activePoisonId] : undefined;
		const equippedWeapon = getPlayerEquippedWeapon(player);

		if (poisonDef) {
			// Poison active — it determines the death effect
			let poisonDeathStyle: keyof typeof DEATH_EFFECTS;
			if (poisonDef.poisonEffect === "floating_death") {
				poisonDeathStyle = "LEVITATION";
			} else if (poisonDef.poisonEffect === "shrinking_death") {
				poisonDeathStyle = "SHRINK";
			} else if (poisonDef.poisonEffect === "divine_pull") {
				poisonDeathStyle = "DIVINE_PULL";
			} else {
				poisonDeathStyle = "DISMEMBER";
			}
			log("[ASSASSINATION] " + player.Name + " used " + poisonDef.name + " on " + model.Name);
			executeDelivery(
				model,
				equippedWeapon,
				playerPosition,
				DEATH_EFFECTS[poisonDeathStyle],
				poisonDef.poisonDelaySecs,
			);
			// Consume a charge for charge-based poisons (e.g. O's Guidance)
			consumePoisonCharge(player);
		} else {
			// No poison — weapon handles the full kill (no death effect passed)
			executeDelivery(model, equippedWeapon, playerPosition);
		}

		// --- Reward the player ---
		// Check if this NPC was the player's personal bounty mark BEFORE calling
		// onNPCKilled (which removes the bounty entry from the map)
		const personalBounty = getPlayerNPCBounty(player);
		const wasLegalKill = personalBounty !== undefined && personalBounty.npcName === model.Name;

		print(
			"[WANTED CHECK] " +
				player.Name +
				" killed " +
				model.Name +
				" | mark=" +
				(personalBounty ? personalBounty.npcName : "none") +
				" | legal=" +
				(wasLegalKill ? "YES" : "NO"),
		);

		// Notify all players who had this NPC as their mark (fires BountyCompleted
		// to them and schedules a new assignment after 3 s)
		onNPCKilled(player, model.Name);

		if (wasLegalKill) {
			// Legal bounty kill — award scroll to inventory for later turn-in at a guild leader
			const npcData3 = MEDIEVAL_NPCS[model.Name];
			const npcStat = (npcData3?.status ?? "Commoner") as string;
			const scrollGold = BASE_COINS + personalBounty.gold;
			const scrollXP = BASE_XP + personalBounty.xp;

			addBountyScrollFromKill(player, model.Name, npcStat, scrollGold, scrollXP);
			addScore(player, BASE_SCORE + personalBounty.gold);
			awardAchievement(player, "FIRST_CONTRACT");
			log(
				"[ASSASSINATION] " +
					player.Name +
					" completed bounty on " +
					model.Name +
					" (scroll added to inventory)",
			);
		} else {
			// Illegal kill — no reward, become wanted
			const npcData2 = MEDIEVAL_NPCS[model.Name];
			const npcStatus = (npcData2?.status ?? "Commoner") as Status;
			const wantedGold = WANTED_GOLD_BY_STATUS[npcStatus] ?? 300;
			const decree = DECREE_BY_STATUS[npcStatus] ?? "Committed murder — by royal decree";
			setPlayerWanted(player, wantedGold, decree);
			awardAchievement(player, "A_COSTLY_MISTAKE");
			print("[WANTED CHECK] " + player.Name + " is now WANTED for " + wantedGold + "g by decree of the king");
		}

		// Record the kill in the player's per-NPC kill log regardless of legality
		const npcData = MEDIEVAL_NPCS[model.Name];
		if (npcData !== undefined) {
			addKill(player, model.Name, { status: npcData.status, race: npcData.race }, wasLegalKill);
		}

		// ── Achievement checks ─────────────────────────────────────────────────
		awardAchievement(player, "FIRST_ASSASSINATION");
		if (poisonDef) {
			awardAchievement(player, "COATED_STEEL");
		}

		// Persist immediately so data is not lost if the server crashes
		task.spawn(() => savePlayerData(player));
	});

	// ── Player-vs-player assassination (wanted bounties) ──────────────────────
	const playerAssassinationRemote = getPlayerAssassinationRemote();

	playerAssassinationRemote.OnServerEvent.Connect((killer: Player, targetCharModel: unknown) => {
		const targetModel = targetCharModel as Model;
		if (!targetModel || !targetModel.Parent) return;

		const targetPlayer = Players.GetPlayerFromCharacter(targetModel);
		if (!targetPlayer) return;
		if (targetPlayer === killer) return;

		if (!isPlayerWanted(targetPlayer)) {
			log(
				"[ASSASSINATION] " + killer.Name + " tried to assassinate non-wanted player " + targetPlayer.Name,
				"WARN",
			);
			return;
		}

		// Require a real weapon — fists cannot assassinate
		if (getPlayerEquippedWeapon(killer) === "fists") {
			log("[ASSASSINATION] " + killer.Name + " has no weapon equipped, player assassination denied", "WARN");
			getAssassinationFeedbackRemote().FireClient(killer, "no_weapon");
			return;
		}

		const killerCharacter = killer.Character;
		if (!killerCharacter) return;

		const killerHRP = killerCharacter.FindFirstChild("HumanoidRootPart") as BasePart;
		const targetHRP = targetModel.FindFirstChild("HumanoidRootPart") as BasePart;
		if (!killerHRP || !targetHRP) return;

		const distance = killerHRP.Position.sub(targetHRP.Position).Magnitude;
		if (distance > 15) {
			log("[ASSASSINATION] " + killer.Name + " too far to assassinate " + targetPlayer.Name, "WARN");
			return;
		}

		// Kill the wanted player
		log("[ASSASSINATION] " + killer.Name + " assassinated wanted player " + targetPlayer.Name + "!");
		const targetHumanoid = targetModel.FindFirstChildOfClass("Humanoid");
		if (targetHumanoid) {
			targetHumanoid.Health = 0;
		}

		// Reward the assassin with the bounty
		const wantedGold = getWantedPlayerGold(targetPlayer) ?? 300;
		addCoins(killer, wantedGold);
		addScore(killer, wantedGold);
		addExperience(killer, math.floor(wantedGold * 1.5));
		log("[ASSASSINATION] " + killer.Name + " earned " + wantedGold + "g for killing " + targetPlayer.Name);

		// Track PvP stats
		addPlayerKill(killer);
		addPlayerDeath(targetPlayer);

		// Achievement: Player Slayer
		awardAchievement(killer, "PLAYER_SLAYER");

		// Award a "player" rarity bounty scroll to the killer
		addPlayerBountyScroll(killer, targetPlayer.Name, wantedGold, math.floor(wantedGold * 1.5));

		// Transfer bounty scrolls from victim to killer (highest rarity first)
		const scrollsTransferred = transferBountyScrolls(targetPlayer, killer);
		if (scrollsTransferred > 0) {
			log(
				"[ASSASSINATION] " +
					killer.Name +
					" looted " +
					scrollsTransferred +
					" bounty scroll(s) from " +
					targetPlayer.Name,
			);
		}

		// Clear wanted status
		clearPlayerWanted(targetPlayer);

		// Respawn is handled by the global Humanoid.Died listener in network-lifecycles.ts

		task.spawn(() => savePlayerData(killer));
	});
}

export { initializeAssassinationHandler };
