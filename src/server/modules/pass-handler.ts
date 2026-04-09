/**
 * Pass Handler — server module.
 *
 * Manages Roblox Game Pass ownership checks and purchase prompts.
 * Caches per-player ownership to avoid repeated MarketplaceService calls.
 * Listens for PromptGamePassPurchaseFinished to update cache immediately.
 */

import { MarketplaceService, Players } from "@rbxts/services";
import { log } from "shared/helpers";
import { getPromptPassPurchaseRemote, getPassOwnershipSyncRemote } from "shared/remotes/pass-remote";
import { WEAPONS } from "shared/config/weapons";
import { givePlayerItem } from "./inventory-handler";

// ── Remotes ───────────────────────────────────────────────────────────────────

const promptPassRemote = getPromptPassPurchaseRemote();
const ownershipSyncRemote = getPassOwnershipSyncRemote();

// ── Ownership cache: player -> set of owned pass IDs ──────────────────────────

const ownershipCache = new Map<Player, Set<number>>();

// ── Collect all game-pass IDs referenced by weapons ───────────────────────────

const ALL_PASS_IDS = new Set<number>();
for (const [, w] of pairs(WEAPONS)) {
	if (w.gamePassId !== undefined) ALL_PASS_IDS.add(w.gamePassId);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOrCreateCache(player: Player): Set<number> {
	let s = ownershipCache.get(player);
	if (!s) {
		s = new Set<number>();
		ownershipCache.set(player, s);
	}
	return s;
}

/** Check MarketplaceService for pass ownership (pcall-guarded). */
function queryPassOwnership(player: Player, passId: number): boolean {
	const [ok, owns] = pcall(() => MarketplaceService.UserOwnsGamePassAsync(player.UserId, passId));
	if (!ok) {
		log("[PASS] MarketplaceService error checking pass " + passId + " for " + player.Name, "WARN");
		return false;
	}
	return owns as boolean;
}

/** Warm cache for a player — checks all known pass IDs. */
function warmCache(player: Player): void {
	const cache = getOrCreateCache(player);
	for (const passId of ALL_PASS_IDS) {
		if (queryPassOwnership(player, passId)) {
			cache.add(passId);
			log("[PASS] " + player.Name + " owns pass " + passId);
		}
	}
}

/**
 * After a pass purchase succeeds, auto-grant the weapon item so the player
 * does not have to visit a shop.
 */
function autoGrantWeaponForPass(player: Player, passId: number): void {
	for (const [, w] of pairs(WEAPONS)) {
		if (w.gamePassId === passId) {
			givePlayerItem(player, w.id, 1);
			log("[PASS] Auto-granted weapon " + w.id + " to " + player.Name + " for pass " + passId);
		}
	}
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns true if the player owns the given Game Pass (cached). */
export function playerOwnsPass(player: Player, passId: number): boolean {
	const cache = ownershipCache.get(player);
	return cache !== undefined && cache.has(passId);
}

/** Sync all pass ownership states to the client. */
export function syncPassOwnership(player: Player): void {
	const cache = ownershipCache.get(player);
	if (!cache) return;
	for (const passId of cache) {
		ownershipSyncRemote.FireClient(player, passId, true);
	}
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initializePassHandler(): void {
	// Client requests a pass purchase prompt
	promptPassRemote.OnServerEvent.Connect((player: Player, ...args: unknown[]) => {
		const passId = args[0] as number | undefined;
		if (passId === undefined || !typeIs(passId, "number")) return;
		// Only allow prompting passes we actually use
		if (!ALL_PASS_IDS.has(passId)) return;

		log("[PASS] " + player.Name + " requested pass purchase prompt for " + passId);
		MarketplaceService.PromptGamePassPurchase(player, passId);
	});

	// Listen for purchase completion
	MarketplaceService.PromptGamePassPurchaseFinished.Connect((player: Player, passId: number, purchased: boolean) => {
		if (!purchased) return;
		log("[PASS] " + player.Name + " purchased pass " + passId);

		const cache = getOrCreateCache(player);
		cache.add(passId);

		// Notify client
		ownershipSyncRemote.FireClient(player, passId, true);

		// Auto-grant the weapon
		autoGrantWeaponForPass(player, passId);
	});

	// Warm cache when players join
	Players.PlayerAdded.Connect((player) => {
		task.spawn(() => warmCache(player));
	});

	// Also warm for players already in game (in case bootstrap runs late)
	for (const player of Players.GetPlayers()) {
		task.spawn(() => warmCache(player));
	}

	// Cleanup on leave
	Players.PlayerRemoving.Connect((player) => {
		ownershipCache.delete(player);
	});

	log("[PASS] Pass handler initialised");
}
