import { setReadyPlayerStatus } from "./player-state";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";

const lifecycle = getOrCreateLifecycleRemote();

lifecycle.OnServerEvent.Connect((player, message) => {
	if (message === "ClientReady") {
		player.LoadCharacter();
		setReadyPlayerStatus(player, true);
		print(`[PLAYER INIT] ${player.DisplayName} initalized / loaded/ and ready`);
	}
});

export function initializePlayerNetworkMessage(player: Player) {
	lifecycle.FireClient(player, "InitializePlayer");
}
