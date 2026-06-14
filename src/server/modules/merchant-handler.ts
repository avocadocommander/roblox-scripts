/**
 * Merchant Handler — server module.
 *
 * Operates on ShopSite_* models tagged "MerchantShop" in CollectionService.
 * Each ShopSite_* must contain:
 *   Routes — a Folder named "Routes" whose BasePart children are the NPC's route
 *             points. Route folder attributes control Pace/RouteRole/Tempo
 *             exactly like any other route in the game. No CollectionService tag
 *             required on the Route folder itself.
 *   Sign   — a BasePart tagged "Sign" in CollectionService (anywhere under the
 *             ShopSite_* model). The SurfaceGui is written here at runtime.
 *
 * On server start this module:
 *   1. Collects all ShopSite_* models tagged "MerchantShop".
 *   2. Assigns a shop type (guaranteed: weapon, elixir, poison; extras random).
 *   3. Picks an NPC name from MERCHANT_NPC_POOL for each site.
 *   4. Spawns the NPC using the site's own Route (attributes + points).
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
import { SHOP_OFFER_SLOTS, getOfferSlotsForShopType, getPremiumOffer } from "shared/config/premium-offers";
import { SHOP_TYPE_MARKERS, SIGN_COLORS, SignColorScheme, generateShopName } from "shared/config/shop-signs";
import { createNPCModelAndGenerateHumanoid, NPC, setState, assignNpcToRoute } from "shared/npc/main";
import { getRouteEnchantment } from "shared/npc-manager";
import { applyEnchantmentVisualToCharacter } from "./enchantment-visual-handler";

// ── Runtime state ─────────────────────────────────────────────────────────────

/** npcName -> items this merchant sells. */
const merchantShops = new Map<string, ShopItem[]>();
/** npcName -> the ShopType this merchant was spawned as (for analytics breakdowns). */
const merchantShopTypes = new Map<string, ShopType>();
/** Names already claimed by the merchant system (skip in route spawning). */
const reservedNames = new Set<string>();

/** Names pinned to a specific ShopSite via NPCName attribute. Populated
 *  synchronously at init so npc-spawner skips their fixed routes before the
 *  full merchant placement (which is deferred) runs. */
const pinnedNames = new Set<string>();
/** Generated premium offer displays by ShopSite, so respawns don't duplicate them. */
const spawnedOfferModelsBySite = new Map<Model, Model[]>();

const SHOP_OFFER_IDS: ReadonlySet<string> = (() => {
	const ids = new Set<string>();
	for (const [, offerIds] of pairs(SHOP_OFFER_SLOTS)) {
		for (const offerId of offerIds) ids.add(offerId);
	}
	return ids;
})();

const OFFER_SLOT_FAR_WARNING_DISTANCE_FROM_SIGN = 36;
const GENERATED_OFFERS_FOLDER_NAME = "GeneratedOffers";

// ── Fallback route config (used when a Route folder has no route attributes) ──

function ensureDefaultMerchantRouteAttributes(routeFolder: Folder): void {
	if (routeFolder.GetAttribute("Pace") === undefined) {
		routeFolder.SetAttribute("Pace", "Stationary");
	}
}

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
	vertical = false,
): void {
	// Canvas is portrait (186 wide × 294 tall px at 50pps).
	// Rotator swaps dimensions so content fills the physically landscape sign.
	const rotator = new Instance("Frame");
	rotator.Name = "Rotator";
	rotator.BackgroundTransparency = 1;
	rotator.AnchorPoint = new Vector2(0.5, 0.5);
	rotator.Position = new UDim2(0.5, 0, 0.5, 0);
	rotator.Size = vertical ? new UDim2(1, 0, 1, 0) : new UDim2(0, 294, 0, 186);
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
	nameLabel.Size = vertical ? new UDim2(1, -12, 0.68, 0) : new UDim2(1, -8, 0.6, 0);
	nameLabel.Position = vertical ? new UDim2(0, 6, 0.08, 0) : new UDim2(0, 4, 0.02, 0);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.TextColor3 = colors.name;
	nameLabel.Font = Enum.Font.GothamBold;
	nameLabel.TextScaled = false;
	nameLabel.TextSize = vertical ? 44 : 52;
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
	markerLabel.Size = vertical ? new UDim2(1, -12, 0.2, 0) : new UDim2(1, -8, 0.3, 0);
	markerLabel.Position = vertical ? new UDim2(0, 6, 0.74, 0) : new UDim2(0, 4, 0.65, 0);
	markerLabel.BackgroundTransparency = 1;
	markerLabel.TextColor3 = colors.marker;
	markerLabel.Font = Enum.Font.SourceSansBold;
	markerLabel.TextScaled = false;
	markerLabel.TextSize = vertical ? 24 : 36;
	markerLabel.TextWrapped = false;
	markerLabel.ClipsDescendants = false;
	markerLabel.TextStrokeColor3 = Color3.fromRGB(0, 0, 0);
	markerLabel.TextStrokeTransparency = 0.82;
	markerLabel.Text = marker;
	markerLabel.TextXAlignment = Enum.TextXAlignment.Center;
	markerLabel.ZIndex = 3;
	markerLabel.Parent = bg;
}

