/**
 * NPC Shop utility functions.
 *
 * Shop DATA now lives on each NPCDef in NPC_REGISTRY (shared/config/npcs.ts).
 * This file provides lightweight helpers for querying that data.
 */

import { ItemDef, ITEMS } from "shared/inventory";
import { NPC_REGISTRY, NPCShopDef } from "./npcs";

// Re-export types so existing consumers keep working.
export type { ShopItem, NPCShopDef } from "./npcs";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Check if an NPC name has a shop. */
export function npcHasShop(npcName: string): boolean {
	return NPC_REGISTRY[npcName]?.shop !== undefined;
}

/** Get the shop def for an NPC (or undefined). */
export function getNPCShop(npcName: string): NPCShopDef | undefined {
	return NPC_REGISTRY[npcName]?.shop;
}

/** Resolve all ShopItems into full ItemDef + price pairs for display. */
export function getShopItemsWithDefs(shop: NPCShopDef): Array<{ item: ItemDef; price: number; maxOwned: number }> {
	const result: Array<{ item: ItemDef; price: number; maxOwned: number }> = [];
	for (const si of shop.shopItems) {
		const def = ITEMS[si.itemId];
		if (def) {
			result.push({ item: def, price: si.price, maxOwned: si.maxOwned ?? -1 });
		}
	}
	return result;
}

/** Pick a random string from an array. */
export function pickRandom(lines: string[]): string {
	if (lines.size() === 0) return "";
	return lines[math.random(0, lines.size() - 1)];
}
