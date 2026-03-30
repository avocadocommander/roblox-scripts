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

export type PoisonEffect = "floating_death" | "shrinking_death" | "dismember_death";

export const POISON_EFFECT_LABELS: Record<PoisonEffect, string> = {
	floating_death: "Levitate",
	shrinking_death: "Shrink",
	dismember_death: "Dismember",
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
	/** Rarity tier — drives border colour AND upgrade tier. */
	rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
	/** Which death-animation effect this poison triggers. */
	poisonEffect: PoisonEffect;
	/** Seconds between assassination hit and NPC death. */
	poisonDelaySecs: number;
	/** How long the coat lasts on the weapon (seconds). */
	coatDurationSecs: number;
	/** Groups upgrade tiers — all items sharing the same familyId are tiers of one poison. */
	familyId: string;
	/** Short description of what this tier adds over the base. Undefined on the base tier. */
	tierBonus?: string;
}

/** Master poison catalogue — keyed by poison ID. */
export const POISONS: Record<string, PoisonDef> = {
	// ── Levitation Poison family ─────────────────────────────────────────
	levitation_poison: {
		id: "levitation_poison",
		familyId: "levitation_poison",
		name: "Levitation Poison",
		description:
			"A translucent vial of swirling violet mist. Victims drift skyward, limbs limp, before the end claims them.",
		effect: "NPC floats upward for 5s before death. Lasts 30 gameplay min.",
		poisonType: "Vial",
		icon: "~",
		rarity: "common",
		poisonEffect: "floating_death",
		poisonDelaySecs: 5,
		coatDurationSecs: DEFAULT_COAT_DURATION_SECS,
	},
	levitation_poison_rare: {
		id: "levitation_poison_rare",
		familyId: "levitation_poison",
		name: "Levitation Poison",
		description:
			"A distilled vintage -- the mist coils tighter, the ascent slower and crueller. They hang in the sky like a warning.",
		effect: "NPC floats 8s before death. +45 min coat. Lasts 45 gameplay min.",
		tierBonus: "+3s float, +15 min coat duration",
		poisonType: "Vial",
		icon: "~",
		rarity: "rare",
		poisonEffect: "floating_death",
		poisonDelaySecs: 8,
		coatDurationSecs: 2700,
	},

	// ── Shrinking Curse family ────────────────────────────────────────────
	shrinking_curse: {
		id: "shrinking_curse",
		familyId: "shrinking_curse",
		name: "Shrinking Curse",
		description:
			"Bottled spite from a hedge-witch's cauldron. The victim crumples inward, bones folding like wet parchment, until nothing remains but a faint pop.",
		effect: "NPC shrinks over 5s then implodes. Lasts 30 gameplay min.",
		poisonType: "Vial",
		icon: "v",
		rarity: "common",
		poisonEffect: "shrinking_death",
		poisonDelaySecs: 5,
		coatDurationSecs: DEFAULT_COAT_DURATION_SECS,
	},
	shrinking_curse_rare: {
		id: "shrinking_curse_rare",
		familyId: "shrinking_curse",
		name: "Shrinking Curse",
		description: "Twice-fermented in a sealed crypt. The collapse is faster, more violent -- and the pop echoes.",
		effect: "NPC shrinks over 3s then implodes. +45 min coat. Lasts 45 gameplay min.",
		tierBonus: "Faster shrink (3s), +15 min coat duration",
		poisonType: "Vial",
		icon: "v",
		rarity: "rare",
		poisonEffect: "shrinking_death",
		poisonDelaySecs: 3,
		coatDurationSecs: 2700,
	},

	// ── Dismembering Blight family ───────────────────────────────────────
	dismembering_blight: {
		id: "dismembering_blight",
		familyId: "dismembering_blight",
		name: "Dismembering Blight",
		description:
			"A tar-black tincture that smells of iron and regret. It loosens the body's seams one joint at a time, each limb surrendering to gravity.",
		effect: "NPC limbs fall off one by one over 5s. Lasts 30 gameplay min.",
		poisonType: "Vial",
		icon: "x",
		rarity: "common",
		poisonEffect: "dismember_death",
		poisonDelaySecs: 5,
		coatDurationSecs: DEFAULT_COAT_DURATION_SECS,
	},
	dismembering_blight_rare: {
		id: "dismembering_blight_rare",
		familyId: "dismembering_blight",
		name: "Dismembering Blight",
		description:
			"Aged in a bone casket. The seams come undone violently -- limbs tear away with force, scattering like broken marionette strings.",
		effect: "Violent dismember over 3s. +45 min coat. Lasts 45 gameplay min.",
		tierBonus: "Faster dismember (3s), +15 min coat duration",
		poisonType: "Vial",
		icon: "x",
		rarity: "rare",
		poisonEffect: "dismember_death",
		poisonDelaySecs: 3,
		coatDurationSecs: 2700,
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

/** Returns all tier variants for a given poison family, sorted common → legendary. */
export function getPoisonFamily(familyId: string): PoisonDef[] {
	const order = ["common", "uncommon", "rare", "epic", "legendary"];
	return POISON_LIST.filter((p) => p.familyId === familyId).sort(
		(a, b) => order.indexOf(a.rarity) < order.indexOf(b.rarity),
	);
}
