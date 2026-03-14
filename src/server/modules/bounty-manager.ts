import { Players } from "@rbxts/services";
import { log } from "shared/helpers";
import { MEDIEVAL_NPC_NAMES, MEDIEVAL_NPCS, SATIRICAL_BOUNTY_OFFENSES, Status } from "shared/module";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";
import {
	getBountyAssignedRemote,
	getBountyCompletedRemote,
	getBountyListSyncRemote,
	getPlayerAssassinationRemote,
	getPlayerWantedClearedRemote,
	getPlayerWantedRemote,
	NPCBountyPayload,
	PlayerWantedPayload,
} from "shared/remotes/bounty-remote";

// ─── Reward scaling by NPC social status ─────────────────────────────────────

const GOLD_BY_STATUS: Record<Status, number> = {
	Serf: 100,
	Commoner: 200,
	Merchant: 350,
	Nobility: 600,
	Royalty: 1200,
};

const XP_BY_STATUS: Record<Status, number> = {
	Serf: 500,
	Commoner: 750,
	Merchant: 1000,
	Nobility: 1500,
	Royalty: 2500,
};

// ─── State ────────────────────────────────────────────────────────────────────

/** Each player's current personal NPC mark. */
const playerNPCBounties = new Map<Player, NPCBountyPayload>();

/** Players who are currently wanted — visible to everyone. */
const wantedPlayers = new Map<Player, { gold: number; reason: string }>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildNewNPCBounty(): NPCBountyPayload {
	const names = [...MEDIEVAL_NPC_NAMES];
	const npcName = names[math.random(0, names.size() - 1)];
	const npcData = MEDIEVAL_NPCS[npcName];
	return {
		npcName,
		gold: GOLD_BY_STATUS[npcData.status as Status] ?? 200,
		xp: XP_BY_STATUS[npcData.status as Status] ?? 500,
		offence: SATIRICAL_BOUNTY_OFFENSES[math.random(0, SATIRICAL_BOUNTY_OFFENSES.size() - 1)],
	};
}

function buildWantedList(): PlayerWantedPayload[] {
	const list: PlayerWantedPayload[] = [];
	for (const [wantedPlayer, info] of wantedPlayers) {
		list.push({
			playerName: wantedPlayer.Name,
			displayName: wantedPlayer.DisplayName,
			gold: info.gold,
			reason: info.reason,
		});
	}
	return list;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Assign a fresh random NPC bounty to `player` and notify their client. */
export function assignNewNPCBounty(player: Player): NPCBountyPayload {
	const bounty = buildNewNPCBounty();
	playerNPCBounties.set(player, bounty);
	getBountyAssignedRemote().FireClient(player, bounty);
	log(
		"[BOUNTY] " + player.Name + " -> mark: " + bounty.npcName + " (" + bounty.gold + "g | " + npcName(bounty) + ")",
	);
	return bounty;
}

function npcName(b: NPCBountyPayload): string {
	return `"${b.offence.sub(0, 40)}..."`;
}

/** Read `player`'s current NPC bounty without consuming it. */
export function getPlayerNPCBounty(player: Player): NPCBountyPayload | undefined {
	return playerNPCBounties.get(player);
}

/**
 * Called when an NPC is killed.
 * Returns the bounty payload if `killerPlayer` had this NPC as their mark
 * (so the caller can stack extra rewards). All players who had this NPC as
 * their mark receive a BountyCompleted event and a new mark after 3 s.
 */
export function onNPCKilled(killerPlayer: Player, npcName: string): NPCBountyPayload | undefined {
	let killerReward: NPCBountyPayload | undefined;

	for (const [player, bounty] of playerNPCBounties) {
		if (bounty.npcName === npcName) {
			if (player === killerPlayer) {
				killerReward = bounty;
			}
			// Notify client their mark is complete
			getBountyCompletedRemote().FireClient(player, bounty);
			playerNPCBounties.delete(player);

			// Assign a new mark after a short dramatic pause
			task.delay(3, () => {
				if (player.Parent !== undefined) {
					assignNewNPCBounty(player);
				}
			});
		}
	}

	return killerReward;
}

/**
 * Mark `player` as wanted — shows on every player's bounty board.
 * Call this when a player breaks the law (attacks a civilian, etc.).
 */
export function setPlayerWanted(player: Player, gold: number, reason: string): void {
	const existing = wantedPlayers.get(player);
	const newGold = existing ? existing.gold + gold : gold;
	const newReason = existing ? existing.reason : reason; // keep the first decree
	wantedPlayers.set(player, { gold: newGold, reason: newReason });
	const payload: PlayerWantedPayload = {
		playerName: player.Name,
		displayName: player.DisplayName,
		gold: newGold,
		reason: newReason,
	};
	getPlayerWantedRemote().FireAllClients(payload);
	if (existing) {
		log("[BOUNTY] " + player.DisplayName + " bounty increased to " + newGold + "g (+" + gold + "g)");
	} else {
		log("[BOUNTY] " + player.DisplayName + " is WANTED -- " + newGold + 'g -- "' + newReason + '"');
	}
}

/** Returns true if `player` is currently on the wanted list. */
export function isPlayerWanted(player: Player): boolean {
	return wantedPlayers.has(player);
}

/** Get the gold bounty on a wanted player's head. */
export function getWantedPlayerGold(player: Player): number | undefined {
	const data = wantedPlayers.get(player);
	return data?.gold;
}

/** Remove `player` from the wanted list and notify all clients. */
export function clearPlayerWanted(player: Player): void {
	if (wantedPlayers.has(player)) {
		wantedPlayers.delete(player);
		getPlayerWantedClearedRemote().FireAllClients(player.Name);
		log(`[BOUNTY] ${player.DisplayName} wanted status cleared`);
	}
}

// ─── Initialization ───────────────────────────────────────────────────────────

export function initializeBountyManager(): void {
	// Pre-create ALL remotes right now during server bootstrap so they exist in
	// ReplicatedStorage before any client module runs. Without this, lazy
	// creation races with the client — the client calls getOrCreateEvent first,
	// creates its own copy, and the server later fires on a different instance.
	getBountyAssignedRemote();
	getBountyCompletedRemote();
	getBountyListSyncRemote();
	getPlayerWantedRemote();
	getPlayerWantedClearedRemote();
	getPlayerAssassinationRemote();

	const lifecycle = getOrCreateLifecycleRemote();

	// Hook into "ClientReady" — this fires AFTER the client has connected all
	// its event listeners, so the initial sync is guaranteed to arrive.
	lifecycle.OnServerEvent.Connect((player: Player, message: unknown) => {
		if (message === "ClientReady") {
			const npcBounty = assignNewNPCBounty(player);
			// Send full current state: their NPC mark + everyone who is wanted
			getBountyListSyncRemote().FireClient(player, npcBounty, buildWantedList());
		}
	});

	Players.PlayerRemoving.Connect((player) => {
		playerNPCBounties.delete(player);
		clearPlayerWanted(player);
	});

	log("[BOUNTY] Bounty manager initialized");
}
