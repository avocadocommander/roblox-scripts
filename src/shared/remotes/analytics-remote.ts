import { getRemoteEvent, getRemotesFolder } from "shared/remote-utils";

/**
 * AnalyticsContext remote — client → server one-shot context report.
 *
 * The client fires this once after init with `{ platform, deviceType }` so the
 * server-side AnalyticsTracker can attach those fields to events.
 *
 * Payload: { platform: string; deviceType: string }
 */
export function getOrCreateAnalyticsContextRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "AnalyticsContext");
}
