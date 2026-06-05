/**
 * NPC Clothing & Armor Config
 *
 * Defines clothing colours and accessory templates each NPC status tier can
 * wear. Accessory names refer to `Accessory` instances stored at the root of
 * ReplicatedStorage; the appearance system clones them at spawn time.
 *
 * To add a new armour / hat / cape:
 *   1. Place the Accessory instance under ReplicatedStorage with a unique
 *      name (e.g. ReplicatedStorage.GuardCape).
 *   2. Add the name to the relevant tier's `accessories` array (always worn,
 *      gated by `accessoryChance`) or `clothingPool` (one seeded pick).
 */

import type { Status } from "../module";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Full clothing definition for one status tier. */
export interface TierClothingDef {
	shirtColors: Color3[];
	pantsColors: Color3[];
	shoeColors: Color3[];
	/** Accessory names always considered for this tier (rolled per entry). */
	accessories: string[];
	/** Probability (0-1) each accessory in `accessories` is applied. Default 1. */
	accessoryChance?: number;
	/** Pool of accessory names; the seeded RNG picks ONE (or none if empty). */
	clothingPool?: string[];
}

/**
 * Per-NPC clothing override. Set on `NPCDef.clothing` in `config/npcs.ts`.
 * When present, replaces the tier `clothingPool` pick for that NPC and all
 * listed names are always applied.
 */
export type NPCClothingOverride = string[];

// ── Tier Palettes ─────────────────────────────────────────────────────────────

const SERF_CLOTHING: TierClothingDef = {
	shirtColors: [
		Color3.fromHex("#6B4C2E"),
		Color3.fromHex("#7A6B55"),
		Color3.fromHex("#5C5040"),
		Color3.fromHex("#8B7D6B"),
	],
	pantsColors: [Color3.fromHex("#5C5040"), Color3.fromHex("#6B4C2E"), Color3.fromHex("#4A4035")],
	shoeColors: [Color3.fromHex("#3B2F20"), Color3.fromHex("#5C4A35")],
	accessories: [],
	clothingPool: ["PirateHat", "Straw", "Straws"],
};

const COMMONER_CLOTHING: TierClothingDef = {
	shirtColors: [
		Color3.fromHex("#556B2F"),
		Color3.fromHex("#6B4C2E"),
		Color3.fromHex("#8B7355"),
		Color3.fromHex("#4A5D3A"),
	],
	pantsColors: [Color3.fromHex("#6B4C2E"), Color3.fromHex("#556B2F"), Color3.fromHex("#D8C9A8")],
	shoeColors: [Color3.fromHex("#6B4C2E"), Color3.fromHex("#2C2C2C"), Color3.fromHex("#A1886F")],
	accessories: [],
	clothingPool: ["LeatherWizardHat", "WornHat"],
};

const MERCHANT_CLOTHING: TierClothingDef = {
	shirtColors: [
		Color3.fromHex("#1E2B44"),
		Color3.fromHex("#4A3728"),
		Color3.fromHex("#2E4A3E"),
		Color3.fromHex("#5B3A5E"),
	],
	pantsColors: [Color3.fromHex("#2C2C2C"), Color3.fromHex("#3E3028"), Color3.fromHex("#1E2B44")],
	shoeColors: [Color3.fromHex("#2C2C2C"), Color3.fromHex("#4A3728")],
	accessories: [],
	accessoryChance: 0.4,
	clothingPool: ["Mushroom"],
};

const NOBILITY_CLOTHING: TierClothingDef = {
	shirtColors: [
		Color3.fromHex("#6A0DAD"),
		Color3.fromHex("#1B3A5C"),
		Color3.fromHex("#8B0000"),
		Color3.fromHex("#2E1A47"),
	],
	pantsColors: [Color3.fromHex("#1A1A2E"), Color3.fromHex("#2C2C2C"), Color3.fromHex("#3E2723")],
	shoeColors: [Color3.fromHex("#1A1A1A"), Color3.fromHex("#3E2723")],
	accessories: [],
	accessoryChance: 0,
	clothingPool: ["Tiara"],
};

const ROYALTY_CLOTHING: TierClothingDef = {
	shirtColors: [
		Color3.fromHex("#9B2E2E"),
		Color3.fromHex("#C3A032"),
		Color3.fromHex("#1B3A5C"),
		Color3.fromHex("#4A0E4E"),
	],
	pantsColors: [Color3.fromHex("#1A1A2E"), Color3.fromHex("#2C2C2C")],
	shoeColors: [Color3.fromHex("#1A1A1A"), Color3.fromHex("#C3A032")],
	accessories: ["RoyalCape", "Gods"],
	accessoryChance: 1,
	clothingPool: ["DemonDarkCrown", "King", "Crown"],
};

// ── Lookup map ────────────────────────────────────────────────────────────────

export const STATUS_CLOTHING: Record<Status, TierClothingDef> = {
	Serf: SERF_CLOTHING,
	Commoner: COMMONER_CLOTHING,
	Merchant: MERCHANT_CLOTHING,
	Nobility: NOBILITY_CLOTHING,
	Royalty: ROYALTY_CLOTHING,
};

// ── Route-specific accessories (Guards, etc.) ────────────────────────────────

/**
 * Accessory names always added to NPCs on a given route, regardless of tier.
 * Takes priority over the tier `accessories` list when present.
 */
export const ROUTE_ACCESSORIES: Record<string, string[]> = {
	Guard: ["GuardBack"],
};

/**
 * Per-route hat/clothing pool. When set, replaces the tier `clothingPool` for
 * NPCs on that route -- the seeded RNG picks ONE name from this list.
 */
export const ROUTE_CLOTHING_POOLS: Record<string, string[]> = {
	Guard: ["GuardCape"],
};
