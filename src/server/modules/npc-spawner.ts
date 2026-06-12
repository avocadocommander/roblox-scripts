import { CollectionService, Workspace } from "@rbxts/services";
import { getActiveNPCNames, log } from "shared/helpers";
import { Assignment, MEDIEVAL_NPCS } from "shared/module";
import { NPC_REGISTRY, ROUTABLE_NPC_NAMES, SocialClass, Race } from "shared/config/npcs";
import { assignNpcToRoute, createNPCModelAndGenerateHumanoid, NPC, setState } from "shared/npc/main";
import { getRouteEnchantment, getRouteRole, RouteRole } from "shared/npc-manager";
import { getReservedMerchantNames } from "./merchant-handler";
import {
	applyHeldWeaponVisualToCharacter,
	applySheathedWeaponVisualToCharacter,
	ensureCharacterWeaponAnchors,
} from "./weapon-visual-handler";
import { applyEnchantmentVisualToCharacter } from "./enchantment-visual-handler";

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

// Module-scoped so other systems (e.g. bounty-manager) can query which NPCs
// are currently alive in the world. Populated by initializeNpcSpawner and
// kept in sync by spawn/respawn/death callbacks via the shared reference.
const spawnAssignments: Map<string, Assignment> = new Map();

function applyDefaultNPCWeaponVisual(npcModel: Model, race: Race, role: RouteRole | undefined): void {
	ensureCharacterWeaponAnchors(npcModel);
	if (role === "Dawnsworn") {
		applyHeldWeaponVisualToCharacter(npcModel, "halberd");
	} else if (role === "Nightbound") {
		applySheathedWeaponVisualToCharacter(npcModel, "dagger");
	} else if (role === "Chaplain") {
		applyHeldWeaponVisualToCharacter(npcModel, "ornate_staff");
	} else if (race === "Pirate") {
		applySheathedWeaponVisualToCharacter(npcModel, "cutlass");
	}
}

