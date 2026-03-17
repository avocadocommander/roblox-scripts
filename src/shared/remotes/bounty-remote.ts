import { getRemoteSubFolder, getRemoteEvent } from "shared/remote-utils";

// ─── Payload types (shared between server and client) ────────────────────────

/** Sent to a specific player when they receive or renew their NPC mark. */
export interface NPCBountyPayload {
	npcName: string;
	gold: number;
	xp: number;
	offence: string;
	route?: string; // Location/route name where the NPC is patrolling
}

/** Sent to ALL clients when a player becomes wanted. */
export interface PlayerWantedPayload {
	playerName: string;
	displayName: string;
	gold: number;
	reason: string;
	/** Up to 4 rarity strings for the wanted player's bounty scrolls (for # indicators). */
	scrollRarities: string[];
}

/** Full state sync fired once when a client first becomes ready. */
export interface BountySyncPayload {
	npcBounty: NPCBountyPayload | undefined;
	wantedList: PlayerWantedPayload[];
}

// ─── Remote getters ───────────────────────────────────────────────────────────

function getFolder(): Folder {
	return getRemoteSubFolder("Bounty");
}

function getBountyEvent(name: string): RemoteEvent {
	return getRemoteEvent(getFolder(), name);
}

/** Server -> specific client: their NPC bounty was assigned / renewed. */
export function getBountyAssignedRemote(): RemoteEvent {
	return getBountyEvent("BountyAssigned");
}

/** Server -> specific client: their NPC bounty target died (cleared). */
export function getBountyCompletedRemote(): RemoteEvent {
	return getBountyEvent("BountyCompleted");
}

/** Server -> all clients: a player is now wanted. */
export function getPlayerWantedRemote(): RemoteEvent {
	return getBountyEvent("PlayerWanted");
}

/** Server -> all clients: a wanted player's bounty was cleared. */
export function getPlayerWantedClearedRemote(): RemoteEvent {
	return getBountyEvent("PlayerWantedCleared");
}

/** Server -> specific client: full state sync on first load. */
export function getBountyListSyncRemote(): RemoteEvent {
	return getBountyEvent("BountyListSync");
}

/** Client -> server: player attempting to assassinate a wanted player. */
export function getPlayerAssassinationRemote(): RemoteEvent {
	return getBountyEvent("PlayerAssassination");
}
