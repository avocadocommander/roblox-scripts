import { Workspace } from "@rbxts/services";
import { Assignment, MEDIEVAL_NPC_NAMES, MEDIEVAL_NPCS, MedievalNPCName, RoutePace } from "shared/module";
import { getActiveNPCNames, log } from "shared/helpers";
import { createNPCModelAndGenerateHumanoid, NPC, assignNpcToRoute } from "shared/npc";
import { bountyService } from "shared/bounty";

export const enum AnimationState {
	WALK = "WALK",
	IDLE = "IDLE",
}

export enum NPCState {
	Idle,
	Patrol,
	Alert,
	Talk,
	Stunned,
	Dead,
}

function getNPCSpawnPoints(): BasePart[] {
	const spawnPoints = Workspace.WaitForChild("NPCSpawnPoints")
		.GetChildren()
		.filter((child): child is BasePart => {
			return child.IsA("BasePart");
		});

	if (spawnPoints.size() === 0) {
		warn("⚠️ No spawn points named 'NPCSpawn' found!");
		return [];
	}

	return spawnPoints;
}

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

function getClosestSpawnPointRelativeToRoute(firstRoutePointToCompare: BasePart): BasePart | undefined {
	if (!firstRoutePointToCompare) {
		log("No basepart used as fist index", "ERROR");
		return undefined;
	}
	const spawnPoints = getNPCSpawnPoints();
	let nearestSpawn: BasePart | undefined = undefined;
	let shortestDistance = math.huge;

	spawnPoints.forEach((spawnPoint: BasePart) => {
		const distance = spawnPoint.Position.sub(firstRoutePointToCompare.Position).Magnitude;
		if (distance < shortestDistance) {
			shortestDistance = distance;
			nearestSpawn = spawnPoint;
		}
	});
	return nearestSpawn;
}

function updateAssignments(assigned: Map<string, Assignment>) {
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
				const routePace: RoutePace = (npcRoute.GetAttribute("Pace") as RoutePace) ?? "Medium";
				const firstPositionInRoutePoints = routePoints[0];
				const closestSpawnPointRelativeToRoute =
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
					MEDIEVAL_NPCS[npcName].gender,
					MEDIEVAL_NPCS[npcName].position,
					routePace,
				);

				if (!npc) {
					error("Not able to create NPC");
				}

				npc.model.PivotTo(new CFrame(closestSpawnPointRelativeToRoute.Position)); // Spawn
				assignNpcToRoute(npc, closestSpawnPointRelativeToRoute.Position, routePoints);
				assigned.set(npcRoute.Name, { npc, route: npcRoute });
				log(`⚜️ ${npc.name} assigned to ${npcRoute.Name} spawned at ${closestSpawnPointRelativeToRoute.Name}`);

				bountyService.onBountyChanged((bounty: NPC | undefined) => {
					if (bounty && bounty === npc) {
						npc.humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.Viewer;
					}
				});
				npc.model.AncestryChanged.Connect((child, parent) => {
					if (!parent) {
						log(`💀 ${child.Name} was removed from this life and from ${npcRoute.Name}`);
						assigned.delete(npcRoute.Name);
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

async function main() {
	const assignmentsActive: boolean = true;
	const assignedRoutes: Map<string, Assignment> = new Map();

	task.spawn(() => {
		while (assignmentsActive) {
			updateAssignments(assignedRoutes);
			task.wait(5);
		}
	});

	task.spawn(() => {
		while (assignmentsActive) {
			task.wait(10);

			updateBounty(assignedRoutes);
		}
	});
}
export function updateBounty(assignedRoutes: Map<string, Assignment>) {
	const activeNPCs = getActiveNPCNames(assignedRoutes);
	const randomNPCTarget = activeNPCs[math.random(0, activeNPCs.size() - 1)];
	let npc: NPC | undefined = undefined;
	assignedRoutes.forEach((route) => {
		if (route.npc.name === randomNPCTarget) {
			npc = route.npc;
		}
	});
	if (npc) {
		bountyService.setBountyOnNPC(npc);
	}
}
main();
