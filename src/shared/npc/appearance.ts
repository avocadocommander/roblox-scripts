import { ReplicatedStorage, ServerStorage } from "@rbxts/services";
import { log } from "../helpers";
import { NPCData, Race } from "../module";
import { getRouteRole } from "../npc-manager";
import { makeSeededRandom } from "./utils";
import { STATUS_CLOTHING, ROUTE_ACCESSORIES, ROUTE_CLOTHING_POOLS } from "../config/npc-clothing";
import { NPC_REGISTRY } from "../config/npcs";

const RACE_SKIN_TONES: Record<Race, Color3[]> = {
	Human: [
		Color3.fromRGB(255, 224, 189), // fair
		Color3.fromRGB(241, 194, 125), // light
		Color3.fromRGB(224, 172, 105), // light tan
		Color3.fromRGB(198, 134, 66), // olive
		Color3.fromRGB(141, 85, 36), // brown
		Color3.fromRGB(101, 67, 33), // dark brown
		Color3.fromRGB(77, 51, 25), // very dark
	],
	Gnome: [
		Color3.fromRGB(238, 198, 168), // rosy fair
		Color3.fromRGB(225, 178, 140), // warm tan
		Color3.fromRGB(208, 158, 118), // ruddy
		Color3.fromRGB(195, 140, 100), // sun-browned
	],
	Goblin: [
		Color3.fromRGB(60, 100, 60), // moss green
		Color3.fromRGB(80, 110, 70), // olive green
		Color3.fromRGB(90, 90, 90), // slate gray
		Color3.fromRGB(50, 70, 50), // dark green
	],
	Pirate: [
		Color3.fromRGB(210, 168, 124), // weathered tan
		Color3.fromRGB(184, 138, 96), // deep sun-browned
		Color3.fromRGB(158, 110, 72), // salt-burnt
		Color3.fromRGB(124, 84, 52), // mahogany
		Color3.fromRGB(96, 64, 40), // brine-darkened
	],
};

function getRaceSkinTones(race: Race): Color3[] {
	return RACE_SKIN_TONES[race] ?? RACE_SKIN_TONES.Human;
}

function getRandomAssetFromListBasedOnSeed<T>(list: T[], seed: number): T {
	return list[math.floor(seed * list.size())];
}

function getAppearanceRole(npc: Model, routeFolder: Folder | undefined) {
	const npcName = npc.GetAttribute("NPCName") as string | undefined;
	const npcDef = npcName !== undefined ? NPC_REGISTRY[npcName] : undefined;
	return npcDef?.appearanceRole ?? getRouteRole(routeFolder);
}

function getHeadwearOffset(accessoryName: string): CFrame {
	if (accessoryName === "Chaplain Hat") return new CFrame(0, 0.55, 0);
	if (accessoryName === "TemplarHelm") return new CFrame(0, 0.2, 0);
	return new CFrame();
}

function usesManualHeadwearAttach(accessoryName: string): boolean {
	return accessoryName === "TemplarHelm" || accessoryName === "Chaplain Hat";
}

function applyRouteClothingColors(
	role: ReturnType<typeof getAppearanceRole>,
	shirt: SurfaceAppearance | undefined,
	pants: SurfaceAppearance | undefined,
	shoes: SurfaceAppearance | undefined,
): boolean {
	if (role === "Nightbound") {
		if (shirt) shirt.Color = new Color3(0, 0, 0);
		if (pants) pants.Color = new Color3(0, 0, 0);
		if (shoes) shoes.Color = new Color3(0, 0, 0);
		return true;
	}

	if (role === "Dawnsworn") {
		if (shirt) shirt.Color = Color3.fromRGB(132, 138, 140);
		if (pants) pants.Color = Color3.fromRGB(72, 78, 82);
		if (shoes) shoes.Color = Color3.fromRGB(42, 45, 48);
		return true;
	}

	if (role === "Chaplain") {
		if (shirt) shirt.Color = Color3.fromRGB(138, 21, 32);
		if (pants) pants.Color = Color3.fromRGB(94, 12, 24);
		if (shoes) shoes.Color = Color3.fromRGB(61, 8, 16);
		return true;
	}

	return false;
}

