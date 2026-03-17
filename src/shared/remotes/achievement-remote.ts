import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

/** Server -> Client: fires when the player unlocks an achievement. */
export function getAchievementUnlockedRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "AchievementUnlocked");
}

/** Client -> Server: fires to request a mock achievement unlock (testing). */
export function getMockAchievementRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "MockAchievementTrigger");
}
