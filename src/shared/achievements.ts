/**
 * Achievement definitions — shared between server and client.
 * Each achievement has an ID, display info, and a description of its unlock condition.
 */

export interface AchievementDef {
	id: string;
	name: string;
	description: string;
	/** Icon text shown in the kill book (short symbol or emoji-safe label). */
	icon: string;
}

/** All achievements in the game, keyed by ID. */
export const ACHIEVEMENTS: Record<string, AchievementDef> = {
	FIRST_ASSASSINATION: {
		id: "FIRST_ASSASSINATION",
		name: "First Blood",
		description: "Perform your first assassination.",
		icon: "I",
	},
	BOUNTY_HUNTER: {
		id: "BOUNTY_HUNTER",
		name: "Bounty Hunter",
		description: "Complete 10 bounty contracts.",
		icon: "X",
	},
	PLAYER_SLAYER: {
		id: "PLAYER_SLAYER",
		name: "Player Slayer",
		description: "Assassinate a wanted player.",
		icon: "P",
	},
};

/** Ordered list for display purposes. */
export const ACHIEVEMENT_LIST: AchievementDef[] = [
	ACHIEVEMENTS.FIRST_ASSASSINATION,
	ACHIEVEMENTS.BOUNTY_HUNTER,
	ACHIEVEMENTS.PLAYER_SLAYER,
];
