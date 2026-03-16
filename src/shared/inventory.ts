/**
 * Inventory system — shared types and item catalogue.
 *
 * Design:
 *   - Three item categories: Weapon, Poison, Elixir
 *   - Weapons: equip from inventory (one active weapon at a time)
 *   - Poisons: activate from inventory, last 1 hour — affect assassination kills
 *   - Elixirs: activate from inventory, immediate or long-term buff on the player
 *   - No fixed equip slot bar — items are used/activated directly from the grid
 */

// ── Item categories ───────────────────────────────────────────────────────────

export type ItemCategory = "weapon" | "poison" | "elixir";

// ── Poison effect constants (hook up logic later) ─────────────────────────────

export type PoisonEffect =
	| "floating_death"   // target floats upward for N seconds then dies
	| "slow_decay"       // target slowed then dies after delay
	| "paralysis"        // target frozen in place then dies
	| "combustion"       // target bursts into flame then dies
	| "phantom_fade";    // target becomes translucent, fades out, then dies

export const POISON_EFFECT_LABELS: Record<PoisonEffect, string> = {
	floating_death: "Float",
	slow_decay: "Decay",
	paralysis: "Paralyse",
	combustion: "Combust",
	phantom_fade: "Fade",
};

// ── Elixir effect constants (hook up logic later) ─────────────────────────────

export type ElixirEffect =
	| "speed_boost"       // +move speed
	| "jump_boost"        // +jump height
	| "detection_shrink"  // reduced detection radius
	| "target_outline"    // see your bounty target outlined
	| "health_regen"      // passive HP regen
	| "stealth_boost";    // harder to detect while sneaking

export const ELIXIR_EFFECT_LABELS: Record<ElixirEffect, string> = {
	speed_boost: "Swiftness",
	jump_boost: "Leap",
	detection_shrink: "Shadow",
	target_outline: "Eagle Eye",
	health_regen: "Vitality",
	stealth_boost: "Ghost",
};

// ── Duration constants ────────────────────────────────────────────────────────

/** Default poison duration in seconds (1 hour). */
export const POISON_DURATION_SECS = 3600;
/** Default elixir duration in seconds (1 hour for long-term effects). */
export const ELIXIR_DURATION_SECS = 3600;

// ── Item definitions ──────────────────────────────────────────────────────────

export interface ItemDef {
	id: string;
	name: string;
	/** Flavour text shown in the tooltip. */
	description: string;
	/** Mechanical effect description shown in gold text. */
	effect: string;
	/** Display type label for the tooltip (e.g. "Blade", "Vial", "Elixir"). */
	itemType: string;
	/** Which category this item belongs to. */
	category: ItemCategory;
	/** Short icon character for the inventory grid tile. */
	icon: string;
	/** Rarity tier — drives border colour. */
	rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
	/** Whether this item is consumed on use (poisons, elixirs). */
	consumable: boolean;
	/** Poison effect type (only for category "poison"). */
	poisonEffect?: PoisonEffect;
	/** Delay in seconds between assassination and NPC death (poisons). */
	poisonDelaySecs?: number;
	/** Elixir effect type (only for category "elixir"). */
	elixirEffect?: ElixirEffect;
	/** Duration in seconds for the effect (0 = instant). */
	effectDurationSecs?: number;
}

