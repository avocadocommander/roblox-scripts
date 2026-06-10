import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

/** Server -> client: dream cloud event active state changed. Payload: (active: boolean) */
export function getDreamCloudEventRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "DreamCloudEvent");
}
