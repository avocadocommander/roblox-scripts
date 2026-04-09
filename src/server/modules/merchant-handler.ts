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

import { CollectionService } from "@rbxts/services";
import { log } from "shared/helpers";
import { NPC_REGISTRY } from "shared/config/npcs";
import { ShopType, SHOP_TYPE_POOLS, REQUIRED_SHOP_TYPES, MERCHANT_NPC_POOL } from "shared/config/shop-types";
import { ShopItem } from "shared/config/npcs";
import { SHOP_TYPE_MARKERS, SIGN_COLORS, SignColorScheme, generateShopName } from "shared/config/shop-signs";
import { createNPCModelAndGenerateHumanoid, NPC, setState, assignNpcToRoute } from "shared/npc/main";
import { RouteConfig, getConfigFromRoute, setupWatcherGaze } from "shared/npc-manager";

// ── Runtime state ─────────────────────────────────────────────────────────────

/** npcName -> items this merchant sells. */
const merchantShops = new Map<string, ShopItem[]>();

/** Names already claimed by the merchant system (skip in route spawning). */
const reservedNames = new Set<string>();

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

	// ── Tier 1: type marker with icon — large, pushed up ────────────────────
	const markerLabel = new Instance("TextLabel");
	markerLabel.Name = "MarkerLabel";
	markerLabel.Size = new UDim2(1, -8, 0.38, 0);
	markerLabel.Position = new UDim2(0, 4, 0.03, 0);
	markerLabel.BackgroundTransparency = 1;
	markerLabel.TextColor3 = colors.marker;
	markerLabel.Font = Enum.Font.GothamBold;
	markerLabel.TextScaled = false;
	markerLabel.TextSize = 56;
	markerLabel.TextWrapped = false;
	markerLabel.ClipsDescendants = false;
	markerLabel.TextStrokeColor3 = Color3.fromRGB(0, 0, 0);
	markerLabel.TextStrokeTransparency = 0.82;
	markerLabel.Text = marker;
	markerLabel.TextXAlignment = Enum.TextXAlignment.Center;
	markerLabel.ZIndex = 3;
	markerLabel.Parent = bg;

	// ── Tier 2: main shop name — tight under marker, wraps ──────────────────
	const nameLabel = new Instance("TextLabel");
	nameLabel.Name = "NameLabel";
	nameLabel.Size = new UDim2(1, -8, 0.58, 0);
	nameLabel.Position = new UDim2(0, 4, 0.4, 0);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.TextColor3 = colors.name;
	nameLabel.Font = Enum.Font.SourceSansBold;
	nameLabel.TextScaled = false;
	nameLabel.TextSize = 42;
	nameLabel.TextWrapped = true;
	nameLabel.ClipsDescendants = false;
	nameLabel.TextStrokeTransparency = 0.75;
	nameLabel.Text = shopName.upper();
	nameLabel.TextXAlignment = Enum.TextXAlignment.Center;
	nameLabel.ZIndex = 3;
	nameLabel.Parent = bg;
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
 * Find the BasePart tagged "Sign" that belongs to this ShopSite.
 * Searches all CollectionService-tagged "Sign" instances and returns the first
 * one that is a descendant of the given shopSite model.
 */
