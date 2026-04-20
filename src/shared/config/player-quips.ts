/**
 * Player Quips — short self-talk lines the player character "says"
 * as floating text only they can see.
 *
 * To add a new quip category, add a key here and trigger it from
 * the client via `showPlayerQuip(category)`.
 */

export type QuipCategory =
	| "no_weapon"
	| "target_too_far"
	| "already_wanted"
	| "inventory_full"
	| "not_enough_gold"
	| "npc_unkillable";

/** Pool of lines per category — one is picked at random each time. */
export const PLAYER_QUIPS: Record<QuipCategory, string[]> = {
	no_weapon: [
		"I need to find a weapon...",
		"Can't kill with bare hands.",
		"I should equip something first.",
		"Not with my fists...",
		"Where did I put my blade?",
	],
	target_too_far: ["Too far away...", "I need to get closer.", "Not close enough."],
	already_wanted: ["They're already looking for me...", "I should lay low.", "The guards know my face."],
	inventory_full: ["My pockets are full.", "No room to carry more.", "I need to offload some things."],
	not_enough_gold: ["Not enough coin...", "I can't afford that.", "My purse is too light."],
	npc_unkillable: ["I shouldn't...", "That one's off limits.", "Better not."],
};
