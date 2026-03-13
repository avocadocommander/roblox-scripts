import { Race, Status } from "./module";

/**
 * Future-facing tier classification for NPCs.
 * All current NPCs are "Standard". When special NPCs are added (mini-bosses,
 * bounty lords, event NPCs, etc.) give them a higher tier and reward logic
 * can scale accordingly.
 */
export type NPCTier = "Standard" | "Elite" | "Boss" | "Legendary";

/**
 * Everything tracked per unique NPC name in a player's kill log.
 * Add new fields here as the system grows (e.g. `lastKilledAt`, `streakRecord`).
 */
export interface NPCKillRecord {
	/** Total number of times this player has killed this NPC. */
	count: number;
	/** Social status of the NPC — acts as the base difficulty indicator. */
	status: Status;
	/** The NPC's race. */
	race: Race;
	/**
	 * Tier classification.
	 * "Standard" → ordinary NPC.
	 * "Elite" / "Boss" / "Legendary" → future special NPCs.
	 */
	tier: NPCTier;
}

/** The full kill log stored per player: NPC name → kill record. */
export type KillLog = Record<string, NPCKillRecord>;

/** Minimum info needed to register a kill — passed by the caller. */
export interface NPCKillMeta {
	status: Status;
	race: Race;
	/** Defaults to "Standard" if omitted. */
	tier?: NPCTier;
}
