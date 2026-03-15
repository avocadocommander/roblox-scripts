import { Players, SoundService, UserInputService } from "@rbxts/services";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";
import { initializeMovementSystem } from "./modules/movement";
import { initializeNPCProximity } from "./modules/npc-proximity";
import "./campfire.client"; // Initialize campfire client handler

const lifecycle = getOrCreateLifecycleRemote();

lifecycle.OnClientEvent.Connect(async (message: string, data: unknown) => {
	if (message === "InitializePlayer") {
		print("(PLAYER INIT) Player Initalizing...");
		const player = Players.LocalPlayer;

		player.CharacterAdded.Connect((character) => {
			const head = character.WaitForChild("Head") as BasePart;
			const humanoid = character.WaitForChild("Humanoid") as Humanoid;

			SoundService.SetListener(Enum.ListenerType.ObjectCFrame, head);
		});

		// Setup unified movement system (handles run, walk, and jump)
		initializeMovementSystem();

		// Setup NPC proximity system for custom assassination UI
		initializeNPCProximity();

		print("(PLAYER INIT) Player Initalized");
		lifecycle.FireServer("ClientReady");
	}
});
