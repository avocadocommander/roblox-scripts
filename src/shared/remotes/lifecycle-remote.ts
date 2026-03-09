import { ReplicatedStorage } from "@rbxts/services";

export function getOrCreateLifecycleRemote(): RemoteEvent {
	let remotesFolder = ReplicatedStorage.FindFirstChild("Remotes");

	if (!remotesFolder) {
		remotesFolder = new Instance("Folder");
		remotesFolder.Name = "Remotes";
		remotesFolder.Parent = ReplicatedStorage;
	}

	let lifecycle = remotesFolder.FindFirstChild("Lifecycle") as RemoteEvent | undefined;

	if (!lifecycle) {
		lifecycle = new Instance("RemoteEvent");
		lifecycle.Name = "Lifecycle";
		lifecycle.Parent = remotesFolder;
	}

	return lifecycle;
}
