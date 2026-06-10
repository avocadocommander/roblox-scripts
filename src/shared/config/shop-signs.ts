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
	weapon: "IRON",
	elixir: "TONIC",
	poison: "VENOM",
	rare: "CURIO",
	tavern: "ALE",
	black_market: "BLACK MARKET",
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

// Shared worn-wood base — all signs read from the same dark painted board.
// Shop type colour appears only in the marker text, accent border, and icon.
// Nothing should look digital — these are physical painted signs.

const WOOD_BG = Color3.fromRGB(22, 16, 10); // dark tarred oak
const WOOD_BORDER = Color3.fromRGB(40, 28, 14); // aged plank grain
const NAME_COLOR = Color3.fromRGB(188, 162, 105); // faded bone parchment
const SUBTEXT_COLOR = Color3.fromRGB(90, 72, 42); // dim tallow shadow

export const SIGN_COLORS: Record<ShopType, SignColorScheme> = {
	// Hammered brass, worn iron — smith's marker
	weapon: {
		marker: Color3.fromRGB(118, 88, 34), // tarnished brass
		name: NAME_COLOR,
		subtext: SUBTEXT_COLOR,
		background: WOOD_BG,
		border: Color3.fromRGB(52, 34, 14), // rust-tinged oak banding
		flavorLine: "Steel & Sparks.",
	},
	// Muted slate-pewter — apothecary chalk on stone
	elixir: {
		marker: Color3.fromRGB(72, 95, 108), // weathered pewter
		name: NAME_COLOR,
		subtext: SUBTEXT_COLOR,
		background: WOOD_BG,
		border: Color3.fromRGB(36, 34, 38), // cold stone edging
		flavorLine: "Bottled Moon.",
	},
	// Mossy fen-green — hedge-witch painted bark
	poison: {
		marker: Color3.fromRGB(55, 82, 40), // dim sage
		name: NAME_COLOR,
		subtext: SUBTEXT_COLOR,
		background: WOOD_BG,
		border: Color3.fromRGB(34, 38, 22), // dark olive trim
		flavorLine: "Quiet Death.",
	},
	// Tarnished gilt on dark walnut — not gleaming, just old
	rare: {
		marker: Color3.fromRGB(118, 95, 34), // dim old gilt
		name: NAME_COLOR,
		subtext: SUBTEXT_COLOR,
		background: WOOD_BG,
		border: Color3.fromRGB(48, 36, 14), // aged gilt trim
		flavorLine: "Odd Wares.",
	},
	// Mead-amber, candlelit — not bright, just warm
	tavern: {
		marker: Color3.fromRGB(132, 88, 28), // dim amber
		name: NAME_COLOR,
		subtext: SUBTEXT_COLOR,
		background: WOOD_BG,
		border: Color3.fromRGB(50, 30, 10), // barrel stave
		flavorLine: "Ale & Fire.",
	},
	// Oxblood lacquer on charred plank — back-alley contraband
	black_market: {
		marker: Color3.fromRGB(138, 28, 28), // dried blood red
		name: NAME_COLOR,
		subtext: SUBTEXT_COLOR,
		background: WOOD_BG,
		border: Color3.fromRGB(56, 14, 14), // smouldered crimson
		flavorLine: "No Questions.",
	},
};

// ── Name template pools ───────────────────────────────────────────────────────
// Each pool entry uses $first, $surname, or $initials as placeholders.
// The template chosen for a merchant is deterministic (same NPC always gets the same one).

const WEAPON_TEMPLATES: string[] = [
	"$surname Forge",
	"$first's Ironworks",
	"The Anvil & Blade",
	"$surname Steel",
	"$first's Armory",
	"The Tempered Edge",
	"$surname Hammerhall",
];

const ELIXIR_TEMPLATES: string[] = [
	"$first's Apothecary",
	"The Silver Alembic",
	"$surname Tonics",
	"$first's Draughts",
	"The Moonlit Flask",
	"$surname Remedies",
	"The Green Glass",
];

const POISON_TEMPLATES: string[] = [
	"$surname Venoms",
	"The Black Vial",
	"$first's Quiet Work",
	"$surname Nightshade",
	"The Bitter Drop",
	"$first's Toxins",
	"The Wilted Herb",
];

const RARE_TEMPLATES: string[] = [
	"$first's Curios",
	"The $surname Cabinet",
	"$surname Relics",
	"The Odd Shelf",
	"$first's Keepsakes",
	"The Gilded Cache",
	"$surname Rare Goods",
];

const TAVERN_TEMPLATES: string[] = [
	"The $surname Hearth",
	"$first's Alehouse",
	"The Copper Cask",
	"The Warm Flagon",
	"$surname Taproom",
	"The Hearth & Barrel",
	"$first's Rest",
];

const BLACK_MARKET_TEMPLATES: string[] = [
	"The $surname Cellar",
	"$first's Quiet Trade",
	"The Back Room",
	"$surname Shadow Goods",
	"The Locked Crate",
	"$first's Hidden Stock",
	"The Unmarked Stall",
];

const TEMPLATES: Record<ShopType, string[]> = {
	weapon: WEAPON_TEMPLATES,
	elixir: ELIXIR_TEMPLATES,
	poison: POISON_TEMPLATES,
	rare: RARE_TEMPLATES,
	tavern: TAVERN_TEMPLATES,
	black_market: BLACK_MARKET_TEMPLATES,
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
