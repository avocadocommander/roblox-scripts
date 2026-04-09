/**
 * Weapon configuration — easy to add / tweak in one place.
 *
 * Weapons change the player's look (models TBD) and deal different
 * damage / speed on assassination. Non-consumable — once owned, always kept.
 */

export interface WeaponDef {
	id: string;
	name: string;
	description: string;
	/** Mechanical stat line shown in gold on the tooltip. */
	effect: string;
	/** Display sub-type (e.g. "Unarmed", "Blade", "Polearm"). */
	weaponType: string;
	/** Short icon character for the inventory tile. */
	icon: string;
	/** Rarity tier — drives border colour. */
	rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
	/** References a key in DELIVERY_TYPES — controls kill behaviour (blunt or pierce). */
	deliveryType: string;
	/** If set, this weapon requires the given Roblox Game Pass to own/equip. */
	gamePassId?: number;
	/** Knockback force on hit (blunt weapons). Default 0. */
	knockbackForce?: number;
	/** Upward lift force on hit (blunt weapons). Default 0. */
	knockbackLift?: number;
	/** Seconds target stays ragdolled before death resolves (blunt weapons). Default 1. */
	ragdollSecs?: number;
}

/** Master weapon catalogue — keyed by weapon ID. */
export const WEAPONS: Record<string, WeaponDef> = {
	fists: {
		id: "fists",
		name: "Fists",
		description: "Your bare knuckles. Better than nothing.",
		effect: "Base melee. No bonus damage.",
		weaponType: "Unarmed",
		icon: "/",
		rarity: "common",
		deliveryType: "dagger",
	},
	dagger: {
		id: "dagger",
		name: "Dagger",
		description: "A short, sharp blade. Quick and quiet.",
		effect: "+8 melee damage. Fast attack speed.",
		weaponType: "Blade",
		icon: "/",
		rarity: "uncommon",
		deliveryType: "dagger",
	},
	warhammer: {
		id: "warhammer",
		name: "Warhammer",
		description: "A heavy instrument of force. Subtlety is not its purpose.",
		effect: "Knocks targets back with force. Death resolves after impact.",
		weaponType: "Blunt",
		icon: "T",
		rarity: "rare",
		deliveryType: "warhammer",
		gamePassId: 1786246558, // TODO: replace with real Roblox Game Pass ID
		knockbackForce: 55,
		knockbackLift: 18,
		ragdollSecs: 1,
	},
};

/** Ordered list of all weapons for iteration. */
export const WEAPON_LIST: WeaponDef[] = (() => {
	const list: WeaponDef[] = [];
	for (const [, def] of pairs(WEAPONS)) {
		list.push(def);
	}
	return list;
})();
