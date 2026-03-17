/**
 * Client-side initialization latch.
 *
 * bootstrap.client.ts calls markPlayerInitialized() the moment it receives
 * "InitializePlayer" from the server.  Every other client script calls
 * onPlayerInitialized(callback) to register work that should run once the
 * player is ready.
 *
 * Because Roblox caches ModuleScript results, ALL LocalScripts that require
 * this module share the same `initialized` flag and `pending` queue -- no
 * race conditions are possible:
 *
 *   - callback registered BEFORE init  --> queued, dispatched when init fires
 *   - callback registered AFTER  init  --> fires immediately via task.spawn
 */

let initialized = false;
const pending: Array<() => void> = [];

/** Called by bootstrap.client.ts ONLY. */
export function markPlayerInitialized(): void {
	if (initialized) return;
	initialized = true;
	print("[CLIENT-INIT] Player initialized -- dispatching " + pending.size() + " pending callbacks");
	for (const cb of pending) {
		task.spawn(cb);
	}
}

/**
 * Register a callback that runs once the player is initialised.
 * Safe to call at any time -- if init already happened the callback
 * fires immediately.
 */
export function onPlayerInitialized(callback: () => void): void {
	if (initialized) {
		task.spawn(callback);
	} else {
		pending.push(callback);
	}
}
