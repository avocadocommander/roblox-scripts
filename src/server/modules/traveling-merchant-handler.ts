/**
 * Traveling Merchant Handler
 *
 * A "Merchant Cart" model in Workspace spawns automatically every 20 minutes
 * and stays for 5 minutes before departing. The cart falls from the sky on
 * arrival and floats upward on departure.
 *
 * Model requirements (Workspace > "Merchant Cart"):
 *   - PrimaryPart set on the model
 *   - All BaseParts anchored
 *   - A child Model named "Shop" containing:
 *       Routes  — Folder of BasePart route waypoints (+ optional Configuration)
 *       Sign    — BasePart for the merchant sign
 *
 * Exports:
 *   startTravelingMerchantEvent()      — force-start (debug / admin)
 *   stopTravelingMerchantEvent()       — force-stop  (debug / admin)
 *   initializeTravelingMerchantSystem() — call once from bootstrap
 */

import { ServerStorage, Workspace } from "@rbxts/services";
import { log } from "shared/helpers";
import { NPC_REGISTRY } from "shared/config/npcs";
import { MERCHANT_NPC_POOL, SHOP_TYPE_POOLS, ShopType } from "shared/config/shop-types";
import { ShopItem } from "shared/config/npcs";
import { createNPCModelAndGenerateHumanoid, NPC, setState, assignNpcToRoute } from "shared/npc/main";
import { RouteConfig, getConfigFromRoute } from "shared/npc-manager";
import { getBoardBroadcastRemote } from "shared/remotes/board-broadcast-remote";
import { registerMerchantShop, unregisterMerchantShop } from "./merchant-handler";

// ── Config ────────────────────────────────────────────────────────────────────

const CART_MODEL_NAME = "Merchant Cart";
const SHOP_CHILD_NAME = "Shop";

/** Minutes between automatic spawns (measured from the end of the previous visit). */
const SPAWN_INTERVAL_SECS = 20 * 60;

/** How long the merchant stays before departing. */
const ACTIVE_DURATION_SECS = 5 * 60;

/** Studs above ground the cart starts/ends its journey. */
const SKY_HEIGHT_OFFSET = 120;

/** Duration of the fall / ascent tween in seconds. */
const ARRIVE_TWEEN_SECS = 4;
const DEPART_TWEEN_SECS = 3.5;

/** Shop type for the traveling merchant (rare = sells everything). */
const TRAVELING_MERCHANT_SHOP_TYPE: ShopType = "rare";

// ── Runtime state ─────────────────────────────────────────────────────────────

/** The original model moved to ServerStorage on init — never modified. */
let cartTemplate: Model | undefined;
/** The live Workspace clone during an active event. */
let activeCart: Model | undefined;
/** The ground CFrame where the cart should land, captured once on init. */
let groundCFrame: CFrame | undefined;
let activeNPC: NPC | undefined;
let activeNPCName: string | undefined;
let eventActive = false;
let autoStopThread: thread | undefined;
let autoSpawnThread: thread | undefined;

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Clones the cart template into Workspace.
 * Returns the new clone, or undefined if the template was never found.
 */
function spawnCart(): Model | undefined {
	if (!cartTemplate || !groundCFrame) return undefined;
	const clone = cartTemplate.Clone();
	// Anchor all parts so PivotTo works reliably.
	for (const desc of clone.GetDescendants()) {
		if (desc.IsA("BasePart")) desc.Anchored = true;
	}
	clone.Parent = Workspace;
	return clone;
}

/**
 * Smoothly interpolate the whole model from `fromCF` to `toCF`.
 * Uses an ease-out cubic curve for a natural feel.
 */
function lerpModel(model: Model, fromCF: CFrame, toCF: CFrame, duration: number): void {
	const startTime = os.clock();
	let raw = 0;
	do {
		raw = math.min((os.clock() - startTime) / duration, 1);
		// ease-out cubic: fast start, slow finish
		const t = 1 - math.pow(1 - raw, 3);
		model.PivotTo(fromCF.Lerp(toCF, t));
		if (raw < 1) task.wait();
	} while (raw < 1);
}

