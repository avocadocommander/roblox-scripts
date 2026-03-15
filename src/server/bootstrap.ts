import { initializePlayerNetworkMessage } from "./network-lifecycles";
import { setReadyPlayerStatus } from "./player-state";
import { serverIsReady, setServerStatus } from "./server-status";
import { initializeMovementSystem } from "./modules/movement";
import { initializeStealthTracker } from "./modules/stealth-tracker";
import { initializeAssassinationHandler } from "./modules/assassination-handler";
import { initializeBountyManager } from "./modules/bounty-manager";
import { initializeKillBookRemotes } from "./modules/kill-book-server";
import { initializeCampfireSystem } from "./modules/campfire-handler";

const Players = game.GetService("Players");
Players.CharacterAutoLoads = false;

export async function bootstrapServer() {
	// load assets / systems
	task.wait(5);
	initializeMovementSystem();
	initializeStealthTracker();
	initializeAssassinationHandler();
	initializeBountyManager();
	initializeKillBookRemotes();
	initializeCampfireSystem();
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
