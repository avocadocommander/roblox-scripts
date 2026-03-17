import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

export type MovementAction = "StartRun" | "StopRun" | "Walk" | "Stealth" | "Jump";

export function getOrCreateMovementRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "Movement");
}
