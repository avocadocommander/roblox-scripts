/**
 * Developer Product Handler — server module.
 *
 * Handles repeat-purchasable Robux products (Developer Products).
 * Registers MarketplaceService.ProcessReceipt to grant items on purchase.
 * Listens for client purchase-prompt requests.
 */

import { MarketplaceService, Players } from "@rbxts/services";
import { log } from "shared/helpers";
import { DEV_PRODUCTS } from "shared/config/dev-products";
import { getPromptProductPurchaseRemote } from "shared/remotes/product-remote";
import { givePlayerItem } from "./inventory-handler";

const promptRemote = getPromptProductPurchaseRemote();

// ── Collect all known product IDs for validation ──────────────────────────────

const KNOWN_PRODUCT_IDS = new Set<number>();
for (const [id] of pairs(DEV_PRODUCTS)) {
	KNOWN_PRODUCT_IDS.add(id as number);
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initializeProductHandler(): void {
	log("[PRODUCT] Initializing Developer Product handler");

	// Process receipt callback — MUST return a PurchaseDecision
	MarketplaceService.ProcessReceipt = (receiptInfo: ReceiptInfo): Enum.ProductPurchaseDecision => {
		const player = Players.GetPlayerByUserId(receiptInfo.PlayerId);
		if (!player) {
			log("[PRODUCT] Player not in game for receipt " + receiptInfo.PurchaseId, "WARN");
			return Enum.ProductPurchaseDecision.NotProcessedYet;
		}

		const productDef = DEV_PRODUCTS[receiptInfo.ProductId];
		if (!productDef) {
			log("[PRODUCT] Unknown product ID " + receiptInfo.ProductId + " from " + player.Name, "WARN");
			return Enum.ProductPurchaseDecision.NotProcessedYet;
		}

		const success = givePlayerItem(player, productDef.grantItemId, productDef.grantCount);
		if (!success) {
			log("[PRODUCT] Failed to grant " + productDef.grantItemId + " to " + player.Name, "WARN");
			return Enum.ProductPurchaseDecision.NotProcessedYet;
		}

		log(
			"[PRODUCT] " +
				player.Name +
				" purchased " +
				productDef.name +
				" (x" +
				productDef.grantCount +
				" " +
				productDef.grantItemId +
				")",
		);

		return Enum.ProductPurchaseDecision.PurchaseGranted;
	};

	// Client requests a purchase prompt
	promptRemote.OnServerEvent.Connect((player: Player, ...args: unknown[]) => {
		const productId = args[0] as number | undefined;
		if (productId === undefined || !typeIs(productId, "number")) return;
		if (!KNOWN_PRODUCT_IDS.has(productId)) return;

		log("[PRODUCT] " + player.Name + " requested product purchase prompt for " + productId);
		MarketplaceService.PromptProductPurchase(player, productId);
	});

	log("[PRODUCT] Developer Product handler ready");
}
