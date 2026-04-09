/**
 * Delivery type definitions — data-only.
 *
 * A delivery type describes HOW a weapon's kill is delivered:
 *   - BLUNT:  Knockback + ragdoll. NPC stays ragdolled until death resolves.
 *   - PIERCE: Instant hit. NPC dies immediately or poison takes over.
 *
 * Per-weapon tuning (knockback force, ragdoll duration, etc.) lives in
 * weapons.ts on each WeaponDef. This file only defines the kind.
 */

export type DeliveryKind = "blunt" | "pierce";

export interface DeliveryDef {
	id: string;
	kind: DeliveryKind;
}

export const DELIVERY_TYPES: Record<string, DeliveryDef> = {
	dagger: {
		id: "dagger",
		kind: "pierce",
	},
	warhammer: {
		id: "warhammer",
		kind: "blunt",
	},
};
