/**
 * Merchant Handler — server module.
 *
 * Operates on ShopSite_* models tagged "MerchantShop" in CollectionService.
 * Each ShopSite_* must contain:
 *   Routes — a Folder named "Routes" whose BasePart children are the NPC's route
 *             points. A Configuration child on Route controls Pace/NPCType/Tempo
 *             exactly like any other route in the game. No CollectionService tag
 *             required on the Route folder itself.
 *   Sign   — a BasePart tagged "Sign" in CollectionService (anywhere under the
 *             ShopSite_* model). The SurfaceGui is written here at runtime.
 *
 * On server start this module:
 *   1. Collects all ShopSite_* models tagged "MerchantShop".
 *   2. Assigns a shop type (guaranteed: weapon, elixir, poison; extras random).
 *   3. Picks an NPC name from MERCHANT_NPC_POOL for each site.
 *   4. Spawns the NPC using the site's own Route (config + points).
 *   5. Writes a SurfaceGui onto the site's Sign BasePart.
 *
 * Exports:
 *   getMerchantShop(npcName)       — shop items for a dynamically-assigned merchant.
 *   getReservedMerchantNames()     — Set of NPC names reserved for merchant slots.
 *   initializeMerchantSystem()     — call once from bootstrap BEFORE setServerStatus.
 */

import { CollectionService, ReplicatedStorage, Workspace } from "@rbxts/services";
import { log } from "shared/helpers";
import { NPC_REGISTRY } from "shared/config/npcs";
import {
	ShopType,
	REQUIRED_SHOP_TYPES,
	MERCHANT_NPC_POOL,
	buildShopInventory,
	isExplicitOnlyShopType,
} from "shared/config/shop-types";
import { ShopItem } from "shared/config/npcs";
import { getOfferSlotsForShopType, getPremiumOffer } from "shared/config/premium-offers";
import { SHOP_TYPE_MARKERS, SIGN_COLORS, SignColorScheme, generateShopName } from "shared/config/shop-signs";
import { createNPCModelAndGenerateHumanoid, NPC, setState, assignNpcToRoute } from "shared/npc/main";
import { RouteConfig, getConfigFromRoute } from "shared/npc-manager";

// ── Runtime state ─────────────────────────────────────────────────────────────

/** npcName -> items this merchant sells. */
const merchantShops = new Map<string, ShopItem[]>();

/** Names already claimed by the merchant system (skip in route spawning). */
const reservedNames = new Set<string>();

/** Names pinned to a specific ShopSite via NPCName attribute. Populated
 *  synchronously at init so npc-spawner skips their fixed routes before the
 *  full merchant placement (which is deferred) runs. */
const pinnedNames = new Set<string>();

// ── Fallback route config (used when a Route folder has no Configuration child) ──

const FALLBACK_ROUTE_CONFIG: RouteConfig = {
	pace: "Stationary",
};

// ── Sign rendering ────────────────────────────────────────────────────────────

/**
 * Create or update the SurfaceGui on a MerchantShopSign-tagged BasePart.
 * The sign displays a static type marker (top) and a generated shop name (bottom).
 * Idempotent: calling again on the same part only updates the text labels.
 */
