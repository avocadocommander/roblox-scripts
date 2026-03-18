/**
 * NPC Clothing & Armor Config
 *
 * Defines what clothing colours and optional accessory meshes each NPC status
 * tier can wear. The appearance system picks randomly (seeded) from the arrays
 * at spawn time, so every NPC of the same name always looks the same.
 *
 * To add a new armour piece:
 *   1. Upload the FBX in Roblox Studio -- you get 4 IDs (Mesh, MeshPart,
 *      MeshPartAttachment, Image/Texture).
 *   2. Add an entry to the relevant status tier's `accessories` array using
 *      the meshId and textureId from the import.
 *
 * To add a new shirt/pants/shoes colour palette for a tier, just push
 * another Color3 into the relevant array.
 */

import type { Status } from "../module";

// ── Types ─────────────────────────────────────────────────────────────────────

/** An optional accessory to clone onto the NPC from ReplicatedStorage. */
export interface NPCAccessoryDef {
	/** Name of the Accessory instance in ReplicatedStorage. */
	name: string;
	/** Optional tint applied to the Handle MeshPart. Omit to keep default. */
	color?: Color3;
	/** If true, destroy BasicShirt before attaching (for chest pieces that replace the shirt). */
	hideShirt?: boolean;
}

/** Full clothing definition for one status tier. */
export interface TierClothingDef {
	/** Colour palette for the BasicShirt SurfaceAppearance. */
	shirtColors: Color3[];
	/** Colour palette for the BasicPants SurfaceAppearance. */
	pantsColors: Color3[];
	/** Colour palette for the BasicShoes SurfaceAppearance. */
	shoeColors: Color3[];
	/**
	 * Optional accessories (armour, capes, hats, jewellery).
	 * Each NPC may receive 0-N of these depending on the `accessoryChance`.
	 * Cloned from ReplicatedStorage by name.
	 */
	accessories: NPCAccessoryDef[];
	/**
	 * Probability (0-1) that each accessory in the list is applied.
	 * 1 = always, 0.5 = 50% chance per accessory slot.
	 * Defaults to 1 if omitted.
	 */
	accessoryChance?: number;
}

// ── Tier Palettes ─────────────────────────────────────────────────────────────

const SERF_CLOTHING: TierClothingDef = {
	shirtColors: [
		Color3.fromHex("#6B4C2E"), // mud brown
		Color3.fromHex("#7A6B55"), // dusty tan
		Color3.fromHex("#5C5040"), // worn leather
		Color3.fromHex("#8B7D6B"), // pale dirt
	],
	pantsColors: [
		Color3.fromHex("#5C5040"), // worn leather
		Color3.fromHex("#6B4C2E"), // mud brown
		Color3.fromHex("#4A4035"), // dark soil
	],
	shoeColors: [
		Color3.fromHex("#3B2F20"), // dark leather
		Color3.fromHex("#5C4A35"), // scuffed brown
	],
	accessories: [],
};

const COMMONER_CLOTHING: TierClothingDef = {
	shirtColors: [
		Color3.fromHex("#556B2F"), // olive drab
		Color3.fromHex("#6B4C2E"), // brown
		Color3.fromHex("#8B7355"), // tan
		Color3.fromHex("#4A5D3A"), // muted green
	],
	pantsColors: [
		Color3.fromHex("#6B4C2E"), // brown
		Color3.fromHex("#556B2F"), // olive
		Color3.fromHex("#D8C9A8"), // linen
	],
	shoeColors: [
		Color3.fromHex("#6B4C2E"), // brown leather
		Color3.fromHex("#2C2C2C"), // charcoal
		Color3.fromHex("#A1886F"), // light brown
	],
	accessories: [],
};

const MERCHANT_CLOTHING: TierClothingDef = {
	shirtColors: [
		Color3.fromHex("#1E2B44"), // navy
		Color3.fromHex("#4A3728"), // rich brown
		Color3.fromHex("#2E4A3E"), // forest green
		Color3.fromHex("#5B3A5E"), // plum
	],
	pantsColors: [
		Color3.fromHex("#2C2C2C"), // dark grey
		Color3.fromHex("#3E3028"), // dark brown
		Color3.fromHex("#1E2B44"), // navy
	],
	shoeColors: [
		Color3.fromHex("#2C2C2C"), // polished black
		Color3.fromHex("#4A3728"), // rich brown
	],
	accessories: [
		// Example: { name: "MerchantBelt" },
	],
	accessoryChance: 0.4,
};

const NOBILITY_CLOTHING: TierClothingDef = {
	shirtColors: [
		Color3.fromHex("#6A0DAD"), // purple
		Color3.fromHex("#1B3A5C"), // royal blue
		Color3.fromHex("#8B0000"), // dark crimson
		Color3.fromHex("#2E1A47"), // deep violet
	],
	pantsColors: [
		Color3.fromHex("#1A1A2E"), // midnight
		Color3.fromHex("#2C2C2C"), // charcoal
		Color3.fromHex("#3E2723"), // espresso
	],
	shoeColors: [
		Color3.fromHex("#1A1A1A"), // black leather
		Color3.fromHex("#3E2723"), // dark brown
	],
	accessories: [{ name: "rpc", hideShirt: true }],
	accessoryChance: 1,
};

const ROYALTY_CLOTHING: TierClothingDef = {
	shirtColors: [
		Color3.fromHex("#9B2E2E"), // crimson
		Color3.fromHex("#C3A032"), // gold cloth
		Color3.fromHex("#1B3A5C"), // royal blue
		Color3.fromHex("#4A0E4E"), // imperial purple
	],
	pantsColors: [
		Color3.fromHex("#1A1A2E"), // midnight
		Color3.fromHex("#2C2C2C"), // charcoal
	],
	shoeColors: [
		Color3.fromHex("#1A1A1A"), // polished black
		Color3.fromHex("#C3A032"), // gold-trimmed
	],
	accessories: [{ name: "rpc", hideShirt: true }],
	accessoryChance: 1,
};

// ── Lookup map ────────────────────────────────────────────────────────────────

/**
 * STATUS_CLOTHING maps each NPC status tier to its clothing definition.
 * The appearance system reads from this at spawn time.
 */
export const STATUS_CLOTHING: Record<Status, TierClothingDef> = {
	Serf: SERF_CLOTHING,
	Commoner: COMMONER_CLOTHING,
	Merchant: MERCHANT_CLOTHING,
	Nobility: NOBILITY_CLOTHING,
	Royalty: ROYALTY_CLOTHING,
};

// ── Route-specific accessories (Guards, Preachers, etc.) ──────────────────────

/**
 * ROUTE_ACCESSORIES maps a route position name to accessories that should
 * always be added to NPCs on that route, regardless of status tier.
 */
export const ROUTE_ACCESSORIES: Record<string, NPCAccessoryDef[]> = {
	Guard: [{ name: "guardShirt", hideShirt: true }],
};
