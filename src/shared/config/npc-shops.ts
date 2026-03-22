/**
 * NPC Shop configuration — data-only.
 *
 * To add a new vendor:  add an entry to NPC_SHOPS keyed by NPC name.
 * To add a new item to a vendor: push an entry into `shopItems`.
 * To add new greeting / farewell lines: extend the arrays.
 *
 * The trade window reads from this config at runtime — no core-logic
 * changes needed.
 */

import { ItemDef, ITEMS } from "shared/inventory";

// ── Types ─────────────────────────────────────────────────────────────────────

/** A single item available for purchase at a shop. */
export interface ShopItem {
	/** Must match an ID in the master ITEMS catalogue (weapons / poisons / elixirs). */
	itemId: string;
	/** Gold cost to buy one unit. */
	price: number;
	/** Optional max quantity a player can hold from this shop (-1 = unlimited). */
	maxOwned?: number;
}

/** Full shop definition for one NPC vendor. */
export interface NPCShopDef {
	/** Lines the NPC says when you first open dialog (random pick). */
	greetings: string[];
	/** Lines the NPC says when you pick "Talk" (random pick). */
	chatLines: string[];
	/** Lines the NPC says when you leave (random pick). */
	farewells: string[];
	/** Items available for purchase. */
	shopItems: ShopItem[];
}

// ── Shop data ─────────────────────────────────────────────────────────────────

/**
 * Master shop catalogue — keyed by exact NPC name from MEDIEVAL_NPCS.
 * Only NPCs listed here will show a "Trade" option in the dialog menu.
 */
export const NPC_SHOPS: Record<string, NPCShopDef> = {
	"Bertram de Mere": {
		greetings: [
			"Ah, a customer. Browse, but do not touch what you cannot afford.",
			"Welcome to my humble stall. Everything here has a price.",
			"You look like someone who needs... supplies.",
		],
		chatLines: [
			"The roads grow dangerous. Wise folk carry protection.",
			"I once sold a dagger to a man who returned it... in my back. I learned to charge more.",
			"Business has been slow since the guard patrols increased.",
			"Keep your coin purse close. Thieves lurk in every shadow.",
		],
		farewells: [
			"Come again when your purse is heavier.",
			"Safe travels. Try not to die before you spend more.",
			"Until next time, friend.",
		],
		shopItems: [
			{ itemId: "dagger", price: 500 },
			{ itemId: "floating_death", price: 300 },
			{ itemId: "slow_decay", price: 200 },
			{ itemId: "swiftness_elixir", price: 250 },
		],
	},

	"Lyra Goldmead": {
		greetings: [
			"Step closer, dear. I have just the thing.",
			"Potions, poisons, and a smile. What more could you want?",
			"Ah, another seeker of liquid courage.",
		],
		chatLines: [
			"The elves distill finer brews, but mine work just as well.",
			"A drop of this in the right goblet... well, you understand.",
			"I test everything I sell. That is why I shake sometimes.",
			"The apothecary guild frowns on my methods. I frown back.",
		],
		farewells: [
			"May your aim be true and your poisons potent.",
			"Do not mix those together. Seriously.",
			"Return when you need more. You always do.",
		],
		shopItems: [
			{ itemId: "floating_death", price: 280 },
			{ itemId: "slow_decay", price: 180 },
			{ itemId: "paralysis_toxin", price: 350 },
			{ itemId: "dragons_breath", price: 600 },
			{ itemId: "phantom_venom", price: 500 },
		],
	},

	"Garrick Hallowmere": {
		greetings: [
			"Need something to keep you alive? You have come to the right place.",
			"Elixirs, tonics, and the occasional miracle. Step right up.",
			"I can see you are the type who values survival. Smart.",
		],
		chatLines: [
			"The Vitality Draught saved my life once. Twice, actually.",
			"Ghost Oil is not cheap, but neither is your life.",
			"I brew under moonlight. Old habit. Probably means nothing.",
			"The market has been rough since the new tariffs. Prices reflect that.",
		],
		farewells: [
			"Stay alive out there. Repeat customers are my favourite.",
			"Good luck. You will need it.",
			"Off you go. And remember — drink responsibly.",
		],
		shopItems: [
			{ itemId: "swiftness_elixir", price: 200 },
			{ itemId: "sky_step", price: 350 },
			{ itemId: "shadow_cloak", price: 500 },
			{ itemId: "eagle_eye", price: 400 },
			{ itemId: "vitality_draught", price: 300 },
			{ itemId: "ghost_oil", price: 700 },
		],
	},

	"Rowena Brambleholt": {
		greetings: [
			"What do you need, stranger? Make it quick.",
			"Weapons, tools of the trade. Browse at your leisure.",
			"You have the look of someone who needs a sharp edge.",
		],
		chatLines: [
			"Every blade I sell has tasted blood at least once. Quality assurance.",
			"The guards do not bother me. Professional courtesy.",
			"A good weapon is the difference between predator and prey.",
			"I sharpen blades and tongues. Both cut deep.",
		],
		farewells: [
			"May your steel stay sharp.",
			"Do not come back broken. Come back richer.",
			"Mind the edge. I just honed it.",
		],
		shopItems: [
			{ itemId: "dagger", price: 450 },
			{ itemId: "slow_decay", price: 220 },
			{ itemId: "swiftness_elixir", price: 280 },
			{ itemId: "sky_step", price: 380 },
		],
	},

	"Thessaly Nywen": {
		greetings: [
			"An outsider. How... quaint. What do you seek?",
			"Elven craft at human prices. You will not find a better deal.",
			"The forest provides. For a fee.",
		],
		chatLines: [
			"Elven poisons are an art. Human poisons are... enthusiastic.",
			"I have lived three of your lifetimes. Trust my expertise.",
			"The Phantom Venom was my grandmother's recipe. She was terrifying.",
			"Do not mistake my patience for weakness.",
		],
		farewells: ["Walk softly, short-lived one.", "The forest watches. As do I.", "Until the next moon."],
		shopItems: [
			{ itemId: "phantom_venom", price: 450 },
			{ itemId: "dragons_breath", price: 550 },
			{ itemId: "shadow_cloak", price: 480 },
			{ itemId: "eagle_eye", price: 380 },
			{ itemId: "ghost_oil", price: 650 },
		],
	},
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Check if an NPC name has a shop. */
export function npcHasShop(npcName: string): boolean {
	return NPC_SHOPS[npcName] !== undefined;
}

/** Get the shop def for an NPC (or undefined). */
export function getNPCShop(npcName: string): NPCShopDef | undefined {
	return NPC_SHOPS[npcName];
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
