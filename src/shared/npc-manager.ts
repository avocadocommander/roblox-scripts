import { CollectionService, Players, Workspace } from "@rbxts/services";
import { bountyService, Bounty } from "./bounty";
import { getActiveNPCNames, log } from "./helpers";
import { Assignment, MEDIEVAL_NPC_NAMES, MEDIEVAL_NPCS } from "./module";
import { NPC, createNPCModelAndGenerateHumanoid, assignNpcToRoute } from "./npc";
import { requestAddView, requestRemoveView } from "./player-visiualization";
import { getBountyTarget } from "./player-state";

type DEATH_TYPE = {
	[key: string]: (npcTarget: NPC) => void;
};

export const DEATH_TYPES: DEATH_TYPE = {
	DEFAULT: (npcTarget: NPC) => {
		npcTarget.model.GetDescendants().forEach((descendant) => {
			if (descendant.IsA("JointInstance")) {
				descendant.Destroy();
			}
		});
		task.wait(5);
		npcTarget.model.Destroy();
	},
};

export function assassinateTarget(player: Player, npcTarget: NPC) {
	warn(`${player.Name} wanting to get that ${npcTarget.name}`);
	const currentPlayerbounty: string | undefined = getBountyTarget(player);

	if (npcTarget.name === currentPlayerbounty) {
		warn("Payday bois");
	} else {
		warn("Killing with no means i see");
	}
	setNpcDeath(npcTarget);
}

export function setNpcDeath(npc: NPC) {
	DEATH_TYPES["DEFAULT"](npc);
	warn(`💀 ${npc.name} was slain`);
}

export function addKillPrompt(npc: NPC) {
	const head = npc.model.FindFirstChild("Head") as BasePart;
	if (!head) return warn("No head for NPC");

	const prompt = new Instance("ProximityPrompt");
	prompt.Enabled = true;
	prompt.Name = "TalkPrompt";
	prompt.ObjectText = npc.model.Name;
	prompt.ActionText = "End";
	prompt.KeyboardKeyCode = Enum.KeyCode.E;
	prompt.HoldDuration = 0;
	prompt.RequiresLineOfSight = true;
	prompt.MaxActivationDistance = 10;
	prompt.Parent = head;

	prompt.Triggered.Connect(async (player) => {
		assassinateTarget(player, npc);
	});
}

const INSTANCES_FOR_NPC_VISION_TO_IGNORE = new Set<Instance>();

export type Pace = "Stationary" | "Slow" | "Medium" | "Fast";
export type Position = "Guard" | "Preacher";
export type Tempo = "Chill" | "Hurry" | "Gas";
export type RouteConfig = Partial<RouteConfiguration>;

interface RouteConfiguration {
	pace: Pace;
	position: Position;
	tempo: number;
}

export function getConfigFromRoute(routeConfigParent: Folder): RouteConfig | undefined {
	const routeConfig: RouteConfig = {};
	const configFromPart = routeConfigParent.FindFirstChild("Configuration") as Configuration;
	if (!configFromPart) {
		return undefined;
	}
	const pace = configFromPart.FindFirstChild("Pace") as StringValue;
	if (pace) {
		routeConfig.pace = pace.Value as Pace;
	}
	const npcType = configFromPart.FindFirstChild("NPCType") as StringValue;
	if (npcType) {
		routeConfig.position = npcType.Value as Position;
	}

	const tempo = configFromPart.FindFirstChild("Tempo") as StringValue;
	if (tempo) {
		const tempoMap: Record<Tempo, number> = {
			Chill: math.random(10, 60),
			Hurry: math.random(5, 10),
			Gas: math.random(1, 2),
		};
		routeConfig.tempo = tempoMap[tempo.Value as Tempo];
	}
	return routeConfig;
}

