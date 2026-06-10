/**
 * Shop type pools — data-only config (plus the black-market generator).
 *
 * Defines which items each shop type sells and which NPC names are eligible
 * to become dynamic merchants. To add a new item to a pool, add an entry here.
 * To add a new merchant-eligible NPC, add their name to MERCHANT_NPC_POOL.
 *
 * MerchantShop-tagged BaseParts in the world must have a "ShopType" attribute
 * set to one of the ShopType values below.
 *
 * Most shop types have a static pool. The "black_market" type is dynamic:
 * it builds a fresh 5-item inventory of random poisons + elixirs (any rarity
 * and any tier) each time a black-market merchant spawns or respawns.
 * Use `buildShopInventory(shopType)` to get the runtime item list — it falls
 * through to the static pool for non-dynamic types.
 */

import { ShopItem } from "./npcs";
import { POISON_LIST } from "./poisons";
import { ELIXIR_LIST } from "./elixirs";
import { DEV_PRODUCTS } from "./dev-products";

export type ShopType = "weapon" | "elixir" | "poison" | "rare" | "tavern" | "black_market";

/** Shop types guaranteed to be present every server session (if enough tagged positions exist). */
export const REQUIRED_SHOP_TYPES: ShopType[] = ["weapon", "elixir", "poison"];

/**
 * Shop types that may ONLY appear at sites whose ShopType attribute is
 * explicitly set on the world model. These are never auto-assigned to
 * unmarked sites. Use this for special/rare merchants that need a hand-picked
 * location (e.g. the black market hidden in a back alley).
 */
export const EXPLICIT_ONLY_SHOP_TYPES: ReadonlySet<ShopType> = new Set<ShopType>(["black_market"]);

/** True if `shopType` is only allowed at sites with an explicit ShopType attribute. */
export function isExplicitOnlyShopType(shopType: ShopType): boolean {
	return EXPLICIT_ONLY_SHOP_TYPES.has(shopType);
}

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
	tavern: [
		{ itemId: "fleetfoot_elixir", price: 150 },
		{ itemId: "featherfall_draught", price: 200 },
		{ itemId: "veil_of_silence", price: 280 },
	],
	// black_market is dynamic — see buildShopInventory(). Empty pool is a fallback
	// only used if the dynamic generator somehow fails to produce any picks.
	black_market: [],
};

// ── Black market dynamic inventory ────────────────────────────────────────────

/** How many items a black-market merchant offers each spawn. */
export const BLACK_MARKET_INVENTORY_SIZE = 5;

/** Base price by rarity (before tier multiplier). Black market is premium-priced. */
const BLACK_MARKET_BASE_PRICE: Record<string, number> = {
	common: 350,
	uncommon: 500,
	rare: 750,
	epic: 1100,
	legendary: 1600,
};

/** Tier multiplier — stronger tiers cost more (1 = base, 2 = +, 3 = ++). */
const BLACK_MARKET_TIER_MULT: Record<number, number> = {
	1: 1.0,
	2: 1.5,
	3: 2.0,
};

/** Price formula for a black-market poison/elixir entry. */
function blackMarketPriceFor(rarity: string, tier: number): number {
	const base = BLACK_MARKET_BASE_PRICE[rarity] ?? 400;
	const mult = BLACK_MARKET_TIER_MULT[tier] ?? 1.0;
	return math.floor(base * mult);
}

/**
 * Item IDs that are sold ONLY as Roblox Developer Products (Robux). These
 * must never appear in any random-vendor pool -- they're paid-content items
 * with their own purchase flow (see premium-offers + product-handler).
 */
const DEV_PRODUCT_ITEM_IDS: ReadonlySet<string> = (() => {
	const set = new Set<string>();
	for (const [, def] of pairs(DEV_PRODUCTS)) set.add(def.grantItemId);
	return set;
})();

/** True if `itemId` is a Robux-only Developer Product reward. */
export function isDevProductItem(itemId: string): boolean {
	return DEV_PRODUCT_ITEM_IDS.has(itemId);
}

/**
 * Build a fresh 5-item black-market inventory: distinct random picks from the
 * combined poison + elixir catalogue (every rarity and tier eligible).
 * Called fresh every time a black-market merchant (re)spawns so each visit
 * offers a different selection.
 */
function buildBlackMarketInventory(): ShopItem[] {
	// Combined pool of all consumable item ids (poisons + elixirs, every tier).
	// Dev-product items are excluded -- they're Robux-only and must not appear
	// at a random vendor.
	const pool: { itemId: string; rarity: string; tier: number }[] = [];
	for (const p of POISON_LIST) {
		if (isDevProductItem(p.id)) continue;
		pool.push({ itemId: p.id, rarity: p.rarity, tier: p.tier });
	}
	for (const e of ELIXIR_LIST) {
		if (isDevProductItem(e.id)) continue;
		pool.push({ itemId: e.id, rarity: e.rarity, tier: e.tier });
	}

	if (pool.size() === 0) return [];

	// Fisher-Yates shuffle, then take the first N distinct picks.
	for (let i = pool.size() - 1; i > 0; i--) {
		const j = math.random(0, i);
		const tmp = pool[i];
		pool[i] = pool[j];
		pool[j] = tmp;
	}

	const count = math.min(BLACK_MARKET_INVENTORY_SIZE, pool.size());
	const out: ShopItem[] = [];
	for (let i = 0; i < count; i++) {
		const pick = pool[i];
		out.push({ itemId: pick.itemId, price: blackMarketPriceFor(pick.rarity, pick.tier) });
	}
	return out;
}

/**
 * Return the items a shop of `shopType` should sell.
 * Static types read from SHOP_TYPE_POOLS. The "black_market" type rebuilds
 * a fresh random inventory each call. Dev-product items are stripped from
 * every result -- random vendors never sell Robux-only content.
 */
export function buildShopInventory(shopType: ShopType): ShopItem[] {
	const raw = shopType === "black_market" ? buildBlackMarketInventory() : (SHOP_TYPE_POOLS[shopType] ?? []);
	const filtered: ShopItem[] = [];
	for (const entry of raw) {
		if (isDevProductItem(entry.itemId)) continue;
		filtered.push(entry);
	}
	return filtered;
}

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
	"Merek de Lowenford",
	"Geoffrey Saltmarsh",
	"Baldric Stonhelm",
	"Edda Barleyroot",
	"Aldon Brightforge",
];
