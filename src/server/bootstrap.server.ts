const Players = game.GetService("Players");
const ReplicatedStorage = game.GetService("ReplicatedStorage");
Players.CharacterAutoLoads = false;

function getOrCreateLifecycleRemote(): RemoteEvent {
	let remotesFolder = ReplicatedStorage.FindFirstChild("Remotes");

	if (!remotesFolder) {
		remotesFolder = new Instance("Folder");
		remotesFolder.Name = "Remotes";
		remotesFolder.Parent = ReplicatedStorage;
	}

	let lifecycle = remotesFolder.FindFirstChild("Lifecycle") as RemoteEvent | undefined;

	if (!lifecycle) {
		lifecycle = new Instance("RemoteEvent");
		lifecycle.Name = "Lifecycle";
		lifecycle.Parent = remotesFolder;
	}

	return lifecycle;
}

const lifecycle = getOrCreateLifecycleRemote();
let serverReady = false;
const readyPlayers = new Map<number, boolean>();

async function bootstrapServer() {
	// load assets / systems
	task.wait(5);
	serverReady = true;
	print("Server Ready");
}

Players.PlayerAdded.Connect(async (player) => {
	readyPlayers.set(player.UserId, false);

	print(`${player.UserId} joined`);

	while (!serverReady) {
		task.wait();
	}
	lifecycle.FireClient(player, "InitializePlayer");
});

lifecycle.OnServerEvent.Connect((player, message) => {
	if (message === "ClientReady") {
		readyPlayers.set(player.UserId, true);
		player.LoadCharacter();
		print(`${player.UserId} ready!`);
	}
});

bootstrapServer();
