import { getRemoteSubFolder, getRemoteEvent, getRemoteFunction } from "shared/remote-utils";
import { CompletedBountyEntry } from "shared/player-state";
import { KillLog } from "shared/kill-log";
import { FactionXP } from "shared/config/factions";

// ─── Payload types ────────────────────────────────────────────────────────────

/** Full kill book data sent from server to client. */
export interface KillBookData {
	killLog: KillLog;
	totalNPCKills: number;
	playerKills: number;
	playerDeaths: number;
	completedBounties: CompletedBountyEntry[];
	turnedInBounties: CompletedBountyEntry[];
	unlockedAchievements: string[];
	activeBountyName: string | undefined;
	score: number;
	/** All title IDs owned by the player. */
	ownedTitles: string[];
	/** Currently equipped title ID. */
	equippedTitle: string;
	/** Per-faction XP totals. */
	factionXP: FactionXP;
}

/** Result of turning in bounties. */
export interface TurnInResult {
	totalGold: number;
	totalXP: number;
	count: number;
}

// ─── Remote getters ───────────────────────────────────────────────────────────

function getFolder(): Folder {
	return getRemoteSubFolder("KillBook");
}

/** Client -> server: request full kill book data snapshot. */
export function getKillBookDataRemote(): RemoteFunction {
	return getRemoteFunction(getFolder(), "GetKillBookData");
}

/** Client -> server: turn in all completed bounties. */
export function getTurnInBountiesRemote(): RemoteFunction {
	return getRemoteFunction(getFolder(), "TurnInBounties");
}

/** Server -> client: achievement unlocked notification. */
export function getAchievementUnlockedRemote(): RemoteEvent {
	return getRemoteEvent(getFolder(), "AchievementUnlocked");
}
