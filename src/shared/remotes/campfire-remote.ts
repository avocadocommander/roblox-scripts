import { ReplicatedStorage } from "@rbxts/services";

// Campfire spawn point data
export interface CampfireData {
	position: Vector3;
	playerName: string;
	timestamp: number;
}

function getRemoteFolder(): Folder {
	let folder = ReplicatedStorage.FindFirstChild("Remotes") as Folder | undefined;
	if (!folder) {
		folder = new Instance("Folder");
		folder.Name = "Remotes";
		folder.Parent = ReplicatedStorage;
	}
	return folder;
}

let placeCampfireRemote: RemoteEvent | undefined;
let campfireRemovedRemote: RemoteEvent | undefined;

export function getPlaceCampfireRemote(): RemoteEvent {
	if (!placeCampfireRemote) {
		const remoteFolder = getRemoteFolder();
		const remote = (remoteFolder.FindFirstChild("PlaceCampfire") as RemoteEvent) ?? new Instance("RemoteEvent");
		remote.Name = "PlaceCampfire";
		remote.Parent = remoteFolder;
		placeCampfireRemote = remote;
	}
	return placeCampfireRemote;
}

export function getCampfireRemovedRemote(): RemoteEvent {
	if (!campfireRemovedRemote) {
		const remoteFolder = getRemoteFolder();
		const remote = (remoteFolder.FindFirstChild("CampfireRemoved") as RemoteEvent) ?? new Instance("RemoteEvent");
		remote.Name = "CampfireRemoved";
		remote.Parent = remoteFolder;
		campfireRemovedRemote = remote;
	}
	return campfireRemovedRemote;
}
