import { ReplicatedStorage } from "@rbxts/services";

export function getOrCreateDoubleJumpRemote(): RemoteEvent {
	let remotesFolder = ReplicatedStorage.FindFirstChild("Remotes");

	if (!remotesFolder) {
		remotesFolder = new Instance("Folder");
		remotesFolder.Name = "Remotes";
		remotesFolder.Parent = ReplicatedStorage;
	}

	let doubleJumpRemote = remotesFolder.FindFirstChild("DoubleJump") as RemoteEvent | undefined;

	if (!doubleJumpRemote) {
		doubleJumpRemote = new Instance("RemoteEvent");
		doubleJumpRemote.Name = "DoubleJump";
		doubleJumpRemote.Parent = remotesFolder;
	}

	return doubleJumpRemote;
}
