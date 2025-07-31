import { ReplicatedStorage, RunService, Workspace } from "@rbxts/services";
import { log } from "./helpers";
import { NPCData, NPCType, useAssetId } from "./module";
import { defaultPlayerStoreData, PLAYER_STORE_NAME, StoreData } from "shared/player-store";
import { PlayerDataService } from "./common-data-service";
import { PathfindingService } from "@rbxts/services";

export interface NPC {
	name: string;
	seed: number;
	rarity: Rarity;
	humanoid: Humanoid;
	// state: NPCStateKeys;
	// animationInstances: NPCStateRecord;
	model: Model;
}

export function createNPCModelAndGenerateHumanoid(name: string, rarity: Rarity): NPC | undefined {
	const npcTemplate = ReplicatedStorage.WaitForChild("NPC") as Model;
	const modelClone = npcTemplate.Clone();
	modelClone.Name = name;
	modelClone.Parent = Workspace;

	const humanoid = modelClone.FindFirstChildOfClass("Humanoid");
	if (!humanoid) return;
	const setHumanoid = setHumanoidDefaults(humanoid, getSeedFromName(name));
	if (!setHumanoid) return;

	return {
		name,
		seed: getSeedFromName(name),
		rarity,
		humanoid,
		model: modelClone,
	};
}

export function getGenericSeededAppearance(
	humanoidDescription: HumanoidDescription,
	seed: () => number,
): HumanoidDescription | undefined {
	const faces = [
		20418658, 12145366, 25166274, 8329679, 162068415, 10907551, 2222771916, 391496223, 7074893, 15432080, 8560971,
		406001167, 7317765, 616381207,
	];
	const hair = [
		"63690008",
		"16630147",
		"2956239660",
		"2956239660",
		"5891039736",
		"4875445470",
		"6441556987",
		"63690008",
		"451221329",
		"451220849",
		"376548738",
		"2956239660",
	];

	const hats = ["617605556", "3403874988", "607702162", "417457461", "48474313", "607700713"];
	const backs = ["98752422639730"];
	const legs = [398634487, 398635338, 382538503, 382537950];

	const torsos = [607785314, 398634295, 382537085, 382538059, 144076358];
	const waist = ["7957171682", "7074727236", "7074727585", "7074727897"];
	const pants = [398634487, 398635338, 382538503, 382537950];

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

	const skinIndex = math.floor(seed() * realisticSkinTones.size()) + 1;
	const skinColor: Color3 = realisticSkinTones[skinIndex - 1];

	humanoidDescription.Head = 746767604;

	humanoidDescription.HeadColor = skinColor;
	humanoidDescription.LeftArmColor = skinColor;
	humanoidDescription.RightArmColor = skinColor;
	humanoidDescription.LeftLegColor = skinColor;
	humanoidDescription.RightLegColor = skinColor;
	humanoidDescription.TorsoColor = skinColor;

	humanoidDescription.Face = getRandomAssetFromListBasedOnSeed(faces, seed());
	humanoidDescription.HairAccessory = getRandomAssetFromListBasedOnSeed(hair, seed());
	humanoidDescription.HatAccessory = getRandomAssetFromListBasedOnSeed(hats, seed());
	humanoidDescription.BackAccessory = getRandomAssetFromListBasedOnSeed(backs, seed());
	humanoidDescription.Torso = getRandomAssetFromListBasedOnSeed(torsos, seed());
	humanoidDescription.WaistAccessory = getRandomAssetFromListBasedOnSeed(waist, seed());
	humanoidDescription.Pants = getRandomAssetFromListBasedOnSeed(pants, seed());

	return humanoidDescription;
}

export function getRandomAssetFromListBasedOnSeed<T>(list: T[], seed: number): T {
	return list[math.floor(seed * list.size())];
}

