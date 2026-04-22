/**
 * Achievement Service — server-authoritative award, persistence, and badge integration.
 *
 * Gameplay systems call `awardAchievement(player, id)` — this module handles:
 *  - duplicate prevention (via player-state)
 *  - persistence (automatic via player-state DataStore)
 *  - reward granting (coins, XP, title)
 *  - Roblox badge awarding (if a badgeId is mapped)
 *  - client notification (fires AchievementUnlocked remote)
 *  - full sync on join (fires AchievementSync remote)
 *
 * Do NOT embed gameplay trigger logic here.
 */

import { BadgeService, Players } from "@rbxts/services";
import { log } from "shared/helpers";
import { ACHIEVEMENTS, AchievementDef } from "shared/achievements";
import {
	getAchievementUnlockedRemote,
	getAchievementSyncRemote,
	getMockAchievementRemote,
} from "shared/remotes/achievement-remote";
import {
	unlockAchievement,
	hasAchievement,
	getUnlockedAchievements,
	addCoins,
	addExperience,
} from "shared/player-state";
import { unlockTitle } from "shared/player-state";

// Lazy import to avoid circular dependency:
//   inventory-handler -> effect-handler -> achievement-handler -> inventory-handler
let _givePlayerItem: ((player: Player, itemId: string, count: number) => boolean) | undefined;
function givePlayerItemLazy(player: Player, itemId: string, count: number): boolean {
	if (!_givePlayerItem) {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const ih = require(script.Parent!.FindFirstChild("inventory-handler") as ModuleScript) as {
			givePlayerItem: (player: Player, itemId: string, count: number) => boolean;
		};
		_givePlayerItem = ih.givePlayerItem;
	}
	return _givePlayerItem(player, itemId, count);
}

const TAG = "[ACHIEVEMENT]";

let gameId = 0;

// ── Badge integration layer ───────────────────────────────────────────────────

function tryAwardBadge(player: Player, badgeId: number): void {
	task.spawn(() => {
		const [ok, err] = pcall(() => {
			if (!BadgeService.UserHasBadgeAsync(player.UserId, badgeId)) {
				BadgeService.AwardBadge(player.UserId, badgeId);
				log(`${TAG} Awarded Roblox badge ${badgeId} to ${player.Name}`);
			}
		});
		if (!ok) {
			warn(`${TAG} Failed to award badge ${badgeId} to ${player.Name}: ${err}`);
		}
	});
}

// ── Reward granting ───────────────────────────────────────────────────────────

function grantReward(player: Player, def: AchievementDef): void {
	const reward = def.reward;
	if (!reward) return;
	if (reward.coins !== undefined && reward.coins > 0) {
		addCoins(player, reward.coins);
		log(`${TAG} Granted ${reward.coins} coins to ${player.Name} for ${def.id}`);
	}
	if (reward.xp !== undefined && reward.xp > 0) {
		addExperience(player, reward.xp);
		log(`${TAG} Granted ${reward.xp} XP to ${player.Name} for ${def.id}`);
	}
	if (reward.titleId !== undefined) {
		unlockTitle(player, reward.titleId);
		log(`${TAG} Granted title '${reward.titleId}' to ${player.Name} for ${def.id}`);
	}
	if (reward.itemId !== undefined) {
		const count = reward.itemCount ?? 1;
		const ok = givePlayerItemLazy(player, reward.itemId, count);
		if (ok) {
			log(`${TAG} Granted item '${reward.itemId}' x${count} to ${player.Name} for ${def.id}`);
		} else {
			warn(`${TAG} Failed to grant item '${reward.itemId}' to ${player.Name} for ${def.id}`);
		}
	}
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Award an achievement to a player.
 * Call this from any gameplay system — the service handles dedup, persistence,
 * rewards, badges, and client notification.
 *
 * Returns true if newly unlocked, false if already had it.
 */
export function awardAchievement(player: Player, achievementId: string): boolean {
	const def = ACHIEVEMENTS[achievementId];
	if (!def) {
		warn(`${TAG} Unknown achievement ID: ${achievementId}`);
		return false;
	}

	if (!unlockAchievement(player, achievementId)) {
		return false; // already unlocked — no-op
	}

	log(`${TAG} ${player.Name} unlocked: ${def.title} (${def.id})`);

	// Grant rewards
	grantReward(player, def);

	// Roblox badge
	if (def.badgeId !== undefined) {
		tryAwardBadge(player, def.badgeId);
	}

	// Notify client for toast popup
	getAchievementUnlockedRemote().FireClient(player, achievementId);

	return true;
}

/**
 * Check if a player has a specific achievement.
 * Convenience re-export so callers don't need to import player-state directly.
 */
export { hasAchievement } from "shared/player-state";

/**
 * Push the full unlocked achievements record to a player's client.
 * Called on join and can be called manually for full resync.
 */
export function syncAchievementsToClient(player: Player): void {
	const data = getUnlockedAchievements(player);
	getAchievementSyncRemote().FireClient(player, data);
}

// ── Initialization ────────────────────────────────────────────────────────────

export function initializeAchievementHandler(): void {
	// Eagerly create remotes
	getAchievementUnlockedRemote();
	getAchievementSyncRemote();
	getMockAchievementRemote();

	// Cache game ID for badge calls
	gameId = game.GameId;

	// Mock achievement trigger — for testing the toast popup
	getMockAchievementRemote().OnServerEvent.Connect((player: Player) => {
		const def = ACHIEVEMENTS.MOCK_TEST;
		if (!def) return;
		log(`${TAG} Mock achievement triggered for ${player.Name}`);
		// Fire directly without persisting — test only
		getAchievementUnlockedRemote().FireClient(player, "MOCK_TEST");
	});

	// Sync achievements to client shortly after join (data needs time to load)
	Players.PlayerAdded.Connect((player) => {
		task.delay(4, () => {
			if (player.Parent !== undefined) {
				syncAchievementsToClient(player);
			}
		});
	});

	log(`${TAG} Achievement handler initialized`);
}
