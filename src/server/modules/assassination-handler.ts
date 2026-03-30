import { Players } from "@rbxts/services";
import { getOrCreateAssassinationRemote } from "shared/remotes/assassination-remote";
import { getPlayerAssassinationRemote } from "shared/remotes/bounty-remote";
import { getAchievementUnlockedRemote } from "shared/remotes/kill-book-remote";
import { isPlayerStealthing } from "./stealth-tracker";
import { log } from "shared/helpers";
import { DEATH_EFFECTS, isNPCActive } from "shared/npc-manager";
import { getActivePoison } from "./effect-handler";
import { POISONS } from "shared/config/poisons";
import {
	addCoins,
	addCompletedBounty,
	addExperience,
	addKill,
	addPlayerDeath,
	addPlayerKill,
	addScore,
	hasAchievement,
	savePlayerData,
	unlockAchievement,
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
import { isNPCKillable } from "shared/config/npcs";

const assassinationRemote = getOrCreateAssassinationRemote();
// POISON is a status effect, not a death animation — keep it out of this list.
const DEATH_STYLES: Array<keyof typeof DEATH_EFFECTS> = ["DEFAULT", "EVAPORATE", "SMOKE"];

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

		// Kill the NPC — use levitation if player has an active poison, otherwise random
		const activePoisonId = getActivePoison(player);
		const poisonDef = activePoisonId ? POISONS[activePoisonId] : undefined;
		let selectedStyle: keyof typeof DEATH_EFFECTS;

		if (poisonDef && poisonDef.poisonEffect === "floating_death") {
			selectedStyle = "LEVITATION";
			log("[ASSASSINATION] " + player.Name + " used " + poisonDef.name + " on " + model.Name);
		} else {
			selectedStyle = DEATH_STYLES[math.random(0, DEATH_STYLES.size() - 1)];
		}
		const deathFunction = DEATH_EFFECTS[selectedStyle];

		if (deathFunction) {
			task.spawn(() => deathFunction(model));
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
			// Legal bounty kill — store as completed bounty (turned in later via kill book)
			const npcData3 = MEDIEVAL_NPCS[model.Name];
			const npcStat = (npcData3?.status ?? "Commoner") as string;
			const scrollGold = BASE_COINS + personalBounty.gold;
			const scrollXP = BASE_XP + personalBounty.xp;

			addCompletedBounty(player, model.Name, scrollGold, scrollXP, personalBounty.offence);
			addBountyScrollFromKill(player, model.Name, npcStat, scrollGold, scrollXP);
			addScore(player, BASE_SCORE + personalBounty.gold);
			log("[ASSASSINATION] " + player.Name + " completed bounty on " + model.Name + " (stored for turn-in)");
		} else {
			// Illegal kill — no reward, become wanted
			const npcData2 = MEDIEVAL_NPCS[model.Name];
			const npcStatus = (npcData2?.status ?? "Commoner") as Status;
			const wantedGold = WANTED_GOLD_BY_STATUS[npcStatus] ?? 300;
			const decree = DECREE_BY_STATUS[npcStatus] ?? "Committed murder — by royal decree";
			setPlayerWanted(player, wantedGold, decree);
			print("[WANTED CHECK] " + player.Name + " is now WANTED for " + wantedGold + "g by decree of the king");
		}

		// Record the kill in the player's per-NPC kill log regardless of legality
		const npcData = MEDIEVAL_NPCS[model.Name];
		if (npcData !== undefined) {
			addKill(player, model.Name, { status: npcData.status, race: npcData.race }, wasLegalKill);
		}

		// ── Achievement checks ─────────────────────────────────────────────────
		if (!hasAchievement(player, "FIRST_ASSASSINATION")) {
			if (unlockAchievement(player, "FIRST_ASSASSINATION")) {
				getAchievementUnlockedRemote().FireClient(player, "FIRST_ASSASSINATION");
				log("[ACHIEVEMENT] " + player.Name + " unlocked: First Blood");
			}
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

		if (!isPlayerStealthing(killer)) {
			log("[ASSASSINATION] " + killer.Name + " not stealthing for player assassination", "WARN");
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
		if (!hasAchievement(killer, "PLAYER_SLAYER")) {
			if (unlockAchievement(killer, "PLAYER_SLAYER")) {
				getAchievementUnlockedRemote().FireClient(killer, "PLAYER_SLAYER");
				log("[ACHIEVEMENT] " + killer.Name + " unlocked: Player Slayer");
			}
		}

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