export function setHumanoidDefaults(humanoid: Humanoid, seed: number): Humanoid | undefined {
	humanoid.WalkSpeed = 6;
	const npcDescription = humanoid.GetAppliedDescription();
	if (!npcDescription) {
		log("Appearence unavalialbe for npc spawn", "ERROR");
		return undefined;
	}
	const rand = makeSeededRandom(seed);
	randomizeBodyShape(npcDescription, rand);
	const appearenceDescription = getGenericSeededAppearance(npcDescription, rand);

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

export function addTalkPrompt(npc: Model, message: string) {
	const head = npc.FindFirstChild("Head") as BasePart;
	if (!head) return warn("No head for NPC");

	const prompt = new Instance("ProximityPrompt");
	prompt.Name = "TalkPrompt";
	prompt.ObjectText = npc.Name;
	prompt.ActionText = "Talk";
	prompt.KeyboardKeyCode = Enum.KeyCode.E;
	prompt.HoldDuration = 0;
	prompt.RequiresLineOfSight = false;
	prompt.MaxActivationDistance = 10;
	prompt.Parent = head;

	prompt.Triggered.Connect((player) => {
		const store = PlayerDataService.getInstance(PLAYER_STORE_NAME, defaultPlayerStoreData);
		store.updatePlayerData(player, (state: Partial<StoreData>) => {
			const currentTitles = state.eliminations ?? [];
			if (!currentTitles.includes(npc.Name)) {
				return {
					eliminations: [...currentTitles, npc.Name],
				};
			}
			return {};
		});
		npc.Destroy();
	});
}

export const patrolLoop = async (
	humanoid: Humanoid,
	startingPosition: Vector3,
	routePoints: BasePart[],
	activeRouteIndex = 0,
) => {
	if (activeRouteIndex >= routePoints.size() - 1) {
		activeRouteIndex = 0;
	} else {
		activeRouteIndex++;
	}
	await navigate(routePoints[activeRouteIndex].Position, startingPosition, humanoid);
	await Promise.delay(math.random(2, 5));
	patrolLoop(humanoid, startingPosition, routePoints, activeRouteIndex); // TODO idk about that activeRouteIndex
};

export async function navigate(goal: Vector3, startPosition: Vector3, humanoid: Humanoid): Promise<void> {
	const goalPosition = goal;

	const path = PathfindingService.CreatePath({
		AgentRadius: 2,
		AgentHeight: 5,
		AgentCanJump: true,
		AgentCanClimb: true,
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
				humanoid.MoveTo(startPosition); // Force MoveDirection = zero
				await waitForMove(humanoid);
				return;
			}

			const wp = waypoints[current];
			humanoid.MoveTo(wp.Position);
			await waitForMove(humanoid);

			if (wp.Action === Enum.PathWaypointAction.Jump) {
				humanoid.Jump = true;
			}
			await moveToNextWaypoint();
		};

		await moveToNextWaypoint();
	} else {
		warn("Pathfinding failed, noble Lord!");
	}
}

export function waitForMove(humanoid: Humanoid): Promise<void> {
	return new Promise((resolve) => {
		humanoid.MoveToFinished.Once(() => resolve());
	});
}

export type NPCStateKeys = "WALKING" | "IDLE";
export type Gender = "M" | "F";
export type Rarity = "Serf" | "Commoner" | "Merchant" | "Nobility" | "Royalty";
export type NPCStateRecord = Record<NPCStateKeys, AnimationTrack>;

// export class NPC {
// 	displayName: string;
// 	seed: number;
// 	humanoid!: Humanoid;
// 	type: NPCData;
// 	model!: Model;
// 	state: NPCStateKeys = "IDLE";
// 	patrolling = true;

// 	animationInstances!: NPCStateRecord;

// 	private previousState: NPCStateKeys | undefined = undefined;
// 	private activeRouteIndex = 0;

// 	constructor(name: string, npcType: NPCData, spawnPoint: Vector3, routePoints: BasePart[]) {
// 		const npcTemplate = ReplicatedStorage.WaitForChild("NPC") as Model;
// 		const modelClone = npcTemplate.Clone();

// 		modelClone.Name = name;
// 		this.type = npcType;
// 		this.displayName = name;
// 		this.seed = this.getSeedFromName(name);
// 		modelClone.Parent = Workspace;
// 		this.model = modelClone;
// 		this.model.PivotTo(new CFrame(spawnPoint));

// 		const humanoid = this.model.FindFirstChildOfClass("Humanoid");
// 		if (!humanoid) return;
// 		const setHumanoid = this.setHumanoidDefaults(humanoid);
// 		if (!setHumanoid) return;

// 		this.humanoid = setHumanoid;
// 		this.addTalkPrompt(this.model, "");

// 		const animator = this.humanoid.WaitForChild("Animator") as Animator;
// 		this.animationInstances = this.getAnimationTracks(animator);

// 		this.patrolLoop(routePoints);

// 		RunService.Heartbeat.Connect(() => {
// 			const currentTrack = this.animationInstances[this.state];
// 			const otherTrack = this.animationInstances[this.state === "IDLE" ? "WALKING" : "IDLE"]; // TODO WTF is this
// 			if (this.state !== this.previousState) {
// 				otherTrack.Stop();
// 				currentTrack.Play();
// 				this.previousState = this.state;
// 			}
// 		});
// 	}

// 	private patrolLoop = async (routePoints: BasePart[]) => {
// 		if (this.patrolling) {
// 			if (this.activeRouteIndex >= routePoints.size() - 1) {
// 				this.activeRouteIndex = 0;
// 			} else {
// 				this.activeRouteIndex++;
// 			}
// 			await this.navigate(routePoints[this.activeRouteIndex].Position);
// 			await Promise.delay(math.random(2, 5)); // Noble pause
// 			this.patrolLoop(routePoints); // Continue the loop
// 		}
// 	};

