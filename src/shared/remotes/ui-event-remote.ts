import { getRemoteEvent, getRemotesFolder } from "shared/remote-utils";

/**
 * UIEvent remote — client → server one-way notification for UI panel opens.
 *
 * The server uses this purely for analytics (custom events). It must never
 * grant gameplay effects since the client controls when it fires. Payload is
 * a single string event name drawn from `UI_OPEN_EVENTS`.
 *
 *   client → server: ("Inventory" | "KillBook" | ...)
 */
export function getOrCreateUIEventRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "UIEvent");
}

/** Closed set of UI-open event tags accepted by the server. Keep this small. */
export const UI_OPEN_EVENTS = {
	Inventory: "Inventory",
	KillBook: "KillBook",
} as const;

export type UIOpenEvent = (typeof UI_OPEN_EVENTS)[keyof typeof UI_OPEN_EVENTS];