/** Master item catalogue — keyed by item ID. */
export const ITEMS: Record<string, ItemDef> = {
	// ── Weapons ────────────────────────────────────────────────────────────
	fists: {
		id: "fists",
		name: "Fists",
		description: "Your bare knuckles. Better than nothing.",
		effect: "Base melee. No bonus damage.",
		itemType: "Unarmed",
		category: "weapon",
		icon: "/",
		rarity: "common",
		consumable: false,
	},
	dagger: {
		id: "dagger",
		name: "Dagger",
		description: "A short, sharp blade. Quick and quiet.",
		effect: "+8 melee damage. Fast attack speed.",
		itemType: "Blade",
		category: "weapon",
		icon: "/",
		rarity: "uncommon",
		consumable: false,
	},

	// ── Poisons ────────────────────────────────────────────────────────────
	floating_death: {
		id: "floating_death",
		name: "Floating Death",
		description: "A spectral toxin that severs the body from the earth. The victim drifts skyward before the end.",
		effect: "Target floats upward for 4s, then dies.",
		itemType: "Vial",
		category: "poison",
		icon: "~",
		rarity: "rare",
		consumable: true,
		poisonEffect: "floating_death",
		poisonDelaySecs: 4,
		effectDurationSecs: POISON_DURATION_SECS,
	},
	slow_decay: {
		id: "slow_decay",
		name: "Nightshade Extract",
		description: "Distilled from deadly nightshade. The victim's movements slow to a crawl.",
		effect: "Target slowed 50% for 6s, then dies.",
		itemType: "Vial",
		category: "poison",
		icon: "~",
		rarity: "uncommon",
		consumable: true,
		poisonEffect: "slow_decay",
		poisonDelaySecs: 6,
		effectDurationSecs: POISON_DURATION_SECS,
	},
	paralysis_toxin: {
		id: "paralysis_toxin",
		name: "Paralysis Toxin",
		description: "Extracted from a cave spider's glands. Locks every muscle in place.",
		effect: "Target frozen for 3s, then dies.",
		itemType: "Vial",
		category: "poison",
		icon: "~",
		rarity: "epic",
		consumable: true,
		poisonEffect: "paralysis",
		poisonDelaySecs: 3,
		effectDurationSecs: POISON_DURATION_SECS,
	},
	dragons_breath: {
		id: "dragons_breath",
		name: "Dragon's Breath",
		description: "Volatile alchemical fire condensed into a vial. Burns from within.",
		effect: "Target bursts into flame for 5s, then dies.",
		itemType: "Vial",
		category: "poison",
		icon: "~",
		rarity: "legendary",
		consumable: true,
		poisonEffect: "combustion",
		poisonDelaySecs: 5,
		effectDurationSecs: POISON_DURATION_SECS,
	},
	phantom_venom: {
		id: "phantom_venom",
		name: "Phantom Venom",
		description: "A ghostly substance that dissolves the body into mist. Eerie and silent.",
		effect: "Target fades to translucent over 4s, then dies.",
		itemType: "Vial",
		category: "poison",
		icon: "~",
		rarity: "rare",
		consumable: true,
		poisonEffect: "phantom_fade",
		poisonDelaySecs: 4,
		effectDurationSecs: POISON_DURATION_SECS,
	},

	// ── Elixirs ────────────────────────────────────────────────────────────
	swiftness_elixir: {
		id: "swiftness_elixir",
		name: "Elixir of Swiftness",
		description: "Quicksilver and ginger root. Your legs tingle, then blur.",
		effect: "+30% move speed for 1 hour.",
		itemType: "Elixir",
		category: "elixir",
		icon: "+",
		rarity: "uncommon",
		consumable: true,
		elixirEffect: "speed_boost",
		effectDurationSecs: ELIXIR_DURATION_SECS,
	},
	sky_step: {
		id: "sky_step",
		name: "Sky Step Tonic",
		description: "Infused with powdered cloud crystal. Gravity loosens its grip on you.",
		effect: "+50% jump height for 1 hour.",
		itemType: "Elixir",
		category: "elixir",
		icon: "+",
		rarity: "rare",
		consumable: true,
		elixirEffect: "jump_boost",
		effectDurationSecs: ELIXIR_DURATION_SECS,
	},
	shadow_cloak: {
		id: "shadow_cloak",
		name: "Shadow Cloak Draught",
		description: "Brewed from midnight moss. Your presence shrinks from the world's notice.",
		effect: "Detection radius reduced 40% for 1 hour.",
		itemType: "Elixir",
		category: "elixir",
		icon: "+",
		rarity: "rare",
		consumable: true,
		elixirEffect: "detection_shrink",
		effectDurationSecs: ELIXIR_DURATION_SECS,
	},
	eagle_eye: {
		id: "eagle_eye",
		name: "Eagle Eye Serum",
		description: "Distilled raptor essence. Your vision sharpens beyond mortal limits.",
		effect: "See your bounty target outlined for 1 hour.",
		itemType: "Elixir",
		category: "elixir",
		icon: "+",
		rarity: "epic",
		consumable: true,
		elixirEffect: "target_outline",
		effectDurationSecs: ELIXIR_DURATION_SECS,
	},
	vitality_draught: {
		id: "vitality_draught",
		name: "Vitality Draught",
		description: "A warm tincture of troll blood and willow bark. Wounds close on their own.",
		effect: "Passive HP regeneration for 1 hour.",
		itemType: "Elixir",
		category: "elixir",
		icon: "+",
		rarity: "uncommon",
		consumable: true,
		elixirEffect: "health_regen",
		effectDurationSecs: ELIXIR_DURATION_SECS,
	},
	ghost_oil: {
		id: "ghost_oil",
		name: "Ghost Oil",
		description: "Rendered from spectral fat. Your footsteps vanish, your breath silences.",
		effect: "Harder to detect while sneaking for 1 hour.",
		itemType: "Elixir",
		category: "elixir",
		icon: "+",
		rarity: "epic",
		consumable: true,
		elixirEffect: "stealth_boost",
		effectDurationSecs: ELIXIR_DURATION_SECS,
	},
};