// 	private async navigate(goal: Vector3): Promise<void> {
// 		const startPosition = this.model.PrimaryPart!.Position;
// 		const goalPosition = goal;

// 		const path = PathfindingService.CreatePath({
// 			AgentRadius: 2,
// 			AgentHeight: 5,
// 			AgentCanJump: true,
// 			AgentCanClimb: true,
// 			Costs: {
// 				Water: 100,
// 			},
// 		});

// 		path.ComputeAsync(startPosition, goalPosition);

// 		if (path.Status === Enum.PathStatus.Success) {
// 			const waypoints = path.GetWaypoints();
// 			let current = 0;

// 			this.state = "WALKING";

// 			const moveToNextWaypoint = async () => {
// 				current++;
// 				if (current >= waypoints.size()) {
// 					this.state = "IDLE";
// 					this.humanoid.MoveTo(this.model.PrimaryPart!.Position); // Force MoveDirection = zero
// 					await this.waitForMove();
// 					return;
// 				}

// 				const wp = waypoints[current];
// 				this.humanoid.MoveTo(wp.Position);
// 				await this.waitForMove();

// 				if (wp.Action === Enum.PathWaypointAction.Jump) {
// 					this.humanoid.Jump = true;
// 				}
// 				await moveToNextWaypoint();
// 			};

// 			await moveToNextWaypoint();
// 		} else {
// 			warn("Pathfinding failed, noble Lord!");
// 		}
// 	}

// 	private waitForMove(): Promise<void> {
// 		return new Promise((resolve) => {
// 			this.humanoid.MoveToFinished.Once(() => resolve());
// 		});
// 	}

// 	public getRandomnessFromSeed() {
// 		return this.makeSeededRandom(this.seed);
// 	}

// 	private getAnimationTracks(animator: Animator): NPCStateRecord {
// 		const walkAnim = new Instance("Animation");
// 		walkAnim.Name = "Walking Animation";
// 		walkAnim.AnimationId = useAssetId("133708367021932");

// 		const idleAnim = new Instance("Animation");
// 		idleAnim.Name = "Idle Animation";
// 		idleAnim.AnimationId = useAssetId("507766951");

// 		const walkTrack = animator.LoadAnimation(walkAnim);
// 		walkTrack.Priority = Enum.AnimationPriority.Movement;
// 		walkTrack.Looped = true;

// 		const idleTrack = animator.LoadAnimation(idleAnim);
// 		idleTrack.Priority = Enum.AnimationPriority.Movement;
// 		idleTrack.Looped = true;

// 		return {
// 			WALKING: walkTrack,
// 			IDLE: idleTrack,
// 		};
// 	}

// 	private getGenericSeededAppearance(
// 		humanoidDescription: HumanoidDescription,
// 		seed: () => number,
// 	): HumanoidDescription | undefined {
// 		const faces = [
// 			20418658, 12145366, 25166274, 8329679, 162068415, 10907551, 2222771916, 391496223, 7074893, 15432080,
// 			8560971, 406001167, 7317765, 616381207,
// 		];
// 		const hair = [
// 			"63690008",
// 			"16630147",
// 			"2956239660",
// 			"2956239660",
// 			"5891039736",
// 			"4875445470",
// 			"6441556987",
// 			"63690008",
// 			"451221329",
// 			"451220849",
// 			"376548738",
// 			"2956239660",
// 		];

// 		const hats = ["617605556", "3403874988", "607702162", "417457461", "48474313", "607700713"];
// 		const backs = ["98752422639730"];
// 		const legs = [398634487, 398635338, 382538503, 382537950];

// 		const torsos = [607785314, 398634295, 382537085, 382538059, 144076358];
// 		const waist = ["7957171682", "7074727236", "7074727585", "7074727897"];
// 		const pants = [398634487, 398635338, 382538503, 382537950];

// 		const realisticSkinTones: Color3[] = [
// 			Color3.fromRGB(255, 224, 189), // Fair
// 			Color3.fromRGB(241, 194, 125), // Light
// 			Color3.fromRGB(224, 172, 105), // Light tan
// 			Color3.fromRGB(198, 134, 66), // Olive
// 			Color3.fromRGB(141, 85, 36), // Brown
// 			Color3.fromRGB(101, 67, 33), // Dark brown
// 			Color3.fromRGB(77, 51, 25), // Very dark
// 			Color3.fromRGB(232, 190, 172), // Rosy fair
// 			Color3.fromRGB(203, 144, 102), // Warm tan
// 			Color3.fromRGB(160, 114, 77), // Deep tan
// 		];

// 		const skinIndex = math.floor(seed() * realisticSkinTones.size()) + 1;
// 		const skinColor: Color3 = realisticSkinTones[skinIndex - 1];

