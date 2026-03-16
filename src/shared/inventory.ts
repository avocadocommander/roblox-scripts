/**
 * Inventory system — shared types, unified item catalogue, and rarity helpers.
 *
 * Design:
 *   - Three item categories: Weapon, Poison, Elixir
 *   - Weapons: equip from inventory (one active weapon at a time)
 *   - Poisons: coat current weapon on activation, last 30 min by default
 *   - Elixirs: immediate or long-term buff on the player
 *   - No fixed equip slot bar — items are used/activated directly from the grid
 *
 * Individual item data lives in the config files:
 *   shared/config/weapons.ts
 *   shared/config/poisons.ts
 *   shared/config/elixirs.ts
 */

import { WEAPONS, WEAPON_LIST, WeaponDef } from "shared/config/weapons";
import { POISONS, POISON_LIST, PoisonDef } from "shared/config/poisons";
import { ELIXIRS, ELIXIR_LIST, ElixirDef } from "shared/config/elixirs";

// Re-export config types so consumers can import from one place
export type { WeaponDef, PoisonDef, ElixirDef };
export { WEAPONS, WEAPON_LIST, POISONS, POISON_LIST, ELIXIRS, ELIXIR_LIST };

// ── Item categories ───────────────────────────────────────────────────────────

export type ItemCategory = "weapon" | "poison" | "elixir" | "scroll";

// ── Unified item definition (used by grid / tooltips) ─────────────────────────

/**
 * Flat item record the inventory UI can render regardless of category.
 * Built automatically from the three config maps at startup.
 */
export interface ItemDef {
	id: string;
	name: string;
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
}

// ── Build ITEMS + ITEM_LIST from config maps ──────────────────────────────────

/** Master item catalogue — keyed by item ID. */
export const ITEMS: Record<string, ItemDef> = {};

// Weapons
for (const [, w] of pairs(WEAPONS)) {
	ITEMS[w.id] = {
		id: w.id,
		name: w.name,
		description: w.description,
		effect: w.effect,
		itemType: w.weaponType,
		category: "weapon",
		icon: w.icon,
		rarity: w.rarity,
		consumable: false,
	};
}

// Poisons
for (const [, p] of pairs(POISONS)) {
	ITEMS[p.id] = {
		id: p.id,
		name: p.name,
		description: p.description,
		effect: p.effect,
		itemType: p.poisonType,
		category: "poison",
		icon: p.icon,
		rarity: p.rarity,
		consumable: true,
	};
}

// Elixirs
for (const [, e] of pairs(ELIXIRS)) {
	ITEMS[e.id] = {
		id: e.id,
		name: e.name,
		description: e.description,
		effect: e.effect,
		itemType: e.elixirType,
		category: "elixir",
		icon: e.icon,
		rarity: e.rarity,
		consumable: true,
	};
}

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
export const MAX_BOUNTY_SLOTS = 10;

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
	/** Currently active poison ID coating the weapon (or undefined). */
	activePoison: string | undefined;
	/** Active elixir IDs (can have multiple at once). */
	activeElixirs: string[];
	/** Collected bounty scrolls (up to MAX_BOUNTY_SLOTS). */
	bountyScrolls: BountyScrollPayload;
}
