import { Players } from "@rbxts/services";
import { setReadyPlayerStatus } from "./player-state";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";
import { respawnPlayerAtCampfire, loadPlayerCampfireFromStorage } from "./modules/campfire-handler";

const lifecycle = getOrCreateLifecycleRemote();

// Disable climbing for all player characters
Players.PlayerAdded.Connect((player) => {
	player.CharacterAdded.Connect((character) => {
		const humanoid = character.WaitForChild("Humanoid") as Humanoid;
		humanoid.SetStateEnabled(Enum.HumanoidStateType.Climbing, false);
	});
});

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
