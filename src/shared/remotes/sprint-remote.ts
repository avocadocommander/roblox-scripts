import { ReplicatedStorage } from "@rbxts/services";

export function getOrCreateSprintRemote(): RemoteEvent {
	let remotesFolder = ReplicatedStorage.FindFirstChild("Remotes");

	if (!remotesFolder) {
		remotesFolder = new Instance("Folder");
		remotesFolder.Name = "Remotes";
		remotesFolder.Parent = ReplicatedStorage;
	}

	let lifecycle = remotesFolder.FindFirstChild("Sprint") as RemoteEvent | undefined;

	if (!lifecycle) {
		lifecycle = new Instance("RemoteEvent");
		lifecycle.Name = "Sprint";
		lifecycle.Parent = remotesFolder;
	}

	return lifecycle;
}
