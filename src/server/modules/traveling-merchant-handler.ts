/**
 * Traveling Merchant Handler
 *
 * A "Merchant Cart" model in Workspace spawns automatically every 20 minutes
 * and stays for 5 minutes before departing. The cart appears at one of the
 * Attachments named "MerchantSpawn" placed anywhere in Workspace (one is
 * chosen at random per visit). If no spawn attachments exist, the cart's
 * original position from init is used as a fallback.
 *
 * Any PointLight named "Mood Light" anywhere inside the cart model will be
 * tinted to the colour of the rarest item the merchant is currently selling.
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
import { MERCHANT_NPC_POOL, buildShopInventory, ShopType } from "shared/config/shop-types";
import { ShopItem } from "shared/config/npcs";
import { ITEMS, RARITY_COLORS } from "shared/inventory";
import { createNPCModelAndGenerateHumanoid, NPC, setState, assignNpcToRoute } from "shared/npc/main";
import { RouteConfig, getConfigFromRoute } from "shared/npc-manager";
import { getBoardBroadcastRemote } from "shared/remotes/board-broadcast-remote";
import { registerMerchantShop, unregisterMerchantShop } from "./merchant-handler";

// ── Config ────────────────────────────────────────────────────────────────────

const CART_MODEL_NAME = "Traveling Merchant Cart";
const SHOP_CHILD_NAME = "Shop";

/** Attachment name used to mark valid merchant spawn locations in Workspace. */
const SPAWN_ATTACHMENT_NAME = "MerchantSpawn";

/** Attachment name on the cart whose child PointLight should glow the rarest item's rarity colour. */
const MOOD_LIGHT_NAME = "Mood Light";

/** Rarity rank used to pick the "rarest" item for the mood lights. */
const RARITY_RANK: Record<string, number> = {
	common: 1,
	uncommon: 2,
	rare: 3,
	epic: 4,
	legendary: 5,
};

/** Minutes between automatic spawns (measured from the end of the previous visit). */
const SPAWN_INTERVAL_SECS = 20 * 60;

/** How long the merchant stays before departing. */
const ACTIVE_DURATION_SECS = 5 * 60;

/** Studs above the spawn point the cart starts/ends its journey. */
const SKY_HEIGHT_OFFSET = 120;

/** Duration of the fall / ascent tween in seconds. */
const ARRIVE_TWEEN_SECS = 4;
const DEPART_TWEEN_SECS = 3.5;

/**
 * Shop type for the traveling merchant.
 *
 * Uses "black_market" so each visit rolls a fresh random selection of poisons
 * and elixirs across every rarity and tier. Fits the "travelling stranger
 * with rare goods" fantasy and keeps the event feeling different every time.
 */
const TRAVELING_MERCHANT_SHOP_TYPE: ShopType = "black_market";

// ── Runtime state ─────────────────────────────────────────────────────────────

/** The cart template stored in ServerStorage — never modified. */
let cartTemplate: Model | undefined;
/** The live Workspace clone during an active event. */
let activeCart: Model | undefined;
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
	if (!cartTemplate) return undefined;
	const clone = cartTemplate.Clone();
	// Anchor all parts so PivotTo works reliably.
	for (const desc of clone.GetDescendants()) {
		if (desc.IsA("BasePart")) desc.Anchored = true;
	}
	clone.Parent = Workspace;
	return clone;
}

/**
 * Scan Workspace for Attachments named SPAWN_ATTACHMENT_NAME and pick one at
 * random. Returns undefined if no spawn attachments exist.
 */
function pickSpawnCFrame(): CFrame | undefined {
	const spots: Attachment[] = [];
	for (const desc of Workspace.GetDescendants()) {
		if (desc.IsA("Attachment") && desc.Name === SPAWN_ATTACHMENT_NAME) {
			spots.push(desc);
		}
	}
	if (spots.size() === 0) return undefined;
	return spots[math.random(0, spots.size() - 1)].WorldCFrame;
}

/** Smoothly interpolate the whole model from `fromCF` to `toCF` (ease-out cubic). */
function lerpModel(model: Model, fromCF: CFrame, toCF: CFrame, duration: number): void {
	const startTime = os.clock();
	let raw = 0;
	do {
		raw = math.min((os.clock() - startTime) / duration, 1);
		const t = 1 - math.pow(1 - raw, 3);
		model.PivotTo(fromCF.Lerp(toCF, t));
		if (raw < 1) task.wait();
	} while (raw < 1);
}

/** Build a sky-height CFrame directly above the given ground CFrame, preserving rotation. */
function buildSkyCFrame(base: CFrame): CFrame {
	return base.add(new Vector3(0, SKY_HEIGHT_OFFSET, 0));
}

/** Determine the rarest rarity present in the shop inventory. */
function getRarestRarity(shopItems: ShopItem[]): string | undefined {
	let bestRank = 0;
	let bestRarity: string | undefined;
	for (const si of shopItems) {
		const def = ITEMS[si.itemId];
		if (!def) continue;
		const rank = RARITY_RANK[def.rarity] ?? 0;
		if (rank > bestRank) {
			bestRank = rank;
			bestRarity = def.rarity;
		}
	}
	return bestRarity;
}

