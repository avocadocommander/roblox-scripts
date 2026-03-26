/**
 * Faction Registry — data-only config.
 *
 * Two rival guilds compete for the player's loyalty.  Turning in bounties at
 * a guild leader awards XP to that specific faction.  The player's *overall*
 * level is derived from the sum of all faction XP.
 *
 * To add a new faction: add an entry to FACTIONS, add the id to FactionId.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** All valid faction identifiers. */
export type FactionId = "Night" | "Dawn";

export interface FactionDef {
	id: FactionId;
	/** Display name shown in UI. */
	name: string;
	/** Short description / motto. */
	motto: string;
	/** The NPC name of the guild leader who accepts turn-ins for this faction. */
	leaderNPC: string;
	/** Colour used in UI for this faction (R, G, B). */
	color: Color3;
}

/** Per-faction XP record stored on the player. */
export type FactionXP = { [K in FactionId]: number };

// ── Config ────────────────────────────────────────────────────────────────────

export const FACTIONS: Record<FactionId, FactionDef> = {
	Night: {
		id: "Night",
		name: "The Night Guild",
		motto: "We are the shadow between stars.",
		leaderNPC: "Thorne Æshgrave",
		color: new Color3(0.35, 0.25, 0.55),
	},
	Dawn: {
		id: "Dawn",
		name: "The Dawn Order",
		motto: "Light demands sacrifice.",
		leaderNPC: "Bertram de Mere",
		color: new Color3(0.8, 0.65, 0.25),
	},
};

export const FACTION_IDS: FactionId[] = ["Night", "Dawn"];

export const DEFAULT_FACTION_XP: FactionXP = { Night: 0, Dawn: 0 };

// ── XP / Level helpers ────────────────────────────────────────────────────────

/** XP needed to reach a given level (1-based). Level 1 = 0 XP. */
export function xpForLevel(level: number): number {
	if (level <= 1) return 0;
	return (level - 1) * 1000;
}

/** Derive a level from raw XP. Minimum level is 1. */
export function levelFromXP(xp: number): number {
	if (xp <= 0) return 1;
	return math.floor(xp / 1000) + 1;
}

/** Sum all faction XP into a single total. */
export function totalXPFromFactions(fxp: FactionXP): number {
	let sum = 0;
	for (const fid of FACTION_IDS) {
		sum += fxp[fid];
	}
	return sum;
}

/** Derive overall level from combined faction XP. */
export function overallLevelFromFactions(fxp: FactionXP): number {
	return levelFromXP(totalXPFromFactions(fxp));
}

/** Look up which faction a guild-leader NPC belongs to (or undefined). */
export function factionForNPC(npcName: string): FactionId | undefined {
	for (const fid of FACTION_IDS) {
		if (FACTIONS[fid].leaderNPC === npcName) return fid;
	}
	return undefined;
}
