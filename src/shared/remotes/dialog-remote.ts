/**
 * Dialog & Trade remotes — lazy-create pattern.
 *
 * Client -> Server:
 *   - OpenDialog:   player wants to interact with an NPC (sends NPC model)
 *   - PurchaseItem: player wants to buy an item (sends npcName + itemId)
 *   - CloseDialog:  player is done talking
 *
 * Server -> Client:
 *   - DialogPayload: sends NPC name, greeting, shop availability
 *   - PurchaseResult: success/failure feedback
 */

import { getRemotesFolder, getRemoteEvent, getRemoteFunction } from "shared/remote-utils";
import { Interaction } from "shared/config/npcs";

/** Client -> Server: player opened dialog with an NPC (sends NPC Model ref). */
export function getOpenDialogRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "OpenDialog");
}

/** Client -> Server: player wants to purchase an item. Args: (npcName: string, itemId: string). */
export function getPurchaseItemRemote(): RemoteFunction {
	return getRemoteFunction(getRemotesFolder(), "PurchaseItem");
}

/** Client -> Server: player closed the dialog. */
export function getCloseDialogRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "CloseDialog");
}

/** Server -> Client: dialog payload (NPC name, text, hasShop flag). */
export function getDialogPayloadRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "DialogPayload");
}

/** Server -> Client: purchase result feedback. Args: (success: boolean, message: string). */
export function getPurchaseResultRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "PurchaseResult");
}

/** Server -> Client: ambient floating text near an NPC. Args: (npcName: string, message: string). */
export function getFloatingNPCTextRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "FloatingNPCText");
}

/** Client -> Server: player wants to turn in bounties at a guild leader NPC. */
export function getTurnInBountiesDialogRemote(): RemoteFunction {
	return getRemoteFunction(getRemotesFolder(), "TurnInBountiesDialog");
}

// ── Payload types (shared between client & server) ────────────────────────────

export interface DialogPayload {
	npcName: string;
	greeting: string;
	hasShop: boolean;
	/** The NPC's interaction type so the client can show the right buttons. */
	interaction: Interaction;
	/** Chat lines for the "Talk" option. */
	chatLines: string[];
	/** Farewell line for when player leaves. */
	farewell: string;
	/** Shop items (only if hasShop). */
	shopItems: ShopItemPayload[];
	/** Number of bounty scrolls pending turn-in (only if interaction=TurnIn). */
	pendingBounties: number;
}

export interface ShopItemPayload {
	itemId: string;
	name: string;
	description: string;
	effect: string;
	itemType: string;
	icon: string;
	rarity: string;
	price: number;
	/** How many the player currently owns. */
	owned: number;
}
