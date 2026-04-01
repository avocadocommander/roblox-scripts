import { Players } from "@rbxts/services";
import { log } from "shared/helpers";
import { awardAchievement } from "./achievement-handler";
import { POISONS } from "shared/config/poisons";
import { ELIXIRS } from "shared/config/elixirs";
import { getEffectSyncRemote, EffectSyncPayload } from "shared/remotes/effect-remote";
import { getPlayerStateSnapshot, setPlayerEffectFields } from "shared/player-state";

const effectSyncRemote = getEffectSyncRemote();

// ── In-memory effect state (authoritative, mirrors PlayerState) ───────────────

interface ActiveEffects {
	poisonId: string | undefined;
	poisonRemainingSecs: number;
	elixirId: string | undefined;
	elixirRemainingSecs: number;
}

const PLAYER_EFFECTS = new Map<Player, ActiveEffects>();

function getOrCreate(player: Player): ActiveEffects {
	let effects = PLAYER_EFFECTS.get(player);
	if (!effects) {
		effects = { poisonId: undefined, poisonRemainingSecs: 0, elixirId: undefined, elixirRemainingSecs: 0 };
		PLAYER_EFFECTS.set(player, effects);
	}
	return effects;
}

// ── Sync to client ────────────────────────────────────────────────────────────

function pushEffectSync(player: Player): void {
	const effects = PLAYER_EFFECTS.get(player);
	if (!effects) return;
	const payload: EffectSyncPayload = {
		activePoisonId: effects.poisonId,
		poisonRemainingSecs: effects.poisonRemainingSecs,
		activeElixirId: effects.elixirId,
		elixirRemainingSecs: effects.elixirRemainingSecs,
	};
	effectSyncRemote.FireClient(player, payload);
}

// ── Persist to PlayerState ────────────────────────────────────────────────────

