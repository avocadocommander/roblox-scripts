/**
 * Achievement definitions — data-only config, shared between server and client.
 *
 * To add a new achievement, add an entry to `ACHIEVEMENTS`.
 * ACHIEVEMENT_LIST is built automatically for ordered display.
 *
 * Gameplay systems award achievements by calling the achievement service with
 * an achievement ID. Do NOT embed unlock logic here.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AchievementCategory = "combat" | "exploration" | "social" | "crafting" | "collection" | "general";

export type AchievementVisibility = "visible" | "hidden" | "secret";

export interface AchievementReward {
	/** Gold granted on unlock. */
	coins?: number;
	/** XP granted on unlock. */
	xp?: number;
	/** Title ID unlocked (from titles config). */
	titleId?: string;
	/** Inventory item granted (id from shared/inventory). */
	itemId?: string;
	/** How many of the item to grant. Defaults to 1 when itemId is set. */
	itemCount?: number;
}

export interface AchievementDef {
	id: string;
	/** Display name. */
	title: string;
	/** Short description of how to earn this. */
	description: string;
	/** Short ASCII icon/symbol for compact UI. */
	icon: string;
	/** Category for grouping in a future codex/journal. */
	category?: AchievementCategory;
	/** Sort order within its category (lower = earlier). Default 0. */
	sortOrder?: number;
	/**
	 * Visibility state:
	 *  - "visible": always shown in UI even if locked
	 *  - "hidden": shown only after unlock
	 *  - "secret": title/description masked until unlock
	 * Default "visible".
	 */
	visibility?: AchievementVisibility;
	/** Optional reward granted on unlock. */
	reward?: AchievementReward;
	/** Roblox badge ID to award alongside this achievement. undefined = no badge. */
	badgeId?: number;
}

// ── The Registry ──────────────────────────────────────────────────────────────

export const ACHIEVEMENTS: Record<string, AchievementDef> = {
	MET_GUILD_LEADER: {
		id: "MET_GUILD_LEADER",
		title: "Introductions",
		description: "Speak to the Guild Leader.",
		icon: ">",
		category: "social",
		sortOrder: 0,
		reward: { itemId: "dagger", itemCount: 1 },
	},
	EQUIPPED_DAGGER: {
		id: "EQUIPPED_DAGGER",
		title: "Drawn Steel",
		description: "Equip your first blade.",
		icon: "/",
		category: "combat",
		sortOrder: 0,
	},
	REVIEWED_BOARD: {
		id: "REVIEWED_BOARD",
		title: "The Board",
		description: "Review the bounty board.",
		icon: "B",
		category: "general",
		sortOrder: 0,
	},
	FIRST_ASSASSINATION: {
		id: "FIRST_ASSASSINATION",
		title: "First Blood",
		description: "Perform your first assassination.",
		icon: "I",
		category: "combat",
		sortOrder: 1,
		reward: { titleId: "first_blood" },
	},
	FIRST_TURN_IN: {
		id: "FIRST_TURN_IN",
		title: "Paid in Full",
		description: "Turn in your first completed bounty scroll.",
		icon: "$",
		category: "general",
		sortOrder: 1,
	},
	BOUNTY_HUNTER: {
		id: "BOUNTY_HUNTER",
		title: "Bounty Hunter",
		description: "Complete 10 bounty contracts.",
		icon: "X",
		category: "combat",
		sortOrder: 2,
		reward: { titleId: "bounty_hunter" },
	},
	PLAYER_SLAYER: {
		id: "PLAYER_SLAYER",
		title: "Player Slayer",
		description: "Assassinate a wanted player.",
		icon: "P",
		category: "combat",
		sortOrder: 3,
		reward: { titleId: "slayer" },
	},
	MOCK_TEST: {
		id: "MOCK_TEST",
		title: "Night Owl",
		description: "Lurk in the shadows long enough to earn your title.",
		icon: "*",
		category: "general",
		sortOrder: 99,
		reward: { titleId: "night_owl" },
	},
	FIRST_CONTRACT: {
		id: "FIRST_CONTRACT",
		title: "First Contract",
		description: "A marked target yields reward. Contracts define purpose.",
		icon: "C",
		category: "combat",
		sortOrder: 10,
	},
	A_COSTLY_MISTAKE: {
		id: "A_COSTLY_MISTAKE",
		title: "A Costly Mistake",
		description: "Killing the unmarked draws attention. The Guard responds to disorder.",
		icon: "!",
		category: "combat",
		sortOrder: 11,
	},
	MARKED_BY_THE_REALM: {
		id: "MARKED_BY_THE_REALM",
		title: "Marked by the Realm",
		description: "Once marked, others may hunt you. Not all hunters wear the same face.",
		icon: "M",
		category: "combat",
		sortOrder: 12,
	},
	A_CURIOUS_MIND: {
		id: "A_CURIOUS_MIND",
		title: "A Curious Mind",
		description: "Clues and patterns exist beyond the obvious. Observation reveals advantage.",
		icon: "?",
		category: "exploration",
		sortOrder: 10,
	},
	FIRST_PURCHASE: {
		id: "FIRST_PURCHASE",
		title: "First Purchase",
		description: "Coin opens doors. Merchants provide tools beyond the blade.",
		icon: "G",
		category: "general",
		sortOrder: 10,
	},
	COATED_STEEL: {
		id: "COATED_STEEL",
		title: "Coated Steel",
		description: "Poisons alter outcomes. A prepared blade carries more than steel.",
		icon: "~",
		category: "crafting",
		sortOrder: 10,
	},
	A_TASTE_OF_POWER: {
		id: "A_TASTE_OF_POWER",
		title: "A Taste of Power",
		description: "Elixirs enhance the body. Their effects fade, but advantage remains.",
		icon: "+",
		category: "crafting",
		sortOrder: 11,
	},
};

/** Ordered list for display — sorted by category then sortOrder. */
export const ACHIEVEMENT_LIST: AchievementDef[] = (() => {
	const list: AchievementDef[] = [];
	for (const [, def] of pairs(ACHIEVEMENTS)) {
		list.push(def);
	}
	list.sort((a, b) => (a.sortOrder ?? 0) < (b.sortOrder ?? 0));
	return list;
})();
