import { getSeedFromName, makeSeededRandom } from "shared/npc/utils";

/** Seeded equipment pool for noble NPCs. Add future noble-only items here. */
export const NOBLE_EQUIPMENT_ITEM_IDS = ["noble_sword"];

/** Seeded equipment pool for royal NPCs. Add future royal-only items here. */
export const ROYAL_EQUIPMENT_ITEM_IDS = [
	"royal_longsword",
	"royal_wand",
	"royal_mace",
	"royal_greataxe",
	"royal_axe",
];

function pickSeeded(items: string[], seed: number): string | undefined {
	if (items.size() === 0) return undefined;
	const rand = makeSeededRandom(seed);
	return items[math.floor(rand() * items.size())];
}

/** Deterministically pick a noble equipment item from the NPC name seed. */
export function pickNobleEquipmentItemId(npcName: string): string | undefined {
	return pickSeeded(NOBLE_EQUIPMENT_ITEM_IDS, getSeedFromName(npcName));
}

/** Deterministically pick a royal equipment item from the NPC name seed. */
export function pickRoyalEquipmentItemId(npcName: string): string | undefined {
	return pickSeeded(ROYAL_EQUIPMENT_ITEM_IDS, getSeedFromName(npcName));
}
