import { Workspace } from "@rbxts/services";
import { Assignment } from "./module";

export const NPC_FOLDER_NAME = "NPCs";

export function getOrCreateWorkspaceFolder(name: string): Folder {
	let folder = Workspace.FindFirstChild(name) as Folder | undefined;
	if (!folder || !folder.IsA("Folder")) {
		folder = new Instance("Folder");
		folder.Name = name;
		folder.Parent = Workspace;
	}
	return folder;
}

export function getNPCFolder(): Folder {
	return getOrCreateWorkspaceFolder(NPC_FOLDER_NAME);
}

export function findWorkspaceModelByName(modelName: string): Model | undefined {
	const direct = Workspace.FindFirstChild(modelName);
	if (direct?.IsA("Model")) return direct;

	const npcFolder = Workspace.FindFirstChild(NPC_FOLDER_NAME);
	const npcModel = npcFolder?.FindFirstChild(modelName);
	if (npcModel?.IsA("Model")) return npcModel;

	for (const descendant of Workspace.GetDescendants()) {
		if (descendant.IsA("Model") && descendant.Name === modelName) return descendant;
	}

	return undefined;
}

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

/**
 * Format a duration in seconds as a short human-readable string for tooltips.
 * Examples: 1800 -> "30 min", 90 -> "1 min 30 sec", 45 -> "45 sec",
 *           3600 -> "1 hour", 5400 -> "1 hour 30 min".
 */
export function formatDuration(seconds: number): string {
	if (seconds <= 0) return "0 sec";
	const totalSec = math.floor(seconds);
	const hours = math.floor(totalSec / 3600);
	const mins = math.floor((totalSec % 3600) / 60);
	const secs = totalSec % 60;

	if (hours > 0) {
		if (mins > 0) return tostring(hours) + " hour" + (hours === 1 ? "" : "s") + " " + tostring(mins) + " min";
		return tostring(hours) + " hour" + (hours === 1 ? "" : "s");
	}
	if (mins > 0) {
		if (secs > 0) return tostring(mins) + " min " + tostring(secs) + " sec";
		return tostring(mins) + " min";
	}
	return tostring(secs) + " sec";
}
