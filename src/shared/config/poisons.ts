/**
 * Poison configuration -- easy to add / tweak in one place.
 *
 * Poisons are consumable. When activated they coat the player's current
 * weapon for `coatDurationSecs` (default 30 minutes). The next assassination
 * with that weapon triggers the poison's death effect on the NPC.
 *
 * Progression model:
 *   - `rarity` is the family identity / classification. It NEVER changes
 *     between tiers in the same family.
 *   - `tier` (1 / 2 / 3) is the strength level inside a family:
 *       1 = Base       (display name: "Levitation Poison")
 *       2 = +          (display name: "Levitation Poison +")
 *       3 = ++         (display name: "Levitation Poison ++")
 *   - The display suffix lives in `POISON_TIER_SUFFIX`; the `name` field
 *     stores only the family base name. Use `getPoisonDisplayName(def)` to
 *     render the full UI label.
 *
 * `poisonDelaySecs` = how long the NPC suffers the effect before dying.
 */

/** Default duration a poison stays active on a weapon (30 minutes). */
export const DEFAULT_COAT_DURATION_SECS = 1800;

export type PoisonEffect = "floating_death" | "shrinking_death" | "dismember_death" | "divine_pull";

export const POISON_EFFECT_LABELS: Record<PoisonEffect, string> = {
	floating_death: "Levitate",
	shrinking_death: "Shrink",
	dismember_death: "Dismember",
	divine_pull: "O's Guidance",
};

/** Upgrade tier within a poison family. */
export type PoisonTier = 1 | 2 | 3;

/** Display suffix appended to the family base name, keyed by tier. */
export const POISON_TIER_SUFFIX: Record<PoisonTier, string> = {
	1: "",
	2: " +",
	3: " ++",
};

export interface PoisonDef {
	id: string;
	/** Family base name -- never includes the +/++ suffix. Use getPoisonDisplayName() to render. */
	name: string;
	description: string;
	/** Mechanical stat line shown in gold on the tooltip. */
	effect: string;
	/**
	 * Optional extra-capability line shown beneath `effect` on the tooltip in
	 * the tier's highlight colour. Use for abilities a higher tier gains beyond
	 * the base (e.g. "Also reveals nearby targets through walls.").
	 */
	extraEffect?: string;
	/** Display sub-type label (always "Vial"). */
	poisonType: string;
	/** Short icon character for the inventory tile. */
	icon: string;
	/**
	 * Rarity tier -- identity / classification only. Fixed across every
	 * tier in the same family. Drives border colour and shop pool placement.
	 */
	rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
	/** Which death-animation effect this poison triggers. */
	poisonEffect: PoisonEffect;
	/** Seconds between assassination hit and NPC death. */
	poisonDelaySecs: number;
	/** How long the coat lasts on the weapon (seconds). */
	coatDurationSecs: number;
	/** Groups upgrade tiers -- all items sharing the same familyId are tiers of one poison. */
	familyId: string;
	/** Strength tier inside the family (1 = base, 2 = +, 3 = ++). */
	tier: PoisonTier;
	/** Developer Product ID for Robux-purchasable poisons (repeat-purchase). */
	devProductId?: number;
	/** Number of charges granted per activation (undefined = standard 1-use coat). */
	chargesPerUse?: number;
}

