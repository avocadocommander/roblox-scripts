import { getPlaceCampfireRemote } from "shared/remotes/campfire-remote";

// Track campfire positions on the client for respawn/UI use
const campfirePositions = new Map<string, Vector3>();

const placeCampfireRemote = getPlaceCampfireRemote();

/**
 * Returns the locally tracked campfire position for a given player name.
 */
export function getClientCampfirePosition(playerName: string): Vector3 | undefined {
	return campfirePositions.get(playerName);
}

// Listen for campfire placement broadcasts from server.
// The server already places the model into Workspace (which auto-replicates to all clients),
// so we only need to track the position here — no model creation needed.
placeCampfireRemote.OnClientEvent.Connect((...args: unknown[]) => {
	const playerName = args[0] as string;
	const position = args[1] as Vector3;
	campfirePositions.set(playerName, position);
});
