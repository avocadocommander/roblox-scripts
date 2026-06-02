import { ReplicatedStorage } from "@rbxts/services";
import { log } from "../helpers";
import { NPCData, Race } from "../module";
import { RouteConfig } from "../npc-manager";
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
	Elf: [
		Color3.fromRGB(245, 245, 240), // porcelain
		Color3.fromRGB(235, 245, 238), // pale with green tint
		Color3.fromRGB(235, 238, 255), // pale with blue tint
		Color3.fromRGB(250, 235, 245), // pale rose
	],
	Goblin: [
		Color3.fromRGB(60, 100, 60), // moss green
		Color3.fromRGB(80, 110, 70), // olive green
		Color3.fromRGB(90, 90, 90), // slate gray
		Color3.fromRGB(50, 70, 50), // dark green
	],
};

function getRaceSkinTones(race: Race): Color3[] {
	return RACE_SKIN_TONES[race] ?? RACE_SKIN_TONES.Human;
}

function getRandomAssetFromListBasedOnSeed<T>(list: T[], seed: number): T {
	return list[math.floor(seed * list.size())];
}

function getGenericSeededAppearance(
	humanoidDescription: HumanoidDescription,
	seed: () => number,
	data: NPCData,
	humanoid: Humanoid,
	routeData: RouteConfig | undefined,
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
		case "Elf": {
			earType = "Elf Ears";
			break;
		}
		case "Goblin": {
			earType = "Goblin Ears";
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

	// Route-specific overrides (Guards, Preachers) take priority
	if (routeData?.position === "Guard") {
		if (shirt) shirt.Color = new Color3(0, 0, 0);
		if (pants) pants.Color = new Color3(0, 0, 0);
		if (shoes) shoes.Color = new Color3(0, 0, 0);
	} else if (routeData?.position === "Preacher") {
		if (shirt) shirt.Color = new Color3(0.59, 0.03, 0.03);
		if (pants) pants.Color = new Color3(0.59, 0.03, 0.03);
		if (shoes) shoes.Color = new Color3(0, 0, 0);
	} else {
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
	const template = ReplicatedStorage.FindFirstChild(accessoryName);
	if (!template) {
		log(
			"[APPEARANCE] Missing accessory in ReplicatedStorage: '" +
				accessoryName +
				"' (NPC=" +
				npc.Name +
				"). Make sure an Accessory/Hat with this exact name exists at the root of ReplicatedStorage.",
			"WARN",
		);
		return;
	}

	const humanoid = npc.FindFirstChildOfClass("Humanoid");

	// Accessory or Hat: humanoid can equip directly.
	if (template.IsA("Accessory") || template.IsA("Hat")) {
		const accessory = template.Clone() as Accessory;
		if (humanoid) {
			const [ok] = pcall(() => humanoid.AddAccessory(accessory));
			if (!ok) {
				log("[APPEARANCE] AddAccessory failed for " + accessoryName + ", parenting directly");
				accessory.Parent = npc;
			}
		} else {
			accessory.Parent = npc;
		}
		log("[APPEARANCE] Attached accessory: " + accessoryName);
		return;
	}

	// Model wrapper: find the first Accessory/Hat inside and equip that.
	if (template.IsA("Model")) {
		const inner = template
			.GetDescendants()
			.find((d) => d.IsA("Accessory") || d.IsA("Hat")) as Accessory | undefined;
		if (inner) {
			const accessory = inner.Clone() as Accessory;
			if (humanoid) {
				const [ok] = pcall(() => humanoid.AddAccessory(accessory));
				if (!ok) accessory.Parent = npc;
			} else {
				accessory.Parent = npc;
			}
			log("[APPEARANCE] Attached accessory from Model wrapper: " + accessoryName);
			return;
		}
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
	routeData: RouteConfig | undefined,
): void {
	// ── Route-specific accessories (guard shirt, preacher hood, etc.) ─────────
	const position = routeData?.position;
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
	routeData: RouteConfig | undefined,
): string[] {
	const npcName = npc.GetAttribute("NPCName") as string | undefined;
	const npcDef = npcName !== undefined ? NPC_REGISTRY[npcName] : undefined;

	// 1) NPC-level override always wins (applies every item).
	if (npcDef && npcDef.clothing !== undefined && npcDef.clothing.size() > 0) {
		return npcDef.clothing;
	}

	// 2) Route pool overrides tier pool (one seeded pick).
	const position = routeData?.position;
	const routePool = position !== undefined ? ROUTE_CLOTHING_POOLS[position] : undefined;
	const pool = routePool ?? STATUS_CLOTHING[data.status].clothingPool;
	if (pool === undefined || pool.size() === 0) return [];
	const pick = pool[math.floor(seed() * pool.size())];
	return pick !== undefined ? [pick] : [];
}

function attachClothingItems(
	npc: Model,
	data: NPCData,
	seed: () => number,
	routeData: RouteConfig | undefined,
): void {
	const items = pickClothingItemsForNPC(npc, data, seed, routeData);
	for (const name of items) {
		cloneAndAttachAccessory(npc, name);
	}
}

function setHumanoidDefaults(
	humanoid: Humanoid,
	seed: number,
	data: NPCData,
	routeData: RouteConfig | undefined,
): Humanoid | undefined {
	humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None;
	const npcDescription = humanoid.GetAppliedDescription();
	if (!npcDescription) {
		log("Appearence unavalialbe for npc spawn", "ERROR");
		return undefined;
	}
	const rand = makeSeededRandom(seed);
	randomizeBodyShape(npcDescription, rand, data.race);
	const appearenceDescription = getGenericSeededAppearance(npcDescription, rand, data, humanoid, routeData);

	if (routeData?.position === "Guard" && routeData?.pace !== "Stationary") {
		const torch = ReplicatedStorage.FindFirstChild("Handtorch") as Tool | undefined;
		const animator = humanoid.FindFirstChildOfClass("Animator");

		if (torch && animator) {
			const anim = new Instance("Animation");
			anim.AnimationId = `rbxassetid://74875540932204`;

			const track = animator.LoadAnimation(anim);
			track.Priority = Enum.AnimationPriority.Action2;
			track.Looped = true;

			track.Play();

			// EquipTool yields until the character is ready -- run on its own
			// thread so we don't stall the NPC spawn loop / server replication.
			const torchClone = torch.Clone();
			task.spawn(() => humanoid.EquipTool(torchClone));
		} else {
			log("[APPEARANCE] Guard missing Handtorch or Animator, skipping torch");
		}
	}

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
		attachTierAccessories(npc, data, accRand, routeData);
		attachClothingItems(npc, data, makeSeededRandom(seed), routeData);
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
		Elf: {
			height: [1.15, 1.28],
			width: [0.78, 0.88],
			depth: [0.85, 0.95],
			head: [0.8, 0.95],
			bodyType: [0.15, 0.35],
			proportion: [0.65, 0.85],
		},
		Goblin: {
			height: [0.88, 1.0],
			width: [0.85, 0.95],
			depth: [0.85, 0.95],
			head: [0.9, 1.05],
			bodyType: [0.25, 0.55],
			proportion: [0.4, 0.6],
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
