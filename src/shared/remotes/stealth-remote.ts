import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

export function getOrCreateStealthRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "Stealth");
}
