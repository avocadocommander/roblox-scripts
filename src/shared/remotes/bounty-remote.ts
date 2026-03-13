import { ReplicatedStorage } from "@rbxts/services";

// ─── Payload types (shared between server and client) ────────────────────────

/** Sent to a specific player when they receive or renew their NPC mark. */
export interface NPCBountyPayload {
	npcName: string;
	gold: number;
	xp: number;
	offence: string;
}

/** Sent to ALL clients when a player becomes wanted. */
export interface PlayerWantedPayload {
	playerName: string;
	displayName: string;
	gold: number;
	reason: string;
}

/** Full state sync fired once when a client first becomes ready. */
export interface BountySyncPayload {
	npcBounty: NPCBountyPayload | undefined;
	wantedList: PlayerWantedPayload[];
}

// ─── Remote getters ───────────────────────────────────────────────────────────

function getFolder(): Folder {
	let remotes = ReplicatedStorage.FindFirstChild("Remotes") as Folder | undefined;
	if (!remotes) {
		remotes = new Instance("Folder");
		remotes.Name = "Remotes";
		remotes.Parent = ReplicatedStorage;
	}
	let bounty = remotes.FindFirstChild("Bounty") as Folder | undefined;
	if (!bounty) {
		bounty = new Instance("Folder");
		bounty.Name = "Bounty";
		bounty.Parent = remotes;
	}
	return bounty;
}

function getOrCreateEvent(name: string): RemoteEvent {
	const folder = getFolder();
	let remote = folder.FindFirstChild(name) as RemoteEvent | undefined;
	if (!remote) {
		remote = new Instance("RemoteEvent");
		remote.Name = name;
		remote.Parent = folder;
	}
	return remote;
}

/** Server → specific client: their NPC bounty was assigned / renewed. */
export function getBountyAssignedRemote(): RemoteEvent {
	return getOrCreateEvent("BountyAssigned");
}

/** Server → specific client: their NPC bounty target died (cleared). */
export function getBountyCompletedRemote(): RemoteEvent {
	return getOrCreateEvent("BountyCompleted");
}

/** Server → all clients: a player is now wanted. */
export function getPlayerWantedRemote(): RemoteEvent {
	return getOrCreateEvent("PlayerWanted");
}

/** Server → all clients: a wanted player's bounty was cleared. */
export function getPlayerWantedClearedRemote(): RemoteEvent {
	return getOrCreateEvent("PlayerWantedCleared");
}

/** Server → specific client: full state sync on first load. */
export function getBountyListSyncRemote(): RemoteEvent {
	return getOrCreateEvent("BountyListSync");
}