interface SignTextOverrides {
	marker?: string;
	shopName?: string;
}

function isStandingSignBoard(signPart: BasePart): boolean {
	return signPart.Name === "Board" || signPart.Size.Y > signPart.Size.X;
}

export function applyMerchantSignText(
	signPart: BasePart,
	shopType: ShopType,
	npcName: string,
	overrides?: SignTextOverrides,
): void {
	const colors = SIGN_COLORS[shopType];
	const marker = overrides?.marker ?? SHOP_TYPE_MARKERS[shopType];
	const shopName = overrides?.shopName ?? generateShopName(npcName, shopType);
	const standingBoard = isStandingSignBoard(signPart);

	// Remove any stale guis
	for (const child of signPart.GetChildren()) {
		if (child.Name === "ShopSignGui" || child.Name === "ShopSignGuiBack") child.Destroy();
	}

	// Front face
	const front = new Instance("SurfaceGui");
	front.Name = "ShopSignGui";
	front.Face = standingBoard ? Enum.NormalId.Front : Enum.NormalId.Right;
	front.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
	front.PixelsPerStud = 50;
	front.AlwaysOnTop = false;
	front.LightInfluence = 1;
	buildSignContents(front, colors, marker, shopName, standingBoard ? 0 : 90, standingBoard);
	front.Parent = signPart;

	// Back face — Left face Y axis is flipped so use -90
	const back = new Instance("SurfaceGui");
	back.Name = "ShopSignGuiBack";
	back.Face = standingBoard ? Enum.NormalId.Back : Enum.NormalId.Left;
	back.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
	back.PixelsPerStud = 50;
	back.AlwaysOnTop = false;
	back.LightInfluence = 1;
	buildSignContents(back, colors, marker, shopName, standingBoard ? 0 : -90, standingBoard);
	back.Parent = signPart;

	log("[MERCHANT] Sign: [" + shopType + "] " + shopName + " on " + signPart.Name);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Find all BaseParts tagged "Sign" that belong to this ShopSite.
 * Searches CollectionService tags, exact name matches, Sign models,
 * and case-insensitive fallbacks. Returns all unique matches.
 */
export function resolveMerchantSignParts(shopSite: Model, routeOrigin?: Vector3): BasePart[] {
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

	// 3. Any descendant named "Sign" that is a container -> prefer a Board part,
	// then PrimaryPart, then the first BasePart.
	for (const inst of shopSite.GetDescendants()) {
		if (inst.Name === "Sign" && (inst.IsA("Model") || inst.IsA("Folder"))) {
			const m = inst.IsA("Model") ? (inst as Model) : undefined;
			const board = inst.FindFirstChild("Board", true);
			const part =
				(board?.IsA("BasePart") ? board : undefined) ??
				m?.PrimaryPart ??
				(inst.FindFirstChildWhichIsA("BasePart", true) as BasePart | undefined);
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
	if (routeOrigin !== undefined && results.size() > 1) {
		results.sort((a, b) => a.Position.sub(routeOrigin).Magnitude < b.Position.sub(routeOrigin).Magnitude);
		return [results[0]];
	}
	return results;
}

// ── Offer Slot Spawning ───────────────────────────────────────────────────────

/**
 * Find OfferSlot attachments/parts in a ShopSite and spawn a floating display
 * model for each, stamped with the matching `offerId` attribute.
 * The client picks these up via the existing premium-offer proximity system.
 */
function clearSpawnedOfferSlots(shopSite: Model): void {
	const existing = spawnedOfferModelsBySite.get(shopSite);
	if (!existing) return;

	for (const model of existing) {
		if (model.Parent) model.Destroy();
	}
	spawnedOfferModelsBySite.delete(shopSite);
}

function isInsideGeneratedOffer(inst: Instance): boolean {
	let ancestor = inst.Parent;
	while (ancestor !== undefined) {
		if (ancestor.IsA("Model") && ancestor.GetAttribute("GeneratedMerchantOffer") === true) return true;
		ancestor = ancestor.Parent;
	}
	return false;
}

function cleanupLegacyShopOfferObjects(): void {
	const doomed = new Set<Instance>();

	for (const inst of Workspace.GetDescendants()) {
		const offerId = inst.GetAttribute("offerId") as string | undefined;
		if (offerId === undefined || !SHOP_OFFER_IDS.has(offerId)) continue;
		if (inst.GetAttribute("GeneratedMerchantOffer") === true || isInsideGeneratedOffer(inst)) continue;

		if (inst.IsA("Model")) {
			doomed.add(inst);
		} else {
			const model = inst.FindFirstAncestorOfClass("Model");
			if (model && model.GetAttribute("offerId") === offerId) {
				doomed.add(model);
			} else {
				doomed.add(inst);
			}
		}
	}

	for (const inst of doomed) {
		log("[MERCHANT] Removing legacy static shop offer object: " + inst.GetFullName());
		inst.Destroy();
	}
}

function cleanupGeneratedMerchantOfferObjects(): void {
	for (const inst of Workspace.GetDescendants()) {
		if (inst.IsA("Model") && inst.GetAttribute("GeneratedMerchantOffer") === true) {
			log("[MERCHANT] Removing stale generated shop offer object: " + inst.GetFullName());
			inst.Destroy();
		}
	}
	spawnedOfferModelsBySite.clear();
}

function resolveOfferSearchRoot(shopSite: Model): Instance {
	const shopContainer = shopSite.FindFirstChild("Shop");
	return shopContainer ?? shopSite;
}

function getOrCreateGeneratedOffersFolder(offerSearchRoot: Instance): Folder {
	let folder = offerSearchRoot.FindFirstChild(GENERATED_OFFERS_FOLDER_NAME) as Folder | undefined;
	if (!folder || !folder.IsA("Folder")) {
		folder = new Instance("Folder");
		folder.Name = GENERATED_OFFERS_FOLDER_NAME;
		folder.Parent = offerSearchRoot;
	}
	return folder;
}

function isInsideGeneratedOfferContainer(inst: Instance): boolean {
	let ancestor = inst.Parent;
	while (ancestor !== undefined) {
		if (ancestor.Name === GENERATED_OFFERS_FOLDER_NAME) return true;
		if (ancestor.IsA("Model") && ancestor.GetAttribute("GeneratedMerchantOffer") === true) return true;
		ancestor = ancestor.Parent;
	}
	return false;
}

function spawnOfferSlots(shopSite: Model, shopType: ShopType, placementOrigin: Vector3): void {
	clearSpawnedOfferSlots(shopSite);

	const offerIds = getOfferSlotsForShopType(shopType);
	if (offerIds.size() === 0) return;
	const offerSearchRoot = resolveOfferSearchRoot(shopSite);
	const generatedOffersFolder = getOrCreateGeneratedOffersFolder(offerSearchRoot);

	// Collect slot positions: Models, BaseParts, or Attachments whose name
	// starts with "offerslot" (case-insensitive). This accepts "OfferSlot",
	// "OfferSlot1", "OfferSlot_Main", an OfferSlot Model wrapper, etc.
	const slots: { position: Vector3; fullName: string }[] = [];

	function isOfferSlotName(inst: Instance): boolean {
		return (inst.Name as string).lower().sub(1, 9).match("offerslot")[0] !== undefined;
	}

	function firstOfferSlotAttachment(root: Instance): Attachment | undefined {
		for (const child of root.GetDescendants()) {
			if (child.IsA("Attachment") && isOfferSlotName(child)) return child;
		}
		return undefined;
	}

	function hasOfferSlotAncestor(inst: Instance): boolean {
		let ancestor = inst.Parent;
		while (ancestor !== undefined && ancestor !== shopSite) {
			if ((ancestor.IsA("Model") || ancestor.IsA("BasePart")) && isOfferSlotName(ancestor)) return true;
			ancestor = ancestor.Parent;
		}
		return false;
	}

	function resolveOfferSlotPosition(slot: Instance): Vector3 | undefined {
		if (slot.IsA("Attachment")) return slot.WorldPosition;

		// In the authored map, OfferSlot parts/models often contain a child
		// Attachment also named OfferSlot. That attachment is the designer's
		// exact placement point; the parent part/model may be offset or at an
		// authored origin, which created stray premium offer displays.
		const attachment = firstOfferSlotAttachment(slot);
		if (attachment) return attachment.WorldPosition;

		if (slot.IsA("BasePart")) return slot.Position;

		if (slot.IsA("Model")) {
			const primary = slot.PrimaryPart;
			if (primary) return primary.Position;

			const part = slot.FindFirstChildWhichIsA("BasePart", true) as BasePart | undefined;
			if (part) return part.Position;
		}

		return undefined;
	}

	for (const desc of offerSearchRoot.GetDescendants()) {
		if (isInsideGeneratedOfferContainer(desc)) continue;
		if (!isOfferSlotName(desc)) continue;
		if (desc.IsA("Model")) {
			// Resolve from actual geometry/attachments. An empty Model's pivot
			// defaults to world origin, which would create a stray rotating offer.
			const position = resolveOfferSlotPosition(desc);
			if (position) {
				slots.push({ position, fullName: desc.GetFullName() });
			} else {
				log("[MERCHANT] OfferSlot model has no BasePart/Attachment: " + desc.GetFullName(), "WARN");
			}
		} else if (desc.IsA("Attachment")) {
			// If this attachment lives under an OfferSlot part/model, that parent
			// already resolves to the attachment's WorldPosition. Don't double-count it.
			if (desc.Parent?.IsA("BasePart") && !hasOfferSlotAncestor(desc)) {
				slots.push({ position: desc.WorldPosition, fullName: desc.GetFullName() });
			}
		} else if (desc.IsA("BasePart")) {
			// Skip BaseParts inside an OfferSlot Model -- already counted by the model wrapper.
			if (!hasOfferSlotAncestor(desc)) {
				const position = resolveOfferSlotPosition(desc);
				if (position) slots.push({ position, fullName: desc.GetFullName() });
			}
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

	slots.sort((a, b) => {
		return a.position.sub(placementOrigin).Magnitude < b.position.sub(placementOrigin).Magnitude;
	});

	// Log detected slot positions so designers can verify placement.
	for (let si = 0; si < slots.size(); si++) {
		const sp = slots[si].position;
		const posStr = tostring(math.floor(sp.X)) + "," + tostring(math.floor(sp.Y)) + "," + tostring(math.floor(sp.Z));
		const dist = math.floor(sp.sub(placementOrigin).Magnitude);
		log(
			"[MERCHANT] " +
				shopSite.Name +
				" OfferSlot[" +
				si +
				"] at pos=" +
				posStr +
				" dist=" +
				dist +
				" " +
				slots[si].fullName,
		);
	}

	const nearestDist = slots[0].position.sub(placementOrigin).Magnitude;
	if (nearestDist > OFFER_SLOT_FAR_WARNING_DISTANCE_FROM_SIGN) {
		log(
			"[MERCHANT] OfferSlot for " +
				shopSite.Name +
				" (" +
				shopType +
				") is " +
				tostring(math.floor(nearestDist * 10) / 10) +
				" studs from selected sign/origin; using it anyway because it belongs to this shop: " +
				slots[0].fullName,
			"WARN",
		);
	}

	// Warn if more offers are configured than there are physical slots.
	if (offerIds.size() > slots.size()) {
		const lost = offerIds.size() - slots.size();
		log(
			"[MERCHANT] OPPORTUNITY LOST: " +
				shopSite.Name +
				" has " +
				slots.size() +
				" slot(s) but " +
				offerIds.size() +
				" offer(s) for '" +
				shopType +
				"' -- " +
				lost +
				" will not display.",
			"WARN",
		);
	}

	// Fill slots with offer IDs (1-to-1; extra slots stay empty)
	const count = math.min(slots.size(), offerIds.size());
	const spawnedModels: Model[] = [];
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
		//   1) ReplicatedStorage.Weapons.<name>        (shared held/display weapon assets)
		//   2) ReplicatedStorage.DisplayModels.<name>  (legacy display models)
		//   3) ReplicatedStorage.<name>                (Accessory, Model, or BasePart at root)
		// Accessories are cloned and the Handle is extracted as the display.
		const weaponFolder = ReplicatedStorage.FindFirstChild("Weapons") as Folder | undefined;
		const displayFolder = ReplicatedStorage.FindFirstChild("DisplayModels") as Folder | undefined;
		let displayClone: Model | undefined;
		if (offer.displayModelName !== undefined) {
			let source: Instance | undefined =
				weaponFolder?.FindFirstChild(offer.displayModelName) ??
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
			} else if (source && source.IsA("BasePart")) {
				const wrapper = new Instance("Model");
				const partClone = source.Clone();
				partClone.Parent = wrapper;
				wrapper.PrimaryPart = partClone;
				displayClone = wrapper;
			}

			if (displayClone) {
				displayClone.Parent = model;
				displayClone.SetAttribute("offerId", undefined);
				displayClone.SetAttribute("inspectId", undefined);
				// Strip anything that would make this look or act like an NPC,
				// or that could fight against manual repositioning (welds, constraints).
				// Accessories have AccessoryWeld/WeldConstraint on the Handle which must
				// be removed or the part may resist CFrame changes when placed in workspace.
				// Display models must be inert visuals only.
				for (const inst of displayClone.GetDescendants()) {
					inst.SetAttribute("offerId", undefined);
					inst.SetAttribute("inspectId", undefined);
					if (
						inst.IsA("Humanoid") ||
						inst.IsA("Script") ||
						inst.IsA("LocalScript") ||
						inst.IsA("ModuleScript") ||
						inst.IsA("Tool") ||
						inst.IsA("ProximityPrompt") ||
						inst.IsA("ClickDetector") ||
						inst.IsA("WeldConstraint") ||
						inst.IsA("Weld") ||
						inst.IsA("Motor6D") ||
						inst.IsA("Motor")
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
						"' not found in ReplicatedStorage.Weapons, DisplayModels, or root",
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
		// source model. Use visible parts for the center, since imported display
		// models sometimes carry an invisible root part back at their authored
		// Workspace position.
		if (displayClone) {
			const parts: BasePart[] = [];
			const visibleParts: BasePart[] = [];
			for (const desc of displayClone.GetDescendants()) {
				if (desc.IsA("BasePart")) {
					parts.push(desc);
					if (desc.Transparency < 0.98) visibleParts.push(desc);
				}
			}
			const centerParts = visibleParts.size() > 0 ? visibleParts : parts;
			if (centerParts.size() > 0) {
				let minX = math.huge,
					minY = math.huge,
					minZ = math.huge;
				let maxX = -math.huge,
					maxY = -math.huge,
					maxZ = -math.huge;
				for (const p of centerParts) {
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
		model.SetAttribute("GeneratedMerchantOffer", true);
		model.SetAttribute("ShopSite", shopSite.GetFullName());
		model.SetAttribute("OfferSlotPosition", slot.position);
		model.SetAttribute("OfferSlotSource", slot.fullName);
		model.SetAttribute("OfferHasDisplayModel", displayClone !== undefined);
		model.SetAttribute("OfferVisualReady", true);
		model.Parent = generatedOffersFolder;
		spawnedModels.push(model);

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
	if (spawnedModels.size() > 0) {
		spawnedOfferModelsBySite.set(shopSite, spawnedModels);
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

	ensureDefaultMerchantRouteAttributes(routeFolder);

	const npcData = { gender: def.gender, race: def.race, status: def.socialClass };
	const npc: NPC | undefined = createNPCModelAndGenerateHumanoid(npcName, npcData, routeFolder);
	if (!npc) {
		log("[MERCHANT] Failed to create model for " + npcName, "ERROR");
		return;
	}

	// Place NPC at the first route point
	npc.model.PivotTo(new CFrame(routePoints[0].Position));
	npc.model.SetAttribute("RouteName", routeFolder.Name);
	npc.model.SetAttribute("ShopSite", shopSite.GetFullName());

	// Tag model so the client can detect this is a shop NPC
	npc.model.SetAttribute("Interaction", "Shop");
	applyEnchantmentVisualToCharacter(npc.model, getRouteEnchantment(routeFolder));

	// Assign to the site's route
	assignNpcToRoute(npc, routePoints, routeFolder, setState);

	// Record shop items
	merchantShops.set(npcName, shopItems);
	merchantShopTypes.set(npcName, shopType);
	reservedNames.add(npcName);

	// Apply sign from the same ShopSite
	// Apply sign to all sign parts in the ShopSite
	const signParts = resolveMerchantSignParts(shopSite, routePoints[0].Position);
	for (const signPart of signParts) {
		applyMerchantSignText(signPart, shopType, npcName);
	}
	const offerPlacementOrigin = signParts[0]?.Position ?? routePoints[0].Position;

	// Spawn premium offer display items at OfferSlot attachments
	spawnOfferSlots(shopSite, shopType, offerPlacementOrigin);

	log("[MERCHANT] " + npcName + " placed as merchant at " + shopSite.Name);

	// Respawn on death — sign re-applied with same shop type and new merchant name
	npc.model.AncestryChanged.Connect((_, parent) => {
		if (!parent) {
			log("[MERCHANT] " + npcName + " (merchant) died -- respawn in 30s");
			merchantShops.delete(npcName);
			merchantShopTypes.delete(npcName);
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

/** Returns the ShopType this merchant was spawned as, or undefined for non-dynamic NPCs. */
export function getMerchantShopType(npcName: string): ShopType | undefined {
	return merchantShopTypes.get(npcName);
}

/** Register an NPC name + item list with the merchant shop system. */
export function registerMerchantShop(npcName: string, items: ShopItem[]): void {
	merchantShops.set(npcName, items);
	reservedNames.add(npcName);
}

/** Unregister an NPC name from the merchant shop system. */
export function unregisterMerchantShop(npcName: string): void {
	merchantShops.delete(npcName);
	merchantShopTypes.delete(npcName);
	reservedNames.delete(npcName);
}

/** Names reserved by the merchant system — do NOT also assign to normal routes. */
export function getReservedMerchantNames(): Set<string> {
	const combined = new Set<string>();
	for (const n of reservedNames) combined.add(n);
	for (const n of pinnedNames) combined.add(n);
	return combined;
}

const VALID_SHOP_TYPES: ReadonlySet<string> = new Set<string>([
	"weapon",
	"elixir",
	"poison",
	"rare",
	"tavern",
	"black_market",
]);

function hasDirectRoutesFolder(model: Model): boolean {
	return model.FindFirstChild("Routes")?.IsA("Folder") === true;
}

function readShopTypeAttribute(site: Model): ShopType | undefined {
	const raw = site.GetAttribute("ShopType") as string | undefined;
	if (raw === undefined || raw === "") return undefined;
	if (VALID_SHOP_TYPES.has(raw)) return raw as ShopType;

	log("[MERCHANT] Ignoring invalid ShopType '" + raw + "' on " + site.Name + ".", "WARN");
	return undefined;
}

function runMerchantInit(): void {
	cleanupGeneratedMerchantOfferObjects();
	cleanupLegacyShopOfferObjects();

	// Collect shop sites: tagged "MerchantShop" + any Model named "Shop"
	const tagged = CollectionService.GetTagged("MerchantShop").filter((inst): inst is Model => {
		return inst.IsA("Model") && hasDirectRoutesFolder(inst);
	});

	const byName: Model[] = [];
	for (const inst of game.GetService("Workspace").GetDescendants()) {
		if (inst.IsA("Model") && inst.Name === "Shop" && hasDirectRoutesFolder(inst)) {
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

	const assignedShopTypes = new Set<ShopType>();

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

		const attrType = readShopTypeAttribute(site);
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
		assignedShopTypes.add(pinnedType);
	}

	// ── Assign shop types ────────────────────────────────────────────────────
	// Shuffle sites so type assignments are random each session
	const explicitSites: { site: Model; shopType: ShopType }[] = [];
	const autoSites: Model[] = [];
	for (const site of unpinnedSites) {
		const attrType = readShopTypeAttribute(site);
		if (attrType !== undefined) {
			explicitSites.push({ site, shopType: attrType });
		} else {
			autoSites.push(site);
		}
	}

	function shuffle<T>(items: T[]): void {
		for (let i = items.size() - 1; i > 0; i--) {
			const j = math.random(0, i);
			const tmp = items[i];
			items[i] = items[j];
			items[j] = tmp;
		}
	}

	shuffle(explicitSites);
	shuffle(autoSites);

	// Auto-assigned extras exclude explicit-only shop types. Required types are
	// filled below after explicitly typed shops have been counted.
	const allAutoTypes: ShopType[] = (
		["weapon", "elixir", "poison", "rare", "tavern", "black_market"] as ShopType[]
	).filter((t) => isExplicitOnlyShopType(t) === false);

	// ── Build available NPC pool (skip any already reserved) ────────────────
	const availablePool = MERCHANT_NPC_POOL.filter((name) => !reservedNames.has(name));

	// ── Assign NPC + shop type to each ShopSite ───────────────────────────────
	let poolIndex = 0;

	function spawnDynamicMerchant(shopSite: Model, resolvedType: ShopType, sourceLabel: string): boolean {

		if (poolIndex >= availablePool.size()) {
			log("[MERCHANT] Ran out of NPC pool entries -- cannot place " + shopSite.Name + ".", "WARN");
			return false;
		}

		const npcName = availablePool[poolIndex];
		poolIndex++;

		if (sourceLabel === "auto-assigned" && isExplicitOnlyShopType(resolvedType)) {
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

		log("[MERCHANT] Site " + shopSite.Name + " -> type '" + resolvedType + "' (" + sourceLabel + ")");

		const shopItems = buildShopInventory(resolvedType);
		if (!shopItems || shopItems.size() === 0) {
			log("[MERCHANT] Empty/unknown ShopType '" + resolvedType + "' on site " + shopSite.Name, "WARN");
			poolIndex--;
			return false;
		}

		spawnMerchant(npcName, shopSite, shopItems, resolvedType);
		assignedShopTypes.add(resolvedType);
		return true;
	}

	for (const entry of explicitSites) {
		spawnDynamicMerchant(entry.site, entry.shopType, "from attribute");
	}

	const missingRequiredTypes = REQUIRED_SHOP_TYPES.filter((shopType) => !assignedShopTypes.has(shopType));
	if (missingRequiredTypes.size() > autoSites.size()) {
		log(
			"[MERCHANT] Cannot guarantee required shop mix: missing " +
				missingRequiredTypes.size() +
				" required type(s) but only " +
				autoSites.size() +
				" auto-assignable shop site(s).",
			"WARN",
		);
	}

	const autoAssignments: ShopType[] = [...missingRequiredTypes];
	for (let i = autoAssignments.size(); i < autoSites.size(); i++) {
		autoAssignments.push(allAutoTypes[math.random(0, allAutoTypes.size() - 1)]);
	}

	for (let i = 0; i < autoSites.size(); i++) {
		const shopType = autoAssignments[i];
		if (shopType === undefined) break;
		spawnDynamicMerchant(autoSites[i], shopType, "auto-assigned");
	}

	log("[MERCHANT] Initialized " + merchantShops.size() + " merchants across " + shopSites.size() + " shop site(s).");
}

/**
 * Synchronously scan ShopSites for an "NPCName" attribute and reserve those
 * names so the NPC spawner skips them (including their fixedRouteId routes).
 * Must run before initializeNpcSpawner so pinned NPCs don't double-spawn.
 */
function reservePinnedMerchantNames(): void {
	const tagged = CollectionService.GetTagged("MerchantShop").filter((inst): inst is Model => {
		return inst.IsA("Model") && hasDirectRoutesFolder(inst);
	});
	const byName: Model[] = [];
	for (const inst of Workspace.GetDescendants()) {
		if (inst.IsA("Model") && inst.Name === "Shop" && hasDirectRoutesFolder(inst)) byName.push(inst);
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