/** Recolour every PointLight child of an Attachment named MOOD_LIGHT_NAME in the cart. */
function applyMoodLightColor(cart: Model, rarity: string | undefined): void {
	if (rarity === undefined) return;
	const color = RARITY_COLORS[rarity];
	if (!color) return;
	for (const desc of cart.GetDescendants()) {
		if (desc.IsA("Attachment") && desc.Name === MOOD_LIGHT_NAME) {
			for (const child of desc.GetChildren()) {
				if (child.IsA("PointLight")) {
					child.Color = color;
					child.Enabled = true;
				}
			}
		}
	}
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

function spawnNPCForCart(cart: Model): ShopItem[] {
	// Resolve the shop sub-model which travels with the cart clone.
	const shopModel = cart.FindFirstChild(SHOP_CHILD_NAME) as Model | undefined;
	if (!shopModel) {
		log("[TRAVELING-MERCHANT] No '" + SHOP_CHILD_NAME + "' child found inside '" + CART_MODEL_NAME + "'.", "WARN");
		return [];
	}

	const routeFolder = shopModel.FindFirstChild("Routes") as Folder | undefined;
	if (!routeFolder) {
		log("[TRAVELING-MERCHANT] No 'Routes' folder in Shop model.", "WARN");
		return [];
	}

	const routePoints = routeFolder.GetChildren().filter((c): c is BasePart => c.IsA("BasePart"));
	if (routePoints.size() === 0) {
		log("[TRAVELING-MERCHANT] No BasePart route points found in Shop/Routes.", "WARN");
		return [];
	}

	// Pick a random NPC from the pool.
	const npcName = MERCHANT_NPC_POOL[math.random(0, MERCHANT_NPC_POOL.size() - 1)];
	const def = NPC_REGISTRY[npcName];
	if (!def) {
		log("[TRAVELING-MERCHANT] NPC '" + npcName + "' not found in NPC_REGISTRY.", "WARN");
		return [];
	}

	const routeConfig: RouteConfig = getConfigFromRoute(routeFolder) ?? { pace: "Stationary" };
	const npcData = { gender: def.gender, race: def.race, status: def.socialClass };
	const npc: NPC | undefined = createNPCModelAndGenerateHumanoid(npcName, npcData, routeConfig);
	if (!npc) {
		log("[TRAVELING-MERCHANT] Failed to create NPC model for '" + npcName + "'.", "ERROR");
		return [];
	}

	// Place the NPC at the first route waypoint.
	npc.model.PivotTo(new CFrame(routePoints[0].Position));
	npc.model.SetAttribute("Interaction", "Shop");
	// Traveling merchants cannot be assassinated.
	npc.model.SetAttribute("Killable", false);

	assignNpcToRoute(npc, routePoints, routeConfig, setState);

	// Register with the merchant system so the dialog handler can serve the shop.
	const shopItems: ShopItem[] = buildShopInventory(TRAVELING_MERCHANT_SHOP_TYPE);
	// TEMP TEST: guarantee at least one wallhack elixir from each guild so the
	// new Shadowsight / Dawnsight elixirs can be exercised in playtest.
	const hasShadow = shopItems.some((si) => si.itemId === "shadowsight_elixir");
	const hasDawn = shopItems.some((si) => si.itemId === "dawnsight_elixir");
	if (!hasShadow) shopItems.push({ itemId: "shadowsight_elixir", price: 1600 });
	if (!hasDawn) shopItems.push({ itemId: "dawnsight_elixir", price: 1600 });
	registerMerchantShop(npcName, shopItems);

	activeNPC = npc;
	activeNPCName = npcName;
	log("[TRAVELING-MERCHANT] NPC '" + npcName + "' spawned at cart.");
	return shopItems;
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
	if (!cartTemplate) {
		log("[TRAVELING-MERCHANT] Cart template not ready -- event cannot start.", "ERROR");
		return;
	}

	const spawnCF = pickSpawnCFrame();
	if (spawnCF === undefined) {
		log("[TRAVELING-MERCHANT] No spawn location available -- event cannot start.", "ERROR");
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

	// Clone the template and start it in the sky above the chosen attachment.
	const cart = spawnCart()!;
	activeCart = cart;
	const skyCF = buildSkyCFrame(spawnCF);
	cart.PivotTo(skyCF);

	task.spawn(() => {
		lerpModel(cart, skyCF, spawnCF, ARRIVE_TWEEN_SECS);

		// After landing, spawn the merchant NPC and colour the mood lights.
		const shopItems = spawnNPCForCart(cart);
		applyMoodLightColor(cart, getRarestRarity(shopItems));
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
			const skyCF = buildSkyCFrame(currentCF);
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
 * The "Traveling Merchant Cart" model is read from ServerStorage and kept as
 * a template. It is cloned into Workspace at one of the "MerchantSpawn"
 * Attachments only during an active event.
 */
export function initializeTravelingMerchantSystem(): void {
	const found = ServerStorage.FindFirstChild(CART_MODEL_NAME);
	if (!found || !found.IsA("Model")) {
		log("[TRAVELING-MERCHANT] '" + CART_MODEL_NAME + "' not found in ServerStorage -- system disabled.", "WARN");
		return;
	}
	cartTemplate = found as Model;

	scheduleNextAutoSpawn();
	log("[TRAVELING-MERCHANT] System initialized. Cart stored until event starts.");
}
