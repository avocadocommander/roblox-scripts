import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

export function getOrCreateAssassinationRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "Assassination");
}
