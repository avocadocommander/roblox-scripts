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

export type PoisonEffect =
	| "floating_death" // target floats upward then dies
	| "slow_decay" // target slowed then dies
	| "paralysis" // target frozen in place then dies
	| "combustion" // target bursts into flame then dies
	| "phantom_fade"; // target fades to translucent then dies

export const POISON_EFFECT_LABELS: Record<PoisonEffect, string> = {
	floating_death: "Float",
	slow_decay: "Decay",
	paralysis: "Paralyse",
	combustion: "Combust",
	phantom_fade: "Fade",
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
	floating_death: {
		id: "floating_death",
		name: "Floating Death",
		description: "A spectral toxin that severs the body from the earth. The victim drifts skyward before the end.",
		effect: "Target floats upward for 4s, then dies.",
		poisonType: "Vial",
		icon: "~",
		rarity: "rare",
		poisonEffect: "floating_death",
		poisonDelaySecs: 4,
		coatDurationSecs: DEFAULT_COAT_DURATION_SECS,
	},
	slow_decay: {
		id: "slow_decay",
		name: "Nightshade Extract",
		description: "Distilled from deadly nightshade. The victim's movements slow to a crawl.",
		effect: "Target slowed 50% for 6s, then dies.",
		poisonType: "Vial",
		icon: "~",
		rarity: "uncommon",
		poisonEffect: "slow_decay",
		poisonDelaySecs: 6,
		coatDurationSecs: DEFAULT_COAT_DURATION_SECS,
	},
	paralysis_toxin: {
		id: "paralysis_toxin",
		name: "Paralysis Toxin",
		description: "Extracted from a cave spider's glands. Locks every muscle in place.",
		effect: "Target frozen for 3s, then dies.",
		poisonType: "Vial",
		icon: "~",
		rarity: "epic",
		poisonEffect: "paralysis",
		poisonDelaySecs: 3,
		coatDurationSecs: DEFAULT_COAT_DURATION_SECS,
	},
	dragons_breath: {
		id: "dragons_breath",
		name: "Dragon's Breath",
		description: "Volatile alchemical fire condensed into a vial. Burns from within.",
		effect: "Target bursts into flame for 5s, then dies.",
		poisonType: "Vial",
		icon: "~",
		rarity: "legendary",
		poisonEffect: "combustion",
		poisonDelaySecs: 5,
		coatDurationSecs: DEFAULT_COAT_DURATION_SECS,
	},
	phantom_venom: {
		id: "phantom_venom",
		name: "Phantom Venom",
		description: "A ghostly substance that dissolves the body into mist. Eerie and silent.",
		effect: "Target fades to translucent over 4s, then dies.",
		poisonType: "Vial",
		icon: "~",
		rarity: "rare",
		poisonEffect: "phantom_fade",
		poisonDelaySecs: 4,
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
