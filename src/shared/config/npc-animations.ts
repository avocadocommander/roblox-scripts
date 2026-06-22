import { Race } from "./npcs";
import { makeSeededRandom } from "../npc/utils";
import { RouteRole } from "../npc-manager";

export interface NPCAnimationPool {
	idle: string[];
	walk: string[];
}

export interface NPCAnimationSelection {
	idle: string;
	walk: string;
}

const DEFAULT_ANIMATIONS: NPCAnimationPool = {
	idle: ["507766951"],
	walk: ["133708367021932"],
};

/**
 * Animation pools by NPC race/type.
 *
 * Each NPC deterministically selects one idle and one walk from its pool using
 * its name seed. Pools may contain one or many animations.
 */
export const NPC_ANIMATION_POOLS: Partial<Record<Race, NPCAnimationPool>> = {
	Pirate: {
		idle: ["750781874", "750782770", "885515365"],
		walk: ["750785693"],
	},
};

/** Route-role pools take priority over race pools. */
export const NPC_ROLE_ANIMATION_POOLS: Partial<Record<RouteRole, NPCAnimationPool>> = {
	Dawnsworn: {
		idle: ["657595757", "657568135", "885499184"],
		walk: ["657552124"],
	},
};

function pickSeeded(pool: string[], seed: number): string {
	const usablePool = pool.size() > 0 ? pool : DEFAULT_ANIMATIONS.idle;
	const random = makeSeededRandom(seed);
	return usablePool[math.floor(random() * usablePool.size())] ?? usablePool[0];
}

/** Select stable idle/walk animation IDs for one NPC. */
export function getNPCAnimationSelection(
	race: Race,
	seed: number,
	routeRole?: RouteRole,
): NPCAnimationSelection {
	const pool =
		(routeRole !== undefined ? NPC_ROLE_ANIMATION_POOLS[routeRole] : undefined) ??
		NPC_ANIMATION_POOLS[race] ??
		DEFAULT_ANIMATIONS;
	return {
		// Separate salts keep idle and walk choices deterministic and independent.
		idle: pickSeeded(pool.idle.size() > 0 ? pool.idle : DEFAULT_ANIMATIONS.idle, seed + 101),
		walk: pickSeeded(pool.walk.size() > 0 ? pool.walk : DEFAULT_ANIMATIONS.walk, seed + 211),
	};
}
