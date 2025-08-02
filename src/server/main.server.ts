// NNEDS: README for this
// FEATURE: Day night mode
// FEATURE: Routes having different speeds and behaviors
// FEATURE: Merchants
// FEATURE: UI Kill Book
// FEATURE: UI Wanted Poster
// FEATURE:

import { Workspace } from "@rbxts/services";
import { Assignment, MEDIEVAL_NPC_NAMES, MEDIEVAL_NPCS } from "shared/module";
import { log } from "shared/helpers";
import { createNPCModelAndGenerateHumanoid, NPC, assignNpcToRoute } from "shared/npc";

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

function updateAssignments(assigned: Map<string, Assignment>, activeNpcs: string[], testing = false) {
	const npcRoutes: Folder[] = getNPCRoutes();

	npcRoutes.forEach((npcRoute: Folder) => {
		if (!assigned.has(npcRoute.Name)) {
			try {
				const routePoints = npcRoute.GetChildren().filter((route) => route.Name === "Route") as Part[];
				if (routePoints.size() === 0) {
					throw "No routePoints avaliable under parent route folder";
				}
				const firstPositionInRoutePoints = routePoints[0];
				const closestSpawnPointRelativeToRoute =
					getClosestSpawnPointRelativeToRoute(firstPositionInRoutePoints); // TODO somethings up here
				if (!closestSpawnPointRelativeToRoute) {
					throw "Close spawnpoint not located";
				}
				const npcName = MEDIEVAL_NPC_NAMES[math.random(0, MEDIEVAL_NPC_NAMES.size() - 1)];
				if (!MEDIEVAL_NPCS[npcName]) {
					error(`Not able to frekin get das gendra ${npcName}`);
				}
				const npc: NPC | undefined = createNPCModelAndGenerateHumanoid(
					npcName,
					MEDIEVAL_NPCS[npcName].gender,
					MEDIEVAL_NPCS[npcName].position,
				);

				if (!npc) {
					error("Not able to create NPC");
				}

				npc.model.PivotTo(new CFrame(closestSpawnPointRelativeToRoute.Position));

				assignNpcToRoute(npc, closestSpawnPointRelativeToRoute.Position, routePoints);
				assigned.set(npcRoute.Name, { npc: npc.model, route: npcRoute });
				log(
					`⚜️ ${npc.model.Name} assigned to ${npcRoute.Name} spawned at ${closestSpawnPointRelativeToRoute.Name}`,
				);

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
	const assignedNPCs: string[] = [];

	task.spawn(() => {
		while (assignmentsActive) {
			updateAssignments(assignedRoutes, assignedNPCs);
			task.wait(5);
		}
	});
}
main();