/** Convenience list of all items for iteration. */
export const ITEM_LIST: ItemDef[] = (() => {
	const list: ItemDef[] = [];
	for (const [, def] of pairs(ITEMS)) {
		list.push(def);
	}
	return list;
})();

// ── Rarity colours (matches the assassin/pirate palette) ──────────────────────

export const RARITY_COLORS: Record<string, Color3> = {
	common: Color3.fromRGB(108, 100, 90),
	uncommon: Color3.fromRGB(68, 138, 82),
	rare: Color3.fromRGB(58, 108, 168),
	epic: Color3.fromRGB(128, 68, 148),
	legendary: Color3.fromRGB(195, 155, 50),
	player: Color3.fromRGB(190, 40, 40),
};

/** Human-readable rarity labels for tooltips. */
export const RARITY_LABELS: Record<string, string> = {
	common: "Common",
	uncommon: "Uncommon",
	rare: "Rare",
	epic: "Epic",
	legendary: "Legendary",
	player: "Player",
};

/** Faint background tint for tooltip cards, per rarity. */
export const RARITY_BG_COLORS: Record<string, Color3> = {
	common: Color3.fromRGB(22, 20, 18),
	uncommon: Color3.fromRGB(16, 26, 18),
	rare: Color3.fromRGB(14, 20, 30),
	epic: Color3.fromRGB(24, 14, 30),
	legendary: Color3.fromRGB(30, 26, 12),
	player: Color3.fromRGB(32, 10, 10),
};

// ── Bounty scrolls ────────────────────────────────────────────────────────────

/** Maximum bounty scroll slots a player can hold. */
export const MAX_BOUNTY_SLOTS = 4;

/** Rarity tiers that a bounty scroll can inherit from NPC status (or PvP kill). */
export type BountyScrollRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "player";

/** Maps NPC social status to a scroll rarity tier. */
export const STATUS_TO_SCROLL_RARITY: Record<string, BountyScrollRarity> = {
	Serf: "common",
	Commoner: "uncommon",
	Merchant: "rare",
	Nobility: "epic",
	Royalty: "legendary",
};

/** A collected bounty scroll that sits in the player's inventory. */
export interface BountyScroll {
	/** Unique ID for this specific scroll instance (e.g. "scroll_1"). */
	slotIndex: number;
	/** Name of the assassination target. */
	targetName: string;
	/** Rarity colour tier. */
	rarity: BountyScrollRarity;
	/** Gold reward to claim on turn-in. */
	gold: number;
	/** XP reward to claim on turn-in. */
	xp: number;
}

/** Wire-friendly scroll payload (array of up to MAX_BOUNTY_SLOTS). */
export type BountyScrollPayload = BountyScroll[];

// ── Full inventory payload ────────────────────────────────────────────────────

/** Player's full inventory payload sent from server to client. */
export interface InventoryPayload {
	/** All item IDs the player owns (with counts). */
	ownedItems: Record<string, number>;
	/** Currently equipped weapon ID (or undefined if fists). */
	equippedWeapon: string | undefined;
	/** Currently active poison ID (or undefined if none). */
	activePoison: string | undefined;
	/** Active elixir IDs (can have multiple at once). */
	activeElixirs: string[];
	/** Collected bounty scrolls (up to MAX_BOUNTY_SLOTS). */
	bountyScrolls: BountyScrollPayload;
}
