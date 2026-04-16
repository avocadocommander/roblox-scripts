/**
 * Player configuration — data-only defaults and balance constants.
 *
 * All tunable player values live here so designers can tweak them in one place.
 * Other systems (player-state, inventory, bounty) import from this file.
 *
 * To adjust starting stats, economy, or limits — edit the values below.
 */

import { FIXED_ROUTE_NPC_NAMES } from "./npcs";

// ── Starting stats ────────────────────────────────────────────────────────────

/** Gold the player starts with on first join. */
export const STARTING_COINS = 0;

/** Level the player starts at. */
export const STARTING_LEVEL = 1;

/** Default display name before the player sets one. */
export const DEFAULT_PLAYER_NAME = "Strider";

/** Title ID granted to every new player (must exist in titles config). */
export const DEFAULT_TITLE = "sellsword";

/** Titles every new player owns on first join. */
export const DEFAULT_OWNED_TITLES: string[] = ["sellsword"];

// ── Inventory limits ──────────────────────────────────────────────────────────

/** Max bounty scroll slots a player can hold at once. */
export const MAX_BOUNTY_SLOTS = 10;

// ── Movement ──────────────────────────────────────────────────────────────────

/** Default walk speed (Humanoid.WalkSpeed). */
export const DEFAULT_WALK_SPEED = 16;

/** Sprint walk speed multiplier (applied via shift-lock / sprint button). */
export const SPRINT_SPEED = 24;

// ── Cooldowns ─────────────────────────────────────────────────────────────────

/** Seconds between campfire placements. */
export const CAMPFIRE_COOLDOWN_SECS = 2;

/** Seconds between consumable item activations (poisons / elixirs). */
export const CONSUMABLE_COOLDOWN_SECS = 3;