function getGenericSeededAppearance(
	humanoidDescription: HumanoidDescription,
	seed: () => number,
	data: NPCData,
	humanoid: Humanoid,
	routeFolder: Folder | undefined,
): HumanoidDescription | undefined {
	const raceSkinTones = getRaceSkinTones(data.race);
	const skinColor = getRandomAssetFromListBasedOnSeed(raceSkinTones, seed());

	humanoidDescription.HeadColor = skinColor;
	humanoidDescription.LeftArmColor = skinColor;
	humanoidDescription.RightArmColor = skinColor;
	humanoidDescription.LeftLegColor = skinColor;
	humanoidDescription.RightLegColor = skinColor;
	humanoidDescription.TorsoColor = skinColor;

	const npc = humanoid.Parent as Model;
	if (!npc) {
		error("NOT npc");
	}

	// ── Tier-based clothing from config ───────────────────────────────────────
	const tierClothing = STATUS_CLOTHING[data.status];

	const shirt = npc.FindFirstChild("BasicShirt")?.FindFirstChild("Handle")?.FindFirstChild("SurfaceAppearance") as
		| SurfaceAppearance
		| undefined;

	const pants = npc.FindFirstChild("BasicPants")?.FindFirstChild("Handle")?.FindFirstChild("SurfaceAppearance") as
		| SurfaceAppearance
		| undefined;
	const shoes = npc.FindFirstChild("BasicShoes")?.FindFirstChild("Handle")?.FindFirstChild("SurfaceAppearance") as
		| SurfaceAppearance
		| undefined;

	let earType: string | undefined = undefined;

	switch (data.race) {
		case "Goblin": {
			earType = "Goblin Ears";
			break;
		}
		case "Gnome": {
			// Gnomes always wear their signature mask -- attach via the same
			// ear-slot pipeline (clones the 'Gnome' Accessory from ReplicatedStorage).
			earType = "Gnome";
			break;
		}
		default: {
			break;
		}
	}
	if (earType !== undefined) {
		const replicatedEars = ReplicatedStorage.FindFirstChild(earType) as Accessory | undefined;
		if (replicatedEars) {
			const ears = replicatedEars.Clone();
			const earMesh = ears.FindFirstChild("Handle") as MeshPart | undefined;
			if (earMesh) earMesh.Color = skinColor;
			ears.Parent = npc;
		} else {
			log("[APPEARANCE] Missing ear accessory: " + earType);
		}
	}

	if (!shirt) {
		log("[APPEARANCE] BasicShirt not found on NPC, skipping clothing colors");
		return humanoidDescription;
	}

	// Route-specific overrides take priority.
	if (!applyRouteClothingColors(getAppearanceRole(npc, routeFolder), shirt, pants, shoes)) {
		// Use status-tier palette
		if (shirt) shirt.Color = getRandomAssetFromListBasedOnSeed(tierClothing.shirtColors, seed());
		if (pants) pants.Color = getRandomAssetFromListBasedOnSeed(tierClothing.pantsColors, seed());
		if (shoes) shoes.Color = getRandomAssetFromListBasedOnSeed(tierClothing.shoeColors, seed());
	}

	// Clothing items are attached post-ApplyDescription via attachClothingItems
	// (called from setHumanoidDefaults).

	return humanoidDescription;
}

