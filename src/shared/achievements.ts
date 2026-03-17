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
	/** Title ID granted when this achievement is first unlocked. */
	titleId?: string;
}

/** All achievements in the game, keyed by ID. */
export const ACHIEVEMENTS: Record<string, AchievementDef> = {
	FIRST_ASSASSINATION: {
		id: "FIRST_ASSASSINATION",
		name: "First Blood",
		description: "Perform your first assassination.",
		icon: "I",
		titleId: "first_blood",
	},
	BOUNTY_HUNTER: {
		id: "BOUNTY_HUNTER",
		name: "Bounty Hunter",
		description: "Complete 10 bounty contracts.",
		icon: "X",
		titleId: "bounty_hunter",
	},
	PLAYER_SLAYER: {
		id: "PLAYER_SLAYER",
		name: "Player Slayer",
		description: "Assassinate a wanted player.",
		icon: "P",
		titleId: "slayer",
	},
	MOCK_TEST: {
		id: "MOCK_TEST",
		name: "Night Owl",
		description: "Lurk in the shadows long enough to earn your title.",
		icon: "*",
		titleId: "night_owl",
	},
};

/** Ordered list for display purposes. */
export const ACHIEVEMENT_LIST: AchievementDef[] = [
	ACHIEVEMENTS.FIRST_ASSASSINATION,
	ACHIEVEMENTS.BOUNTY_HUNTER,
	ACHIEVEMENTS.PLAYER_SLAYER,
	ACHIEVEMENTS.MOCK_TEST,
];
