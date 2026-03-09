import { initializePlayerNetworkMessage } from "./network-lifecycles";
import { setReadyPlayerStatus } from "./player-state";
import { serverIsReady, setServerStatus } from "./server-status";

const Players = game.GetService("Players");
Players.CharacterAutoLoads = false;

export async function bootstrapServer() {
	// load assets / systems
	task.wait(5);
	setServerStatus(true);
	print("[SERVER INIT] Server Ready");
}

Players.PlayerAdded.Connect(async (player) => {
	setReadyPlayerStatus(player, false);

	print(`${player.DisplayName} joined`);

	while (!serverIsReady()) {
		task.wait();
	}
	print(`[SERVER INIT] Server Ready letting ${player.DisplayName} in`);

	initializePlayerNetworkMessage(player);
});

bootstrapServer();
