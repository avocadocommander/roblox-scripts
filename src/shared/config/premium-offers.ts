/**
 * Premium World Offer configuration — data-only.
 *
 * Each entry describes a purchasable offer presented at a world object
 * (pedestal, shrine, display). World models carry an `offerId` attribute
 * that keys into this map. The system supports two purchase types:
 *
 *   - "gamepass"          — one-time Game Pass purchase (permanent unlock).
 *   - "developerProduct"  — repeatable Developer Product (consumable charges).
 *
 * Product IDs are imported from their respective config files (game-passes.ts,
 * dev-products.ts) so there is a single source of truth.
 *
 * To add a new premium offer, just add an entry here and place a model
 * in the world with `offerId` set to the key.
 */

import { GAME_PASSES } from "./game-passes";
import { DEV_PRODUCTS } from "./dev-products";
import { ShopType } from "./shop-types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PremiumOfferType = "gamepass" | "developerProduct";

export interface PremiumWorldOffer {
	/** Unique offer key — matches the `offerId` attribute on the world model. */
	offerId: string;
	/** Which Roblox purchase API to use. */
	offerType: PremiumOfferType;
	/** Roblox Game Pass ID or Developer Product ID. */
	productId: number;
	/** Display name shown in the UI panel. */
	title: string;
	/** Short mechanical description (what the player gets). */
	description: string;
	/** Atmospheric / lore flavour text shown below the description. */
	flavorText: string;
	/** Roblox asset ID for a display icon (optional). */
	iconId?: string;
	/** If true, hide the world object once the player owns the Game Pass. */
	requiresOwnedHidden?: boolean;
	/** For Developer Products: label describing charges (e.g. "Grants 2 uses per purchase"). */
	chargesLabel?: string;
	/**
	 * Name of a Model in ReplicatedStorage > DisplayModels to clone as the
	 * floating 3D display at shop OfferSlots.  Leave undefined to show only
	 * the billboard text (no 3D mesh).
	 */
	displayModelName?: string;
}

// ── Offer Registry ────────────────────────────────────────────────────────────

export const PREMIUM_OFFERS: Record<string, PremiumWorldOffer> = {
	warhammer_pass: {
		offerId: "warhammer_pass",
		offerType: "gamepass",
		productId: GAME_PASSES.warhammer_pass.passId,
		title: "Warhammer",
		description:
			"Unlock the Warhammer -- a brutal blunt weapon that sends targets flying with devastating knockback.",
		flavorText: "Forged in the fires of the old keep. Its weight alone is a death sentence.",
		chargesLabel: undefined,
		displayModelName: "Warhammer",
	},

	os_guidance: {
		offerId: "os_guidance",
		offerType: "developerProduct",
		productId: DEV_PRODUCTS[3571561126].productId,
		title: "O's Guidance",
		description:
			"A divine vial humming with holy light. Coat your blade and the next strike calls a beam from the heavens.",
		flavorText: "The sky opens. The beam descends. Judgement is swift.",
		chargesLabel: "Grants 2 vials per purchase",
		displayModelName: "OsGuidance",
	},
};

/** Look up an offer by its offerId. Returns undefined if not found. */
export function getPremiumOffer(offerId: string): PremiumWorldOffer | undefined {
	return PREMIUM_OFFERS[offerId];
}

// ── Shop Offer Slots ──────────────────────────────────────────────────────────
// Maps each ShopType to the premium offer IDs that can appear as floating
// display items at that shop's attachment slots. Order matters — first entries
// fill the first available attachment, and so on.
//
// To add a new offer to a shop type, append its offerId here.

export const SHOP_OFFER_SLOTS: Record<ShopType, string[]> = {
	weapon: ["warhammer_pass"],
	poison: ["os_guidance"],
	elixir: [],
	rare: [],
};

/** Return the offer IDs for a given shop type. */
export function getOfferSlotsForShopType(shopType: ShopType): string[] {
	return SHOP_OFFER_SLOTS[shopType] ?? [];
}