function resolveSignPart(shopSite: Model): BasePart | undefined {
	// 1. Prefer CollectionService "Sign" tag on a descendant
	const tagged = CollectionService.GetTagged("Sign").filter(
		(inst): inst is BasePart => inst.IsA("BasePart") && inst.IsDescendantOf(shopSite),
	);
	if (tagged.size() > 0) return tagged[0];

	// 2. Exact name match "Sign" anywhere in the hierarchy (any Instance type)
	for (const inst of shopSite.GetDescendants()) {
		if (inst.Name === "Sign" && inst.IsA("BasePart")) {
			return inst;
		}
	}

	// 3. Any descendant named "Sign" that is a Model — use its PrimaryPart or first BasePart
	for (const inst of shopSite.GetDescendants()) {
		if (inst.Name === "Sign" && inst.IsA("Model")) {
			const m = inst as Model;
			const part = m.PrimaryPart ?? (m.FindFirstChildWhichIsA("BasePart") as BasePart | undefined);
			if (part) return part;
		}
	}

	// 4. Any BasePart whose name contains "sign" (case-insensitive fallback)
	for (const inst of shopSite.GetDescendants()) {
		if (inst.IsA("BasePart") && inst.Name.lower().find("sign", 1, true)[0] !== undefined) {
			return inst;
		}
	}

	return undefined;
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
	setupWatcherGaze(npc, routeConfig);

	// Record shop items
	merchantShops.set(npcName, shopItems);
	reservedNames.add(npcName);

	// Apply sign from the same ShopSite
	const signPart = resolveSignPart(shopSite);
	if (signPart) {
		applySignText(signPart, shopType, npcName);
	}

	log("[MERCHANT] " + npcName + " placed as merchant at " + shopSite.Name);

	// Respawn on death — sign re-applied with same shop type and new merchant name
	npc.model.AncestryChanged.Connect((_, parent) => {
		if (!parent) {
			log("[MERCHANT] " + npcName + " (merchant) died -- respawn in 30s");
			merchantShops.delete(npcName);
			task.delay(30, () => {
				spawnMerchant(npcName, shopSite, shopItems, shopType);
			});
		}
	});
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns the shop items for a dynamically-assigned merchant, or undefined. */
export function getMerchantShop(npcName: string): ShopItem[] | undefined {
	return merchantShops.get(npcName);
}

/** Names reserved by the merchant system — do NOT also assign to normal routes. */
export function getReservedMerchantNames(): Set<string> {
	return reservedNames;
}

function runMerchantInit(): void {
	// Collect ShopSite_* models — prefer CollectionService tag, fall back to name prefix
	const tagged = CollectionService.GetTagged("MerchantShop").filter((inst): inst is Model => inst.IsA("Model"));

	const byName: Model[] = [];
	for (const inst of game.GetService("Workspace").GetDescendants()) {
		if (inst.IsA("Model") && inst.Name === "Shop") {
			byName.push(inst);
		}
	}

	// Merge: use tagged list if non-empty, otherwise fall back to name scan
	const shopSites = tagged.size() > 0 ? tagged : byName;

	if (shopSites.size() === 0) {
		log("[MERCHANT] No ShopSite_* models found (checked tag + name prefix) -- no merchants spawned.");
		return;
	}

	// ── Assign shop types ────────────────────────────────────────────────────
	// Shuffle sites so type assignments are random each session
	const shuffled = [...shopSites];
	for (let i = shuffled.size() - 1; i > 0; i--) {
		const j = math.random(0, i);
		const tmp = shuffled[i];
		shuffled[i] = shuffled[j];
		shuffled[j] = tmp;
	}

	// Build the type-assignment list: required types first, then random extras
	const typeAssignments: ShopType[] = [...REQUIRED_SHOP_TYPES];
	const allTypes: ShopType[] = ["weapon", "elixir", "poison", "rare"];
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

		// ShopType attribute on the ShopSite model overrides the auto-assigned type
		const attrType = shopSite.GetAttribute("ShopType") as string | undefined;
		const resolvedType: ShopType = (attrType as ShopType) ?? shopType;

		const shopItems = SHOP_TYPE_POOLS[resolvedType];
		if (!shopItems) {
			log("[MERCHANT] Unknown ShopType '" + resolvedType + "' on site " + shopSite.Name, "WARN");
			poolIndex--;
			continue;
		}

		spawnMerchant(npcName, shopSite, shopItems, resolvedType);
	}

	log("[MERCHANT] Initialized " + merchantShops.size() + " merchants across " + shopSites.size() + " shop site(s).");
}

export function initializeMerchantSystem(): void {
	// Defer 3 seconds so CollectionService tags are fully registered in the DataModel
	task.delay(3, () => runMerchantInit());
}
