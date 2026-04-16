import { Players, SoundService, UserInputService } from "@rbxts/services";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";
import { markPlayerInitialized } from "./modules/client-init";
import { initializeMovementSystem } from "./modules/movement";
import {
	initializeNPCProximity,
	fireCurrentAction,
	fireAssassinateAction,
	getAssassinateContext,
} from "./modules/npc-proximity";
import { toggleInventory, toggleKillBook, fireCampfireAction } from "./modules/ui-toggles";

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

		// ── Keyboard hotkeys (PC players) ────────────────────────────────
		UserInputService.InputBegan.Connect((input, gameProcessed) => {
			if (gameProcessed) return;

			if (input.KeyCode === Enum.KeyCode.Tab) {
				toggleInventory();
			} else if (input.KeyCode === Enum.KeyCode.V) {
				toggleKillBook();
			} else if (input.KeyCode === Enum.KeyCode.E) {
				fireCurrentAction();
			} else if (input.KeyCode === Enum.KeyCode.Q) {
				if (getAssassinateContext() !== "none") {
					fireAssassinateAction();
				}
			} else if (input.KeyCode === Enum.KeyCode.Z) {
				fireCampfireAction();
			} else if (input.KeyCode === Enum.KeyCode.Space) {
				fireCurrentAction();
			}
		});

		print("(PLAYER INIT) Player Initalized");
		lifecycle.FireServer("ClientReady");
	}
});
