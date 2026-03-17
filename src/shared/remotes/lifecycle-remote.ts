import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

export function getOrCreateLifecycleRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "Lifecycle");
}
