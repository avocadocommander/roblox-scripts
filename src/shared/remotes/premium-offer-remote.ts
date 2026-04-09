/**
 * Premium Offer remotes — lazy-create pattern.
 *
 * Client -> Server:
 *   - OpenPremiumOffer:    player interacted with a premium world object (sends offerId)
 *   - BuyPremiumOffer:     player clicked "Buy" in the premium UI (sends offerId)
 *
 * Server -> Client:
 *   - PremiumOfferPayload: sends offer data + ownership state back to the client
 */

import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";
import { PremiumOfferType } from "shared/config/premium-offers";

// ── Remotes ───────────────────────────────────────────────────────────────────

/** Client -> Server: player interacted with a premium world object. Args: (offerId: string). */
export function getOpenPremiumOfferRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "OpenPremiumOffer");
}

/** Client -> Server: player clicked Buy in the premium panel. Args: (offerId: string). */
export function getBuyPremiumOfferRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "BuyPremiumOffer");
}

/** Server -> Client: premium offer payload for the UI. */
export function getPremiumOfferPayloadRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "PremiumOfferPayload");
}

// ── Payload types ─────────────────────────────────────────────────────────────

export interface PremiumOfferPayload {
	offerId: string;
	offerType: PremiumOfferType;
	productId: number;
	title: string;
	description: string;
	flavorText: string;
	/** "Permanent Unlock" or "Grants X uses per purchase". */
	purchaseTypeLabel: string;
	/** True if the player already owns this Game Pass. Only relevant for gamepass type. */
	alreadyOwned: boolean;
}