function buildSignContents(
	gui: SurfaceGui,
	colors: SignColorScheme,
	marker: string,
	shopName: string,
	rotation: number,
): void {
	// Canvas is portrait (186 wide × 294 tall px at 50pps).
	// Rotator swaps dimensions so content fills the physically landscape sign.
	const rotator = new Instance("Frame");
	rotator.Name = "Rotator";
	rotator.BackgroundTransparency = 1;
	rotator.AnchorPoint = new Vector2(0.5, 0.5);
	rotator.Position = new UDim2(0.5, 0, 0.5, 0);
	rotator.Size = new UDim2(0, 294, 0, 186);
	rotator.Rotation = rotation;
	rotator.ClipsDescendants = false;
	rotator.Parent = gui;

	// ── Outer border frame (simulates thick wooden edge, no glow) ───────────
	const border = new Instance("Frame");
	border.Name = "Border";
	border.Size = new UDim2(1, 0, 1, 0);
	border.BackgroundColor3 = colors.border;
	border.BackgroundTransparency = 0;
	border.BorderSizePixel = 0;
	border.Parent = rotator;

	// ── Inner background (dark wood, inset 5px) ──────────────────────────────
	const bg = new Instance("Frame");
	bg.Name = "Background";
	bg.Size = new UDim2(1, -10, 1, -10);
	bg.Position = new UDim2(0, 5, 0, 5);
	bg.BackgroundColor3 = colors.background;
	bg.BackgroundTransparency = 0;
	bg.BorderSizePixel = 0;
	bg.Parent = rotator;

	// ── Wood grain: two subtle horizontal strips for color variation ─────────
	const grainTop = new Instance("Frame");
	grainTop.Size = new UDim2(1, 0, 0.15, 0);
	grainTop.Position = new UDim2(0, 0, 0.08, 0);
	grainTop.BackgroundColor3 = Color3.fromRGB(255, 255, 255);
	grainTop.BackgroundTransparency = 0.92;
	grainTop.BorderSizePixel = 0;
	grainTop.ZIndex = bg.ZIndex;
	grainTop.Parent = bg;

	const grainMid = new Instance("Frame");
	grainMid.Size = new UDim2(1, 0, 0.12, 0);
	grainMid.Position = new UDim2(0, 0, 0.55, 0);
	grainMid.BackgroundColor3 = Color3.fromRGB(255, 255, 255);
	grainMid.BackgroundTransparency = 0.94;
	grainMid.BorderSizePixel = 0;
	grainMid.ZIndex = bg.ZIndex;
	grainMid.Parent = bg;

	// ── Tier 1: main shop name — large, top area ────────────────────────────
	const nameLabel = new Instance("TextLabel");
	nameLabel.Name = "NameLabel";
	nameLabel.Size = new UDim2(1, -8, 0.6, 0);
	nameLabel.Position = new UDim2(0, 4, 0.02, 0);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.TextColor3 = colors.name;
	nameLabel.Font = Enum.Font.GothamBold;
	nameLabel.TextScaled = false;
	nameLabel.TextSize = 52;
	nameLabel.TextWrapped = true;
	nameLabel.ClipsDescendants = false;
	nameLabel.TextStrokeTransparency = 0.75;
	nameLabel.Text = shopName.upper();
	nameLabel.TextXAlignment = Enum.TextXAlignment.Center;
	nameLabel.ZIndex = 3;
	nameLabel.Parent = bg;

	// ── Tier 2: shop type — smaller, bottom area ────────────────────────────
	const markerLabel = new Instance("TextLabel");
	markerLabel.Name = "MarkerLabel";
	markerLabel.Size = new UDim2(1, -8, 0.3, 0);
	markerLabel.Position = new UDim2(0, 4, 0.65, 0);
	markerLabel.BackgroundTransparency = 1;
	markerLabel.TextColor3 = colors.marker;
	markerLabel.Font = Enum.Font.SourceSansBold;
	markerLabel.TextScaled = false;
	markerLabel.TextSize = 36;
	markerLabel.TextWrapped = false;
	markerLabel.ClipsDescendants = false;
	markerLabel.TextStrokeColor3 = Color3.fromRGB(0, 0, 0);
	markerLabel.TextStrokeTransparency = 0.82;
	markerLabel.Text = marker;
	markerLabel.TextXAlignment = Enum.TextXAlignment.Center;
	markerLabel.ZIndex = 3;
	markerLabel.Parent = bg;
}

