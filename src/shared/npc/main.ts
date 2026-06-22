import { ReplicatedStorage } from "@rbxts/services";
import { getNPCFolder, log } from "../helpers";
import { NPCData, Race, useAssetId } from "../module";
import { getRoutePace, getRouteRole } from "../npc-manager";
import { getHumanoidPace, assignNpcToRoute, navigate } from "./movement";
import { getGenericSeededAppearance, setHumanoidDefaults } from "./appearance";
import { makeSeededRandom, getSeedFromName } from "./utils";
import { isNPCKillable } from "../config/npcs";
import { getNPCAnimationSelection } from "../config/npc-animations";

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
	routeFolder: Folder | undefined,
): NPC | undefined {
	const npcTemplate = ReplicatedStorage.WaitForChild("NPC") as Model;
	const modelClone = npcTemplate.Clone();
	modelClone.Name = name;
	modelClone.SetAttribute("NPCName", name);
	modelClone.SetAttribute("Killable", isNPCKillable(name));
	modelClone.Parent = getNPCFolder();

	const humanoid = modelClone.FindFirstChildOfClass("Humanoid");
	if (!humanoid) return;
	humanoid.SetStateEnabled(Enum.HumanoidStateType.Climbing, false);
	setHumanoidDefaults(humanoid, getSeedFromName(name), data, routeFolder);
	humanoid.WalkSpeed = getHumanoidPace(getRoutePace(routeFolder));

	const animator = humanoid.FindFirstChildOfClass("Animator");
	if (!animator) {
		log("[NPC] No Animator found on " + name + ", skipping animations");
		return undefined;
	}
	const seed = getSeedFromName(name);
	const animationSelection = getNPCAnimationSelection(data.race, seed, getRouteRole(routeFolder));
	const animationInstances = getAnimationTracks(animator, animationSelection.walk, animationSelection.idle);
	modelClone.SetAttribute("WalkAnimationId", animationSelection.walk);
	modelClone.SetAttribute("IdleAnimationId", animationSelection.idle);
	animationInstances.IDLE.Play();

	return {
		name,
		race: data.race,
		seed,
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

export function getAnimationTracks(
	animator: Animator,
	walkAnimationId = "133708367021932",
	idleAnimationId = "507766951",
): NPCStateRecord {
	const walkAnim = new Instance("Animation");
	walkAnim.Name = "Walking Animation";
	walkAnim.AnimationId = useAssetId(walkAnimationId);

	const idleAnim = new Instance("Animation");
	idleAnim.Name = "Idle Animation";
	idleAnim.AnimationId = useAssetId(idleAnimationId);

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
