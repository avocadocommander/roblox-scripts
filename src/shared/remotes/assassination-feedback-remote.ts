import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

/** Fired server -> client when an assassination attempt is rejected. */
export function getAssassinationFeedbackRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "AssassinationFeedback");
}
