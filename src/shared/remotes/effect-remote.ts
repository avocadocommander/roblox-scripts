import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

/** Payload sent from server to client describing active consumable effects. */
export interface EffectSyncPayload {
	activePoisonId: string | undefined;
	poisonRemainingSecs: number;
	activeElixirId: string | undefined;
	elixirRemainingSecs: number;
}

/** Server -> Client: sync active consumable effect state (poison + elixir timers). */
export function getEffectSyncRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "EffectSync");
}
