import { Players, SoundService, UserInputService } from "@rbxts/services";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";
import { markPlayerInitialized } from "./modules/client-init";
import { initializeMovementSystem } from "./modules/movement";
import { initializeNPCProximity } from "./modules/npc-proximity";

const lifecycle = getOrCreateLifecycleRemote();

// ── Create the shared ScreenGui that all UI scripts parent into ──────────────
const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
let screenGui = playerGui.FindFirstChild("ScreenGui") as ScreenGui | undefined;
if (!screenGui) {
	screenGui = new Instance("ScreenGui");
	screenGui.Name = "ScreenGui";
	screenGui.ResetOnSpawn = false;
	screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
	screenGui.IgnoreGuiInset = false;
	screenGui.Parent = playerGui;
}

lifecycle.OnClientEvent.Connect(async (message: string, data: unknown) => {
	if (message === "InitializePlayer") {
		print("(PLAYER INIT) Player Initalizing...");
		markPlayerInitialized();
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
