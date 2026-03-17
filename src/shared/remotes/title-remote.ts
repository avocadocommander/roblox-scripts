import { ReplicatedStorage } from "@rbxts/services";

function getFolder(): Folder {
	let remotes = ReplicatedStorage.FindFirstChild("Remotes") as Folder | undefined;
	if (!remotes) {
		remotes = new Instance("Folder");
		remotes.Name = "Remotes";
		remotes.Parent = ReplicatedStorage;
	}
	let titleFolder = remotes.FindFirstChild("Titles") as Folder | undefined;
	if (!titleFolder) {
		titleFolder = new Instance("Folder");
		titleFolder.Name = "Titles";
		titleFolder.Parent = remotes;
	}
	return titleFolder;
}

function getOrCreateEvent(name: string): RemoteEvent {
	const folder = getFolder();
	let re = folder.FindFirstChild(name) as RemoteEvent | undefined;
	if (!re) {
		re = new Instance("RemoteEvent");
		re.Name = name;
		re.Parent = folder;
	}
	return re;
}

function getOrCreateFunction(name: string): RemoteFunction {
	const folder = getFolder();
	let rf = folder.FindFirstChild(name) as RemoteFunction | undefined;
	if (!rf) {
		rf = new Instance("RemoteFunction");
		rf.Name = name;
		rf.Parent = folder;
	}
	return rf;
}

/** Client -> Server: fire to request equipping a title. Payload: titleId (string). */
export function getEquipTitleRemote(): RemoteEvent {
	return getOrCreateEvent("EquipTitle");
}

/**
 * Server -> All clients: broadcast when a player's active title changes.
 * Payload: (playerName: string, titleId: string).
 */
export function getTitleSyncRemote(): RemoteEvent {
	return getOrCreateEvent("TitleSync");
}

/**
 * Client -> Server: request a snapshot of all players' current titles.
 * Returns Record<string, string> where key = playerName, value = titleId.
 */
export function getAllTitlesRemote(): RemoteFunction {
	return getOrCreateFunction("GetAllTitles");
}
