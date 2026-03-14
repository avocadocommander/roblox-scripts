import { Players, ReplicatedStorage } from "@rbxts/services";
import { PlayerDataService } from "./common-data-service";
import { KillLog, NPCKillMeta, NPCKillRecord } from "./kill-log";

/** A completed bounty waiting to be turned in (or already turned in). */
export interface CompletedBountyEntry {
	npcName: string;
	gold: number;
	xp: number;
	offence: string;
	/** Epoch timestamp when completed. */
	completedAt: number;
}

const playerStateFolder = ((): Folder => {
	const root = (ReplicatedStorage.FindFirstChild("PlayerState") as Folder) ?? new Instance("Folder");
	root.Name = "PlayerState";
	root.Parent = ReplicatedStorage;
	return root;
})();

const GetExpierence = ((): RemoteFunction => {
	const rf = (playerStateFolder.FindFirstChild("GetExpierence") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "GetExpierence";
	rf.Parent = playerStateFolder;
	return rf;
})();

const GetTitle = ((): RemoteFunction => {
	const rf = (playerStateFolder.FindFirstChild("GetTitle") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "GetTitle";
	rf.Parent = playerStateFolder;
	return rf;
})();

const GetName = ((): RemoteFunction => {
	const rf = (playerStateFolder.FindFirstChild("GetName") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "GetName";
	rf.Parent = playerStateFolder;
	return rf;
})();

const GetLevel = ((): RemoteFunction => {
	const rf = (playerStateFolder.FindFirstChild("GetLevel") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "GetLevel";
	rf.Parent = playerStateFolder;
	return rf;
})();

const GetCoins = ((): RemoteFunction => {
	const rf = (playerStateFolder.FindFirstChild("GetCoins") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "GetCoins";
	rf.Parent = playerStateFolder;
	return rf;
})();

const GetBountyTarget = ((): RemoteFunction => {
	const rf =
		(playerStateFolder.FindFirstChild("GetBountyTarget") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "GetBountyTarget";
	rf.Parent = playerStateFolder;
	return rf;
})();

const ExpierenceUpdated = ((): RemoteEvent => {
	const re = (playerStateFolder.FindFirstChild("ExpierenceUpdated") as RemoteEvent) ?? new Instance("RemoteEvent");
	re.Name = "ExpierenceUpdated";
	re.Parent = playerStateFolder;
	return re;
})();

const LevelUpdated = ((): RemoteEvent => {
	const re = (playerStateFolder.FindFirstChild("LevelUpdated") as RemoteEvent) ?? new Instance("RemoteEvent");
	re.Name = "LevelUpdated";
	re.Parent = playerStateFolder;
	return re;
})();

const CoinsUpdated = ((): RemoteEvent => {
	const re = (playerStateFolder.FindFirstChild("CoinsUpdated") as RemoteEvent) ?? new Instance("RemoteEvent");
	re.Name = "CoinsUpdated";
	re.Parent = playerStateFolder;
	return re;
})();

const GetScore = ((): RemoteFunction => {
	const rf = (playerStateFolder.FindFirstChild("GetScore") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "GetScore";
	rf.Parent = playerStateFolder;
	return rf;
})();

const ScoreUpdated = ((): RemoteEvent => {
	const re = (playerStateFolder.FindFirstChild("ScoreUpdated") as RemoteEvent) ?? new Instance("RemoteEvent");
	re.Name = "ScoreUpdated";
	re.Parent = playerStateFolder;
	return re;
})();

const RequestAddExpierence = ((): RemoteFunction => {
	const rf =
		(playerStateFolder.FindFirstChild("RequestAddExpierence") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "RequestAddExpierence";
	rf.Parent = playerStateFolder;
	return rf;
})();
const RequestAddLevel = ((): RemoteFunction => {
	const rf =
		(playerStateFolder.FindFirstChild("RequestAddLevel") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "RequestAddLevel";
	rf.Parent = playerStateFolder;
	return rf;
})();
const RequestAddCoins = ((): RemoteFunction => {
	const rf =
		(playerStateFolder.FindFirstChild("RequestAddCoins") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "RequestAddCoins";
	rf.Parent = playerStateFolder;
	return rf;
})();

export interface PlayerState {
	expierence: number;
	level: number;
	birth: number;
	coins: number;
	/** Total score — incremented by kills, bounties, and other events. */
	score: number;
	name: string;
	title: string;
	activeBountyName: string | undefined;
	wanted: boolean;
	/** Per-NPC kill counts and metadata for this player. */
	killLog: KillLog;
	/** PvP — total player kills (as the assassin). */
	playerKills: number;
	/** PvP — total deaths to other players. */
	playerDeaths: number;
	/** Completed bounties waiting to be turned in for reward. */
	completedBounties: CompletedBountyEntry[];
	/** All-time bounties turned in (for the kill book history). */
	turnedInBounties: CompletedBountyEntry[];
	/** Achievement IDs the player has unlocked. */
	unlockedAchievements: string[];
	/** Total NPC assassinations (all-time). */
	totalNPCKills: number;
}

const DEFAULT_STATE: PlayerState = {
	birth: 0,
	coins: 0,
	expierence: 0,
	level: 1,
	score: 0,
	name: "Strider",
	title: "Ranger",
	activeBountyName: undefined,
	wanted: false,
	killLog: {},
	playerKills: 0,
	playerDeaths: 0,
	completedBounties: [],
	turnedInBounties: [],
	unlockedAchievements: [],
	totalNPCKills: 0,
};

const PLAYER_STATES = new Map<Player, PlayerState>();

// ─── DataStore persistence ────────────────────────────────────────────────────
// Bump the version string (e.g. "_v2") whenever PlayerState has breaking schema
// changes to avoid loading stale incompatible data.
const playerStateStore = PlayerDataService.getInstance<PlayerState>("PlayerState_v1", DEFAULT_STATE);

/** Persist the in-memory state of `player` to DataStore immediately. */
export async function savePlayerData(player: Player): Promise<void> {
	const state = PLAYER_STATES.get(player);
	if (!state) return;
	// Use save() — a single SetAsync — rather than updatePlayerData which
	// does an extra GetAsync before writing.
	await playerStateStore.save(player, state);
}

// ─────────────────────────────────────────────────────────────────────────────

function getPlayerExpierence(player: Player): number {
	return PLAYER_STATES.get(player)?.expierence ?? DEFAULT_STATE.expierence;
}

function pushExpierenceUpdate(player: Player) {
	ExpierenceUpdated.FireClient(player, getPlayerExpierence(player));
}

function pushLevelUpdate(player: Player) {
	LevelUpdated.FireClient(player, PLAYER_STATES.get(player)?.level ?? DEFAULT_STATE.level);
}

export function getBountyTarget(player: Player) {
	return PLAYER_STATES.get(player)?.activeBountyName ?? undefined;
}

Players.PlayerAdded.Connect((player) => {
	// Set default state IMMEDIATELY so the player is always in PLAYER_STATES.
	// This prevents race conditions where an assassination could happen before
	// the async DataStore load resolves, causing all writes to silently fail.
	PLAYER_STATES.set(player, { ...DEFAULT_STATE, name: player.Name });
	warn(`[PlayerState] Initialized default state for ${player.Name}`);

	// Load saved data in the background and overwrite defaults with real data.
	task.spawn(async () => {
		const savedData = await playerStateStore.fetchPlayerData(player);
		if (player.Parent !== undefined) {
			// Player is still in the game — merge saved data on top of defaults
			PLAYER_STATES.set(player, { ...DEFAULT_STATE, ...savedData, name: player.Name });
			warn(`[PlayerState] Loaded DataStore data for ${player.Name}`);
		}
	});
});

Players.PlayerRemoving.Connect((player) => {
	// task.spawn yields this coroutine until the async save resolves,
	// ensuring the DataStore write completes before the player is cleaned up.
	task.spawn(() => {
		savePlayerData(player).await();
		PLAYER_STATES.delete(player);
	});
});

// Save all connected players when the server shuts down.
game.BindToClose(() => {
	const saveTasks: Promise<void>[] = [];
	for (const [player] of PLAYER_STATES) {
		saveTasks.push(savePlayerData(player));
	}
	Promise.all(saveTasks).await();
});

// Periodic auto-save every 5 minutes so data loss is minimal on unexpected
// server crashes that skip BindToClose.
task.spawn(() => {
	// eslint-disable-next-line no-constant-condition
	for (;;) {
		task.wait(300);
		for (const [player] of PLAYER_STATES) {
			savePlayerData(player);
		}
	}
});

GetExpierence.OnServerInvoke = (player: Player) => {
	return getPlayerExpierence(player);
};

GetName.OnServerInvoke = (player: Player) => {
	return PLAYER_STATES.get(player)?.name ?? DEFAULT_STATE.name;
};
GetLevel.OnServerInvoke = (player: Player) => {
	return PLAYER_STATES.get(player)?.level ?? DEFAULT_STATE.level;
};
GetTitle.OnServerInvoke = (player: Player) => {
	return PLAYER_STATES.get(player)?.title ?? DEFAULT_STATE.title;
};
GetCoins.OnServerInvoke = (player: Player) => {
	return PLAYER_STATES.get(player)?.coins ?? DEFAULT_STATE.coins;
};
GetBountyTarget.OnServerInvoke = (player: Player): string | undefined => {
	return getBountyTarget(player);
};

GetScore.OnServerInvoke = (player: Player): number => {
	return PLAYER_STATES.get(player)?.score ?? DEFAULT_STATE.score;
};

/** Read the current score for `player` (server-side). */
export function getScore(player: Player): number {
	return PLAYER_STATES.get(player)?.score ?? DEFAULT_STATE.score;
}

/**
 * Add `amount` to `player`'s score, update their in-memory state,
 * and push the new total to the client.
 */
export function addScore(player: Player, amount: number): number {
	const state = PLAYER_STATES.get(player);
	if (!state) return 0;
	const newScore = state.score + amount;
	PLAYER_STATES.set(player, { ...state, score: newScore });
	ScoreUpdated.FireClient(player, newScore);
	return newScore;
}

/** Add `amount` coins to `player` and push the update to the client. */
export function addCoins(player: Player, amount: number): number {
	const state = PLAYER_STATES.get(player);
	if (!state) return 0;
	const newCoins = state.coins + amount;
	PLAYER_STATES.set(player, { ...state, coins: newCoins });
	CoinsUpdated.FireClient(player, newCoins);
	return newCoins;
}

/**
 * Add `amount` XP to `player`, auto-level if the threshold is crossed,
 * and push both updates to the client.
 */
export function addExperience(player: Player, amount: number): number {
	const state = PLAYER_STATES.get(player);
	if (!state) return 0;
	const newXP = state.expierence + amount;
	const newLevel = math.ceil(newXP / 1000);
	const didLevelUp = newLevel !== state.level;
	PLAYER_STATES.set(player, { ...state, expierence: newXP, level: newLevel });
	pushExpierenceUpdate(player);
	if (didLevelUp) pushLevelUpdate(player);
	return newXP;
}

/**
 * Record a kill against `npcName` for `player`.
 * If the NPC has been killed before, its count is incremented.
 * If it's a first kill, a fresh record is created from `meta`.
 */
export function addKill(player: Player, npcName: string, meta: NPCKillMeta, wasBountyKill = false): void {
	const state = PLAYER_STATES.get(player);
	if (!state) return;

	const existing: NPCKillRecord | undefined = state.killLog[npcName] as NPCKillRecord | undefined;
	const updated: NPCKillRecord = {
		count: (existing?.count ?? 0) + 1,
		bountyKills: (existing?.bountyKills ?? 0) + (wasBountyKill ? 1 : 0),
		status: meta.status,
		race: meta.race,
		tier: meta.tier ?? "Standard",
	};

	// Build a new killLog object — spread keeps all other NPC entries intact
	const updatedLog: KillLog = { ...state.killLog };
	updatedLog[npcName] = updated;

	PLAYER_STATES.set(player, {
		...state,
		killLog: updatedLog,
		totalNPCKills: state.totalNPCKills + 1,
	});
}

/** Return the full kill log for `player` (server-side read). */
export function getKillLog(player: Player): KillLog {
	return PLAYER_STATES.get(player)?.killLog ?? {};
}

/** Return how many times `player` has killed the NPC named `npcName`. */
export function getKillCount(player: Player, npcName: string): number {
	const record = (PLAYER_STATES.get(player)?.killLog ?? {})[npcName] as NPCKillRecord | undefined;
	return record?.count ?? 0;
}

// ── PvP tracking ───────────────────────────────────────────────────────────────

/** Increment player kill count (PvP). */
export function addPlayerKill(player: Player): void {
	const state = PLAYER_STATES.get(player);
	if (!state) return;
	PLAYER_STATES.set(player, { ...state, playerKills: state.playerKills + 1 });
}

/** Increment player death count (PvP). */
export function addPlayerDeath(player: Player): void {
	const state = PLAYER_STATES.get(player);
	if (!state) return;
	PLAYER_STATES.set(player, { ...state, playerDeaths: state.playerDeaths + 1 });
}

// ── Completed bounty collection ──────────────────────────────────────────────────

/** Add a completed bounty to the player's pending collection. */
export function addCompletedBounty(player: Player, npcName: string, gold: number, xp: number, offence: string): void {
	const state = PLAYER_STATES.get(player);
	if (!state) return;
	const entry: CompletedBountyEntry = {
		npcName,
		gold,
		xp,
		offence,
		completedAt: os.time(),
	};
	PLAYER_STATES.set(player, {
		...state,
		completedBounties: [...state.completedBounties, entry],
	});
}

/** Turn in all completed bounties — award gold/XP, move to history, return total. */
export function turnInBounties(player: Player): { totalGold: number; totalXP: number; count: number } {
	const state = PLAYER_STATES.get(player);
	if (!state || state.completedBounties.size() === 0) return { totalGold: 0, totalXP: 0, count: 0 };

	let totalGold = 0;
	let totalXP = 0;
	for (const b of state.completedBounties) {
		totalGold += b.gold;
		totalXP += b.xp;
	}

	const count = state.completedBounties.size();
	PLAYER_STATES.set(player, {
		...state,
		completedBounties: [],
		turnedInBounties: [...state.turnedInBounties, ...state.completedBounties],
	});

	addCoins(player, totalGold);
	addExperience(player, totalXP);
	addScore(player, totalGold);

	return { totalGold, totalXP, count };
}

/** Read completed bounties pending turn-in (server-side). */
export function getCompletedBounties(player: Player): CompletedBountyEntry[] {
	return PLAYER_STATES.get(player)?.completedBounties ?? [];
}

/** Read the full player state snapshot (for kill book data sync). */
export function getPlayerStateSnapshot(player: Player): PlayerState | undefined {
	return PLAYER_STATES.get(player);
}

// ── Achievements ─────────────────────────────────────────────────────────────

/** Unlock an achievement by ID if not already unlocked. Returns true if newly unlocked. */
export function unlockAchievement(player: Player, achievementId: string): boolean {
	const state = PLAYER_STATES.get(player);
	if (!state) return false;
	if (state.unlockedAchievements.includes(achievementId)) return false;
	PLAYER_STATES.set(player, {
		...state,
		unlockedAchievements: [...state.unlockedAchievements, achievementId],
	});
	return true;
}

/** Check if player has a specific achievement. */
export function hasAchievement(player: Player, achievementId: string): boolean {
	return PLAYER_STATES.get(player)?.unlockedAchievements.includes(achievementId) ?? false;
}

RequestAddLevel.OnServerInvoke = (player: Player, ...args: unknown[]) => {
	LevelUpdated.FireClient(player, PLAYER_STATES.get(player)?.level ?? DEFAULT_STATE.level);
};

RequestAddCoins.OnServerInvoke = (player: Player, ...args: unknown[]) => {
	const playerState = PLAYER_STATES.get(player);
	const [coinsToAddFromArgs] = args;
	if (typeOf(coinsToAddFromArgs) !== "number" || !playerState) {
		return false;
	}
	const coinsToAdd = coinsToAddFromArgs as number;
	const currentPlayerCoins: number = playerState?.coins ?? 0;
	const newCoinTotal: number = currentPlayerCoins + coinsToAdd;

	PLAYER_STATES.set(player, { ...playerState, coins: newCoinTotal });

	CoinsUpdated.FireClient(player, PLAYER_STATES.get(player)?.coins ?? DEFAULT_STATE.coins);
};

RequestAddExpierence.OnServerInvoke = (player, ...args: unknown[]) => {
	const playerState = PLAYER_STATES.get(player);
	const expierence = playerState?.expierence ?? DEFAULT_STATE.expierence;
	const [newExpierenceGainedFromArgs] = args;
	if (typeOf(newExpierenceGainedFromArgs) !== "number") {
		return false;
	}
	const newExpierenceGained = newExpierenceGainedFromArgs as number;
	if (playerState === undefined || expierence === undefined || newExpierenceGained === undefined) {
		return false;
	}
	const newExpierenceTotal = expierence + newExpierenceGained;
	PLAYER_STATES.set(player, { ...playerState, expierence: newExpierenceTotal });
	pushExpierenceUpdate(player);

	const playerLevelAccoringToCurrentXP = math.ceil(newExpierenceTotal / 1000);
	if (playerLevelAccoringToCurrentXP !== playerState.level) {
		PLAYER_STATES.set(player, { ...playerState, level: playerLevelAccoringToCurrentXP });
		pushLevelUpdate(player);
	}
	return true;
};
