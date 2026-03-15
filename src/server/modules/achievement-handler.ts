import { log } from "shared/helpers";
import { ACHIEVEMENTS } from "shared/achievements";
import { getAchievementUnlockedRemote, getMockAchievementRemote } from "shared/remotes/achievement-remote";

const achievementUnlockedRemote = getAchievementUnlockedRemote();
const mockAchievementRemote = getMockAchievementRemote();

export function initializeAchievementHandler(): void {
	// Mock achievement trigger — always fires the popup, for testing
	mockAchievementRemote.OnServerEvent.Connect((player: Player) => {
		const def = ACHIEVEMENTS.MOCK_TEST;
		if (!def) return;
		log(`[ACHIEVEMENT] Mock achievement triggered for ${player.Name}`);
		achievementUnlockedRemote.FireClient(player, def.name, def.description, def.icon);
	});

	log("[ACHIEVEMENT] Achievement handler initialised");
}

/**
 * Fire an achievement unlock notification to a player.
 * Call this from other server modules (assassination-handler, bounty-manager, etc.)
 * after unlockAchievement() returns true.
 */
export function notifyAchievementUnlocked(player: Player, achievementId: string): void {
	const def = ACHIEVEMENTS[achievementId];
	if (!def) return;
	achievementUnlockedRemote.FireClient(player, def.name, def.description, def.icon);
}
