import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

export function getOrCreateSprintRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "Sprint");
}
