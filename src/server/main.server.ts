import { ReplicatedStorage, Workspace } from "@rbxts/services";
import { Assignment, isNPCType, MEDIEVAL_NAMES, NPCType } from "shared/module";
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

function spawnNPCAndReturnModel(spawnPoint: BasePart, routePoints: BasePart[], npcType: NPCType): Model {
	const npcTemplate = ReplicatedStorage.WaitForChild("NPC") as Model;

	const npc = new NPC(npcTemplate.Clone(), MEDIEVAL_NAMES[math.random(0, MEDIEVAL_NAMES.size())], npcType);
	npc.model.PivotTo(new CFrame(spawnPoint.Position));

	if (routePoints) {
		npc.patrol(routePoints);
	}
	return npc.model;
}

// function changeAnimationState(npc: Model, state: AnimationState) {
// 	const humanoid = npc.FindFirstChildOfClass("Humanoid");
// 	if (!humanoid) return;

// 	switch (state) {
// 		case AnimationState.WALK: {
// 			let animator = humanoid.FindFirstChildOfClass("Animator");
// 			if (!animator) {
// 				animator = new Instance("Animator");
// 				animator.Parent = humanoid;
// 			}
// 			const walkAnimation = new Instance("Animation");
// 			walkAnimation.Name = "Walk";
// 			walkAnimation.AnimationId = useAssetId("133708367021932");

// 			const track = animator.LoadAnimation(walkAnimation);
// 			track.Priority = Enum.AnimationPriority.Movement;
// 			track.Looped = true;
// 			track.Play();

// 			break;
// 		}
// 		case AnimationState.IDLE: {
// 			humanoid.ChangeState(Enum.HumanoidStateType.None);

// 			break;
// 		}
// 		default: {
// 			print("ERROR UNKNOWN ANIMATION STATE");
// 		}
// 	}
// }

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

function updateAssignments(assigned: Map<string, Assignment>) {
	const npcRoutes: Folder[] = getNPCRoutes();

	npcRoutes.forEach((npcRoute: Folder) => {
		if (!assigned.has(npcRoute.Name)) {
			try {
				const npcTypeAttribute = npcRoute.GetAttribute("NPCType") as string;
				const isNPC = isNPCType(npcTypeAttribute);
				const npcType: NPCType = isNPC ? npcTypeAttribute : "COMMONER";
				log("Route Names for: " + npcRoute.Name);
				const routePoints = npcRoute.GetChildren().filter((route) => route.Name === "Route") as Part[];
				if (routePoints.size() === 0) {
					throw "No routePoints avaliable under parent route folder";
				}
				const closestSpawnPointRelativeToRoute = getClosestSpawnPointRelativeToRoute(routePoints[0]);
				if (!closestSpawnPointRelativeToRoute) {
					throw "Close spawnpoint not located";
				}

				const npc = spawnNPCAndReturnModel(closestSpawnPointRelativeToRoute, routePoints, npcType);
				assigned.set(npcRoute.Name, { npc, route: npcRoute });
				npc.AddTag("Targeted");
				log(`⚜️ ${npc.Name} assigned to ${npcRoute.Name}`);
				npc.AncestryChanged.Connect((child, parent) => {
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
	const assigned: Map<string, Assignment> = new Map();

	task.spawn(() => {
		while (true) {
			updateAssignments(assigned);
			task.wait(5);
		}
	});
}

main();