// 		humanoidDescription.Head = 746767604;

// 		humanoidDescription.HeadColor = skinColor;
// 		humanoidDescription.LeftArmColor = skinColor;
// 		humanoidDescription.RightArmColor = skinColor;
// 		humanoidDescription.LeftLegColor = skinColor;
// 		humanoidDescription.RightLegColor = skinColor;
// 		humanoidDescription.TorsoColor = skinColor;

// 		humanoidDescription.Face = this.getRandomAssetFromListBasedOnSeed(faces, seed());
// 		humanoidDescription.HairAccessory = this.getRandomAssetFromListBasedOnSeed(hair, seed());
// 		humanoidDescription.HatAccessory = this.getRandomAssetFromListBasedOnSeed(hats, seed());
// 		humanoidDescription.BackAccessory = this.getRandomAssetFromListBasedOnSeed(backs, seed());
// 		humanoidDescription.Torso = this.getRandomAssetFromListBasedOnSeed(torsos, seed());
// 		humanoidDescription.WaistAccessory = this.getRandomAssetFromListBasedOnSeed(waist, seed());
// 		humanoidDescription.Pants = this.getRandomAssetFromListBasedOnSeed(pants, seed());

// 		return humanoidDescription;
// 	}

// 	private getRandomAssetFromListBasedOnSeed<T>(list: T[], seed: number): T {
// 		return list[math.floor(seed * list.size())];
// 	}

// 	private setHumanoidDefaults(humanoid: Humanoid): Humanoid | undefined {
// 		humanoid.WalkSpeed = 6;
// 		const npcDescription = humanoid.GetAppliedDescription();
// 		if (!npcDescription) {
// 			log("Appearence unavalialbe for npc spawn", "ERROR");
// 			return undefined;
// 		}
// 		const rand = this.makeSeededRandom(this.seed);
// 		this.randomizeBodyShape(npcDescription, rand);
// 		const appearenceDescription = this.getGenericSeededAppearance(npcDescription, rand);

// 		if (!appearenceDescription) return;
// 		humanoid.ApplyDescription(appearenceDescription);
// 		return humanoid;
// 	}

// 	private makeSeededRandom(seed: number): () => number {
// 		let currentSeed = seed;

// 		return () => {
// 			currentSeed = (currentSeed * 9301 + 49297) % 233280;
// 			return currentSeed / 233280;
// 		};
// 	}

// 	private getSeedFromName(name: string): number {
// 		if (!name) throw "No see was created with undefined name";

// 		let seed = 0;
// 		for (let i = 0; i < name.size(); i++) {
// 			const char = name.sub(i + 1, i + 1);
// 			const byte = string.byte(char) as unknown as number;
// 			seed += byte;
// 		}
// 		return seed;
// 	}

// 	private randomizeBodyShape(npcDescription: HumanoidDescription, seed: () => number) {
// 		npcDescription.BodyTypeScale = math.round(seed() * 100) / 100; // 0.0 to 1.0
// 		npcDescription.ProportionScale = math.round(seed() * 100) / 100;

// 		npcDescription.HeightScale = math.round((0.9 + seed() * 0.15) * 100) / 100; // 0.9 to 1.05
// 		npcDescription.WidthScale = math.round((0.9 + seed() * 0.15) * 100) / 100;
// 		npcDescription.DepthScale = math.round((0.9 + seed() * 0.15) * 100) / 100;

// 		npcDescription.HeadScale = math.round((0.8 + seed() * 0.4) * 100) / 100; // 0.8 to 1.2
// 	}

// 	private addTalkPrompt(npc: Model, message: string) {
// 		const head = npc.FindFirstChild("Head") as BasePart;
// 		if (!head) return warn("No head for NPC");

// 		const prompt = new Instance("ProximityPrompt");
// 		prompt.Name = "TalkPrompt";
// 		prompt.ObjectText = npc.Name;
// 		prompt.ActionText = "Talk";
// 		prompt.KeyboardKeyCode = Enum.KeyCode.E;
// 		prompt.HoldDuration = 0;
// 		prompt.RequiresLineOfSight = false;
// 		prompt.MaxActivationDistance = 10;
// 		prompt.Parent = head;

// 		prompt.Triggered.Connect((player) => {
// 			// if (!npc.GetTags().includes("Targeted")) {
// 			// 	return;
// 			// }
// 			const store = PlayerDataService.getInstance(PLAYER_STORE_NAME, defaultPlayerStoreData);
// 			store.updatePlayerData(player, (state: Partial<StoreData>) => {
// 				const currentTitles = state.eliminations ?? [];
// 				if (!currentTitles.includes(npc.Name)) {
// 					return {
// 						eliminations: [...currentTitles, npc.Name],
// 					};
// 				}
// 				return {};
// 			});
// 			npc.Destroy();
// 		});
// 	}
// }