/** Names of NPCs currently spawned (alive) in the world. */
export function getSpawnedNPCNames(): string[] {
	const out: string[] = [];
	spawnAssignments.forEach((a) => out.push(a.npc.model.Name));
	return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Route SocialClass tagging
//
// Each tagged "Route" folder may carry an optional "SocialClass" string
// attribute (case-insensitive): "Serf" | "Commoner" | "Merchant" | "Nobility"
// | "Royalty" | "Any". "Any" or unset means the route accepts whatever pool
// names remain after typed routes are filled.
// ──────────────────────────────────────────────────────────────────────────

const VALID_SOCIAL_CLASSES: ReadonlySet<string> = new Set<string>([
	"Serf",
	"Commoner",
	"Merchant",
	"Nobility",
	"Royalty",
]);

/** Read the SocialClass attribute off a route folder. Returns undefined for
 *  unset / "any" / "x" / unrecognised values (meaning: accept any class). */
function getRouteSocialClass(route: Folder): SocialClass | undefined {
	const raw = route.GetAttribute("SocialClass");
	if (typeIs(raw, "string") === false) return undefined;
	const s = raw as string;
	if (s === "" || s.lower() === "any" || s.lower() === "x") return undefined;
	// Canonicalise: first letter upper, rest lower.
	const canon = s.sub(1, 1).upper() + s.sub(2).lower();
	if (!VALID_SOCIAL_CLASSES.has(canon)) {
		log(`[NPC-SPAWNER] Route ${route.Name} has invalid SocialClass attribute '${s}' -- treating as Any`, "WARN");
		return undefined;
	}
	return canon as SocialClass;
}

const VALID_RACES: ReadonlySet<string> = new Set<string>(["Human", "Goblin", "Gnome", "Pirate"]);

/** Read the Race attribute off a route folder. Returns undefined for
 *  unset / "any" / "x" / unrecognised values (meaning: accept any race). */
function getRouteRace(route: Folder): Race | undefined {
	const raw = route.GetAttribute("Race");
	if (typeIs(raw, "string") === false) return undefined;
	const s = raw as string;
	if (s === "" || s.lower() === "any" || s.lower() === "x") return undefined;
	const canon = s.sub(1, 1).upper() + s.sub(2).lower();
	if (!VALID_RACES.has(canon)) {
		log(`[NPC-SPAWNER] Route ${route.Name} has invalid Race attribute '${s}' -- treating as Any`, "WARN");
		return undefined;
	}
	return canon as Race;
}

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
		// Skip routes that live anywhere inside a merchant shop site -- those are
		// managed by merchant-handler. Walk ancestors so nested Routes are caught.
		let p: Instance | undefined = child.Parent;
		while (p !== undefined && p !== game) {
			if (CollectionService.HasTag(p, "MerchantShop")) return false;
			if (p.IsA("Model") && p.Name === "Shop") return false;
			p = p.Parent;
		}
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

		const firstRoutePoint = routePoints[0];

		const spawnPosition = resolveSpawnPosition(firstRoutePoint, isInitial);
		if (!spawnPosition) {
			throw "Spawn position could not be resolved";
		}

		const takenNames: string[] = getActiveNPCNames(assigned);
		const reservedMerchants = getReservedMerchantNames();
		const routeClass = getRouteSocialClass(npcRoute);
		const routeRace = getRouteRace(npcRoute);

		let availableNames = ROUTABLE_NPC_NAMES.filter(
			(name: string) => !takenNames.includes(name) && !reservedMerchants.has(name),
		);

		// Gnomes only ever populate routes that explicitly opt in via Race=Gnome
		// (or via fixedRouteId on the NPC entry). Otherwise they would flood the
		// general pool and steal slots from Humans/Goblins/Pirates.
		if (routeRace !== "Gnome") {
			availableNames = availableNames.filter((n) => NPC_REGISTRY[n].race !== "Gnome");
		}

		// Gnomes cannot serve as Dawnsworn/Nightbound route representatives.
		const routeRole = getRouteRole(npcRoute);
		if (routeRole !== undefined) {
			availableNames = availableNames.filter((n) => NPC_REGISTRY[n].race !== "Gnome");
		}

		if (routeClass !== undefined) {
			const typed = availableNames.filter((n) => NPC_REGISTRY[n].socialClass === routeClass);
			if (typed.size() === 0) {
				log(
					`[NPC-SPAWNER] Route ${npcRoute.Name} requested class '${routeClass}' but no NPCs of that class are available -- falling back to Any`,
					"WARN",
				);
			} else {
				availableNames = typed;
			}
		}

		if (routeRace !== undefined) {
			const typed = availableNames.filter((n) => NPC_REGISTRY[n].race === routeRace);
			if (typed.size() === 0) {
				log(
					`[NPC-SPAWNER] Route ${npcRoute.Name} requested race '${routeRace}' but no NPCs of that race are available -- falling back to Any`,
					"WARN",
				);
			} else {
				availableNames = typed;
			}
		}

		const npcName = availableNames[math.random(0, availableNames.size() - 1)];

		if (!npcName) {
			throw `NPC name is invalid: ${npcName}`;
		}

		// Dawnsworn/Nightbound representatives are always Commoners regardless of their name's status.
		const npcData = { ...MEDIEVAL_NPCS[npcName] };
		if (routeRole !== undefined) {
			npcData.status = "Commoner";
		}

		const npc: NPC | undefined = createNPCModelAndGenerateHumanoid(npcName, npcData, npcRoute);

		if (!npc) {
			throw "Not able to create NPC";
		}

		applyDefaultNPCWeaponVisual(npc.model, npcData.race as Race, routeRole);
		applyEnchantmentVisualToCharacter(npc.model, getRouteEnchantment(npcRoute));
		npc.model.PivotTo(new CFrame(spawnPosition));
		npc.model.SetAttribute("RouteName", npcRoute.Name);

		assignNpcToRoute(npc, routePoints, npcRoute, setState, isInitial && routePoints.size() > 1 ? 1 : 0);

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
		const npcDef = NPC_REGISTRY[npcName];
		if (!npcDef) throw `NPC ${npcName} not found in registry`;

		const npcData = { gender: npcDef.gender, race: npcDef.race, status: npcDef.socialClass };

		const npc: NPC | undefined = createNPCModelAndGenerateHumanoid(npcName, npcData, npcRoute);
		if (!npc) throw `Not able to create NPC ${npcName}`;

		applyDefaultNPCWeaponVisual(npc.model, npcDef.race, getRouteRole(npcRoute));
		applyEnchantmentVisualToCharacter(npc.model, getRouteEnchantment(npcRoute));
		const firstRoutePoint = routePoints[0];
		const spawnPosition = resolveSpawnPosition(firstRoutePoint, isInitial);
		if (!spawnPosition) {
			throw `Spawn position could not be resolved for ${npcName}`;
		}

		npc.model.PivotTo(new CFrame(spawnPosition));
		npc.model.SetAttribute("RouteName", npcRoute.Name);

		assignNpcToRoute(npc, routePoints, npcRoute, setState, isInitial && routePoints.size() > 1 ? 1 : 0);

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
	const assigned = spawnAssignments;
	const npcRoutes = getNPCRoutes();
	const reservedMerchants = getReservedMerchantNames();

	// ── Phase 1: Spawn pinned NPCs first (Route folder has an NPCName attribute)
	// This replaces the old fixedRouteId lookup. Any Route folder with an NPCName
	// attribute will spawn exactly that NPC regardless of folder name.
	const pinnedRoutes: Folder[] = [];
	const routableRoutes: Folder[] = [];
	for (const route of npcRoutes) {
		const pinned = route.GetAttribute("NPCName") as string | undefined;
		if (pinned !== undefined && pinned !== "") pinnedRoutes.push(route);
		else routableRoutes.push(route);
	}

	for (const route of pinnedRoutes) {
		const npcName = route.GetAttribute("NPCName") as string;
		if (!NPC_REGISTRY[npcName]) {
			log(`[NPC-SPAWNER] Pinned NPCName "${npcName}" on route ${route.Name} not in registry`, "WARN");
			continue;
		}
		if (reservedMerchants.has(npcName)) {
			log(`[NPC-SPAWNER] Skipping pinned route for ${npcName} -- claimed by merchant shop`);
			continue;
		}
		spawnFixedRouteNPC(npcName, route, assigned, true);
	}

	// ── Phase 2: Spawn random routable NPCs on remaining routes
	//          Typed routes (SocialClass/Race attribute set) first, untyped after,
	//          so a typed route can't be starved by an untyped pick.
	const remainingRoutes = routableRoutes.filter((r) => !assigned.has(r.Name));
	const typedRoutes: Folder[] = [];
	const untypedRoutes: Folder[] = [];
	for (const r of remainingRoutes) {
		if (getRouteSocialClass(r) !== undefined || getRouteRace(r) !== undefined) typedRoutes.push(r);
		else untypedRoutes.push(r);
	}

	if (remainingRoutes.size() > ROUTABLE_NPC_NAMES.size()) {
		log(
			`[NPC-SPAWNER] Route Size: ${remainingRoutes.size()} > Routable NPC amount: ${ROUTABLE_NPC_NAMES.size()}`,
			"ERROR",
		);
	}
	print(
		`[NPC-SPAWNER] Routes: ${npcRoutes.size()} (${assigned.size()} pinned, ${typedRoutes.size()} typed, ${untypedRoutes.size()} any) | Routable NPCs: ${ROUTABLE_NPC_NAMES.size()}`,
	);

	const spawnFn = (npcRoute: Folder) => {
		try {
			spawnForRoute(npcRoute, assigned, true);
		} catch (err) {
			log(`[NPC-SPAWNER] Spawn failed for NPC: ${err as string}`, "ERROR");
		}
	};
	typedRoutes.forEach(spawnFn);
	untypedRoutes.forEach(spawnFn);

	print(`[NPC-SPAWNER] Initial spawn complete (${assigned.size()} NPCs placed)`);
}
