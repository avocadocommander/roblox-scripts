/**
 * tutorial-controller — listens to achievement remotes and feeds the
 * board its unlocked-achievement set. Guidance Mode is derived purely
 * from that set inside board-state; this module is just the wire.
 *
 * No separate tutorialStage flag — achievements ARE the progression.
 */

import {
	getAchievementSyncRemote,
	getAchievementUnlockedRemote,
} from "shared/remotes/achievement-remote";
import { getBoardBroadcastRemote } from "shared/remotes/board-broadcast-remote";
import {
	addUnlockedAchievement,
	BoardMessageType,
	setTutorialBountyScrollCount,
	setUnlockedAchievements,
	showBoardMessage,
	showServerEvent,
} from "./board-state";
import { ACHIEVEMENTS } from "shared/achievements";
import { InventoryPayload } from "shared/inventory";
import { getInventorySyncRemote } from "shared/remotes/inventory-remote";

export function initializeTutorialController(): void {
	// Full sync on join
	getAchievementSyncRemote().OnClientEvent.Connect((data: unknown) => {
		const ids: string[] = [];
		if (typeIs(data, "table")) {
			for (const [id] of pairs(data as Record<string, unknown>)) {
				ids.push(id as string);
			}
		}
		setUnlockedAchievements(ids);
	});

	// Single unlock push
	getAchievementUnlockedRemote().OnClientEvent.Connect((achievementId: unknown) => {
		const id = achievementId as string;
		addUnlockedAchievement(id);
		const def = ACHIEVEMENTS[id];
		if (def) {
			showBoardMessage("unlock", "New Achievement: " + def.title);
		}
	});

	getInventorySyncRemote().OnClientEvent.Connect((data: unknown) => {
		const payload = data as InventoryPayload;
		let npcScrolls = 0;
		let playerScrolls = 0;
		for (const scroll of payload.bountyScrolls ?? []) {
			const source = scroll.source ?? (scroll.rarity === "player" ? "player" : "npc");
			if (source === "player") playerScrolls++;
			else npcScrolls++;
		}
		setTutorialBountyScrollCount(npcScrolls, playerScrolls);
	});

	// Server-wide broadcast (special events, decrees, etc.)
	getBoardBroadcastRemote().OnClientEvent.Connect((messageType: unknown, text: unknown) => {
		if (messageType === "event") {
			// "event" type maps to the static server-event banner (not the transient queue).
			showServerEvent(text as string | undefined);
		} else {
			showBoardMessage(messageType as BoardMessageType, text as string);
		}
	});
}
