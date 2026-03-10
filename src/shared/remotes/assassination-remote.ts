import { ReplicatedStorage } from "@rbxts/services";

export function getOrCreateAssassinationRemote(): RemoteEvent {
	let remotesFolder = ReplicatedStorage.FindFirstChild("Remotes");

	if (!remotesFolder) {
		remotesFolder = new Instance("Folder");
		remotesFolder.Name = "Remotes";
		remotesFolder.Parent = ReplicatedStorage;
	}

	let assassinationRemote = remotesFolder.FindFirstChild("Assassination") as RemoteEvent | undefined;

	if (!assassinationRemote) {
		assassinationRemote = new Instance("RemoteEvent");
		assassinationRemote.Name = "Assassination";
		assassinationRemote.Parent = remotesFolder;
	}

	return assassinationRemote;
}
