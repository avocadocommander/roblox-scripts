import { ReplicatedStorage } from "@rbxts/services";

export function getOrCreateStealthRemote(): RemoteEvent {
	let remotesFolder = ReplicatedStorage.FindFirstChild("Remotes");

	if (!remotesFolder) {
		remotesFolder = new Instance("Folder");
		remotesFolder.Name = "Remotes";
		remotesFolder.Parent = ReplicatedStorage;
	}

	let stealthRemote = remotesFolder.FindFirstChild("Stealth") as RemoteEvent | undefined;

	if (!stealthRemote) {
		stealthRemote = new Instance("RemoteEvent");
		stealthRemote.Name = "Stealth";
		stealthRemote.Parent = remotesFolder;
	}

	return stealthRemote;
}
