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
			log(`[STEALTH] ${player.Name} entered stealth mode`);
		} else {
			stealthingPlayers.delete(player);
			log(`[STEALTH] ${player.Name} exited stealth mode`);
		}
	});

	// Clean up when player leaves
	const Players = game.GetService("Players");
	Players.PlayerRemoving.Connect((player) => {
		stealthingPlayers.delete(player);
		log(`[STEALTH] ${player.Name} left - removed from stealth tracking`);
	});
}

function isPlayerStealthing(player: Player): boolean {
	return stealthingPlayers.has(player);
}

export { initializeStealthTracker, isPlayerStealthing };