function cloneAndAttachAccessory(npc: Model, accessoryName: string): void {
	const serverClothesFolder = ServerStorage.FindFirstChild("Clothes") as Folder | undefined;
	const replicatedClothesFolder = ReplicatedStorage.FindFirstChild("Clothes") as Folder | undefined;
	const template =
		serverClothesFolder?.FindFirstChild(accessoryName) ??
		replicatedClothesFolder?.FindFirstChild(accessoryName) ??
		ServerStorage.FindFirstChild(accessoryName) ??
		ReplicatedStorage.FindFirstChild(accessoryName);
	if (!template) {
		log(
			"[APPEARANCE] Missing accessory in ServerStorage/Clothes or ReplicatedStorage: '" +
				accessoryName +
				"' (NPC=" +
				npc.Name +
				"). Make sure an Accessory/Hat with this exact name exists in ServerStorage/Clothes.",
			"WARN",
		);
		return;
	}

	const humanoid = npc.FindFirstChildOfClass("Humanoid");
	const head = npc.FindFirstChild("Head") as BasePart | undefined;

	function removeEmbeddedScripts(root: Instance): void {
		for (const desc of root.GetDescendants()) {
			if (desc.IsA("Script") || desc.IsA("LocalScript") || desc.IsA("ModuleScript")) {
				desc.Destroy();
			}
		}
	}

	function sanitizeAccessoryClone(accessory: Accessory): void {
		removeEmbeddedScripts(accessory);

		function weldTouchesOutsideAccessory(part0: BasePart | undefined, part1: BasePart | undefined): boolean {
			return (
				part0 === undefined ||
				part1 === undefined ||
				!part0.IsDescendantOf(accessory) ||
				!part1.IsDescendantOf(accessory)
			);
		}

		for (const desc of accessory.GetDescendants()) {
			if (desc.IsA("BasePart")) {
				desc.Anchored = false;
				desc.CanCollide = false;
				desc.CanTouch = false;
				desc.CanQuery = false;
				desc.Massless = true;
			} else if (desc.IsA("Weld") && (desc.Name === "AccessoryWeld" || weldTouchesOutsideAccessory(desc.Part0, desc.Part1))) {
				desc.Destroy();
			} else if (desc.IsA("WeldConstraint") && weldTouchesOutsideAccessory(desc.Part0, desc.Part1)) {
				desc.Destroy();
			} else if (
				desc.IsA("Motor") &&
				(desc.Name === "AccessoryWeld" || weldTouchesOutsideAccessory(desc.Part0, desc.Part1))
			) {
				desc.Destroy();
			} else if (
				desc.IsA("Motor6D") &&
				(desc.Name === "AccessoryWeld" || weldTouchesOutsideAccessory(desc.Part0, desc.Part1))
			) {
				desc.Destroy();
			}
		}
	}

	function equipAccessory(accessory: Accessory, logLabel: string): void {
		sanitizeAccessoryClone(accessory);
		if (humanoid) {
			const [ok] = pcall(() => humanoid.AddAccessory(accessory));
			if (!ok) {
				log("[APPEARANCE] AddAccessory failed for " + accessoryName + ", parenting directly");
				accessory.Parent = npc;
			}
		} else {
			accessory.Parent = npc;
		}
		log(logLabel + accessoryName);
	}

	function prepareModelParts(model: Model): BasePart[] {
		removeEmbeddedScripts(model);

		const parts: BasePart[] = [];
		for (const desc of model.GetDescendants()) {
			if (desc.IsA("BasePart")) {
				desc.Anchored = false;
				desc.CanCollide = false;
				desc.CanTouch = false;
				desc.CanQuery = false;
				desc.Massless = true;
				parts.push(desc);
			}
		}
		return parts;
	}

	function attachHeadwearInstance(templateInstance: Instance): boolean {
		if (!head) return false;

		const model = new Instance("Model");
		model.Name = accessoryName;
		const clone = templateInstance.Clone();
		clone.Parent = model;
		const parts = prepareModelParts(model);
		if (parts.size() === 0) {
			model.Destroy();
			return false;
		}

		let anchor =
			(model.FindFirstChild("Handle", true) as BasePart | undefined) ??
			(model.FindFirstChild("Middle", true) as BasePart | undefined) ??
			(model.FindFirstChild("Root", true) as BasePart | undefined) ??
			(model.FindFirstChild("Cabasset", true) as BasePart | undefined) ??
			parts[0];
		if (!anchor || !anchor.IsA("BasePart")) anchor = parts[0];

		model.PrimaryPart = anchor;
		model.Parent = npc;

		const pivotOffsetFromAnchor = anchor.CFrame.ToObjectSpace(model.GetPivot());
		model.PivotTo(head.CFrame.mul(getHeadwearOffset(accessoryName)).mul(pivotOffsetFromAnchor));

		for (const part of parts) {
			if (part === anchor) continue;
			const weld = new Instance("WeldConstraint");
			weld.Part0 = anchor;
			weld.Part1 = part;
			weld.Parent = anchor;
		}

		const headWeld = new Instance("WeldConstraint");
		headWeld.Name = "HeadwearWeld";
		headWeld.Part0 = head;
		headWeld.Part1 = anchor;
		headWeld.Parent = anchor;
		log("[APPEARANCE] Attached model headwear: " + accessoryName);
		return true;
	}

	// Accessory or Hat: humanoid can equip directly.
	if (template.IsA("Accessory") || template.IsA("Hat")) {
		const handle = template.FindFirstChild("Handle");
		if ((!handle || !handle.IsA("BasePart")) && usesManualHeadwearAttach(accessoryName)) {
			if (attachHeadwearInstance(template)) return;
		}

		const accessory = template.Clone() as Accessory;
		equipAccessory(accessory, "[APPEARANCE] Attached accessory: ");
		return;
	}

	// Model wrapper: find the first Accessory/Hat inside and equip that.
	if (template.IsA("Model")) {
		const inner = template
			.GetDescendants()
			.find((d) => d.IsA("Accessory") || d.IsA("Hat")) as Accessory | undefined;
		if (inner) {
			const accessory = inner.Clone() as Accessory;
			equipAccessory(accessory, "[APPEARANCE] Attached accessory from Model wrapper: ");
			return;
		}

		// Model containing a `Handle` BasePart (no nested Accessory) — wrap
		// the Handle in a runtime Accessory so the humanoid can equip it.
		// The Handle should carry its own Attachment so AddAccessory can weld.
		if (usesManualHeadwearAttach(accessoryName)) {
			if (attachHeadwearInstance(template)) return;
		}

		const handle = template.FindFirstChild("Handle");
		if (handle && handle.IsA("BasePart")) {
			const accessory = new Instance("Accessory");
			accessory.Name = template.Name;
			const handleClone = handle.Clone();
			handleClone.Name = "Handle";
			handleClone.Parent = accessory;
			equipAccessory(accessory, "[APPEARANCE] Attached accessory from Model+Handle: ");
			return;
		}
	}

	if (template.IsA("BasePart") && usesManualHeadwearAttach(accessoryName)) {
		if (attachHeadwearInstance(template)) return;
	}

	log(
		"[APPEARANCE] ReplicatedStorage." +
			accessoryName +
			" is a " +
			template.ClassName +
			", expected Accessory/Hat (NPC=" +
			npc.Name +
			")",
		"WARN",
	);
}

