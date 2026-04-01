import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

/**
 * Server -> Client: fires when the player unlocks an achievement.
 * Payload: achievementId (string)
 */
export function getAchievementUnlockedRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "AchievementUnlocked");
}

/**
 * Server -> Client: full sync of unlocked achievement IDs.
 * Fired on join and whenever bulk updates happen.
 * Payload: Record<string, { unlockedAt: number }>
 */
export function getAchievementSyncRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "AchievementSync");
}

/** Client -> Server: fires to request a mock achievement unlock (testing). */
export function getMockAchievementRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "MockAchievementTrigger");
}
