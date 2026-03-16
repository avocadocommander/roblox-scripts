/**
 * Elixir configuration — easy to add / tweak in one place.
 *
 * Elixirs are consumable. They affect the PLAYER (not NPCs).
 *   - Immediate elixirs apply their effect instantly and are gone.
 *   - Long-term elixirs last for `effectDurationSecs` (like poisons on weapons).
 */

/** Default long-term elixir duration (1 hour). */
export const DEFAULT_ELIXIR_DURATION_SECS = 3600;

export type ElixirEffect =
	| "speed_boost" // +move speed
	| "jump_boost" // +jump height
	| "detection_shrink" // reduced detection radius
	| "target_outline" // see your bounty target outlined
	| "health_regen" // passive HP regen
	| "stealth_boost"; // harder to detect while sneaking

export const ELIXIR_EFFECT_LABELS: Record<ElixirEffect, string> = {
	speed_boost: "Swiftness",
	jump_boost: "Leap",
	detection_shrink: "Shadow",
	target_outline: "Eagle Eye",
	health_regen: "Vitality",
	stealth_boost: "Ghost",
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
	swiftness_elixir: {
		id: "swiftness_elixir",
		name: "Elixir of Swiftness",
		description: "Quicksilver and ginger root. Your legs tingle, then blur.",
		effect: "+30% move speed for 1 hour.",
		elixirType: "Elixir",
		icon: "+",
		rarity: "uncommon",
		elixirEffect: "speed_boost",
		immediate: false,
		effectDurationSecs: DEFAULT_ELIXIR_DURATION_SECS,
	},
	sky_step: {
		id: "sky_step",
		name: "Sky Step Tonic",
		description: "Infused with powdered cloud crystal. Gravity loosens its grip on you.",
		effect: "+50% jump height for 1 hour.",
		elixirType: "Elixir",
		icon: "+",
		rarity: "rare",
		elixirEffect: "jump_boost",
		immediate: false,
		effectDurationSecs: DEFAULT_ELIXIR_DURATION_SECS,
	},
	shadow_cloak: {
		id: "shadow_cloak",
		name: "Shadow Cloak Draught",
		description: "Brewed from midnight moss. Your presence shrinks from the world's notice.",
		effect: "Detection radius reduced 40% for 1 hour.",
		elixirType: "Elixir",
		icon: "+",
		rarity: "rare",
		elixirEffect: "detection_shrink",
		immediate: false,
		effectDurationSecs: DEFAULT_ELIXIR_DURATION_SECS,
	},
	eagle_eye: {
		id: "eagle_eye",
		name: "Eagle Eye Serum",
		description: "Distilled raptor essence. Your vision sharpens beyond mortal limits.",
		effect: "See your bounty target outlined for 1 hour.",
		elixirType: "Elixir",
		icon: "+",
		rarity: "epic",
		elixirEffect: "target_outline",
		immediate: false,
		effectDurationSecs: DEFAULT_ELIXIR_DURATION_SECS,
	},
	vitality_draught: {
		id: "vitality_draught",
		name: "Vitality Draught",
		description: "A warm tincture of troll blood and willow bark. Wounds close on their own.",
		effect: "Passive HP regeneration for 1 hour.",
		elixirType: "Elixir",
		icon: "+",
		rarity: "uncommon",
		elixirEffect: "health_regen",
		immediate: false,
		effectDurationSecs: DEFAULT_ELIXIR_DURATION_SECS,
	},
	ghost_oil: {
		id: "ghost_oil",
		name: "Ghost Oil",
		description: "Rendered from spectral fat. Your footsteps vanish, your breath silences.",
		effect: "Harder to detect while sneaking for 1 hour.",
		elixirType: "Elixir",
		icon: "+",
		rarity: "epic",
		elixirEffect: "stealth_boost",
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
