import { CollectionService, Workspace } from "@rbxts/services";
import { getActiveNPCNames, log } from "shared/helpers";
import { Assignment, MEDIEVAL_NPCS } from "shared/module";
import { NPC_REGISTRY, ROUTABLE_NPC_NAMES, FIXED_ROUTE_NPC_NAMES } from "shared/config/npcs";
import { assignNpcToRoute, createNPCModelAndGenerateHumanoid, NPC, setState } from "shared/npc/main";
import { getConfigFromRoute } from "shared/npc-manager";
import { getReservedMerchantNames } from "./merchant-handler";

// ──────────────────────────────────────────────────────────────────────────
// NPC Spawner
//
// Initial spawn (server start, before players join): every NPC is placed
// directly at the FIRST point of their assigned route.
//
// Respawn (after death): the NPC re-enters the world from the nearest
// NPCSpawnPoint attachment relative to the first route point.
// ──────────────────────────────────────────────────────────────────────────

const ROUTABLE_RESPAWN_DELAY = 5;
const FIXED_RESPAWN_DELAY = 30;

function getNPCSpawnPoints(): Attachment[] {
	const spawnPoints = CollectionService.GetTagged("NPCSpawnPoint").filter((spawnPoint): spawnPoint is Attachment => {
		return spawnPoint.IsA("Attachment");
	});

	if (spawnPoints.size() === 0) {
		warn("[NPC-SPAWNER] No spawn points tagged 'NPCSpawnPoint' found!");
		return [];
	}

	return spawnPoints;
}

