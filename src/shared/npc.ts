import { ReplicatedStorage, Workspace } from "@rbxts/services";
import { log } from "./helpers";
import { NPCData, Position, Race, RouteData, RoutePace, useAssetId } from "./module";
import { PathfindingService } from "@rbxts/services";

export interface NPC {
	name: string;
	seed: number;
	rarity: Rarity;
	humanoid: Humanoid;
	state: NPCStateKeys;
	previousState: NPCStateKeys;
	animationInstances: NPCStateRecord;
	model: Model;
	race: Race;
}

export function createNPCModelAndGenerateHumanoid(name: string, data: NPCData, routeData: RouteData): NPC | undefined {
	const npcTemplate = ReplicatedStorage.WaitForChild("NPC") as Model;
	const modelClone = npcTemplate.Clone();
	modelClone.Name = name;

	modelClone.Parent = Workspace;

	const humanoid = modelClone.FindFirstChildOfClass("Humanoid");
	if (!humanoid) return;
	setHumanoidDefaults(humanoid, getSeedFromName(name), data, routeData);
	setHumanoidPace(humanoid, routeData.pace);

	const animator = humanoid.WaitForChild("Animator") as Animator;
	const animationInstances = getAnimationTracks(animator);

	return {
		name,
		race: data.race,
		seed: getSeedFromName(name),
		rarity: "Commoner",
		humanoid,
		model: modelClone,
		state: "IDLE",
		previousState: "IDLE",
		animationInstances,
	};
}

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

export function getGenericSeededAppearance(
	humanoidDescription: HumanoidDescription,
	seed: () => number,
	data: NPCData,
	humanoid: Humanoid,
	routeData: RouteData,
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
	const beltColors: Color3[] = [Color3.fromHex("#6B4C2E"), Color3.fromHex("#2C2C2C"), Color3.fromHex("#A1886F")];

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

	//const belt = npc.WaitForChild("Belt").WaitForChild("Handle").WaitForChild("SurfaceAppearance") as SurfaceAppearance;

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

	//	belt.Color = getRandomAssetFromListBasedOnSeed(beltColors, seed());

	if (routeData.position === "Guard") {
		shirt.Color = new Color3(0, 0, 0);
		pants.Color = new Color3(0, 0, 0);
		shoes.Color = new Color3(0, 0, 0);
		//belt.Color = new Color3(0, 0, 0);
		const hoodCore = ReplicatedStorage.WaitForChild("Hood") as Accessory;
		const hood = hoodCore.Clone();
		const hoodMesh = hood.WaitForChild("Handle") as MeshPart;
		hoodMesh.Color = new Color3(0, 0, 0);
		hood.Parent = npc;
	} else if (routeData.position === "Preacher") {
		shirt.Color = new Color3(1, 1, 1);
		pants.Color = new Color3(1, 1, 1);
		//	belt.Color = new Color3(0, 0, 0);
		shoes.Color = new Color3(0, 0, 0);
	} else {
		shirt.Color = getRandomAssetFromListBasedOnSeed(shirtColors, seed());
		pants.Color = getRandomAssetFromListBasedOnSeed(pantsColors, seed());
		shoes.Color = getRandomAssetFromListBasedOnSeed(shoeColors, seed());
	}

	return humanoidDescription;
}

export function getRandomAssetFromListBasedOnSeed<T>(list: T[], seed: number): T {
	return list[math.floor(seed * list.size())];
}

function setHumanoidPace(humanoid: Humanoid, pace: RoutePace) {
	const paceSpeedMap: Record<RoutePace, number> = {
		Slow: math.random(3, 4),
		Medium: math.random(5, 6),
		Fast: math.random(7, 8),
	};
	humanoid.WalkSpeed = paceSpeedMap[pace];
}

export function setHumanoidDefaults(
	humanoid: Humanoid,
	seed: number,
	data: NPCData,
	routeData: RouteData,
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

	if (routeData.position === "Guard") {
		const lantern = ReplicatedStorage.WaitForChild("Lantern") as Tool;
		const animator = humanoid.FindFirstChildOfClass("Animator") ?? (humanoid.WaitForChild("Animator") as Animator);

		const anim = new Instance("Animation");
		anim.AnimationId = `rbxassetid://74875540932204`;

		const track = animator.LoadAnimation(anim);
		track.Priority = Enum.AnimationPriority.Action2;
		track.Looped = true;

		track.Play();

		humanoid.EquipTool(lantern.Clone());
	}

	if (!appearenceDescription) return;
	humanoid.ApplyDescription(appearenceDescription);

	return humanoid;
}

