import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

/** Client -> Server: request a Developer Product purchase prompt. Payload: productId (number). */
export function getPromptProductPurchaseRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "PromptProductPurchase");
}
