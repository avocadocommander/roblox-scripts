import { getOrCreateStealthRemote } from "shared/remotes/stealth-remote";
import { log } from "shared/helpers";

const stealthRemote = getOrCreateStealthRemote();
const stealthingPlayers = new Set<Player>();

function initializeStealthTracker() {
	log("[STEALTH] Initializing stealth tracker");

	stealthRemote.OnServerEvent.Connect((player: Player, isStealthing: unknown) => {
		const stealthState = isStealthing as boolean;

		if (stealthState) {
			stealthingPlayers.add(player);
		} else {
			stealthingPlayers.delete(player);
		}
	});

	// Clean up when player leaves
	const Players = game.GetService("Players");
	Players.PlayerRemoving.Connect((player) => {
		stealthingPlayers.delete(player);

	});
}

function isPlayerStealthing(player: Player): boolean {
	return stealthingPlayers.has(player);
}

export { initializeStealthTracker, isPlayerStealthing };
