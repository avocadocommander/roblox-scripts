import { CollectionService, Lighting, Workspace } from "@rbxts/services";
import { getActiveNPCNames, log } from "shared/helpers";
import { Assignment, MEDIEVAL_NPC_NAMES, MEDIEVAL_NPCS } from "shared/module";
import { assignNpcToRoute, createNPCModelAndGenerateHumanoid, NPC, setState } from "shared/npc/main";
import { getConfigFromRoute, setupWatcherGaze } from "shared/npc-manager";
import { serverIsReady } from "./server-status";
import "shared/player-state"; // Ensure DataStore listeners are registered at server start
import "./bootstrap"; // Load and initialize server bootstrap

const time = 20.45;
Lighting.ClockTime = time;

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

function getNPCRoutes(): Folder[] {
	const legacyRoutes = Workspace.WaitForChild("NPCRoutes")
		.GetChildren()
		.filter((child): child is Folder => {
			return child.IsA("Folder");
		});

	const updatedRoutes = CollectionService.GetTagged("Route").filter((child): child is Folder => {
		return child.IsA("Folder");
	});

	if (updatedRoutes.size() === 0) {
		warn("⚠️ No new routes found dog!");
		return [];
	}

	const routes: Folder[] = [...legacyRoutes, ...updatedRoutes];

	if (routes.size() === 0) {
		warn("⚠️ No Routes found!");
		return [];
	}

	return routes;
}

function spawnForRoute(npcRoute: Folder, assigned: Map<string, Assignment>) {
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
				throw `NPC name is invalid: ${npcName}`;
			}

			// Guards are always Commoners regardless of their name's status
			const npcData = { ...MEDIEVAL_NPCS[npcName] };
			if (routeConfig?.position === "Guard") {
				npcData.status = "Commoner";
			}

			const npc: NPC | undefined = createNPCModelAndGenerateHumanoid(
				npcName,
				npcData,
				routeConfig,
			);

			if (!npc) {
				throw "Not able to create NPC";
			}

			const npcSpawnPoint: Vector3 = closestSpawnPointRelativeToRoute.WorldPosition;
			// Assassination prompts are now handled client-side in custom UI system

			npc.model.PivotTo(new CFrame(npcSpawnPoint));

			assignNpcToRoute(npc, routePoints, routeConfig, setState);
			setupWatcherGaze(npc, routeConfig);

			assigned.set(npcRoute.Name, { npc, route: npcRoute });
			log(`${npc.name} assigned to ${npcRoute.Name} spawned at ${closestSpawnPointRelativeToRoute.Name}`);

			// bountyService.onBountyChanged((bounty: Bounty | undefined) => {
			// 	if (bounty && bounty.npc === npc) {
			// 		npc.humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.Viewer;
			// 	}
			// });
			npc.model.AncestryChanged.Connect((child, parent) => {
				if (!parent) {
					log(`💀 ${child.Name} was removed from this life and from ${npcRoute.Name}`);
					assigned.delete(npcRoute.Name);

					task.delay(5, () => {
						spawnForRoute(npcRoute, assigned);
					});
				}
			});
		} catch (error) {
			log(`Spawn failed for NPC: ${error as string}`, "ERROR");
		}
	}
}

function coreGameLoop() {
	while (!serverIsReady()) {
		task.wait();
	}
	print("[CORE LOOP] Started");
	const assigned: Map<string, Assignment> = new Map();
	const npcRoutes = getNPCRoutes();

	if (npcRoutes.size() > [...MEDIEVAL_NPC_NAMES].size()) {
		log(`[CORE LOOP] Route Size: ${npcRoutes.size()} > NPC amount: ${[...MEDIEVAL_NPC_NAMES].size()}`, "ERROR");
	}
	print(`[CORE LOOP] Initial Route Size: ${npcRoutes.size()} | NPC amount: ${[...MEDIEVAL_NPC_NAMES].size()}`);

	npcRoutes.forEach((npcRoute) => {
		try {
			spawnForRoute(npcRoute, assigned);
		} catch (err) {
			log(`[CORE LOOP] Spawn failed for NPC: ${err as string}`, "ERROR");
		}
	});
}

task.spawn(() => {
	coreGameLoop();
});
