import { Assignment } from "./module";

export function isArray(value: unknown): boolean {
	if (typeOf(value) === "table") {
		const tbl = value as Record<number, unknown>;
		return tbl[1] !== undefined;
	}
	return false;
}

export function log(message: string, logType: "INFO" | "WARN" | "ERROR" = "INFO") {
	switch (logType) {
		case "WARN": {
			warn(`📣 ${message}`);
			break;
		}
		case "ERROR": {
			error(`🚨 ${message}`);
			break;
		}
		default: {
			print(`${message}`);
			break;
		}
	}
}

export function applySpeed(speed: SPEEDS, humanoid: Humanoid) {
	if (humanoid) {
		const speedValue = SPEED[speed];
		print(`[SPEED] Applying speed: ${speed} = ${speedValue}`);
		humanoid.WalkSpeed = speedValue;
	}
}

export const SPEED: Record<SPEEDS, number> = {
	WALK: 16,
	RUN: 24,
	STEALTH: 8,
};
export const enum SPEEDS {
	WALK = "WALK",
	RUN = "RUN",
	STEALTH = "STEALTH",
}

export function getActiveNPCNames(assignedRoutes: Map<string, Assignment>): string[] {
	const activeNPCs: string[] = [];
	assignedRoutes.forEach((route) => {
		activeNPCs.push(route.npc.model.Name);
	});
	return activeNPCs;
}