function getClosestSpawnPointRelativeToRoute(firstRoutePointToCompare: BasePart): Attachment | undefined {
	if (!firstRoutePointToCompare) {
		log("[NPC-SPAWNER] No basepart used as first index", "ERROR");
		return undefined;
	}
	const spawnPoints = getNPCSpawnPoints();
	let nearestSpawn: Attachment | undefined = undefined;
	let shortestDistance = math.huge;

	spawnPoints.forEach((spawnPoint) => {
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
		.filter((child): child is Folder => child.IsA("Folder"));

	const updatedRoutes = CollectionService.GetTagged("Route").filter((child): child is Folder => {
		if (!child.IsA("Folder")) return false;
		// Skip routes that live inside a MerchantShop site -- those are managed by merchant-handler
		const parent = child.Parent;
		if (parent !== undefined && CollectionService.HasTag(parent, "MerchantShop")) return false;
		return true;
	});

	if (updatedRoutes.size() === 0) {
		warn("[NPC-SPAWNER] No routes found!");
		return [];
	}

	const routes: Folder[] = [...legacyRoutes, ...updatedRoutes];

	if (routes.size() === 0) {
		warn("[NPC-SPAWNER] No Routes found!");
		return [];
	}

	return routes;
}

/**
 * Resolve where an NPC should physically appear when entering the world.
 *  - isInitial = true  → first point of the route (server-start placement)
 *  - isInitial = false → nearest NPCSpawnPoint attachment (post-death respawn)
 */
function resolveSpawnPosition(firstRoutePoint: BasePart, isInitial: boolean): Vector3 | undefined {
	if (isInitial) {
		return firstRoutePoint.Position;
	}
	const closest = getClosestSpawnPointRelativeToRoute(firstRoutePoint);
	if (!closest) return undefined;
	return closest.WorldPosition;
}

function spawnForRoute(npcRoute: Folder, assigned: Map<string, Assignment>, isInitial: boolean) {
	if (assigned.has(npcRoute.Name)) return;

	try {
		const routePoints = npcRoute.GetChildren().filter((route) => route.Name === "Route") as Part[];
		if (routePoints.size() === 0) {
			throw "No routePoints available under parent route folder";
		}

		const routeConfig = getConfigFromRoute(npcRoute);
		const firstRoutePoint = routePoints[0];

		const spawnPosition = resolveSpawnPosition(firstRoutePoint, isInitial);
		if (!spawnPosition) {
			throw "Spawn position could not be resolved";
		}

		const takenNames: string[] = getActiveNPCNames(assigned);
		const reservedMerchants = getReservedMerchantNames();
		const avaliableNames = ROUTABLE_NPC_NAMES.filter(
			(name: string) => !takenNames.includes(name) && !reservedMerchants.has(name),
		);
		const npcName = avaliableNames[math.random(0, avaliableNames.size() - 1)];

		if (!npcName) {
			throw `NPC name is invalid: ${npcName}`;
		}

		// Guards are always Commoners regardless of their name's status
		const npcData = { ...MEDIEVAL_NPCS[npcName] };
		if (routeConfig?.position === "Guard") {
			npcData.status = "Commoner";
		}

		const npc: NPC | undefined = createNPCModelAndGenerateHumanoid(npcName, npcData, routeConfig);

		if (!npc) {
			throw "Not able to create NPC";
		}

		npc.model.PivotTo(new CFrame(spawnPosition));

		assignNpcToRoute(npc, routePoints, routeConfig, setState);

		assigned.set(npcRoute.Name, { npc, route: npcRoute });
		log(
			`[NPC-SPAWNER] ${npc.name} assigned to ${npcRoute.Name} (${
				isInitial ? "initial @ first route point" : "respawn @ nearest spawner"
			})`,
		);

		npc.model.AncestryChanged.Connect((child, parent) => {
			if (!parent) {
				log(`[DEATH] ${child.Name} was removed from this life and from ${npcRoute.Name}`);
				assigned.delete(npcRoute.Name);

				task.delay(ROUTABLE_RESPAWN_DELAY, () => {
					spawnForRoute(npcRoute, assigned, false);
				});
			}
		});
	} catch (error) {
		log(`[NPC-SPAWNER] Spawn failed for NPC: ${error as string}`, "ERROR");
	}
}

function spawnFixedRouteNPC(npcName: string, npcRoute: Folder, assigned: Map<string, Assignment>, isInitial: boolean) {
	if (assigned.has(npcRoute.Name)) return;

	try {
		const routePoints = npcRoute.GetChildren().filter((route) => route.Name === "Route") as Part[];
		if (routePoints.size() === 0) {
			throw `No routePoints under route folder ${npcRoute.Name}`;
		}

		const routeConfig = getConfigFromRoute(npcRoute);

		const npcDef = NPC_REGISTRY[npcName];
		if (!npcDef) throw `NPC ${npcName} not found in registry`;

		const npcData = { gender: npcDef.gender, race: npcDef.race, status: npcDef.socialClass };

		const npc: NPC | undefined = createNPCModelAndGenerateHumanoid(npcName, npcData, routeConfig);
		if (!npc) throw `Not able to create NPC ${npcName}`;

		const firstRoutePoint = routePoints[0];
		const spawnPosition = resolveSpawnPosition(firstRoutePoint, isInitial);
		if (!spawnPosition) {
			throw `Spawn position could not be resolved for ${npcName}`;
		}

		npc.model.PivotTo(new CFrame(spawnPosition));

		assignNpcToRoute(npc, routePoints, routeConfig, setState);

		assigned.set(npcRoute.Name, { npc, route: npcRoute });
		log(
			`[FIXED] ${npc.name} spawned at route ${npcRoute.Name} (killable=${npcDef.killable}, ${
				isInitial ? "initial @ first route point" : "respawn @ nearest spawner"
			})`,
		);

		// Respawn fixed-route / merchant NPCs after 30 s when killed -- from nearest spawner
		npc.model.AncestryChanged.Connect((child, parent) => {
			if (!parent) {
				log(`[DEATH] ${child.Name} (fixed-route) was removed from ${npcRoute.Name} -- respawn in 30s`);
				assigned.delete(npcRoute.Name);

				task.delay(FIXED_RESPAWN_DELAY, () => {
					spawnFixedRouteNPC(npcName, npcRoute, assigned, false);
				});
			}
		});
	} catch (error) {
		log(`[FIXED] Spawn failed for ${npcName} on ${npcRoute.Name}: ${error as string}`, "ERROR");
	}
}

/**
 * Synchronously spawn every initial NPC at the FIRST point of their route.
 *
 * MUST be called from the server bootstrap BEFORE setServerStatus(true) so
 * the world is fully populated before any player is allowed in.
 *
 * Death/respawn callbacks installed here will use the nearest NPCSpawnPoint.
 */
export function initializeNpcSpawner(): void {
	print("[NPC-SPAWNER] Initial spawn started");
	const assigned: Map<string, Assignment> = new Map();
	const npcRoutes = getNPCRoutes();
	const routesByName = new Map<string, Folder>();
	for (const route of npcRoutes) {
		routesByName.set(route.Name, route);
	}

	// ── Phase 1: Spawn fixed-route NPCs first
	for (const npcName of FIXED_ROUTE_NPC_NAMES) {
		const def = NPC_REGISTRY[npcName];
		if (!def || !def.fixedRouteId) continue;
		const route = routesByName.get(def.fixedRouteId);
		if (!route) {
			log(`[NPC-SPAWNER] Fixed route "${def.fixedRouteId}" not found for NPC ${npcName}`, "WARN");
			continue;
		}
		spawnFixedRouteNPC(npcName, route, assigned, true);
	}

	// ── Phase 2: Spawn random routable NPCs on remaining routes
	const remainingRoutes = npcRoutes.filter((r) => !assigned.has(r.Name));

	if (remainingRoutes.size() > ROUTABLE_NPC_NAMES.size()) {
		log(
			`[NPC-SPAWNER] Route Size: ${remainingRoutes.size()} > Routable NPC amount: ${ROUTABLE_NPC_NAMES.size()}`,
			"ERROR",
		);
	}
	print(
		`[NPC-SPAWNER] Routes: ${npcRoutes.size()} (${assigned.size()} fixed, ${remainingRoutes.size()} remaining) | Routable NPCs: ${ROUTABLE_NPC_NAMES.size()}`,
	);

	remainingRoutes.forEach((npcRoute) => {
		try {
			spawnForRoute(npcRoute, assigned, true);
		} catch (err) {
			log(`[NPC-SPAWNER] Spawn failed for NPC: ${err as string}`, "ERROR");
		}
	});

	print(`[NPC-SPAWNER] Initial spawn complete (${assigned.size()} NPCs placed)`);
}
