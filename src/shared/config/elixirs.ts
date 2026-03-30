/**
 * Elixir configuration — easy to add / tweak in one place.
 *
 * Elixirs are consumable. They affect the PLAYER (not NPCs).
 *   - Immediate elixirs apply their effect instantly and are gone.
 *   - Long-term elixirs last for `effectDurationSecs` (like poisons on weapons).
 */

/** Default long-term elixir duration (30 gameplay minutes). */
export const DEFAULT_ELIXIR_DURATION_SECS = 1800;

export type ElixirEffect = "speed_boost";

export const ELIXIR_EFFECT_LABELS: Record<ElixirEffect, string> = {
	speed_boost: "Swiftness",
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
	/** Rarity tier — drives border colour. */
	rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
	/** Which buff this elixir applies. */
	elixirEffect: ElixirEffect;
	/** true = instant one-shot, false = lasts `effectDurationSecs`. */
	immediate: boolean;
	/** Duration in seconds (0 for immediate-only elixirs). */
	effectDurationSecs: number;
}

/** Master elixir catalogue — keyed by elixir ID. */
export const ELIXIRS: Record<string, ElixirDef> = {
	fleetfoot_elixir: {
		id: "fleetfoot_elixir",
		name: "Fleetfoot Elixir",
		description: "Quicksilver and wind-dancer root brewed under a crescent moon. Your legs tingle, then blur.",
		effect: "+20% move speed for 30 gameplay min.",
		elixirType: "Elixir",
		icon: "+",
		rarity: "uncommon",
		elixirEffect: "speed_boost",
		immediate: false,
		effectDurationSecs: DEFAULT_ELIXIR_DURATION_SECS,
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
