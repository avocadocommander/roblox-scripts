/**
 * Dialog Handler — server module.
 *
 * Validates NPC dialog requests, builds payloads, processes purchases.
 * Purchase flow:
 *   1. Client fires PurchaseItem(npcName, itemId)
 *   2. Server checks: NPC has shop, item in shop, player has gold, item exists
 *   3. Deducts gold, gives item, syncs inventory, returns result
 */

import { Players, Workspace } from "@rbxts/services";
import { log } from "shared/helpers";
import { ITEMS } from "shared/inventory";
import { MEDIEVAL_NPCS } from "shared/module";
import { getNPCShop, npcHasShop, pickRandom } from "shared/config/npc-shops";
import {
	getOpenDialogRemote,
	getPurchaseItemRemote,
	getCloseDialogRemote,
	getDialogPayloadRemote,
	getPurchaseResultRemote,
	getFloatingNPCTextRemote,
	DialogPayload,
	ShopItemPayload,
} from "shared/remotes/dialog-remote";
import { addCoins, getPlayerStateSnapshot } from "shared/player-state";
import { givePlayerItem, getPlayerOwnedCount } from "./inventory-handler";
import { getQuipForStatus } from "shared/config/npc-quips";

// ── Remotes ───────────────────────────────────────────────────────────────────

const openDialogRemote = getOpenDialogRemote();
const purchaseItemRemote = getPurchaseItemRemote();
const closeDialogRemote = getCloseDialogRemote();
const dialogPayloadRemote = getDialogPayloadRemote();
const purchaseResultRemote = getPurchaseResultRemote();
const floatingTextRemote = getFloatingNPCTextRemote();

// ── Per-player state: which NPC is the player currently talking to? ───────────

const activeDialog = new Map<Player, string>(); // player -> npcName

// Cooldown: prevent spamming floating quips per player (seconds)
const QUIP_COOLDOWN = 2.5;
const lastQuipTime = new Map<Player, number>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDialogPayload(npcName: string, player: Player): DialogPayload | undefined {
	const shop = getNPCShop(npcName);
	const hasShop = shop !== undefined;

	// Build greeting — use shop greeting if available, else medieval phrase
	let greeting: string;
	let chatLines: string[];
	let farewell: string;
	const shopItems: ShopItemPayload[] = [];

	if (shop) {
		greeting = pickRandom(shop.greetings);
		chatLines = [...shop.chatLines];
		farewell = pickRandom(shop.farewells);

		for (const si of shop.shopItems) {
			const def = ITEMS[si.itemId];
			if (!def) continue;
			shopItems.push({
				itemId: si.itemId,
				name: def.name,
				description: def.description,
				effect: def.effect,
				itemType: def.itemType,
				icon: def.icon,
				rarity: def.rarity,
				price: si.price,
				owned: getPlayerOwnedCount(player, si.itemId),
			});
		}
	} else {
		// Non-vendor NPC — generic dialog
		greeting = "Hail, traveler. What brings you here?";
		chatLines = [
			"The roads grow dangerous these days.",
			"Mind your own business, and I shall mind mine.",
			"Have you heard the rumours from the east?",
			"I have nothing to sell you, if that is what you seek.",
		];
		farewell = "Safe travels.";
	}

	return {
		npcName,
		greeting,
		hasShop,
		chatLines,
		farewell,
		shopItems,
	};
}

