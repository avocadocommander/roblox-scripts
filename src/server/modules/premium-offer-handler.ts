/**
 * Premium Offer Handler — server module.
 *
 * Centralises all premium purchase logic (the "PremiumService" layer).
 *
 *  - Validates offer requests from world objects.
 *  - Builds payloads with ownership state.
 *  - Triggers the correct Roblox purchase prompt ONLY when the player
 *    clicks Buy (not on interaction).
 *  - Game Pass: checks ownership via pass-handler cache.
 *  - Developer Product: always purchasable (ProcessReceipt is in product-handler).
 */

import { MarketplaceService, Players } from "@rbxts/services";
import { log } from "shared/helpers";
import { getPremiumOffer } from "shared/config/premium-offers";
import {
	getOpenPremiumOfferRemote,
	getBuyPremiumOfferRemote,
	getPremiumOfferPayloadRemote,
	PremiumOfferPayload,
} from "shared/remotes/premium-offer-remote";
import { playerOwnsPass } from "./pass-handler";

// ── Remotes ───────────────────────────────────────────────────────────────────

const openRemote = getOpenPremiumOfferRemote();
const buyRemote = getBuyPremiumOfferRemote();
const payloadRemote = getPremiumOfferPayloadRemote();

// ── Per-player state: which offer is the player currently viewing? ─────────────

const activeOffer = new Map<Player, string>(); // player -> offerId

// ── Init ──────────────────────────────────────────────────────────────────────

export function initializePremiumOfferHandler(): void {
	log("[PREMIUM] Initializing premium world-offer handler");

	// ── Open: player interacted with a world object ───────────────────────
	openRemote.OnServerEvent.Connect((player: Player, ...args: unknown[]) => {
		const offerId = args[0] as string | undefined;
		if (offerId === undefined || !typeIs(offerId, "string")) return;

		const offer = getPremiumOffer(offerId);
		if (!offer) {
			log("[PREMIUM] Unknown offer ID: " + offerId + " from " + player.Name, "WARN");
			return;
		}

		// Determine ownership for gamepasses
		let alreadyOwned = false;
		if (offer.offerType === "gamepass") {
			alreadyOwned = playerOwnsPass(player, offer.productId);
		}

		// Build purchase type label
		let purchaseTypeLabel: string;
		if (offer.offerType === "gamepass") {
			purchaseTypeLabel = "Permanent Unlock";
		} else {
			purchaseTypeLabel = offer.chargesLabel ?? "Consumable";
		}

		// Track which offer the player has open
		activeOffer.set(player, offerId);

		// Send payload to client
		const payload: PremiumOfferPayload = {
			offerId: offer.offerId,
			offerType: offer.offerType,
			productId: offer.productId,
			title: offer.title,
			description: offer.description,
			flavorText: offer.flavorText,
			purchaseTypeLabel,
			alreadyOwned,
		};

		log("[PREMIUM] Sending offer payload to " + player.Name + ": " + offer.title);
		payloadRemote.FireClient(player, payload);
	});

	// ── Buy: player clicked Buy in the premium panel ──────────────────────
	buyRemote.OnServerEvent.Connect((player: Player, ...args: unknown[]) => {
		const offerId = args[0] as string | undefined;
		if (offerId === undefined || !typeIs(offerId, "string")) return;

		// Validate the player has this offer open
		if (activeOffer.get(player) !== offerId) {
			log("[PREMIUM] " + player.Name + " tried to buy offer " + offerId + " without opening it", "WARN");
			return;
		}

		const offer = getPremiumOffer(offerId);
		if (!offer) {
			log("[PREMIUM] Unknown offer ID on buy: " + offerId, "WARN");
			return;
		}

		if (offer.offerType === "gamepass") {
			// Check if already owned
			if (playerOwnsPass(player, offer.productId)) {
				log("[PREMIUM] " + player.Name + " already owns gamepass " + offer.productId);
				return;
			}
			log("[PREMIUM] Prompting Game Pass purchase for " + player.Name + ": " + offer.productId);
			MarketplaceService.PromptGamePassPurchase(player, offer.productId);
		} else {
			// Developer Product — always purchasable
			log("[PREMIUM] Prompting Developer Product purchase for " + player.Name + ": " + offer.productId);
			MarketplaceService.PromptProductPurchase(player, offer.productId);
		}
	});

	// Cleanup on leave
	Players.PlayerRemoving.Connect((player) => {
		activeOffer.delete(player);
	});

	log("[PREMIUM] Premium world-offer handler ready");
}
