import { ReplicatedStorage } from "@rbxts/services";

function getRemotesFolder(): Folder {
	let folder = ReplicatedStorage.FindFirstChild("Remotes") as Folder | undefined;
	if (!folder) {
		folder = new Instance("Folder");
		folder.Name = "Remotes";
		folder.Parent = ReplicatedStorage;
	}
	return folder;
}

/** Server -> Client: fires when the player unlocks an achievement. */
export function getAchievementUnlockedRemote(): RemoteEvent {
	const folder = getRemotesFolder();
	let remote = folder.FindFirstChild("AchievementUnlocked") as RemoteEvent | undefined;
	if (!remote) {
		remote = new Instance("RemoteEvent");
		remote.Name = "AchievementUnlocked";
		remote.Parent = folder;
	}
	return remote;
}

/** Client -> Server: fires to request a mock achievement unlock (testing). */
export function getMockAchievementRemote(): RemoteEvent {
	const folder = getRemotesFolder();
	let remote = folder.FindFirstChild("MockAchievementTrigger") as RemoteEvent | undefined;
	if (!remote) {
		remote = new Instance("RemoteEvent");
		remote.Name = "MockAchievementTrigger";
		remote.Parent = folder;
	}
	return remote;
}
