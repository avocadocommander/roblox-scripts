import { ReplicatedStorage } from "@rbxts/services";

export type MovementAction = "StartRun" | "StopRun" | "Walk" | "Stealth" | "Jump";

export function getOrCreateMovementRemote(): RemoteEvent {
	let remotesFolder = ReplicatedStorage.FindFirstChild("Remotes");

	if (!remotesFolder) {
		remotesFolder = new Instance("Folder");
		remotesFolder.Name = "Remotes";
		remotesFolder.Parent = ReplicatedStorage;
	}

	let movementRemote = remotesFolder.FindFirstChild("Movement") as RemoteEvent | undefined;

	if (!movementRemote) {
		movementRemote = new Instance("RemoteEvent");
		movementRemote.Name = "Movement";
		movementRemote.Parent = remotesFolder;
	}

	return movementRemote;
}
