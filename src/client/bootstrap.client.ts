import { LifecycleMessage } from "shared/module";

const ReplicatedStorage = game.GetService("ReplicatedStorage");

const lifecycle = ReplicatedStorage.WaitForChild("Remotes").WaitForChild("Lifecycle") as RemoteEvent;

lifecycle.OnClientEvent.Connect(async (message: LifecycleMessage, data) => {
	if (message === "InitializePlayer") {
		//buildTargetUI(data.target);
		print("Player Initalizing...");
		task.wait(5);
		lifecycle.FireServer("ClientReady");
	}
});
