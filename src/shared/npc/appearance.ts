import { ReplicatedStorage } from "@rbxts/services";
import { log } from "../helpers";
import { NPCData, Race } from "../module";
import { RouteConfig } from "../npc-manager";
import { makeSeededRandom } from "./utils";
import { STATUS_CLOTHING, ROUTE_ACCESSORIES, NPCAccessoryDef } from "../config/npc-clothing";

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

// ── Body part aliases (R6 <-> R15) ────────────────────────────────────────────
// Tries the given name first, then falls back to known equivalents.
const PART_ALIASES: Record<string, string[]> = {
	Torso:         ["Torso", "UpperTorso"],
	UpperTorso:    ["UpperTorso", "Torso"],
	"Left Leg":    ["Left Leg", "LeftFoot", "LeftLowerLeg", "LeftUpperLeg"],
	"Right Leg":   ["Right Leg", "RightFoot", "RightLowerLeg", "RightUpperLeg"],
	LeftFoot:      ["LeftFoot", "Left Leg", "LeftLowerLeg"],
	RightFoot:     ["RightFoot", "Right Leg", "RightLowerLeg"],
};

function findBodyPart(npc: Model, partName: string): BasePart | undefined {
	const aliases = PART_ALIASES[partName] ?? [partName];
	for (const alias of aliases) {
		const found = npc.FindFirstChild(alias) as BasePart | undefined;
		if (found) return found;
	}
	return undefined;
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

	// ── Tier accessories are applied AFTER ApplyDescription in setHumanoidDefaults
	// so the welds target the final body parts, not pre-description ones.

	return humanoidDescription;
}

function cloneAndAttachAccessory(npc: Model, accDef: NPCAccessoryDef): void {
	const template = ReplicatedStorage.FindFirstChild(accDef.name);
	if (!template) {
		log("[APPEARANCE] Missing accessory in ReplicatedStorage: " + accDef.name);
		return;
	}

	if (accDef.hideShirt === true) {
		const basicShirt = npc.FindFirstChild("BasicShirt") as Accessory | undefined;
		if (basicShirt) basicShirt.Destroy();
	}

	// weldToMany: clone once per part entry and weld each independently
	if (accDef.weldToMany !== undefined) {
		for (const entry of accDef.weldToMany) {
			const targetPart = findBodyPart(npc, entry.part);
			if (!targetPart) {
				log("[APPEARANCE] weldToMany target '" + entry.part + "' not found for " + accDef.name, "WARN");
				continue;
			}
			const clone = template.Clone() as Accessory;
			if (accDef.color !== undefined) {
				const h = clone.FindFirstChild("Handle") as BasePart | undefined;
				if (h) h.Color = accDef.color;
			}
			const handle = clone.FindFirstChild("Handle") as BasePart | undefined;
			if (handle) {
				handle.Anchored = false;
				clone.Parent = npc;
				const weld = new Instance("Weld");
				weld.Part0 = targetPart;
				weld.Part1 = handle;
				weld.C0 = entry.cframe ?? new CFrame(0, 0, 0);
				weld.Parent = handle;
				log("[APPEARANCE] Welded " + accDef.name + " to " + targetPart.Name + " (via '" + entry.part + "')");
			}
		}
		return;
	}

	const accessory = template.Clone() as Accessory;
	if (accDef.color !== undefined) {
		const handle = accessory.FindFirstChild("Handle") as BasePart | undefined;
		if (handle) handle.Color = accDef.color;
	}

	// Single weld path — use when the accessory lacks correct attachment data
	if (accDef.weldTo !== undefined) {
		const targetPart = findBodyPart(npc, accDef.weldTo);
		const handle = accessory.FindFirstChild("Handle") as BasePart | undefined;
		if (targetPart && handle) {
			handle.Anchored = false;
			accessory.Parent = npc;
			const weld = new Instance("Weld");
			weld.Part0 = targetPart;
			weld.Part1 = handle;
			weld.C0 = accDef.weldCFrame ?? new CFrame(0, 0, 0);
			weld.Parent = handle;
			log("[APPEARANCE] Welded " + accDef.name + " to " + targetPart.Name + " (via '" + accDef.weldTo + "')");
		} else {
			log("[APPEARANCE] weldTo target '" + accDef.weldTo + "' not found for " + accDef.name, "WARN");
		}
		return;
	}

	const humanoid = npc.FindFirstChildOfClass("Humanoid");
	if (humanoid) {
		const [ok] = pcall(() => humanoid.AddAccessory(accessory));
		if (!ok) {
			log("[APPEARANCE] AddAccessory failed for " + accDef.name + ", parenting directly");
			accessory.Parent = npc;
		}
	} else {
		accessory.Parent = npc;
	}

	log("[APPEARANCE] Attached accessory: " + accDef.name);
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
		for (const accDef of routeAccs) {
			cloneAndAttachAccessory(npc, accDef);
		}
	} else {
		// ── Status-tier accessories (chest pieces, capes, etc.) ──────────────
		const tierClothing = STATUS_CLOTHING[data.status];
		const chance = tierClothing.accessoryChance ?? 1;

		for (const accDef of tierClothing.accessories) {
			const roll = seed();
			if (roll > chance) continue;
			cloneAndAttachAccessory(npc, accDef);
		}
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
	//randomizeBodyShape(npcDescription, rand, data.race);
	const appearenceDescription = getGenericSeededAppearance(npcDescription, rand, data, humanoid, routeData);

	if (routeData?.position === "Guard" && routeData?.pace !== "Stationary") {
		const torch = ReplicatedStorage.FindFirstChild("HandTorch") as Tool | undefined;
		const animator = humanoid.FindFirstChildOfClass("Animator");

		if (torch && animator) {
			const anim = new Instance("Animation");
			anim.AnimationId = `rbxassetid://74875540932204`;

			const track = animator.LoadAnimation(anim);
			track.Priority = Enum.AnimationPriority.Action2;
			track.Looped = true;

			track.Play();

			humanoid.EquipTool(torch.Clone());
		} else {
			log("[APPEARANCE] Guard missing HandTorch or Animator, skipping torch");
		}
	}

	if (!appearenceDescription) return;
	humanoid.ApplyDescription(appearenceDescription);

	// Attach tier accessories AFTER ApplyDescription so the body parts are final
	const npc = humanoid.Parent as Model;
	if (npc) {
		const accRand = makeSeededRandom(seed);
		attachTierAccessories(npc, data, accRand, routeData);
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
			height: [1.05, 1.15],
			width: [0.9, 1.0],
			depth: [0.95, 1.05],
			head: [0.85, 1.0],
			bodyType: [0.2, 0.5],
			proportion: [0.55, 0.75],
		},
		Goblin: {
			height: [0.75, 0.9],
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
