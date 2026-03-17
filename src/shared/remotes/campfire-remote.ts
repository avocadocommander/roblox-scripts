import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

// Campfire spawn point data
export interface CampfireData {
	position: Vector3;
	playerName: string;
	timestamp: number;
}

export function getPlaceCampfireRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "PlaceCampfire");
}

export function getCampfireRemovedRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "CampfireRemoved");
}
