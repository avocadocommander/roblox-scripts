import { log } from "shared/helpers";
import {
	getAchievementUnlockedRemote,
	getKillBookDataRemote,
	getTurnInBountiesRemote,
	KillBookData,
	TurnInResult,
} from "shared/remotes/kill-book-remote";
import { getPlayerStateSnapshot, savePlayerData, turnInBounties } from "shared/player-state";
import { getPlayerNPCBounty } from "./bounty-manager";

export function initializeKillBookRemotes(): void {
	// Pre-create remotes so they exist before clients connect
	const getDataRemote = getKillBookDataRemote();
	const turnInRemote = getTurnInBountiesRemote();
	getAchievementUnlockedRemote();

	// Client requests full kill book data
	getDataRemote.OnServerInvoke = (player: Player): KillBookData | undefined => {
		const state = getPlayerStateSnapshot(player);
		if (!state) return undefined;

		const activeBounty = getPlayerNPCBounty(player);

		return {
			killLog: state.killLog,
			totalNPCKills: state.totalNPCKills,
			playerKills: state.playerKills,
			playerDeaths: state.playerDeaths,
			completedBounties: state.completedBounties,
			turnedInBounties: state.turnedInBounties,
			unlockedAchievements: state.unlockedAchievements,
			activeBountyName: activeBounty?.npcName,
			score: state.score,
			ownedTitles: state.ownedTitles,
			equippedTitle: state.title,
			factionXP: state.factionXP,
		};
	};

	// Client requests to turn in all completed bounties
	turnInRemote.OnServerInvoke = (player: Player): TurnInResult => {
		const result = turnInBounties(player);
		if (result.count > 0) {
			log(
				"[KILL BOOK] " + player.Name + " turned in " + result.count + " bounties for " + result.totalGold + "g",
			);
			task.spawn(() => savePlayerData(player));
		}
		return result;
	};

	log("[KILL BOOK] Kill book remotes initialized");
}
