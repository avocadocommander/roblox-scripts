import { ReplicatedStorage } from "@rbxts/services";
import { CompletedBountyEntry } from "shared/player-state";
import { KillLog } from "shared/kill-log";

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
}

/** Result of turning in bounties. */
export interface TurnInResult {
	totalGold: number;
	totalXP: number;
	count: number;
}

// ─── Remote getters ───────────────────────────────────────────────────────────

function getFolder(): Folder {
	let remotes = ReplicatedStorage.FindFirstChild("Remotes") as Folder | undefined;
	if (!remotes) {
		remotes = new Instance("Folder");
		remotes.Name = "Remotes";
		remotes.Parent = ReplicatedStorage;
	}
	let killBook = remotes.FindFirstChild("KillBook") as Folder | undefined;
	if (!killBook) {
		killBook = new Instance("Folder");
		killBook.Name = "KillBook";
		killBook.Parent = remotes;
	}
	return killBook;
}

function getOrCreateFunction(name: string): RemoteFunction {
	const folder = getFolder();
	let rf = folder.FindFirstChild(name) as RemoteFunction | undefined;
	if (!rf) {
		rf = new Instance("RemoteFunction");
		rf.Name = name;
		rf.Parent = folder;
	}
	return rf;
}

function getOrCreateEvent(name: string): RemoteEvent {
	const folder = getFolder();
	let re = folder.FindFirstChild(name) as RemoteEvent | undefined;
	if (!re) {
		re = new Instance("RemoteEvent");
		re.Name = name;
		re.Parent = folder;
	}
	return re;
}

/** Client → server: request full kill book data snapshot. */
export function getKillBookDataRemote(): RemoteFunction {
	return getOrCreateFunction("GetKillBookData");
}

/** Client → server: turn in all completed bounties. */
export function getTurnInBountiesRemote(): RemoteFunction {
	return getOrCreateFunction("TurnInBounties");
}

/** Server → client: achievement unlocked notification. */
export function getAchievementUnlockedRemote(): RemoteEvent {
	return getOrCreateEvent("AchievementUnlocked");
}
