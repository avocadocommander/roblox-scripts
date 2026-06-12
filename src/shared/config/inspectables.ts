/**
 * Inspectable Object Registry — data-only config.
 *
 * Any model in the world with a string attribute `inspectId` will be
 * inspectable when the player walks up to it.  The `inspectId` maps to
 * an entry here for display name and description text.
 *
 * To add a new inspectable object:
 *   1. Add an entry to INSPECT_REGISTRY below.
 *   2. In Roblox Studio, set the model's `inspectId` string attribute to the key.
 */

export interface InspectDef {
	displayName: string;
	description: string;
}

export const INSPECT_REGISTRY: Record<string, InspectDef> = {
	templar_cross: {
		displayName: "Odd looking rune",
		description:
			"This rune looks old - maybe it was carved by the original settlers of this land? It depicts a cross with four triangles around it. You wonder if it has any significance.",
	},
	moon_book: {
		displayName: "Moon-stained notes",
		description:
			"Whoever wrote this book was desperately trying to learn how to replant and reproduce the glowing mushrooms connected to the moon.",
	},
	growing_shroom: {
		displayName: "Farmed glowing mushroom",
		description: "Looks like these farmed mushrooms do not have the same effect as the natural ones.",
	},
	ship: {
		displayName: "Ancient wreck",
		description:
			"This ship must have been down here for hundreds of years by the look of it. You know you have seen that symbol before.",
	},
};

/** Look up an inspect definition by id. Returns undefined if not found. */
export function getInspectDef(inspectId: string): InspectDef | undefined {
	return INSPECT_REGISTRY[inspectId];
}
