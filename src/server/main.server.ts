import { ReplicatedStorage, Workspace } from "@rbxts/services";
import { Assignment, isNPCType, MEDIEVAL_NPC_NAMES, MEDIEVAL_NPCS, NPCData, NPCModel, NPCType } from "shared/module";
import { log } from "shared/helpers";
import { NPC } from "shared/npc";

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
			return child.IsA("BasePart") && child.Name === "NPCSpawn";
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
	let nearestSpawn: BasePart = spawnPoints[0];
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
				log("Route Names for: " + npcRoute.Name);
				const routePoints = npcRoute.GetChildren().filter((route) => route.Name === "Route") as Part[];
				if (routePoints.size() === 0) {
					throw "No routePoints avaliable under parent route folder";
				}
				const startingRoutePosition = routePoints[0];
				const closestSpawnPointRelativeToRoute = getClosestSpawnPointRelativeToRoute(startingRoutePosition);
				if (!closestSpawnPointRelativeToRoute) {
					throw "Close spawnpoint not located";
				}
				let chosenNpc: NPCData | undefined = undefined;
				let chosenNpcName: string | undefined = undefined;
				const pickAvaliableNameForNPC = () => {
					const npcName = MEDIEVAL_NPC_NAMES[math.random(0, MEDIEVAL_NPC_NAMES.size())];
					if (!activeNpcs.includes(npcName)) {
						chosenNpc = MEDIEVAL_NPCS[npcName];
						chosenNpcName = npcName;
					} else {
						pickAvaliableNameForNPC();
					}
				};
				pickAvaliableNameForNPC();
				if (!chosenNpc || !chosenNpcName) {
					return;
				}
				const npc = new NPC(chosenNpcName, chosenNpc, closestSpawnPointRelativeToRoute.Position, routePoints);
				npc.model.AddTag("Targeted");
				assigned.set(npcRoute.Name, { npc: npc.model, route: npcRoute });
				log(`⚜️ ${npc.model.Name} assigned to ${npcRoute.Name}`);
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
