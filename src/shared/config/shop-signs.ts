/**
 * Shop Sign config — pure data/computation, no Roblox Instance references.
 *
 * Provides:
 *   SHOP_TYPE_MARKERS   — plain ASCII type indicator strings per shop type.
 *   SIGN_COLORS         — text/background Color3 palette per shop type.
 *   generateShopName()  — deterministic name from (npcName, shopType).
 *
 * To add a new template for a shop type, append a string to the matching array.
 * Use $first, $surname, or $initials as placeholders.
 */

import { ShopType } from "./shop-types";

// ── Type markers ──────────────────────────────────────────────────────────────
// Plain ASCII only. These are always shown so the shop type is readable at a glance.

export const SHOP_TYPE_MARKERS: Record<ShopType, string> = {
	weapon: "<+> FORGE",
	elixir: "<*> BREWS",
	poison: "<~> TOXINS",
	rare: "<=> WARES",
};

// ── Sign color schemes ────────────────────────────────────────────────────────

export interface SignColorScheme {
	marker: Color3; // small type line
	name: Color3; // main shop name
	subtext: Color3; // dim flavor line
	background: Color3;
	border: Color3;
	flavorLine: string;
}

export const SIGN_COLORS: Record<ShopType, SignColorScheme> = {
	// Forge/iron — warm charred oak, hammered brass, aged parchment
	weapon: {
		marker: Color3.fromRGB(135, 98, 42), // worn brass
		name: Color3.fromRGB(198, 172, 118), // warm bone
		subtext: Color3.fromRGB(108, 78, 28), // dim tallow
		background: Color3.fromRGB(32, 22, 12), // dark umber
		border: Color3.fromRGB(58, 36, 16), // muted rust banding
		flavorLine: "Fine Steel.",
	},
	// Alchemist — cool dark slate, like chalk on worn stone
	elixir: {
		marker: Color3.fromRGB(95, 118, 138), // weathered pewter
		name: Color3.fromRGB(168, 185, 195), // faded chalk
		subtext: Color3.fromRGB(65, 85, 105), // dim stone
		background: Color3.fromRGB(24, 22, 28), // dark charcoal, faint blue
		border: Color3.fromRGB(42, 38, 46), // muted plum-grey
		flavorLine: "Old Brews.",
	},
	// Apothecary — deep moss, like painted fen-wood
	poison: {
		marker: Color3.fromRGB(72, 105, 55), // muted sage
		name: Color3.fromRGB(148, 175, 108), // dried herb
		subtext: Color3.fromRGB(52, 80, 38), // dark fern
		background: Color3.fromRGB(22, 24, 16), // dark moss-brown
		border: Color3.fromRGB(38, 42, 26), // dim olive
		flavorLine: "Dark Craft.",
	},
	// Curiosity — aged gilt on dark walnut, tarnished not gleaming
	rare: {
		marker: Color3.fromRGB(142, 118, 42), // tarnished gilt
		name: Color3.fromRGB(208, 188, 122), // old ivory
		subtext: Color3.fromRGB(102, 76, 24), // dim tarnish
		background: Color3.fromRGB(30, 22, 10), // dark walnut
		border: Color3.fromRGB(56, 42, 16), // aged gilt trim
		flavorLine: "Rare Finds.",
	},
};

// ── Name template pools ───────────────────────────────────────────────────────
// Each pool entry uses $first, $surname, or $initials as placeholders.
// The template chosen for a merchant is deterministic (same NPC always gets the same one).

const WEAPON_TEMPLATES: string[] = [
	"$first's Armory",
	"$surname Arms",
	"The $surname Forge",
	"$initials Steel",
	"$first's Blades",
	"$surname Weaponry",
	"The $first Bladesmith",
];

const ELIXIR_TEMPLATES: string[] = [
	"$first's Elixirs",
	"$surname Brews",
	"The $surname Alembic",
	"$initials Tonic",
	"$first's Potions",
	"$surname Draught House",
	"The $first Tinctures",
];

const POISON_TEMPLATES: string[] = [
	"$first's Vials",
	"$surname Toxins",
	"The $surname Apothecary",
	"$initials Venoms",
	"$first's Dark Wares",
	"$surname Poisons",
	"The $first Venom Works",
];

const RARE_TEMPLATES: string[] = [
	"$first's Rarities",
	"$surname Curiosities",
	"The $surname Cache",
	"$initials Rare Goods",
	"$first's Curios",
	"$surname Emporium",
	"The $first Collection",
];

const TEMPLATES: Record<ShopType, string[]> = {
	weapon: WEAPON_TEMPLATES,
	elixir: ELIXIR_TEMPLATES,
	poison: POISON_TEMPLATES,
	rare: RARE_TEMPLATES,
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function splitName(npcName: string): { first: string; surname: string; initials: string } {
	const [firstSpace] = npcName.find(" ", 1, true);
	if (firstSpace === undefined) {
		return { first: npcName, surname: npcName, initials: npcName.sub(1, 1) + "." };
	}
	const first = npcName.sub(1, firstSpace - 1);
	// Walk forward to find the last space for the surname
	let lastSpace = firstSpace;
	let searchFrom = firstSpace + 1;
	let [nextSpace] = npcName.find(" ", searchFrom, true);
	while (nextSpace !== undefined) {
		lastSpace = nextSpace;
		searchFrom = nextSpace + 1;
		[nextSpace] = npcName.find(" ", searchFrom, true);
	}
	const surname = npcName.sub(lastSpace + 1);
	// "F.S." initials from first word and surname
	const initials = first.sub(1, 1) + "." + surname.sub(1, 1) + ".";
	return { first, surname, initials };
}

/** Deterministic template index — same NPC always picks the same template. */
function templateIndex(npcName: string, poolSize: number): number {
	if (poolSize === 0) return 0;
	const [a] = npcName.byte(1);
	const [b] = npcName.byte(npcName.size());
	return ((a ?? 0) + (b ?? 0) * 7) % poolSize;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a shop name from the assigned merchant NPC and shop type.
 * The result is deterministic: the same (npcName, shopType) pair always
 * produces the same name, so signs are consistent across respawns.
 */
export function generateShopName(npcName: string, shopType: ShopType): string {
	const { first, surname, initials } = splitName(npcName);
	const pool = TEMPLATES[shopType];
	const idx = templateIndex(npcName, pool.size());
	const template = pool[idx];
	if (template === undefined) return first + "'s Shop";
	// Lua gsub: %$ matches a literal $ in the pattern
	const [s1] = template.gsub("%$first", first);
	const [s2] = s1.gsub("%$surname", surname);
	const [s3] = s2.gsub("%$initials", initials);
	return s3;
}
