import { ReplicatedStorage } from "@rbxts/services";
import { log } from "../helpers";
import { NPCData, Race } from "../module";
import { RouteConfig } from "../npc-manager";
import { makeSeededRandom } from "./utils";

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
	const shirtColors: Color3[] = [
		Color3.fromHex("#9B2E2E"),
		Color3.fromHex("#556B2F"),
		Color3.fromHex("#1E2B44"),
		Color3.fromHex("#6B4C2E"),
	];
	const pantsColors: Color3[] = [Color3.fromHex("#6B4C2E"), Color3.fromHex("#556B2F"), Color3.fromHex("#D8C9A8")];
	const shoeColors: Color3[] = [Color3.fromHex("#6B4C2E"), Color3.fromHex("#2C2C2C"), Color3.fromHex("#A1886F")];

	if (!shirtColors) {
		error("NOT shirtColors");
	}
	const shirt = npc
		.WaitForChild("BasicShirt")
		.WaitForChild("Handle")
		.WaitForChild("SurfaceAppearance") as SurfaceAppearance;

	const pants = npc
		.WaitForChild("BasicPants")
		.WaitForChild("Handle")
		.WaitForChild("SurfaceAppearance") as SurfaceAppearance;
	const shoes = npc
		.WaitForChild("BasicShoes")
		.WaitForChild("Handle")
		.WaitForChild("SurfaceAppearance") as SurfaceAppearance;

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
		const replicatedEars = ReplicatedStorage.WaitForChild(earType) as Accessory;
		const ears = replicatedEars.Clone();
		const earMesh = ears.WaitForChild("Handle") as MeshPart;
		earMesh.Color = skinColor;
		ears.Parent = npc;
	}

	if (!shirt) {
		error("NOT SHIRT");
	}

	if (routeData?.position === "Guard") {
		shirt.Color = new Color3(0, 0, 0);
		pants.Color = new Color3(0, 0, 0);
		shoes.Color = new Color3(0, 0, 0);
	} else if (routeData?.position === "Preacher") {
		shirt.Color = new Color3(0.59, 0.03, 0.03);
		pants.Color = new Color3(0.59, 0.03, 0.03);
		shoes.Color = new Color3(0, 0, 0);
	} else {
		shirt.Color = getRandomAssetFromListBasedOnSeed(shirtColors, seed());
		pants.Color = getRandomAssetFromListBasedOnSeed(pantsColors, seed());
		shoes.Color = getRandomAssetFromListBasedOnSeed(shoeColors, seed());
	}

	return humanoidDescription;
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
		const torch = ReplicatedStorage.WaitForChild("HandTorch") as Tool;
		const animator = humanoid.FindFirstChildOfClass("Animator") ?? (humanoid.WaitForChild("Animator") as Animator);

		const anim = new Instance("Animation");
		anim.AnimationId = `rbxassetid://74875540932204`;

		const track = animator.LoadAnimation(anim);
		track.Priority = Enum.AnimationPriority.Action2;
		track.Looped = true;

		track.Play();

		humanoid.EquipTool(torch.Clone());
	}

	if (!appearenceDescription) return;
	humanoid.ApplyDescription(appearenceDescription);

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
