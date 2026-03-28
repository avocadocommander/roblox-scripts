/**
 * Shared UI toggle callbacks — allows the mobile HUD (or any client script)
 * to open/close panels without importing .client.ts entry-point files.
 *
 * Each panel registers its toggle function at init time.
 */

let inventoryToggleFn: (() => void) | undefined;
let killBookToggleFn: (() => void) | undefined;

export function registerInventoryToggle(fn: () => void): void {
	inventoryToggleFn = fn;
}

export function registerKillBookToggle(fn: () => void): void {
	killBookToggleFn = fn;
}

export function toggleInventory(): void {
	if (inventoryToggleFn) inventoryToggleFn();
}

export function toggleKillBook(): void {
	if (killBookToggleFn) killBookToggleFn();
}
