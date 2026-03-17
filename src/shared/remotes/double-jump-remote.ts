import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

export function getOrCreateDoubleJumpRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "DoubleJump");
}
