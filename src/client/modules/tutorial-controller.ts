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
	setUnlockedAchievements,
	showBoardMessage,
} from "./board-state";
import { ACHIEVEMENTS } from "shared/achievements";

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

	// Server-wide broadcast (special events, decrees, etc.)
	getBoardBroadcastRemote().OnClientEvent.Connect((messageType: unknown, text: unknown) => {
		showBoardMessage(messageType as BoardMessageType, text as string);
	});
}