function applySignText(signPart: BasePart, shopType: ShopType, npcName: string): void {
	const colors = SIGN_COLORS[shopType];
	const marker = SHOP_TYPE_MARKERS[shopType];
	const shopName = generateShopName(npcName, shopType);

	// Remove any stale guis
	for (const child of signPart.GetChildren()) {
		if (child.Name === "ShopSignGui" || child.Name === "ShopSignGuiBack") child.Destroy();
	}

	// Front face
	const front = new Instance("SurfaceGui");
	front.Name = "ShopSignGui";
	front.Face = Enum.NormalId.Right;
	front.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
	front.PixelsPerStud = 50;
	front.AlwaysOnTop = false;
	front.LightInfluence = 1;
	buildSignContents(front, colors, marker, shopName, 90);
	front.Parent = signPart;

	// Back face — Left face Y axis is flipped so use -90
	const back = new Instance("SurfaceGui");
	back.Name = "ShopSignGuiBack";
	back.Face = Enum.NormalId.Left;
	back.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
	back.PixelsPerStud = 50;
	back.AlwaysOnTop = false;
	back.LightInfluence = 1;
	buildSignContents(back, colors, marker, shopName, -90);
	back.Parent = signPart;

	log("[MERCHANT] Sign: [" + shopType + "] " + shopName + " on " + signPart.Name);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Find all BaseParts tagged "Sign" that belong to this ShopSite.
 * Searches CollectionService tags, exact name matches, Sign models,
 * and case-insensitive fallbacks. Returns all unique matches.
 */
function resolveSignParts(shopSite: Model): BasePart[] {
	const found = new Set<BasePart>();

	// 1. CollectionService "Sign" tag on descendant BaseParts
	for (const inst of CollectionService.GetTagged("Sign")) {
		if (inst.IsA("BasePart") && inst.IsDescendantOf(shopSite)) {
			found.add(inst);
		}
	}

	// 2. Exact name match "Sign" anywhere in the hierarchy
	for (const inst of shopSite.GetDescendants()) {
		if (inst.Name === "Sign" && inst.IsA("BasePart")) {
			found.add(inst);
		}
	}

	// 3. Any descendant named "Sign" that is a Model -> use PrimaryPart or first BasePart
	for (const inst of shopSite.GetDescendants()) {
		if (inst.Name === "Sign" && inst.IsA("Model")) {
			const m = inst as Model;
			const part = m.PrimaryPart ?? (m.FindFirstChildWhichIsA("BasePart") as BasePart | undefined);
			if (part) found.add(part);
		}
	}

	// 4. Any BasePart whose name contains "sign" (case-insensitive fallback)
	for (const inst of shopSite.GetDescendants()) {
		if (inst.IsA("BasePart") && inst.Name.lower().find("sign", 1, true)[0] !== undefined) {
			found.add(inst);
		}
	}

	const results: BasePart[] = [];
	found.forEach((part) => results.push(part));
	return results;
}

// ── Offer Slot Spawning ───────────────────────────────────────────────────────

/**
 * Find OfferSlot attachments/parts in a ShopSite and spawn a floating display
 * model for each, stamped with the matching `offerId` attribute.
 * The client picks these up via the existing premium-offer proximity system.
 */
function spawnOfferSlots(shopSite: Model, shopType: ShopType): void {
	const offerIds = getOfferSlotsForShopType(shopType);
	if (offerIds.size() === 0) return;

	// Collect slot positions: Models, BaseParts, or Attachments whose name
	// starts with "offerslot" (case-insensitive). This accepts "OfferSlot",
	// "OfferSlot1", "OfferSlot_Main", an OfferSlot Model wrapper, etc.
	const slots: { position: Vector3 }[] = [];

	for (const desc of shopSite.GetDescendants()) {
		const nameLower = (desc.Name as string).lower();
		if (!nameLower.sub(1, 9).match("offerslot")[0]) continue;
		if (desc.IsA("Model")) {
			// Use the model's pivot for placement. Skip any inner Attachment so
			// we don't double-count the same slot.
			slots.push({ position: desc.GetPivot().Position });
		} else if (desc.IsA("Attachment")) {
			// Only count attachments inside a BasePart -- if they're inside an
			// OfferSlot Model we already counted that model above.
			if (
				desc.Parent?.IsA("BasePart") &&
				!desc.FindFirstAncestorOfClass("Model")?.Name.lower().sub(1, 9).match("offerslot")[0]
			) {
				slots.push({ position: desc.WorldPosition });
			}
		} else if (desc.IsA("BasePart")) {
			slots.push({ position: desc.Position });
		}
	}

	if (slots.size() === 0) {
		log("[MERCHANT] No OfferSlot attachments in " + shopSite.Name + " for " + shopType);
		// Dump what we DID see so the level designer can fix the names.
		// Includes Models so empty OfferSlot Model wrappers are visible too.
		const seen: string[] = [];
		for (const desc of shopSite.GetDescendants()) {
			if (desc.IsA("Attachment") || desc.IsA("BasePart") || desc.IsA("Model")) {
				seen.push(desc.ClassName + ":" + desc.GetFullName());
			}
		}
		log("[MERCHANT] " + shopSite.Name + " contains " + seen.size() + " parts/attachments/models");
		for (const name of seen) log("  - " + name);
		return;
	}

	// Fill slots with offer IDs (1-to-1; extra slots stay empty)
	const count = math.min(slots.size(), offerIds.size());
	for (let i = 0; i < count; i++) {
		const offerId = offerIds[i];
		const offer = getPremiumOffer(offerId);
		if (!offer) {
			log("[MERCHANT] Unknown offerId '" + offerId + "' in SHOP_OFFER_SLOTS." + shopType, "WARN");
			continue;
		}

		const slot = slots[i];

		// Create the offer model the client will detect via `offerId` attribute
		const model = new Instance("Model");
		model.Name = "OfferSlot_" + offerId;

		// Resolve the 3D display source. Order:
		//   1) ReplicatedStorage.DisplayModels.<name>  (legacy display models)
		//   2) ReplicatedStorage.<name>                (Accessory or Model at root)
		// Accessories are cloned and the Handle is extracted as the display.
		const displayFolder = ReplicatedStorage.FindFirstChild("DisplayModels") as Folder | undefined;
		let displayClone: Model | undefined;
		if (offer.displayModelName !== undefined) {
			let source: Instance | undefined =
				displayFolder?.FindFirstChild(offer.displayModelName) ??
				ReplicatedStorage.FindFirstChild(offer.displayModelName);

			if (source && source.IsA("Accessory")) {
				const handle = source.FindFirstChild("Handle") as BasePart | undefined;
				if (handle) {
					const wrapper = new Instance("Model");
					const handleClone = handle.Clone();
					handleClone.Parent = wrapper;
					wrapper.PrimaryPart = handleClone;
					displayClone = wrapper;
				} else {
					log("[MERCHANT] Accessory '" + offer.displayModelName + "' has no Handle", "WARN");
					source = undefined;
				}
			} else if (source && source.IsA("Model")) {
				displayClone = source.Clone();
			}

			if (displayClone) {
				displayClone.Parent = model;
				// Strip anything that would make this look or act like an NPC.
				// Display models must be inert visuals only.
				for (const inst of displayClone.GetDescendants()) {
					if (
						inst.IsA("Humanoid") ||
						inst.IsA("Script") ||
						inst.IsA("LocalScript") ||
						inst.IsA("ModuleScript") ||
						inst.IsA("Tool") ||
						inst.IsA("ProximityPrompt") ||
						inst.IsA("ClickDetector")
					) {
						inst.Destroy();
					}
				}
				for (const part of displayClone.GetDescendants()) {
					if (part.IsA("BasePart")) {
						part.Anchored = true;
						part.CanCollide = false;
					}
				}
			} else if (!source) {
				log(
					"[MERCHANT] Display source '" +
						offer.displayModelName +
						"' not found in ReplicatedStorage.DisplayModels or root",
					"WARN",
				);
			}
		}

		// Invisible anchor that defines the slot position
		const anchor = new Instance("Part");
		anchor.Name = "Anchor";
		anchor.Size = new Vector3(1, 1, 1);
		anchor.Anchored = true;
		anchor.CanCollide = false;
		anchor.Transparency = 1;
		anchor.Position = slot.position;
		anchor.Parent = model;

		model.PrimaryPart = anchor;

		// Position the display clone at the slot: translate every BasePart so
		// the model's bounding-box center lands exactly at slot.position. This
		// ignores any (possibly wrong) authored WorldPivot/PrimaryPart on the
		// source model.
		if (displayClone) {
			const parts: BasePart[] = [];
			for (const desc of displayClone.GetDescendants()) {
				if (desc.IsA("BasePart")) parts.push(desc);
			}
			if (parts.size() > 0) {
				let minX = math.huge,
					minY = math.huge,
					minZ = math.huge;
				let maxX = -math.huge,
					maxY = -math.huge,
					maxZ = -math.huge;
				for (const p of parts) {
					const c = p.Position;
					if (c.X < minX) minX = c.X;
					if (c.Y < minY) minY = c.Y;
					if (c.Z < minZ) minZ = c.Z;
					if (c.X > maxX) maxX = c.X;
					if (c.Y > maxY) maxY = c.Y;
					if (c.Z > maxZ) maxZ = c.Z;
				}
				const center = new Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
				const offset = slot.position.sub(center);
				for (const p of parts) {
					p.CFrame = p.CFrame.add(offset);
				}
			}
		}

		model.SetAttribute("offerId", offerId);
		model.Parent = Workspace;

		log(
			"[MERCHANT] Spawned offer slot '" +
				offerId +
				"' (" +
				offer.title +
				")" +
				(displayClone ? " with display model" : " no display model") +
				" at " +
				shopSite.Name +
				" pos=" +
				tostring(math.floor(slot.position.X)) +
				"," +
				tostring(math.floor(slot.position.Y)) +
				"," +
				tostring(math.floor(slot.position.Z)),
		);
	}
}

function spawnMerchant(npcName: string, shopSite: Model, shopItems: ShopItem[], shopType: ShopType): void {
	const def = NPC_REGISTRY[npcName];
	if (!def) {
		log("[MERCHANT] NPC not found in registry: " + npcName, "ERROR");
		return;
	}

	// ── Resolve the site's Route folder and its points ────────────────────
	const routeFolder = shopSite.FindFirstChild("Routes") as Folder | undefined;
	if (!routeFolder) {
		log("[MERCHANT] ShopSite " + shopSite.Name + " has no Routes folder -- skipped.", "ERROR");
		return;
	}
	const routePoints = routeFolder.GetChildren().filter((c): c is BasePart => c.IsA("BasePart"));
	if (routePoints.size() === 0) {
		log("[MERCHANT] ShopSite " + shopSite.Name + " Route has no BasePart points -- skipped.", "ERROR");
		return;
	}

	const routeConfig: RouteConfig = getConfigFromRoute(routeFolder) ?? FALLBACK_ROUTE_CONFIG;

	const npcData = { gender: def.gender, race: def.race, status: def.socialClass };
	const npc: NPC | undefined = createNPCModelAndGenerateHumanoid(npcName, npcData, routeConfig);
	if (!npc) {
		log("[MERCHANT] Failed to create model for " + npcName, "ERROR");
		return;
	}

	// Place NPC at the first route point
	npc.model.PivotTo(new CFrame(routePoints[0].Position));

	// Tag model so the client can detect this is a shop NPC
	npc.model.SetAttribute("Interaction", "Shop");

	// Assign to the site's route
	assignNpcToRoute(npc, routePoints, routeConfig, setState);

	// Record shop items
	merchantShops.set(npcName, shopItems);
	reservedNames.add(npcName);

	// Apply sign from the same ShopSite
	// Apply sign to all sign parts in the ShopSite
	const signParts = resolveSignParts(shopSite);
	for (const signPart of signParts) {
		applySignText(signPart, shopType, npcName);
	}

	// Spawn premium offer display items at OfferSlot attachments
	spawnOfferSlots(shopSite, shopType);

	log("[MERCHANT] " + npcName + " placed as merchant at " + shopSite.Name);

	// Respawn on death — sign re-applied with same shop type and new merchant name
	npc.model.AncestryChanged.Connect((_, parent) => {
		if (!parent) {
			log("[MERCHANT] " + npcName + " (merchant) died -- respawn in 30s");
			merchantShops.delete(npcName);
			task.delay(30, () => {
				// Re-roll inventory each respawn so black-market merchants get a
				// fresh random selection. Static shop types return their stable pool.
				const nextItems = buildShopInventory(shopType);
				spawnMerchant(npcName, shopSite, nextItems.size() > 0 ? nextItems : shopItems, shopType);
			});
		}
	});
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns the shop items for a dynamically-assigned merchant, or undefined. */
export function getMerchantShop(npcName: string): ShopItem[] | undefined {
	return merchantShops.get(npcName);
}

/** Register an NPC name + item list with the merchant shop system. */
export function registerMerchantShop(npcName: string, items: ShopItem[]): void {
	merchantShops.set(npcName, items);
	reservedNames.add(npcName);
}

/** Unregister an NPC name from the merchant shop system. */
export function unregisterMerchantShop(npcName: string): void {
	merchantShops.delete(npcName);
	reservedNames.delete(npcName);
}

/** Names reserved by the merchant system — do NOT also assign to normal routes. */
export function getReservedMerchantNames(): Set<string> {
	const combined = new Set<string>();
	for (const n of reservedNames) combined.add(n);
	for (const n of pinnedNames) combined.add(n);
	return combined;
}

function runMerchantInit(): void {
	// Collect shop sites: tagged "MerchantShop" + any Model named "Shop"
	const tagged = CollectionService.GetTagged("MerchantShop").filter((inst): inst is Model => inst.IsA("Model"));

	const byName: Model[] = [];
	for (const inst of game.GetService("Workspace").GetDescendants()) {
		if (inst.IsA("Model") && inst.Name === "Shop") {
			byName.push(inst);
		}
	}

	// Merge both lists, deduplicating
	const seen = new Set<Model>();
	const shopSites: Model[] = [];
	for (const m of [...tagged, ...byName]) {
		if (!seen.has(m)) {
			seen.add(m);
			shopSites.push(m);
		}
	}

	if (shopSites.size() === 0) {
		log("[MERCHANT] No ShopSite models found (checked tag + name) -- no merchants spawned.");
		return;
	}

	log(
		"[MERCHANT] Found " +
			shopSites.size() +
			" shop site(s) (" +
			tagged.size() +
			" tagged, " +
			byName.size() +
			" by name).",
	);

	// ── Pinned sites (NPCName attribute) ─────────────────────────────────────
	// Any ShopSite with an "NPCName" attribute is locked to that specific NPC
	// (and optionally a specific ShopType via the existing attribute). Handle
	// these first so their NPC is reserved before random pool allocation runs.
	const pinnedSites: Model[] = [];
	const unpinnedSites: Model[] = [];
	for (const site of shopSites) {
		const pinnedName = site.GetAttribute("NPCName") as string | undefined;
		if (pinnedName !== undefined && pinnedName !== "") pinnedSites.push(site);
		else unpinnedSites.push(site);
	}

	for (const site of pinnedSites) {
		const npcName = site.GetAttribute("NPCName") as string;
		if (!NPC_REGISTRY[npcName]) {
			log("[MERCHANT] Pinned NPCName '" + npcName + "' on " + site.Name + " not in registry.", "WARN");
			continue;
		}
		if (reservedNames.has(npcName)) {
			log("[MERCHANT] Pinned NPC '" + npcName + "' already reserved -- skipping " + site.Name + ".", "WARN");
			continue;
		}

		const attrType = site.GetAttribute("ShopType") as string | undefined;
		const npcDef = NPC_REGISTRY[npcName];

		// NPC-level shop overrides the ShopType pool. Use "rare" as the recorded
		// type so the sign still renders a sensible marker.
		let pinnedType: ShopType;
		let pinnedItems: ShopItem[];
		if (npcDef.shop !== undefined && npcDef.shop.shopItems.size() > 0) {
			pinnedType = (attrType as ShopType) ?? "rare";
			pinnedItems = npcDef.shop.shopItems;
			log(
				"[MERCHANT] Pinned site " +
					site.Name +
					" -> " +
					npcName +
					" (NPC-defined inventory, sign type '" +
					pinnedType +
					"')",
			);
		} else {
			pinnedType = (attrType as ShopType) ?? "rare";
			pinnedItems = buildShopInventory(pinnedType);
			if (!pinnedItems || pinnedItems.size() === 0) {
				log("[MERCHANT] Pinned site " + site.Name + " has empty ShopType '" + pinnedType + "'.", "WARN");
				continue;
			}
			log("[MERCHANT] Pinned site " + site.Name + " -> " + npcName + " (type '" + pinnedType + "')");
		}

		spawnMerchant(npcName, site, pinnedItems, pinnedType);
	}

	// ── Assign shop types ────────────────────────────────────────────────────
	// Shuffle sites so type assignments are random each session
	const shuffled = [...unpinnedSites];
	for (let i = shuffled.size() - 1; i > 0; i--) {
		const j = math.random(0, i);
		const tmp = shuffled[i];
		shuffled[i] = shuffled[j];
		shuffled[j] = tmp;
	}

	// Build the type-assignment list: required types first, then random extras.
	// Explicit-only shop types (e.g. black_market) are excluded here — they must
	// be placed via a ShopType attribute on the world model.
	const typeAssignments: ShopType[] = [...REQUIRED_SHOP_TYPES];
	const allTypes: ShopType[] = (
		["weapon", "elixir", "poison", "rare", "tavern", "black_market"] as ShopType[]
	).filter((t) => isExplicitOnlyShopType(t) === false);
	for (let i = typeAssignments.size(); i < shuffled.size(); i++) {
		typeAssignments.push(allTypes[math.random(0, allTypes.size() - 1)]);
	}

	// ── Build available NPC pool (skip any already reserved) ────────────────
	const availablePool = MERCHANT_NPC_POOL.filter((name) => !reservedNames.has(name));

	// ── Assign NPC + shop type to each ShopSite ───────────────────────────────
	let poolIndex = 0;
	for (let i = 0; i < shuffled.size(); i++) {
		const shopSite = shuffled[i];
		const shopType = typeAssignments[i] as ShopType;

		if (poolIndex >= availablePool.size()) {
			log("[MERCHANT] Ran out of NPC pool entries -- " + (shuffled.size() - i) + " shop(s) left unassigned.");
			break;
		}

		const npcName = availablePool[poolIndex];
		poolIndex++;

		// ShopType attribute on the ShopSite model overrides the auto-assigned type.
		// Explicit-only types (e.g. black_market) MUST come from the attribute —
		// if one somehow ended up in auto-assignment, fall back to a safe default.
		const attrType = shopSite.GetAttribute("ShopType") as string | undefined;
		let resolvedType: ShopType = (attrType as ShopType) ?? shopType;
		if (attrType === undefined && isExplicitOnlyShopType(resolvedType)) {
			log(
				"[MERCHANT] Refused to auto-assign explicit-only ShopType '" +
					resolvedType +
					"' to site " +
					shopSite.Name +
					" -- falling back to 'rare'.",
				"WARN",
			);
			resolvedType = "rare";
		}

		log(
			"[MERCHANT] Site " +
				shopSite.Name +
				" -> type '" +
				resolvedType +
				"'" +
				(attrType !== undefined ? " (from attribute)" : " (auto-assigned)"),
		);

		const shopItems = buildShopInventory(resolvedType);
		if (!shopItems || shopItems.size() === 0) {
			log("[MERCHANT] Empty/unknown ShopType '" + resolvedType + "' on site " + shopSite.Name, "WARN");
			poolIndex--;
			continue;
		}

		spawnMerchant(npcName, shopSite, shopItems, resolvedType);
	}

	log("[MERCHANT] Initialized " + merchantShops.size() + " merchants across " + shopSites.size() + " shop site(s).");
}

/**
 * Synchronously scan ShopSites for an "NPCName" attribute and reserve those
 * names so the NPC spawner skips them (including their fixedRouteId routes).
 * Must run before initializeNpcSpawner so pinned NPCs don't double-spawn.
 */
function reservePinnedMerchantNames(): void {
	const tagged = CollectionService.GetTagged("MerchantShop").filter((inst): inst is Model => inst.IsA("Model"));
	const byName: Model[] = [];
	for (const inst of Workspace.GetDescendants()) {
		if (inst.IsA("Model") && inst.Name === "Shop") byName.push(inst);
	}
	const seen = new Set<Model>();
	for (const m of [...tagged, ...byName]) {
		if (seen.has(m)) continue;
		seen.add(m);
		const pinnedName = m.GetAttribute("NPCName") as string | undefined;
		if (pinnedName !== undefined && pinnedName !== "") {
			pinnedNames.add(pinnedName);
			log("[MERCHANT] Reserved pinned NPC '" + pinnedName + "' for site " + m.Name);
		}
	}
}

export function initializeMerchantSystem(): void {
	// Reserve pinned NPC names immediately so npc-spawner won't also spawn them
	// at their fixedRouteId routes.
	reservePinnedMerchantNames();
	// Defer full merchant placement 3s so CollectionService tags are fully registered
	task.delay(3, () => runMerchantInit());
}
