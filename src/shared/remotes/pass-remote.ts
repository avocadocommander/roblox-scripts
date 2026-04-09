/**
 * Game Pass remotes — lazy-create pattern.
 *
 * Client -> Server:
 *   - PromptPassPurchase: client requests the server to prompt a Game Pass purchase
 *
 * Server -> Client:
 *   - PassOwnershipSync: broadcasts pass ownership changes to the client
 */

import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

/** Client -> Server: request to prompt Game Pass purchase. Args: (gamePassId: number). */
export function getPromptPassPurchaseRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "PromptPassPurchase");
}

/** Server -> Client: pass ownership update. Args: (gamePassId: number, owns: boolean). */
export function getPassOwnershipSyncRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "PassOwnershipSync");
}
