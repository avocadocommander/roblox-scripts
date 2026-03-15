/**
 * Inventory system — shared types and item catalogue.
 *
 * Design:
 *   - Fixed slot bar: WEAPON, POISON, POTION_1, POTION_2, POTION_3
 *   - Each item has a `slotType` that determines which slot(s) it fits
 *   - A generic inventory grid shows ALL owned items; selecting a slot
 *     filters the grid to items that fit that slot
 *   - Click an item while a slot is selected → equip it there
 *   - Double-click an item in the general view → auto-equip to first
 *     compatible empty slot (or swap if all occupied)
 */

// ── Slot types ────────────────────────────────────────────────────────────────

export type SlotType = "weapon" | "poison" | "potion";

/** The fixed slot layout. Index = visual position left-to-right. */
export interface SlotDef {
	id: string;
	label: string;
	slotType: SlotType;
	/** Short icon character shown in the slot when empty. */
	emptyIcon: string;
}

export const SLOT_LAYOUT: SlotDef[] = [
	{ id: "weapon", label: "Weapon", slotType: "weapon", emptyIcon: "/" },
	{ id: "poison", label: "Poison", slotType: "poison", emptyIcon: "~" },
	{ id: "potion1", label: "Potion", slotType: "potion", emptyIcon: "+" },
	{ id: "potion2", label: "Potion", slotType: "potion", emptyIcon: "+" },
	{ id: "potion3", label: "Potion", slotType: "potion", emptyIcon: "+" },
];

// ── Item definitions ──────────────────────────────────────────────────────────

export interface ItemDef {
	id: string;
	name: string;
	/** Flavour text shown in the tooltip. */
	description: string;
	/** Mechanical effect description (e.g. "+20 HP over 5s"). */
	effect: string;
	/** Display type label for the tooltip (e.g. "Blade", "Elixir", "Vial"). */
	itemType: string;
	/** Which slot type this item can fit into. */
	slotType: SlotType;
	/** Short icon character for the inventory grid tile. */
	icon: string;
	/** Rarity tier — drives border colour via STATUS_RARITY-like mapping. */
	rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
	/** Whether this item is consumed on use (potions, poisons). */
	consumable: boolean;
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
		slotType: "weapon",
		icon: "/",
		rarity: "common",
		consumable: false,
	},
	rusty_dagger: {
		id: "rusty_dagger",
		name: "Rusty Dagger",
		description: "A pitted blade that has seen better days. Unreliable but sharp enough.",
		effect: "+5 melee damage. 10% chance to inflict Tetanus (slow).",
		itemType: "Blade",
		slotType: "weapon",
		icon: "/",
		rarity: "uncommon",
		consumable: false,
	},
	shadow_blade: {
		id: "shadow_blade",
		name: "Shadow Blade",
		description: "Forged in darkness. Whispers when drawn. The edge drinks light.",
		effect: "+18 melee damage. Stealth kills deal 2x. Silent strikes.",
		itemType: "Blade",
		slotType: "weapon",
		icon: "/",
		rarity: "epic",
		consumable: false,
	},

	// ── Poisons ────────────────────────────────────────────────────────────
	nightshade: {
		id: "nightshade",
		name: "Nightshade Extract",
		description: "Distilled from deadly nightshade berries. Coat your blade before the kill.",
		effect: "Applied to weapon. Target slowed 40% for 6s on hit.",
		itemType: "Vial",
		slotType: "poison",
		icon: "~",
		rarity: "rare",
		consumable: true,
	},
	serpent_venom: {
		id: "serpent_venom",
		name: "Serpent Venom",
		description: "Milked from a pit viper. Burns from within — fast and agonising.",
		effect: "Applied to weapon. 8 damage/s for 4s. Stacks up to 3x.",
		itemType: "Vial",
		slotType: "poison",
		icon: "~",
		rarity: "epic",
		consumable: true,
	},

	// ── Potions / Elixirs ────────────────────────────────────────────────────
	minor_heal: {
		id: "minor_heal",
		name: "Minor Healing Draught",
		description: "A murky tincture brewed from swamp moss. Tastes foul, works fast.",
		effect: "Restores 20 HP instantly.",
		itemType: "Elixir",
		slotType: "potion",
		icon: "+",
		rarity: "common",
		consumable: true,
	},
	swiftness: {
		id: "swiftness",
		name: "Elixir of Swiftness",
		description: "Quicksilver and ginger root. Your legs tingle, then blur.",
		effect: "+30% move speed for 8s.",
		itemType: "Elixir",
		slotType: "potion",
		icon: "+",
		rarity: "uncommon",
		consumable: true,
	},
	invisibility: {
		id: "invisibility",
		name: "Cloak Draught",
		description: "Light bends around you. Even your shadow fades.",
		effect: "Invisible for 5s. Breaks on attack or damage taken.",
		itemType: "Elixir",
		slotType: "potion",
		icon: "+",
		rarity: "rare",
		consumable: true,
	},
	fortify: {
		id: "fortify",
		name: "Ironhide Tonic",
		description: "Powdered iron filings in a thick ale. Your skin hardens like scale.",
		effect: "-40% damage taken for 10s.",
		itemType: "Elixir",
		slotType: "potion",
		icon: "+",
		rarity: "uncommon",
		consumable: true,
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

// ── Equipped state (sent over the wire) ───────────────────────────────────────

/** Maps slot ID → equipped item ID (or undefined if empty). */
export type EquippedSlots = Record<string, string | undefined>;

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
	/** Currently equipped slot mapping. */
	equipped: EquippedSlots;
	/** Collected bounty scrolls (up to MAX_BOUNTY_SLOTS). */
	bountyScrolls: BountyScrollPayload;
}
