import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

/**
 * Server -> Client: push a short message to the board message strip.
 * Payload: (messageType: "info" | "warning" | "event" | "unlock", text: string)
 *
 * Typically fired to ALL clients via FireAllClients for server-wide
 * announcements (e.g. special events, royal decrees, merchant arrivals).
 */
export function getBoardBroadcastRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "BoardBroadcast");
}