function attachTierAccessories(
	npc: Model,
	data: NPCData,
	seed: () => number,
	routeFolder: Folder | undefined,
): void {
	// ── Route-specific accessories (guard shirt, etc.) ───────────────────────
	const position = getAppearanceRole(npc, routeFolder);
	const routeAccs = position !== undefined ? ROUTE_ACCESSORIES[position] : undefined;

	log("[APPEARANCE] position=" + tostring(position) + " routeAccs=" + tostring(routeAccs));

	if (routeAccs !== undefined && routeAccs.size() > 0) {
		// Route accessories take priority — skip tier accessories entirely
		log("[APPEARANCE] Applying " + routeAccs.size() + " route accessories for " + tostring(position));
		for (const name of routeAccs) {
			cloneAndAttachAccessory(npc, name);
		}
	} else {
		// ── Status-tier accessories (chest pieces, capes, etc.) ──────────────
		const tierClothing = STATUS_CLOTHING[data.status];
		const chance = tierClothing.accessoryChance ?? 1;

		for (const name of tierClothing.accessories) {
			const roll = seed();
			if (roll > chance) continue;
			cloneAndAttachAccessory(npc, name);
		}
	}

	// Catalog clothing handled post-ApplyDescription via attachClothingItems.
}

// ── Clothing items (ReplicatedStorage templates) ─────────────────────────
// Each name MUST match an Accessory child under ReplicatedStorage.

function pickClothingItemsForNPC(
	npc: Model,
	data: NPCData,
	seed: () => number,
	routeFolder: Folder | undefined,
): string[] {
	const npcName = npc.GetAttribute("NPCName") as string | undefined;
	const npcDef = npcName !== undefined ? NPC_REGISTRY[npcName] : undefined;

	// 1) NPC-level override always wins (applies every item).
	if (npcDef && npcDef.clothing !== undefined && npcDef.clothing.size() > 0) {
		return npcDef.clothing;
	}

	// Gnomes only ever wear their signature mask (attached via the ear-slot
	// pipeline). Skip the random hat/clothing pool entirely.
	if (data.race === "Gnome") return [];

	// 2) Route pool overrides tier pool (one seeded pick).
	const position = getAppearanceRole(npc, routeFolder);
	const routePool = position !== undefined ? ROUTE_CLOTHING_POOLS[position] : undefined;
	if (position !== undefined && routePool === undefined) return [];
	const pool = routePool ?? STATUS_CLOTHING[data.status].clothingPool;
	if (pool === undefined || pool.size() === 0) return [];
	const pick = pool[math.floor(seed() * pool.size())];
	return pick !== undefined ? [pick] : [];
}

function attachClothingItems(
	npc: Model,
	data: NPCData,
	seed: () => number,
	routeFolder: Folder | undefined,
): void {
	const items = pickClothingItemsForNPC(npc, data, seed, routeFolder);
	for (const name of items) {
		cloneAndAttachAccessory(npc, name);
	}
}

