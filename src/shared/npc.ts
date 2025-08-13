import { ReplicatedStorage, Workspace } from "@rbxts/services";
import { log } from "./helpers";
import { Position, RoutePace, useAssetId } from "./module";
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
}

export function createNPCModelAndGenerateHumanoid(
	name: string,
	gender: Gender,
	position: Position,
	pace: RoutePace,
): NPC | undefined {
	const npcTemplate = ReplicatedStorage.WaitForChild("NPC") as Model;
	const modelClone = npcTemplate.Clone();
	modelClone.Name = name;

	modelClone.Parent = Workspace;

	const humanoid = modelClone.FindFirstChildOfClass("Humanoid");
	if (!humanoid) return;
	setHumanoidDefaults(humanoid, getSeedFromName(name), gender, position);
	setHumanoidPace(humanoid, pace);
	addPromptToEndNpc(modelClone, "");

	const animator = humanoid.WaitForChild("Animator") as Animator;
	const animationInstances = getAnimationTracks(animator);

	return {
		name,
		seed: getSeedFromName(name),
		rarity: position,
		humanoid,
		model: modelClone,
		state: "IDLE",
		previousState: "IDLE",
		animationInstances,
	};
}

export function getGenericSeededAppearance(
	humanoidDescription: HumanoidDescription,
	seed: () => number,
	gender: Gender,
	position: Position,
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

	// const hats = ["617605556", "3403874988", "607702162", "417457461", "48474313", "607700713"];
	// const backs = ["98752422639730"];
	// const legs = [398634487, 398635338, 382538503, 382537950];

	// const torsos = [607785314, 398634295, 382537085, 382538059, 144076358];
	// const waist = ["7957171682", "7074727236", "7074727585", "7074727897"];
	// const pants = [398634487, 398635338, 382538503, 382537950];

	const realisticSkinTones: Color3[] = [
		Color3.fromRGB(255, 224, 189), // Fair
		Color3.fromRGB(241, 194, 125), // Light
		Color3.fromRGB(224, 172, 105), // Light tan
		Color3.fromRGB(198, 134, 66), // Olive
		Color3.fromRGB(141, 85, 36), // Brown
		Color3.fromRGB(101, 67, 33), // Dark brown
		Color3.fromRGB(77, 51, 25), // Very dark
		Color3.fromRGB(232, 190, 172), // Rosy fair
		Color3.fromRGB(203, 144, 102), // Warm tan
		Color3.fromRGB(160, 114, 77), // Deep tan
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

	const skinIndex = math.floor(seed() * realisticSkinTones.size()) + 1;
	const skinColor: Color3 = realisticSkinTones[skinIndex - 1];

	humanoidDescription.Head = 746767604;

	humanoidDescription.HeadColor = skinColor;
	humanoidDescription.LeftArmColor = skinColor;
	humanoidDescription.RightArmColor = skinColor;
	humanoidDescription.LeftLegColor = skinColor;
	humanoidDescription.RightLegColor = skinColor;
	humanoidDescription.TorsoColor = skinColor;

	humanoidDescription.Face = getRandomAssetFromListBasedOnSeed(gender === "F" ? femaleFaces : faces, seed());

	humanoidDescription.HairAccessory = getRandomAssetFromListBasedOnSeed(
		gender === "F" ? femaleHair : malehair,
		seed(),
	);
	if (position === "Merchant") {
		humanoidDescription.HatAccessory = "617605556";
		humanoidDescription.HairAccessory = "";
	}

	humanoidDescription.TorsoColor = getRandomAssetFromListBasedOnSeed(shirtColors, seed());
	humanoidDescription.RightArmColor = humanoidDescription.TorsoColor;
	humanoidDescription.LeftArmColor = humanoidDescription.TorsoColor;

	if (gender === "F") {
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

export function setHumanoidDefaults(
	humanoid: Humanoid,
	seed: number,
	gender: Gender,
	position: Position,
): Humanoid | undefined {
	humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None;
	const npcDescription = humanoid.GetAppliedDescription();
	if (!npcDescription) {
		log("Appearence unavalialbe for npc spawn", "ERROR");
		return undefined;
	}
	const rand = makeSeededRandom(seed);
	randomizeBodyShape(npcDescription, rand);
	const appearenceDescription = getGenericSeededAppearance(npcDescription, rand, gender, position);

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

export function randomizeBodyShape(npcDescription: HumanoidDescription, seed: () => number) {
	npcDescription.BodyTypeScale = math.round(seed() * 100) / 100; // 0.0 to 1.0
	npcDescription.ProportionScale = math.round(seed() * 100) / 100;

	npcDescription.HeightScale = math.round((0.9 + seed() * 0.15) * 100) / 100; // 0.9 to 1.05
	npcDescription.WidthScale = math.round((0.9 + seed() * 0.15) * 100) / 100;
	npcDescription.DepthScale = math.round((0.9 + seed() * 0.15) * 100) / 100;

	npcDescription.HeadScale = math.round((0.8 + seed() * 0.4) * 100) / 100; // 0.8 to 1.2
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
