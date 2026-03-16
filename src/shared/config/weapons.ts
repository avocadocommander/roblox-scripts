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
	},
	dagger: {
		id: "dagger",
		name: "Dagger",
		description: "A short, sharp blade. Quick and quiet.",
		effect: "+8 melee damage. Fast attack speed.",
		weaponType: "Blade",
		icon: "/",
		rarity: "uncommon",
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