function setHumanoidDefaults(
	humanoid: Humanoid,
	seed: number,
	data: NPCData,
	routeFolder: Folder | undefined,
): Humanoid | undefined {
	humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None;
	const npcDescription = humanoid.GetAppliedDescription();
	if (!npcDescription) {
		log("Appearence unavalialbe for npc spawn", "ERROR");
		return undefined;
	}
	const rand = makeSeededRandom(seed);
	randomizeBodyShape(npcDescription, rand, data.race);
	const appearenceDescription = getGenericSeededAppearance(npcDescription, rand, data, humanoid, routeFolder);

	// Guard torch carry is temporarily disabled while guard weapons move to the
	// attachment-based weapon system. Keep this block here for a later pass.
	// if (getRouteRole(routeFolder) === "Dawnsworn") {
	// 	const torch = ReplicatedStorage.FindFirstChild("Handtorch") as Tool | undefined;
	// 	const animator = humanoid.FindFirstChildOfClass("Animator");
	//
	// 	if (torch && animator) {
	// 		const anim = new Instance("Animation");
	// 		anim.AnimationId = `rbxassetid://74875540932204`;
	//
	// 		const track = animator.LoadAnimation(anim);
	// 		track.Priority = Enum.AnimationPriority.Action2;
	// 		track.Looped = true;
	//
	// 		track.Play();
	//
	// 		// EquipTool yields until the character is ready -- run on its own
	// 		// thread so we don't stall the NPC spawn loop / server replication.
	// 		const torchClone = torch.Clone();
	// 		task.spawn(() => humanoid.EquipTool(torchClone));
	// 	} else {
	// 		log("[APPEARANCE] Guard missing Handtorch or Animator, skipping torch");
	// 	}
	// }

	if (!appearenceDescription) return;
	const [applyOk, applyErr] = pcall(() => humanoid.ApplyDescription(appearenceDescription));
	if (!applyOk) {
		log("[APPEARANCE] ApplyDescription failed: " + tostring(applyErr), "WARN");
	}

	// Attach tier accessories + clothing items AFTER ApplyDescription so the
	// body parts are final and welds target the correct rig.
	const npc = humanoid.Parent as Model;
	if (npc) {
		const accRand = makeSeededRandom(seed);
		attachTierAccessories(npc, data, accRand, routeFolder);
		attachClothingItems(npc, data, makeSeededRandom(seed), routeFolder);
	}

	return humanoid;
}

function randomizeBodyShape(npcDescription: HumanoidDescription, seed: () => number, race: Race) {
	function randRange(min: number, max: number, seed: () => number) {
		return min + (max - min) * seed();
	}

	const raceScale: Record<
		Race,
		{
			height: [number, number];
			width: [number, number];
			depth: [number, number];
			head: [number, number];
			bodyType: [number, number];
			proportion: [number, number];
		}
	> = {
		Human: {
			height: [0.95, 1.05],
			width: [0.95, 1.05],
			depth: [0.95, 1.05],
			head: [0.9, 1.1],
			bodyType: [0.3, 0.7],
			proportion: [0.45, 0.65],
		},
		Gnome: {
			height: [0.82, 0.95],
			width: [0.85, 0.98],
			depth: [0.85, 0.95],
			head: [1.0, 1.15],
			bodyType: [0.25, 0.55],
			proportion: [0.4, 0.6],
		},
		Goblin: {
			height: [0.88, 1.0],
			width: [0.85, 0.95],
			depth: [0.85, 0.95],
			head: [0.9, 1.05],
			bodyType: [0.25, 0.55],
			proportion: [0.4, 0.6],
		},
		Pirate: {
			height: [0.95, 1.05],
			width: [0.95, 1.08],
			depth: [0.95, 1.05],
			head: [0.9, 1.1],
			bodyType: [0.35, 0.75],
			proportion: [0.45, 0.65],
		},
	};

	const scales = raceScale[race];

	npcDescription.HeightScale = math.round(randRange(scales.height[0], scales.height[1], seed) * 100) / 100;
	npcDescription.WidthScale = math.round(randRange(scales.width[0], scales.width[1], seed) * 100) / 100;
	npcDescription.DepthScale = math.round(randRange(scales.depth[0], scales.depth[1], seed) * 100) / 100;

	npcDescription.HeadScale = math.round(randRange(scales.head[0], scales.head[1], seed) * 100) / 100;

	npcDescription.BodyTypeScale = math.round(randRange(scales.bodyType[0], scales.bodyType[1], seed) * 100) / 100;
	npcDescription.ProportionScale =
		math.round(randRange(scales.proportion[0], scales.proportion[1], seed) * 100) / 100;
}

export { getGenericSeededAppearance, setHumanoidDefaults, randomizeBodyShape };