/** Build a sky-height CFrame directly above the ground position. */
function buildSkyCFrame(base: CFrame): CFrame {
	return new CFrame(base.X, base.Y + SKY_HEIGHT_OFFSET, base.Z).mul(CFrame.Angles(0, base.ToEulerAnglesXYZ()[1], 0));
}

function despawnNPC(): void {
	if (!activeNPC) return;
	if (activeNPCName !== undefined) {
		unregisterMerchantShop(activeNPCName);
		log("[TRAVELING-MERCHANT] NPC '" + activeNPCName + "' despawned.");
	}
	pcall(() => {
		const model = activeNPC!.model;
		if (model && model.Parent) {
			model.Destroy();
		}
	});
	activeNPC = undefined;
	activeNPCName = undefined;
}

function spawnNPCForCart(cart: Model): void {
	// Resolve the shop sub-model which travels with the cart clone.
	const shopModel = cart.FindFirstChild(SHOP_CHILD_NAME) as Model | undefined;
	if (!shopModel) {
		log("[TRAVELING-MERCHANT] No '" + SHOP_CHILD_NAME + "' child found inside '" + CART_MODEL_NAME + "'.", "WARN");
		return;
	}

	const routeFolder = shopModel.FindFirstChild("Routes") as Folder | undefined;
	if (!routeFolder) {
		log("[TRAVELING-MERCHANT] No 'Routes' folder in Shop model.", "WARN");
		return;
	}

	const routePoints = routeFolder.GetChildren().filter((c): c is BasePart => c.IsA("BasePart"));
	if (routePoints.size() === 0) {
		log("[TRAVELING-MERCHANT] No BasePart route points found in Shop/Routes.", "WARN");
		return;
	}

	// Pick a random NPC from the pool.
	const npcName = MERCHANT_NPC_POOL[math.random(0, MERCHANT_NPC_POOL.size() - 1)];
	const def = NPC_REGISTRY[npcName];
	if (!def) {
		log("[TRAVELING-MERCHANT] NPC '" + npcName + "' not found in NPC_REGISTRY.", "WARN");
		return;
	}

	const routeConfig: RouteConfig = getConfigFromRoute(routeFolder) ?? { pace: "Stationary" };
	const npcData = { gender: def.gender, race: def.race, status: def.socialClass };
	const npc: NPC | undefined = createNPCModelAndGenerateHumanoid(npcName, npcData, routeConfig);
	if (!npc) {
		log("[TRAVELING-MERCHANT] Failed to create NPC model for '" + npcName + "'.", "ERROR");
		return;
	}

	// Place the NPC at the first route waypoint.
	npc.model.PivotTo(new CFrame(routePoints[0].Position));
	npc.model.SetAttribute("Interaction", "Shop");
	// Traveling merchants cannot be assassinated.
	npc.model.SetAttribute("Killable", false);

	assignNpcToRoute(npc, routePoints, routeConfig, setState);

	// Register with the merchant system so the dialog handler can serve the shop.
	const shopItems: ShopItem[] = SHOP_TYPE_POOLS[TRAVELING_MERCHANT_SHOP_TYPE];
	registerMerchantShop(npcName, shopItems);

	activeNPC = npc;
	activeNPCName = npcName;
	log("[TRAVELING-MERCHANT] NPC '" + npcName + "' spawned at cart.");
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Force-start the traveling merchant event.
 * Safe to call from admin commands — no-ops if already active.
 */
export function startTravelingMerchantEvent(): void {
	if (eventActive) {
		log("[TRAVELING-MERCHANT] Event already active -- ignoring start request.");
		return;
	}
	if (!cartTemplate || groundCFrame === undefined) {
		log("[TRAVELING-MERCHANT] Cart template not ready -- event cannot start.", "ERROR");
		return;
	}

	// Cancel any pending auto-spawn so we don't double-spawn.
	if (autoSpawnThread !== undefined) {
		task.cancel(autoSpawnThread);
		autoSpawnThread = undefined;
	}

	eventActive = true;

	// Set the persistent server-event banner for all clients.
	getBoardBroadcastRemote().FireAllClients("event", "Traveling Merchant is here! Visit before they depart!");

	// Arrival transient notification.
	getBoardBroadcastRemote().FireAllClients("info", "A Traveling Merchant has arrived!");

	// Clone the template, position at sky height, then tween to the ground.
	const cart = spawnCart()!;
	activeCart = cart;
	const skyCF = buildSkyCFrame(groundCFrame);
	task.spawn(() => {
		cart.PivotTo(skyCF);
		lerpModel(cart, skyCF, groundCFrame!, ARRIVE_TWEEN_SECS);

		// After landing, spawn the merchant NPC.
		spawnNPCForCart(cart);
		log("[TRAVELING-MERCHANT] Cart landed. Merchant active for " + ACTIVE_DURATION_SECS / 60 + " min.");
	});

	// Schedule automatic departure.
	autoStopThread = task.delay(ACTIVE_DURATION_SECS, () => {
		autoStopThread = undefined;
		stopTravelingMerchantEvent();
	});
}

/**
 * Force-stop the traveling merchant event.
 * Safe to call from admin commands — no-ops if not active.
 * Also schedules the next automatic spawn.
 */
export function stopTravelingMerchantEvent(): void {
	if (!eventActive) {
		log("[TRAVELING-MERCHANT] No active event -- ignoring stop request.");
		return;
	}

	// Cancel pending auto-stop (in case this was called manually).
	if (autoStopThread !== undefined) {
		task.cancel(autoStopThread);
		autoStopThread = undefined;
	}

	// Setting false here stops any legacy loops.
	eventActive = false;

	// Clear the persistent server-event banner.
	getBoardBroadcastRemote().FireAllClients("event", "");
	// Departure transient notification.
	getBoardBroadcastRemote().FireAllClients("info", "The Traveling Merchant has departed.");

	// Remove the NPC immediately before the cart lifts off.
	despawnNPC();

	const cart = activeCart;
	activeCart = undefined;
	if (cart) {
		task.spawn(() => {
			const currentCF = cart.GetPivot();
			const skyCF = buildSkyCFrame(groundCFrame!);
			lerpModel(cart, currentCF, skyCF, DEPART_TWEEN_SECS);
			log("[TRAVELING-MERCHANT] Cart ascended -- destroying.");
			cart.Destroy();
		});
	}

	// Schedule the next automatic spawn.
	scheduleNextAutoSpawn();
}

function scheduleNextAutoSpawn(): void {
	if (autoSpawnThread !== undefined) {
		task.cancel(autoSpawnThread);
	}
	autoSpawnThread = task.delay(SPAWN_INTERVAL_SECS, () => {
		autoSpawnThread = undefined;
		startTravelingMerchantEvent();
	});
	log("[TRAVELING-MERCHANT] Next automatic spawn in " + SPAWN_INTERVAL_SECS / 60 + " min.");
}

/**
 * Call once from bootstrap to start the automatic event cycle.
 *
 * On init the "Merchant Cart" model is taken from Workspace, its ground
 * CFrame recorded, then moved to ServerStorage as a template. The cart
 * will only appear in Workspace during an active event.
 */
export function initializeTravelingMerchantSystem(): void {
	const found = Workspace.FindFirstChild(CART_MODEL_NAME);
	if (!found || !found.IsA("Model")) {
		log("[TRAVELING-MERCHANT] '" + CART_MODEL_NAME + "' not found in Workspace -- system disabled.", "WARN");
		return;
	}
	const cart = found as Model;
	groundCFrame = cart.GetPivot();

	// Move to ServerStorage so it is invisible until the event starts.
	cart.Parent = ServerStorage;
	cartTemplate = cart;

	scheduleNextAutoSpawn();
	log("[TRAVELING-MERCHANT] System initialized. Cart stored until event starts.");
}
