import { CollectionService, Players, Workspace } from "@rbxts/services";
import { bountyService, Bounty } from "./bounty";
import { getActiveNPCNames, log } from "./helpers";
import { Assignment, MEDIEVAL_NPC_NAMES, MEDIEVAL_NPCS } from "./module";
import { NPC, createNPCModelAndGenerateHumanoid, assignNpcToRoute } from "./npc";
import { assassinateTarget } from "./bounty-manager";
import { requestAddView, requestRemoveView } from "./player-visiualization";
import { getConfigFromRoute, RouteConfig } from "./route-config";

function getNPCRoutes(): Folder[] {
	const routes = Workspace.WaitForChild("NPCRoutes")
		.GetChildren()
		.filter((child): child is Folder => {
			return child.IsA("Folder");
		});

	if (routes.size() === 0) {
		warn("⚠️ No Routes found!");
		return [];
	}

	return routes;
}

function getNPCSpawnPoints(): Attachment[] {
	const spawnPoints = CollectionService.GetTagged("NPCSpawnPoint").filter((spawnPoint): spawnPoint is Attachment => {
		return spawnPoint.IsA("Attachment");
	});

	if (spawnPoints.size() === 0) {
		warn("⚠️ No spawn points named 'NPCSpawn' found!");
		return [];
	}

	return spawnPoints;
}

function getClosestSpawnPointRelativeToRoute(firstRoutePointToCompare: BasePart): Attachment | undefined {
	if (!firstRoutePointToCompare) {
		log("No basepart used as fist index", "ERROR");
		return undefined;
	}
	const spawnPoints: Attachment[] = getNPCSpawnPoints();
	let nearestSpawn: Attachment | undefined = undefined;
	let shortestDistance = math.huge;

	spawnPoints.forEach((spawnPoint: Attachment) => {
		const distance = spawnPoint.WorldPosition.sub(firstRoutePointToCompare.Position).Magnitude;
		if (distance < shortestDistance) {
			shortestDistance = distance;
			nearestSpawn = spawnPoint;
		}
	});

	return nearestSpawn;
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

export function updateAssignments(assigned: Map<string, Assignment>) {
	const npcRoutes: Folder[] = getNPCRoutes();

	if (npcRoutes.size() > [...MEDIEVAL_NPC_NAMES].size()) {
		error(`Route Size: ${npcRoutes.size()} > NPC amount: ${[...MEDIEVAL_NPC_NAMES].size()}`);
	}
	print(`Route Size: ${npcRoutes.size()} | NPC amount: ${[...MEDIEVAL_NPC_NAMES].size()}`);

	npcRoutes.forEach((npcRoute: Folder) => {
		if (!assigned.has(npcRoute.Name)) {
			try {
				const routePoints = npcRoute.GetChildren().filter((route) => route.Name === "Route") as Part[];
				if (routePoints.size() === 0) {
					throw "No routePoints avaliable under parent route folder";
				}

				const routeConfig = getConfigFromRoute(npcRoute);

				const firstPositionInRoutePoints = routePoints[0];
				const closestSpawnPointRelativeToRoute: Attachment | undefined =
					getClosestSpawnPointRelativeToRoute(firstPositionInRoutePoints);
				if (!closestSpawnPointRelativeToRoute) {
					throw "Close spawnpoint not located";
				}

				const takenNames: string[] = getActiveNPCNames(assigned);
				const avaliableNames = MEDIEVAL_NPC_NAMES.filter((name: string) => !takenNames.includes(name));
				const npcName = avaliableNames[math.random(0, avaliableNames.size() - 1)];

				if (!npcName) {
					error(`${npcName} name is bad`);
				}
				const npc: NPC | undefined = createNPCModelAndGenerateHumanoid(
					npcName,
					MEDIEVAL_NPCS[npcName],
					routeConfig,
				);

				if (!npc) {
					error("Not able to create NPC");
				}

				const npcSpawnPoint: Vector3 = closestSpawnPointRelativeToRoute.WorldPosition;
				addKillPrompt(npc);
				setupWatcherGaze(npc, routeConfig);

				npc.model.PivotTo(new CFrame(npcSpawnPoint));

				assignNpcToRoute(npc, routePoints);

				assigned.set(npcRoute.Name, { npc, route: npcRoute });
				log(`⚜️ ${npc.name} assigned to ${npcRoute.Name} spawned at ${closestSpawnPointRelativeToRoute.Name}`);

				bountyService.onBountyChanged((bounty: Bounty | undefined) => {
					if (bounty && bounty.npc === npc) {
						npc.humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.Viewer;
					}
				});
				npc.model.AncestryChanged.Connect((child, parent) => {
					if (!parent) {
						log(`💀 ${child.Name} was removed from this life and from ${npcRoute.Name}`);
						assigned.delete(npcRoute.Name);
					}
				});
			} catch (error) {
				log(`Spawn failed for NPC: ${error as string}`, "ERROR");
			}
		}
	});
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
								//DEBUG createVisionBeam(attachment0, attachment1);
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
