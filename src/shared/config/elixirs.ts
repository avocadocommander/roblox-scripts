/**
 * Elixir configuration — easy to add / tweak in one place.
 *
 * Elixirs are consumable. They affect the PLAYER (not NPCs).
 *   - Immediate elixirs apply their effect instantly and are gone.
 *   - Long-term elixirs last for `effectDurationSecs` (like poisons on weapons).
 */

/** Default long-term elixir duration (30 gameplay minutes). */
export const DEFAULT_ELIXIR_DURATION_SECS = 1800;

export type ElixirEffect = "speed_boost" | "slow_fall" | "invisibility";

export const ELIXIR_EFFECT_LABELS: Record<ElixirEffect, string> = {
	speed_boost: "Swiftness",
	slow_fall: "Featherfall",
	invisibility: "Vanish",
};

export interface ElixirDef {
	id: string;
	name: string;
	description: string;
	/** Mechanical stat line shown in gold on the tooltip. */
	effect: string;
	/** Display sub-type label (always "Elixir"). */
	elixirType: string;
	/** Short icon character for the inventory tile. */
	icon: string;
	/** Rarity tier — drives border colour AND upgrade tier. */
	rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
	/** Which buff this elixir applies. */
	elixirEffect: ElixirEffect;
	/** true = instant one-shot, false = lasts `effectDurationSecs`. */
	immediate: boolean;
	/** Duration in seconds (0 for immediate-only elixirs). */
	effectDurationSecs: number;
	/** Groups upgrade tiers — all items sharing the same familyId are tiers of one elixir. */
	familyId: string;
	/** Short description of what this tier adds over the base. Undefined on the base tier. */
	tierBonus?: string;

	// ── Mechanical parameters (read by client gameplay code) ────────────
	/** Walk-speed multiplier for speed_boost (e.g. 1.2 = +20%). */
	speedMultiplier?: number;
	/** Fraction of gravity to counteract for slow_fall (0–1). */
	gravityReduction?: number;
	/** Duration of the invisibility burst in seconds. */
	burstDurationSecs?: number;
}

/** Master elixir catalogue — keyed by elixir ID. */
export const ELIXIRS: Record<string, ElixirDef> = {
	// ── Fleetfoot Elixir family ────────────────────────────────────────
	fleetfoot_elixir: {
		id: "fleetfoot_elixir",
		familyId: "fleetfoot_elixir",
		name: "Fleetfoot Elixir",
		description: "Quicksilver and wind-dancer root brewed under a crescent moon. Your legs tingle, then blur.",
		effect: "+20% move speed for 30 gameplay min.",
		elixirType: "Elixir",
		icon: "+",
		rarity: "common",
		elixirEffect: "speed_boost",
		immediate: false,
		effectDurationSecs: DEFAULT_ELIXIR_DURATION_SECS,
		speedMultiplier: 1.2,
	},
	fleetfoot_elixir_rare: {
		id: "fleetfoot_elixir_rare",
		familyId: "fleetfoot_elixir",
		name: "Fleetfoot Elixir",
		description: "A triple-distilled batch aged in a wind-spirit's flask. Your feet barely touch the ground.",
		effect: "+35% move speed for 45 gameplay min.",
		tierBonus: "+35% speed (up from +20%), +15 min duration",
		elixirType: "Elixir",
		icon: "+",
		rarity: "rare",
		elixirEffect: "speed_boost",
		immediate: false,
		effectDurationSecs: 2700,
		speedMultiplier: 1.35,
	},

	// ── Featherfall Draught family ─────────────────────────────────────
	featherfall_draught: {
		id: "featherfall_draught",
		familyId: "featherfall_draught",
		name: "Featherfall Draught",
		description:
			"Distilled cloud-moss and crushed sparrow bone. Gravity forgets you exist for a while -- every leap hangs in the air like a held breath.",
		effect: "Slow fall (65% gravity reduction) for 30 gameplay min.",
		elixirType: "Elixir",
		icon: "^",
		rarity: "common",
		elixirEffect: "slow_fall",
		immediate: false,
		effectDurationSecs: DEFAULT_ELIXIR_DURATION_SECS,
		gravityReduction: 0.65,
	},
	featherfall_draught_rare: {
		id: "featherfall_draught_rare",
		familyId: "featherfall_draught",
		name: "Featherfall Draught",
		description: "Sky-brewed above the cloud line. You do not fall so much as choose when to descend.",
		effect: "Near-weightless fall (85% gravity reduction) for 45 gameplay min.",
		tierBonus: "85% gravity reduction (up from 65%), +15 min duration",
		elixirType: "Elixir",
		icon: "^",
		rarity: "rare",
		elixirEffect: "slow_fall",
		immediate: false,
		effectDurationSecs: 2700,
		gravityReduction: 0.85,
	},

	// ── Veil of Silence family ────────────────────────────────────────
	veil_of_silence: {
		id: "veil_of_silence",
		familyId: "veil_of_silence",
		name: "Veil of Silence",
		description:
			"A single sip and the world loses sight of you. Five heartbeats of perfect invisibility -- enough to slip a blade between ribs and vanish.",
		effect: "5s invisibility burst on activation. Lasts 30 gameplay min.",
		elixirType: "Elixir",
		icon: "o",
		rarity: "common",
		elixirEffect: "invisibility",
		immediate: false,
		effectDurationSecs: DEFAULT_ELIXIR_DURATION_SECS,
		burstDurationSecs: 5,
	},
	veil_of_silence_rare: {
		id: "veil_of_silence_rare",
		familyId: "veil_of_silence",
		name: "Veil of Silence",
		description:
			"A deeper draught brewed in total darkness. Eight heartbeats of nothingness -- they will not even hear you breathe.",
		effect: "8s invisibility burst on activation. Lasts 45 gameplay min.",
		tierBonus: "8s burst (up from 5s), +15 min duration",
		elixirType: "Elixir",
		icon: "o",
		rarity: "rare",
		elixirEffect: "invisibility",
		immediate: false,
		effectDurationSecs: 2700,
		burstDurationSecs: 8,
	},
};

/** Ordered list of all elixirs for iteration. */
export const ELIXIR_LIST: ElixirDef[] = (() => {
	const list: ElixirDef[] = [];
	for (const [, def] of pairs(ELIXIRS)) {
		list.push(def);
	}
	return list;
})();

/** Returns all tier variants for a given elixir family, sorted common → legendary. */
export function getElixirFamily(familyId: string): ElixirDef[] {
	const order = ["common", "uncommon", "rare", "epic", "legendary"];
	return ELIXIR_LIST.filter((e) => e.familyId === familyId).sort(
		(a, b) => order.indexOf(a.rarity) < order.indexOf(b.rarity),
	);
}
