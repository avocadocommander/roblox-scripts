import { ReplicatedStorage, Workspace } from "@rbxts/services";
import { log } from "../helpers";
import { NPCData, Race, useAssetId } from "../module";
import { RouteConfig } from "../npc-manager";
import { getHumanoidPace, assignNpcToRoute, navigate } from "./movement";
import { getGenericSeededAppearance, setHumanoidDefaults } from "./appearance";
import { makeSeededRandom, getSeedFromName } from "./utils";

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

export function createNPCModelAndGenerateHumanoid(
	name: string,
	data: NPCData,
	routeData: RouteConfig | undefined,
): NPC | undefined {
	const npcTemplate = ReplicatedStorage.WaitForChild("NPC") as Model;
	const modelClone = npcTemplate.Clone();
	modelClone.Name = name;

	modelClone.Parent = Workspace;

	const humanoid = modelClone.FindFirstChildOfClass("Humanoid");
	if (!humanoid) return;
	humanoid.SetStateEnabled(Enum.HumanoidStateType.Climbing, false);
	setHumanoidDefaults(humanoid, getSeedFromName(name), data, routeData);
	humanoid.WalkSpeed = getHumanoidPace(routeData?.pace);

	const animator = humanoid.FindFirstChildOfClass("Animator");
	if (!animator) {
		log("[NPC] No Animator found on " + name + ", skipping animations");
		return undefined;
	}
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

export function setState(newState: NPCStateKeys, npc: NPC) {
	if (npc.state === newState) return;
	npc.animationInstances[npc.state].Stop();
	npc.state = newState;
	npc.animationInstances[npc.state].Play();
}

export { assignNpcToRoute, navigate };

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
