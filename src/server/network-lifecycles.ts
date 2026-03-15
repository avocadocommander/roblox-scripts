import { setReadyPlayerStatus } from "./player-state";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";
import { respawnPlayerAtCampfire, loadPlayerCampfireFromStorage } from "./modules/campfire-handler";

const lifecycle = getOrCreateLifecycleRemote();

lifecycle.OnServerEvent.Connect((player, message) => {
	if (message === "ClientReady") {
		// Load saved campfire first (async DataStore), then spawn character only after data is ready
		loadPlayerCampfireFromStorage(player, () => {
			player.LoadCharacter();

			// Give the character a moment to initialise before teleporting
			task.delay(0.5, () => {
				respawnPlayerAtCampfire(player);
			});

			setReadyPlayerStatus(player, true);
			print(`[PLAYER INIT] ${player.DisplayName} initialized / loaded / and ready`);
		});
	}
});

export function initializePlayerNetworkMessage(player: Player) {
	lifecycle.FireClient(player, "InitializePlayer");
}
