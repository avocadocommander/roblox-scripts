/**
 * Game Pass configuration — data-only.
 *
 * Centralises every Roblox Game Pass referenced by the game.
 * Other configs (weapons, premium-offers) import pass IDs from here
 * so there is a single source of truth.
 *
 * To add a new Game Pass:
 *   1. Add an entry to GAME_PASSES below.
 *   2. If it unlocks an item, set `unlocksItemId` to the item's config key.
 *   3. Reference the passId from weapons.ts / premium-offers.ts as needed.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GamePassDef {
	/** Unique key used in code to reference this pass. */
	id: string;
	/** Roblox Game Pass ID from the Creator Dashboard. */
	passId: number;
	/** Human-readable name. */
	name: string;
	/** Short description of what the pass grants. */
	description: string;
	/** Item ID this pass unlocks (maps to ITEMS / weapon / poison / elixir configs). */
	unlocksItemId?: string;
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const GAME_PASSES: Record<string, GamePassDef> = {
	warhammer_pass: {
		id: "warhammer_pass",
		passId: 1786246558, // TODO: replace with real Roblox Game Pass ID
		name: "Warhammer",
		description: "Unlocks the Warhammer -- a brutal blunt weapon with devastating knockback.",
		unlocksItemId: "warhammer",
	},
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** All Game Pass IDs for bulk ownership checks (e.g. pass-handler warmCache). */
export const ALL_GAME_PASS_IDS: number[] = (() => {
	const ids: number[] = [];
	for (const [, def] of pairs(GAME_PASSES)) {
		ids.push(def.passId);
	}
	return ids;
})();

/** Look up a Game Pass definition by its Roblox pass ID. */
export function getGamePassByPassId(passId: number): GamePassDef | undefined {
	for (const [, def] of pairs(GAME_PASSES)) {
		if (def.passId === passId) return def;
	}
	return undefined;
}

/** Look up the Game Pass ID required for a given item. Returns undefined if no pass needed. */
export function getGamePassForItem(itemId: string): number | undefined {
	for (const [, def] of pairs(GAME_PASSES)) {
		if (def.unlocksItemId === itemId) return def.passId;
	}
	return undefined;
}
