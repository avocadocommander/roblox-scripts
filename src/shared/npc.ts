import { ReplicatedStorage, Workspace } from "@rbxts/services";
import { log } from "./helpers";
import { NPCData, Position, Race, RoutePace, useAssetId } from "./module";
import { murderNpcByPlayer } from "shared/player-store";
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

export function createNPCModelAndGenerateHumanoid(name: string, data: NPCData, pace: RoutePace): NPC | undefined {
	const npcTemplate = ReplicatedStorage.WaitForChild("NPC") as Model;
	const modelClone = npcTemplate.Clone();
	modelClone.Name = name;

	modelClone.Parent = Workspace;

	const humanoid = modelClone.FindFirstChildOfClass("Humanoid");
	if (!humanoid) return;
	setHumanoidDefaults(humanoid, getSeedFromName(name), data);
	setHumanoidPace(humanoid, pace);
	addPromptToEndNpc(modelClone, "");

	const animator = humanoid.WaitForChild("Animator") as Animator;
	const animationInstances = getAnimationTracks(animator);

	return {
		name,
		race: data.race,
		seed: getSeedFromName(name),
		rarity: data.position,
		humanoid,
		model: modelClone,
		state: "IDLE",
		previousState: "IDLE",
		animationInstances,
	};
}

// Lore-true skin tones by race
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
	Dwarf: [
		Color3.fromRGB(255, 220, 190), // ruddy fair
		Color3.fromRGB(232, 190, 172), // rosy
		Color3.fromRGB(203, 144, 102), // warm tan
		Color3.fromRGB(160, 114, 77), // deep tan
		Color3.fromRGB(141, 85, 36), // brown
	],
	Hobbit: [
		Color3.fromRGB(255, 230, 200), // rosy fair
		Color3.fromRGB(241, 200, 150), // warm light
		Color3.fromRGB(224, 172, 105), // light tan
		Color3.fromRGB(198, 134, 66), // olive
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
): HumanoidDescription | undefined {
	const faces = [
		17448541918, 12145366, 25166274, 8329679, 162068415, 10907551, 2222771916, 391496223, 7074893, 15432080,
		8560971, 406001167, 7317765, 616381207,
	];
	const femaleFaces = [7046036136, 12064732367, 12361152003];
	const femaleHair = [
		"451220849",
		"2956239660",
		"7429019921",
		"7565118471",
		"6134532324",
		"9244095135",
		"9244097555",
		"7193448988",
		"9244148336",
		"7193455510",
		"9244150641",
	];
	const malehair = [
		"16630147",
		"5891039736",
		"4875445470",
		"6441556987",
		"63690008",
		"451221329",
		"376548738",
		"2956239660",
	];

	const shirtColors: Color3[] = [
		Color3.fromRGB(139, 69, 19), // Saddle Brown
		Color3.fromRGB(160, 82, 45), // Sienna
		Color3.fromRGB(205, 133, 63), // Peru
		Color3.fromRGB(222, 184, 135), // Burlywood
		Color3.fromRGB(245, 245, 220), // Beige Linen
		Color3.fromRGB(112, 128, 144), // Slate Gray
		Color3.fromRGB(119, 136, 153), // Light Slate
		Color3.fromRGB(47, 79, 79), // Dark Slate Gray
		Color3.fromRGB(255, 248, 220), // Cornsilk (soft cream)
		Color3.fromRGB(150, 111, 51), // Raw Umber
	];
	const pantColors: Color3[] = [
		Color3.fromRGB(54, 42, 28), // Leather Brown
		Color3.fromRGB(70, 53, 34), // Mudstone
		Color3.fromRGB(105, 89, 72), // Faded Earth
		Color3.fromRGB(80, 80, 80), // Charcoal Gray
		Color3.fromRGB(30, 30, 30), // Soot Black
		Color3.fromRGB(102, 51, 0), // Chestnut
		Color3.fromRGB(85, 107, 47), // Olive Drab
		Color3.fromRGB(89, 74, 60), // Bark
		Color3.fromRGB(67, 56, 47), // Ashen Clay
		Color3.fromRGB(153, 101, 21), // Golden Oak
	];

	const raceSkinTones = getRaceSkinTones(data.race);
	const skinColor = getRandomAssetFromListBasedOnSeed(raceSkinTones, seed());

	humanoidDescription.Head = 746767604;

	humanoidDescription.HeadColor = skinColor;
	humanoidDescription.LeftArmColor = skinColor;
	humanoidDescription.RightArmColor = skinColor;
	humanoidDescription.LeftLegColor = skinColor;
	humanoidDescription.RightLegColor = skinColor;
	humanoidDescription.TorsoColor = skinColor;

	humanoidDescription.Face = getRandomAssetFromListBasedOnSeed(data.gender === "F" ? femaleFaces : faces, seed());

	humanoidDescription.HairAccessory = getRandomAssetFromListBasedOnSeed(
		data.gender === "F" ? femaleHair : malehair,
		seed(),
	);
	if (data.position === "Merchant") {
		humanoidDescription.HatAccessory = "617605556";
		humanoidDescription.HairAccessory = "";
	}

	humanoidDescription.TorsoColor = getRandomAssetFromListBasedOnSeed(shirtColors, seed());
	humanoidDescription.RightArmColor = humanoidDescription.TorsoColor;
	humanoidDescription.LeftArmColor = humanoidDescription.TorsoColor;

	if (data.gender === "F") {
		//humanoidDescription.Shirt = 126515050129801;
	}

	humanoidDescription.RightLegColor = getRandomAssetFromListBasedOnSeed(pantColors, seed());
	humanoidDescription.LeftLegColor = humanoidDescription.RightLegColor;

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

export function setHumanoidDefaults(humanoid: Humanoid, seed: number, data: NPCData): Humanoid | undefined {
	humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None;
	const npcDescription = humanoid.GetAppliedDescription();
	if (!npcDescription) {
		log("Appearence unavalialbe for npc spawn", "ERROR");
		return undefined;
	}
	const rand = makeSeededRandom(seed);
	randomizeBodyShape(npcDescription, rand, data.race);
	const appearenceDescription = getGenericSeededAppearance(npcDescription, rand, data);

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
		Dwarf: {
			height: [0.8, 0.9],
			width: [1.05, 1.2],
			depth: [1.05, 1.2],
			head: [1.0, 1.15],
			bodyType: [0.6, 0.9],
			proportion: [0.4, 0.6],
		},
		Hobbit: {
			height: [0.7, 0.8],
			width: [0.9, 1.0],
			depth: [0.9, 1.0],
			head: [0.95, 1.1],
			bodyType: [0.3, 0.6],
			proportion: [0.45, 0.65],
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

export function addPromptToEndNpc(npc: Model, message: string) {
	const head = npc.FindFirstChild("Head") as BasePart;
	if (!head) return warn("No head for NPC");

	const prompt = new Instance("ProximityPrompt");
	prompt.Enabled = false;
	prompt.Name = "TalkPrompt";
	prompt.ObjectText = npc.Name;
	prompt.ActionText = "Talk";
	prompt.KeyboardKeyCode = Enum.KeyCode.E;
	prompt.HoldDuration = 0;
	prompt.RequiresLineOfSight = false;
	prompt.MaxActivationDistance = 10;
	prompt.Parent = head;

	// prompt.PromptShown.Connect(() => {
	// 	warn("GMMMM");
	// 	const player = game.GetService("Players").LocalPlayer;
	// 	if (player.GetAttribute("state") === undefined || player.GetAttribute("state") !== "warmingUp") {
	// 		prompt.Enabled = false;
	// 	}
	// 	prompt.Enabled = true;
	// });

	prompt.Triggered.Connect(async (player) => {
		warn(`${player.GetAttribute("state")} state`);
		murderNpcByPlayer(player, npc);

		npc.GetDescendants().forEach((descendant) => {
			if (descendant.IsA("JointInstance")) {
				descendant.Destroy();
			}
		});
		await Promise.delay(10);
		npc.Destroy();
	});
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
	} else {
		// warn("Pathfinding failed, noble Lord!");
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