export function setupWatcherGaze(npc: NPC, routeData: RouteConfig | undefined) {
	const defaultDetectionRadius = 60;
	const guardDetectionRadius = defaultDetectionRadius * 2;
	const detectionRadius = routeData?.position === "Guard" ? guardDetectionRadius : defaultDetectionRadius;

	const viewAngle = 180;

	const humanoidRootPart = npc.model.FindFirstChild("HumanoidRootPart") as BasePart;
	if (!humanoidRootPart) return;

	const visibilityMap = new Map<Player, boolean>();

	task.spawn(() => {
		while (npc.model.Parent && npc.model.IsDescendantOf(Workspace)) {
			const npcLookDir = humanoidRootPart.CFrame.LookVector;

			for (const player of Players.GetPlayers()) {
				const currentPlayerIsAlreadyVisible: boolean = visibilityMap.get(player) ?? false;

				if (player.Character?.PrimaryPart?.Position) {
					const playerPart = player.Character?.PrimaryPart;

					let attachment1 = playerPart.FindFirstChild("VisionAttachment") as Attachment;
					if (!attachment1) {
						attachment1 = new Instance("Attachment");
						attachment1.Name = "VisionAttachment";
						attachment1.Parent = playerPart;
					}
					let attachment0 = humanoidRootPart.FindFirstChild("VisionAttachment") as Attachment;
					if (!attachment0) {
						attachment0 = new Instance("Attachment");
						attachment0.Name = "VisionAttachment";
						attachment0.Parent = humanoidRootPart;
					}

					const npcPosition = humanoidRootPart.Position;
					const playerPosition = player.Character?.PrimaryPart?.Position;

					const dirrectionToPlayer = playerPosition.sub(npcPosition).Unit;
					const distance = npcPosition.sub(playerPosition).Magnitude;
					const angle = math.acos(dirrectionToPlayer.Dot(npcLookDir)) * (180 / math.pi);

					const inRadius = distance <= detectionRadius / 2;
					const inView = angle <= viewAngle / 2;

					if (inRadius && inView) {
						const ray = createRaycast(npc.model, npcPosition, dirrectionToPlayer, distance);
						if (ray && ray.Instance) {
							const hitModel = ray.Instance.FindFirstAncestorOfClass("Model");
							const isPlayerHit = hitModel === player.Character;

							if (isPlayerHit) {
								if (!currentPlayerIsAlreadyVisible) {
									requestAddView(player, npc.model.Name);
								}
								//DEBUG
								// createVisionBeam(attachment0, attachment1);
								visibilityMap.set(player, true);
							} else {
								requestRemoveView(player, npc.model.Name);
							}
						}
					} else {
						if (currentPlayerIsAlreadyVisible) {
							requestRemoveView(player, npc.model.Name);
							visibilityMap.set(player, false);
						}
					}
				}
			}
			task.wait(0.4);
		}
	});
}

function createRaycast(npc: Model, npcPosition: Vector3, directionToPlayer: Vector3, distance: number) {
	const rayParams = new RaycastParams();
	rayParams.FilterType = Enum.RaycastFilterType.Exclude;
	const ignoreList: (Model | Instance)[] = [npc];
	for (const instanceToIgnore of INSTANCES_FOR_NPC_VISION_TO_IGNORE) {
		ignoreList.push(instanceToIgnore);
	}

	rayParams.FilterDescendantsInstances = ignoreList;
	rayParams.IgnoreWater = true;

	return Workspace.Raycast(npcPosition, directionToPlayer.mul(distance), rayParams);
}

function createVisionBeam(attachment0: Attachment, attachment1: Attachment): void {
	const beam = new Instance("Beam");
	beam.Name = `VisionBeam_${attachment0.Parent?.Name}_to_${attachment1.Parent?.Name}_${math.random()}`;

	beam.Attachment0 = attachment0;
	beam.Attachment1 = attachment1;
	beam.Color = new ColorSequence(Color3.fromHSV(math.random(), 1, 1));
	beam.Width0 = 0.1;
	beam.Width1 = 0.1;
	beam.FaceCamera = true;
	beam.LightInfluence = 0;

	beam.Parent = Workspace;

	task.delay(0.5, () => beam.Destroy());
}