function handlePurchase(player: Player, npcName: string, itemId: string): [boolean, string] {
	// Validate the player is actually in dialog with this NPC
	const currentNPC = activeDialog.get(player);
	if (currentNPC !== npcName) {
		return [false, "You are not talking to this vendor."];
	}

	// Validate the NPC has a shop and the item is in it
	const shop = getNPCShop(npcName);
	if (!shop) {
		return [false, "This NPC has nothing to sell."];
	}

	const shopItem = shop.shopItems.find((si) => si.itemId === itemId);
	if (!shopItem) {
		return [false, "That item is not available here."];
	}

	// Validate the item exists in the master catalogue
	const itemDef = ITEMS[itemId];
	if (!itemDef) {
		return [false, "Unknown item."];
	}

	// Check max owned limit
	if (shopItem.maxOwned !== undefined && shopItem.maxOwned > 0) {
		const owned = getPlayerOwnedCount(player, itemId);
		if (owned >= shopItem.maxOwned) {
			return [false, "You already own the maximum of this item."];
		}
	}

	// Check player has enough gold
	const state = getPlayerStateSnapshot(player);
	if (!state) {
		return [false, "Player data not found."];
	}
	if (state.coins < shopItem.price) {
		return [false, "Not enough gold. You need " + shopItem.price + " gold."];
	}

	// Deduct gold (negative amount)
	addCoins(player, -shopItem.price);

	// Give item
	givePlayerItem(player, itemId, 1);

	log("[DIALOG] " + player.Name + " purchased " + itemDef.name + " from " + npcName + " for " + shopItem.price + "g");

	return [true, "Purchased " + itemDef.name + " for " + shopItem.price + " gold."];
}

// ── Public init ───────────────────────────────────────────────────────────────

export function initializeDialogHandler(): void {
	// Player opens dialog with an NPC
	openDialogRemote.OnServerEvent.Connect((player: Player, ...args: unknown[]) => {
		const npcModel = args[0] as Model | undefined;
		if (!npcModel || !npcModel.IsA("Model")) return;

		const npcName = npcModel.Name;

		// Verify NPC exists in world and is close enough (anti-cheat)
		const char = player.Character;
		if (!char) return;
		const hrp = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (!hrp) return;
		const npcPart = npcModel.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (!npcPart) return;
		const dist = hrp.Position.sub(npcPart.Position).Magnitude;
		if (dist > 15) return; // Too far away

		// Merchants always get the full dialog panel (even without a shop they
		// still have chat lines). Non-merchant NPCs without a shop get a quip.
		const npcData = MEDIEVAL_NPCS[npcName];
		const isMerchant = npcData !== undefined && npcData.status === "Merchant";
		if (!isMerchant && !npcHasShop(npcName)) {
			const now = tick();
			const lastTime = lastQuipTime.get(player) ?? 0;
			if (now - lastTime < QUIP_COOLDOWN) return; // rate-limit
			lastQuipTime.set(player, now);

			const status = npcData !== undefined ? npcData.status : "Commoner";
			const quip = getQuipForStatus(status);
			floatingTextRemote.FireClient(player, npcName, quip);
			log("[DIALOG] " + player.Name + " -> floating quip from " + npcName + ": " + quip);
			return;
		}

		// Build and send payload
		const payload = buildDialogPayload(npcName, player);
		if (!payload) return;

		activeDialog.set(player, npcName);
		dialogPayloadRemote.FireClient(player, payload);
		log("[DIALOG] " + player.Name + " opened dialog with " + npcName);
	});

	// Player requests a purchase
	purchaseItemRemote.OnServerInvoke = (player: Player, ...args: unknown[]) => {
		const npcName = args[0] as string | undefined;
		const itemId = args[1] as string | undefined;
		if (npcName === undefined || itemId === undefined) return { success: false, message: "Invalid request." };

		const [success, message] = handlePurchase(player, npcName, itemId);

		// Fire result event (for UI feedback)
		purchaseResultRemote.FireClient(player, success, message);

		return { success, message, newOwned: getPlayerOwnedCount(player, itemId) };
	};

	// Player closes dialog
	closeDialogRemote.OnServerEvent.Connect((player: Player) => {
		const npcName = activeDialog.get(player);
		if (npcName !== undefined) {
			log("[DIALOG] " + player.Name + " closed dialog with " + npcName);
		}
		activeDialog.delete(player);
	});

	// Cleanup on leave
	Players.PlayerRemoving.Connect((player) => {
		activeDialog.delete(player);
		lastQuipTime.delete(player);
	});

	log("[DIALOG] Dialog handler initialised");
}
