/**
 * Weapon configuration — easy to add / tweak in one place.
 *
 * Weapons change the player's look (models TBD) and deal different
 * damage / speed on assassination. Non-consumable — once owned, always kept.
 *
 * Game Pass requirements are defined in game-passes.ts via `unlocksItemId`.
 * Use `getGamePassForItem(weaponId)` to check if a weapon needs a pass.
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
	/** Knockback force on hit (blunt weapons). Default 0. */
	knockbackForce?: number;
	/** Upward lift force on hit (blunt weapons). Default 0. */
	knockbackLift?: number;
	/** Seconds target stays ragdolled before death resolves (blunt weapons). Default 1. */
	ragdollSecs?: number;
	/** Model or MeshPart name under ReplicatedStorage/Weapons. */
	heldModelName?: string;
	/** Drives support/sheath behavior. One-handed weapons sheath at hip; two-handed weapons sheath on back. */
	handedness?: "oneHanded" | "twoHanded";
	/** Held pose behavior. Use oneHanded for staff-like two-handed weapons. Default follows handedness. */
	heldGripStyle?: "oneHanded" | "twoHanded";
	/** Optional effect spawned at BladeTipAttachment on the held weapon visual. */
	bladeTipEffect?: "dawnsGuide";
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
		heldModelName: "Dagger",
		handedness: "oneHanded",
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
		heldModelName: "Warhammer",
		handedness: "twoHanded",
		knockbackForce: 55,
		knockbackLift: 18,
		ragdollSecs: 1,
	},
	shortsword: {
		id: "shortsword",
		name: "Short Sword",
		description: "A compact sidearm, easy to draw in close quarters.",
		effect: "+10 melee damage. Reliable and quick.",
		weaponType: "Blade",
		icon: "/",
		rarity: "uncommon",
		deliveryType: "dagger",
		heldModelName: "ShortSword",
		handedness: "oneHanded",
	},
	cutlass: {
		id: "cutlass",
		name: "Cutlass",
		description: "A curved pirate blade made for close, ugly work.",
		effect: "+10 melee damage. Reliable and quick.",
		weaponType: "Blade",
		icon: "/",
		rarity: "uncommon",
		deliveryType: "dagger",
		heldModelName: "Cutlass",
		handedness: "oneHanded",
	},
	halberd: {
		id: "halberd",
		name: "Halberd",
		description: "A long guard polearm built to keep trouble at a distance.",
		effect: "Heavy reach weapon. Used by guards.",
		weaponType: "Polearm",
		icon: "T",
		rarity: "rare",
		deliveryType: "dagger",
		heldModelName: "Halberd",
		handedness: "twoHanded",
		heldGripStyle: "oneHanded",
	},
	ornate_staff: {
		id: "ornate_staff",
		name: "Ornate Staff",
		description: "A ceremonial staff carried by church leaders.",
		effect: "Holy staff with a guiding spirit glow.",
		weaponType: "Staff",
		icon: "T",
		rarity: "rare",
		deliveryType: "dagger",
		heldModelName: "Ornate Staff",
		handedness: "twoHanded",
		heldGripStyle: "oneHanded",
		bladeTipEffect: "dawnsGuide",
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
