import { log } from "shared/helpers";
import {
	getKillBookDataRemote,
	KillBookData,
} from "shared/remotes/kill-book-remote";
import { getPlayerStateSnapshot } from "shared/player-state";
import { getPlayerNPCBounty } from "./bounty-manager";

export function initializeKillBookRemotes(): void {
	// Pre-create remotes so they exist before clients connect
	const getDataRemote = getKillBookDataRemote();

	// Client requests full kill book data
	getDataRemote.OnServerInvoke = (player: Player): KillBookData | undefined => {
		const state = getPlayerStateSnapshot(player);
		if (!state) return undefined;

		const activeBounty = getPlayerNPCBounty(player);

		// Convert achievement record keys to a flat ID list for the client
		const achievementIds: string[] = [];
		for (const [id] of pairs(state.unlockedAchievements)) {
			achievementIds.push(id as string);
		}

		return {
			killLog: state.killLog,
			totalNPCKills: state.totalNPCKills,
			playerKills: state.playerKills,
			playerDeaths: state.playerDeaths,
			unlockedAchievementIds: achievementIds,
			activeBountyName: activeBounty?.npcName,
			score: state.score,
			ownedTitles: state.ownedTitles,
			equippedTitle: state.title,
			factionXP: state.factionXP,
		};
	};

	log("[KILL BOOK] Kill book remotes initialized");
}
