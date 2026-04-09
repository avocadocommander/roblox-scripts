/**
 * Shop type pools — data-only config.
 *
 * Defines which items each shop type sells and which NPC names are eligible
 * to become dynamic merchants. To add a new item to a pool, add an entry here.
 * To add a new merchant-eligible NPC, add their name to MERCHANT_NPC_POOL.
 *
 * MerchantShop-tagged BaseParts in the world must have a "ShopType" attribute
 * set to one of the ShopType values below.
 */

import { ShopItem } from "./npcs";

export type ShopType = "weapon" | "elixir" | "poison" | "rare";

/** Shop types guaranteed to be present every server session (if enough tagged positions exist). */
export const REQUIRED_SHOP_TYPES: ShopType[] = ["weapon", "elixir", "poison"];

/** Item pools keyed by shop type. Merchants sell ALL items in their pool. */
export const SHOP_TYPE_POOLS: Record<ShopType, ShopItem[]> = {
	weapon: [
		{ itemId: "dagger", price: 450 },
		{ itemId: "warhammer", price: 850 },
	],
	elixir: [
		{ itemId: "fleetfoot_elixir", price: 280 },
		{ itemId: "featherfall_draught", price: 400 },
		{ itemId: "veil_of_silence", price: 580 },
	],
	poison: [
		{ itemId: "levitation_poison", price: 300 },
		{ itemId: "shrinking_curse", price: 450 },
		{ itemId: "dismembering_blight", price: 700 },
	],
	rare: [
		{ itemId: "dagger", price: 420 },
		{ itemId: "warhammer", price: 800 },
		{ itemId: "levitation_poison", price: 280 },
		{ itemId: "shrinking_curse", price: 420 },
		{ itemId: "dismembering_blight", price: 650 },
		{ itemId: "fleetfoot_elixir", price: 260 },
		{ itemId: "featherfall_draught", price: 370 },
		{ itemId: "veil_of_silence", price: 540 },
	],
};

/**
 * NPC names eligible to be assigned as dynamic merchants at runtime.
 * All entries must be killable Ambient NPCs with no fixedRouteId in NPC_REGISTRY.
 * Listed in priority order — first N names fill the available shop positions.
 */
export const MERCHANT_NPC_POOL: string[] = [
	"Veyra Ashenmaw",
	"Lyra Goldmead",
	"Garrick Hallowmere",
	"Rowena Brambleholt",
	"Thessaly Nywen",
	"Merek de Lowenford",
	"Geoffrey Saltmarsh",
	"Baldric Stonhelm",
	"Edda Barleyroot",
	"Aldon Brightforge",
	"Thalindra Emberglen",
	"Vaelion Greenmantle",
];