function persistEffects(player: Player): void {
	const effects = PLAYER_EFFECTS.get(player);
	if (!effects) return;
	setPlayerEffectFields(
		player,
		effects.poisonId,
		effects.poisonRemainingSecs,
		effects.elixirId,
		effects.elixirRemainingSecs,
	);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Activate a poison for `player`. Replaces any existing poison. */
export function activatePoison(player: Player, poisonId: string): void {
	const def = POISONS[poisonId];
	if (!def) {
		log("[EFFECT] Unknown poison ID: " + poisonId, "WARN");
		return;
	}
	const effects = getOrCreate(player);
	effects.poisonId = poisonId;
	effects.poisonRemainingSecs = def.coatDurationSecs;
	log("[EFFECT] " + player.Name + " activated poison: " + def.name + " (" + def.coatDurationSecs + "s)");
	persistEffects(player);
	pushEffectSync(player);
}

/** Activate an elixir for `player`. Replaces any existing elixir (max 1). */
export function activateElixir(player: Player, elixirId: string): void {
	const def = ELIXIRS[elixirId];
	if (!def) {
		log("[EFFECT] Unknown elixir ID: " + elixirId, "WARN");
		return;
	}
	const effects = getOrCreate(player);
	effects.elixirId = elixirId;
	effects.elixirRemainingSecs = def.effectDurationSecs;
	awardAchievement(player, "A_TASTE_OF_POWER");
	log("[EFFECT] " + player.Name + " activated elixir: " + def.name + " (" + def.effectDurationSecs + "s)");
	persistEffects(player);
	pushEffectSync(player);
}

/** Get the currently active poison ID for `player` (undefined if none/expired). */
export function getActivePoison(player: Player): string | undefined {
	const effects = PLAYER_EFFECTS.get(player);
	if (!effects || effects.poisonRemainingSecs <= 0) return undefined;
	return effects.poisonId;
}

/** Get the currently active elixir ID for `player` (undefined if none/expired). */
export function getActiveElixir(player: Player): string | undefined {
	const effects = PLAYER_EFFECTS.get(player);
	if (!effects || effects.elixirRemainingSecs <= 0) return undefined;
	return effects.elixirId;
}

/** Clear the active poison for `player`. */
export function clearPoison(player: Player): void {
	const effects = PLAYER_EFFECTS.get(player);
	if (!effects) return;
	effects.poisonId = undefined;
	effects.poisonRemainingSecs = 0;
	persistEffects(player);
	pushEffectSync(player);
}

/** Clear the active elixir for `player`. */
export function clearElixir(player: Player): void {
	const effects = PLAYER_EFFECTS.get(player);
	if (!effects) return;
	effects.elixirId = undefined;
	effects.elixirRemainingSecs = 0;
	persistEffects(player);
	pushEffectSync(player);
}

// ── Initialization ────────────────────────────────────────────────────────────

export function initializeEffectHandler(): void {
	log("[EFFECT] Initializing consumable effect handler");

	// Restore effects from PlayerState on join
	Players.PlayerAdded.Connect((player) => {
		// Delay slightly so PlayerState has loaded from DataStore
		task.delay(3, () => {
			const state = getPlayerStateSnapshot(player);
			if (!state) return;
			const effects = getOrCreate(player);
			if (state.activePoisonId && state.activePoisonRemainingSecs > 0) {
				effects.poisonId = state.activePoisonId;
				effects.poisonRemainingSecs = state.activePoisonRemainingSecs;
				log(
					"[EFFECT] Restored poison for " +
						player.Name +
						": " +
						state.activePoisonId +
						" (" +
						state.activePoisonRemainingSecs +
						"s left)",
				);
			}
			if (state.activeElixirId && state.activeElixirRemainingSecs > 0) {
				effects.elixirId = state.activeElixirId;
				effects.elixirRemainingSecs = state.activeElixirRemainingSecs;
				log(
					"[EFFECT] Restored elixir for " +
						player.Name +
						": " +
						state.activeElixirId +
						" (" +
						state.activeElixirRemainingSecs +
						"s left)",
				);
			}
			pushEffectSync(player);
		});
	});

	// Also restore for players already in-game
	for (const player of Players.GetPlayers()) {
		const state = getPlayerStateSnapshot(player);
		if (!state) continue;
		const effects = getOrCreate(player);
		if (state.activePoisonId && state.activePoisonRemainingSecs > 0) {
			effects.poisonId = state.activePoisonId;
			effects.poisonRemainingSecs = state.activePoisonRemainingSecs;
		}
		if (state.activeElixirId && state.activeElixirRemainingSecs > 0) {
			effects.elixirId = state.activeElixirId;
			effects.elixirRemainingSecs = state.activeElixirRemainingSecs;
		}
		pushEffectSync(player);
	}

	// Cleanup on leave
	Players.PlayerRemoving.Connect((player) => {
		// Already persisted via PlayerState auto-save
		PLAYER_EFFECTS.delete(player);
	});

	// ── 1-second countdown tick ───────────────────────────────────────────────
	task.spawn(() => {
		// eslint-disable-next-line no-constant-condition
		for (;;) {
			task.wait(1);
			for (const [player, effects] of PLAYER_EFFECTS) {
				let changed = false;

				if (effects.poisonId && effects.poisonRemainingSecs > 0) {
					effects.poisonRemainingSecs -= 1;
					changed = true;
					if (effects.poisonRemainingSecs <= 0) {
						log("[EFFECT] Poison expired for " + player.Name);
						effects.poisonId = undefined;
						effects.poisonRemainingSecs = 0;
					}
				}

				if (effects.elixirId && effects.elixirRemainingSecs > 0) {
					effects.elixirRemainingSecs -= 1;
					changed = true;
					if (effects.elixirRemainingSecs <= 0) {
						log("[EFFECT] Elixir expired for " + player.Name);
						effects.elixirId = undefined;
						effects.elixirRemainingSecs = 0;
					}
				}

				if (changed) {
					// Persist every 30 seconds (not every tick) to reduce DataStore writes
					if (effects.poisonRemainingSecs % 30 === 0 || effects.elixirRemainingSecs % 30 === 0) {
						persistEffects(player);
					}
					// Sync to client every 5 seconds (not every tick) to reduce network traffic
					if (effects.poisonRemainingSecs % 5 === 0 || effects.elixirRemainingSecs % 5 === 0) {
						pushEffectSync(player);
					}
				}
			}
		}
	});
}
