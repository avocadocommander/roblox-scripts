/**
 * Poison configuration — easy to add / tweak in one place.
 *
 * Poisons are consumable. When activated they coat the player's current
 * weapon for `coatDurationSecs` (default 30 minutes). The next assassination
 * with that weapon triggers the poison's death effect on the NPC.
 *
 * `poisonDelaySecs` = how long the NPC suffers the effect before dying.
 */

/** Default duration a poison stays active on a weapon (30 minutes). */
export const DEFAULT_COAT_DURATION_SECS = 1800;

export type PoisonEffect = "floating_death";

export const POISON_EFFECT_LABELS: Record<PoisonEffect, string> = {
	floating_death: "Levitate",
};

export interface PoisonDef {
	id: string;
	name: string;
	description: string;
	/** Mechanical stat line shown in gold on the tooltip. */
	effect: string;
	/** Display sub-type label (always "Vial"). */
	poisonType: string;
	/** Short icon character for the inventory tile. */
	icon: string;
	/** Rarity tier — drives border colour. */
	rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
	/** Which death-animation effect this poison triggers. */
	poisonEffect: PoisonEffect;
	/** Seconds between assassination hit and NPC death. */
	poisonDelaySecs: number;
	/** How long the coat lasts on the weapon (seconds). */
	coatDurationSecs: number;
}

/** Master poison catalogue — keyed by poison ID. */
export const POISONS: Record<string, PoisonDef> = {
	levitation_poison: {
		id: "levitation_poison",
		name: "Levitation Poison",
		description:
			"A translucent vial of swirling violet mist. Victims drift skyward, limbs limp, before the end claims them.",
		effect: "NPC floats upward for 5s before death. Lasts 30 gameplay min.",
		poisonType: "Vial",
		icon: "~",
		rarity: "rare",
		poisonEffect: "floating_death",
		poisonDelaySecs: 5,
		coatDurationSecs: DEFAULT_COAT_DURATION_SECS,
	},
};

/** Ordered list of all poisons for iteration. */
export const POISON_LIST: PoisonDef[] = (() => {
	const list: PoisonDef[] = [];
	for (const [, def] of pairs(POISONS)) {
		list.push(def);
	}
	return list;
})();
