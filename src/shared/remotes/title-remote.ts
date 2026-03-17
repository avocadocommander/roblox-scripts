import { getRemoteSubFolder, getRemoteEvent, getRemoteFunction } from "shared/remote-utils";

function getFolder(): Folder {
	return getRemoteSubFolder("Titles");
}

/** Client -> Server: fire to request equipping a title. Payload: titleId (string). */
export function getEquipTitleRemote(): RemoteEvent {
	return getRemoteEvent(getFolder(), "EquipTitle");
}

/**
 * Server -> All clients: broadcast when a player's active title changes.
 * Payload: (playerName: string, titleId: string).
 */
export function getTitleSyncRemote(): RemoteEvent {
	return getRemoteEvent(getFolder(), "TitleSync");
}

/**
 * Client -> Server: request a snapshot of all players' current titles.
 * Returns Record<string, string> where key = playerName, value = titleId.
 */
export function getAllTitlesRemote(): RemoteFunction {
	return getRemoteFunction(getFolder(), "GetAllTitles");
}