export function makeSeededRandom(seed: number): () => number {
	let currentSeed = seed;

	return () => {
		currentSeed = (currentSeed * 9301 + 49297) % 233280;
		return currentSeed / 233280;
	};
}

export function getSeedFromName(name: string): number {
	if (!name) throw "No see was created with undefined name";

	let seed = 0;
	for (let i = 0; i < name.size(); i++) {
		const char = name.sub(i + 1, i + 1);
		const byte = string.byte(char) as unknown as number;
		seed += byte;
	}
	return seed;
}

export function randomizeBodyShape(npcDescription: HumanoidDescription, seed: () => number, race: Race) {
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

export const assignNpcToRoute = async (
	npc: NPC,
	startingPosition: Vector3,
	routePoints: BasePart[],
	activeRouteIndex = 0,
) => {
	if (activeRouteIndex >= routePoints.size() - 1) {
		activeRouteIndex = 0;
	} else {
		activeRouteIndex++;
	}
	await navigate(routePoints[activeRouteIndex].Position, startingPosition, npc, routePoints[0].Position);
	await Promise.delay(math.random(5, 50));

	assignNpcToRoute(npc, routePoints[activeRouteIndex].Position, routePoints, activeRouteIndex);
};

export async function navigate(
	goal: Vector3,
	startPosition: Vector3,
	npc: NPC,
	firstPointInRoute: Vector3,
): Promise<void> {
	const goalPosition = goal;
	const path = PathfindingService.CreatePath({
		AgentRadius: 2,
		AgentHeight: 5,
		AgentCanJump: true,
		AgentCanClimb: false,
		Costs: {
			Water: 100,
		},
	});
	path.ComputeAsync(startPosition, goalPosition);
	if (path.Status === Enum.PathStatus.Success) {
		const waypoints = path.GetWaypoints();
		let current = 0;
		const moveToNextWaypoint = async () => {
			current++;
			if (current >= waypoints.size()) {
				npc.humanoid.MoveTo(firstPointInRoute);
				await waitForMove(npc.humanoid);
				setState("IDLE", npc);
				return;
			}
			const wp = waypoints[current];
			npc.humanoid.MoveTo(wp.Position);
			setState("WALKING", npc);
			await waitForMove(npc.humanoid);
			await moveToNextWaypoint();
		};
		await moveToNextWaypoint();
	}
}

export function setState(newState: NPCStateKeys, npc: NPC) {
	if (npc.state === newState) return;
	npc.animationInstances[npc.state].Stop();
	npc.state = newState;
	npc.animationInstances[npc.state].Play();
}

export function getAnimationTracks(animator: Animator): NPCStateRecord {
	const walkAnim = new Instance("Animation");
	walkAnim.Name = "Walking Animation";
	walkAnim.AnimationId = useAssetId("133708367021932");

	const idleAnim = new Instance("Animation");
	idleAnim.Name = "Idle Animation";
	idleAnim.AnimationId = useAssetId("507766951");

	const walkTrack = animator.LoadAnimation(walkAnim);
	walkTrack.Priority = Enum.AnimationPriority.Movement;
	walkTrack.Looped = true;

	const idleTrack = animator.LoadAnimation(idleAnim);
	idleTrack.Priority = Enum.AnimationPriority.Movement;
	idleTrack.Looped = true;

	return {
		WALKING: walkTrack,
		IDLE: idleTrack,
	};
}

export function waitForMove(humanoid: Humanoid): Promise<void> {
	return new Promise((resolve) => {
		humanoid.MoveToFinished.Once(() => {
			return resolve();
		});
	});
}

export type NPCStateKeys = "WALKING" | "IDLE";
export type Gender = "M" | "F";
export type Rarity = "Serf" | "Commoner" | "Merchant" | "Nobility" | "Royalty";
export type NPCStateRecord = Record<NPCStateKeys, AnimationTrack>;
