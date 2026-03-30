/**
 * Inspect remotes -- lazy-create pattern.
 *
 * Client -> Server:
 *   - OpenInspect: player wants to inspect a model (sends Model ref)
 *
 * Server -> Client:
 *   - InspectPayload: sends display name, description, model name
 */

import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

/** Client -> Server: player opened inspect on a world model. */
export function getOpenInspectRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "OpenInspect");
}

/** Server -> Client: validated inspect payload. */
export function getInspectPayloadRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "InspectPayload");
}

// ── Payload type ──────────────────────────────────────────────────────────────

export interface InspectPayload {
	/** The model name in Workspace (used to clone for viewport render). */
	modelName: string;
	/** Display name from the registry (or fallback to model name). */
	displayName: string;
	/** Description text shown in the dialog text area. */
	description: string;
}
