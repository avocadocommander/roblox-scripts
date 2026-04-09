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
 * To add a new premium offer, just add an entry here and place a model
 * in the world with `offerId` set to the key.
 */

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
}

// ── Offer Registry ────────────────────────────────────────────────────────────

export const PREMIUM_OFFERS: Record<string, PremiumWorldOffer> = {
	warhammer_pass: {
		offerId: "warhammer_pass",
		offerType: "gamepass",
		productId: 1786246558, // TODO: replace with real Game Pass ID
		title: "Warhammer",
		description:
			"Unlock the Warhammer -- a brutal blunt weapon that sends targets flying with devastating knockback.",
		flavorText: "Forged in the fires of the old keep. Its weight alone is a death sentence.",
		chargesLabel: undefined,
	},

	os_guidance: {
		offerId: "os_guidance",
		offerType: "developerProduct",
		productId: 3571561126,
		title: "O's Guidance",
		description:
			"A divine vial humming with holy light. Coat your blade and the next strike calls a beam from the heavens.",
		flavorText: "The sky opens. The beam descends. Judgement is swift.",
		chargesLabel: "Grants 2 vials per purchase",
	},
};

/** Look up an offer by its offerId. Returns undefined if not found. */
export function getPremiumOffer(offerId: string): PremiumWorldOffer | undefined {
	return PREMIUM_OFFERS[offerId];
}
