import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

/** Server -> Client: play a configured one-shot sound effect locally. */
export function getSoundEffectRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "SoundEffect");
}