/** Master poison catalogue -- keyed by poison ID. */
export const POISONS: Record<string, PoisonDef> = {
	// -- Levitation Poison family ---------------------------------------
	levitation_poison: {
		id: "levitation_poison",
		familyId: "levitation_poison",
		tier: 1,
		name: "Levitation Poison",
		description:
			"A translucent vial of swirling violet mist. Victims drift skyward, limbs limp, before the end claims them.",
		effect: "NPC floats upward for 5s before death.",
		poisonType: "Vial",
		icon: "~",
		rarity: "uncommon",
		poisonEffect: "floating_death",
		poisonDelaySecs: 5,
		coatDurationSecs: DEFAULT_COAT_DURATION_SECS,
	},
	levitation_poison_plus: {
		id: "levitation_poison_plus",
		familyId: "levitation_poison",
		tier: 2,
		name: "Levitation Poison",
		description:
			"A distilled vintage -- the mist coils tighter, the ascent slower and crueller. They hang in the sky like a warning.",
		effect: "NPC floats 8s before death.",
		poisonType: "Vial",
		icon: "~",
		rarity: "uncommon",
		poisonEffect: "floating_death",
		poisonDelaySecs: 8,
		coatDurationSecs: 2700,
	},
	levitation_poison_plus_plus: {
		id: "levitation_poison_plus_plus",
		familyId: "levitation_poison",
		tier: 3,
		name: "Levitation Poison",
		description:
			"A masterwork brew said to be aged in a sealed thunderhead. The victim is hurled into the heavens, suspended an eternity before falling.",
		effect: "NPC floats 12s before death.",
		poisonType: "Vial",
		icon: "~",
		rarity: "uncommon",
		poisonEffect: "floating_death",
		poisonDelaySecs: 12,
		coatDurationSecs: 3600,
	},

	// -- Shrinking Curse family -----------------------------------------
	shrinking_curse: {
		id: "shrinking_curse",
		familyId: "shrinking_curse",
		tier: 1,
		name: "Shrinking Curse",
		description:
			"Bottled spite from a hedge-witch's cauldron. The victim crumples inward, bones folding like wet parchment, until nothing remains but a faint pop.",
		effect: "NPC shrinks over 5s then implodes.",
		poisonType: "Vial",
		icon: "v",
		rarity: "rare",
		poisonEffect: "shrinking_death",
		poisonDelaySecs: 5,
		coatDurationSecs: DEFAULT_COAT_DURATION_SECS,
	},
	shrinking_curse_plus: {
		id: "shrinking_curse_plus",
		familyId: "shrinking_curse",
		tier: 2,
		name: "Shrinking Curse",
		description: "Twice-fermented in a sealed crypt. The collapse is faster, more violent -- and the pop echoes.",
		effect: "NPC shrinks over 3s then implodes.",
		poisonType: "Vial",
		icon: "v",
		rarity: "rare",
		poisonEffect: "shrinking_death",
		poisonDelaySecs: 3,
		coatDurationSecs: 2700,
	},
	shrinking_curse_plus_plus: {
		id: "shrinking_curse_plus_plus",
		familyId: "shrinking_curse",
		tier: 3,
		name: "Shrinking Curse",
		description:
			"Distilled malice condensed to a single drop. The victim folds inward like crumpled foil -- a single heartbeat, then a thunderclap pop.",
		effect: "NPC shrinks over 1.5s then implodes violently.",
		poisonType: "Vial",
		icon: "v",
		rarity: "rare",
		poisonEffect: "shrinking_death",
		poisonDelaySecs: 1.5,
		coatDurationSecs: 3600,
	},

	// -- Dismembering Blight family -------------------------------------
	dismembering_blight: {
		id: "dismembering_blight",
		familyId: "dismembering_blight",
		tier: 1,
		name: "Dismembering Blight",
		description:
			"A tar-black tincture that smells of iron and regret. It loosens the body's seams one joint at a time, each limb surrendering to gravity.",
		effect: "NPC limbs fall off one by one over 5s.",
		poisonType: "Vial",
		icon: "x",
		rarity: "epic",
		poisonEffect: "dismember_death",
		poisonDelaySecs: 5,
		coatDurationSecs: DEFAULT_COAT_DURATION_SECS,
	},
	dismembering_blight_plus: {
		id: "dismembering_blight_plus",
		familyId: "dismembering_blight",
		tier: 2,
		name: "Dismembering Blight",
		description:
			"Aged in a bone casket. The seams come undone violently -- limbs tear away with force, scattering like broken marionette strings.",
		effect: "Violent dismember over 3s.",
		poisonType: "Vial",
		icon: "x",
		rarity: "epic",
		poisonEffect: "dismember_death",
		poisonDelaySecs: 3,
		coatDurationSecs: 2700,
	},
	dismembering_blight_plus_plus: {
		id: "dismembering_blight_plus_plus",
		familyId: "dismembering_blight",
		tier: 3,
		name: "Dismembering Blight",
		description:
			"A reaper's masterstroke -- bottled annihilation. The body unmakes itself instantly, every joint failing at once in a single brutal heartbeat.",
		effect: "Instant dismember in 1.5s.",
		poisonType: "Vial",
		icon: "x",
		rarity: "epic",
		poisonEffect: "dismember_death",
		poisonDelaySecs: 1.5,
		coatDurationSecs: 3600,
	},

	// -- O's Guidance (Developer Product) -------------------------------
	os_guidance: {
		id: "os_guidance",
		familyId: "os_guidance",
		tier: 1,
		name: "O's Guidance",
		description:
			"A divine vial humming with holy light. Upon striking a target, a beam descends from the heavens and wrenches the soul skyward -- swift and merciless.",
		effect: "Beam from sky, ragdoll, rapid pull upward.",
		poisonType: "Vial",
		icon: "*",
		rarity: "legendary",
		poisonEffect: "divine_pull",
		poisonDelaySecs: 0.15,
		coatDurationSecs: DEFAULT_COAT_DURATION_SECS,
		devProductId: 3571561126,
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

/** Render a poison's full display name including the tier suffix. */
export function getPoisonDisplayName(def: PoisonDef): string {
	return def.name + POISON_TIER_SUFFIX[def.tier];
}

/** Returns all tier variants for a given poison family, sorted base -> +/++ . */
export function getPoisonFamily(familyId: string): PoisonDef[] {
	return POISON_LIST.filter((p) => p.familyId === familyId).sort((a, b) => a.tier < b.tier);
}
