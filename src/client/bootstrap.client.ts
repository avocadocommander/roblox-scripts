import { ContextActionService, Players, SoundService, StarterGui, UserInputService } from "@rbxts/services";
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
import { showPlayerQuip } from "./modules/player-quips";
import { getAssassinationFeedbackRemote } from "shared/remotes/assassination-feedback-remote";
import { QuipCategory } from "shared/config/player-quips";
import { initializeSoundEffects } from "./modules/sound-effects";

const lifecycle = getOrCreateLifecycleRemote();

// ── Disable the default Roblox backpack / inventory ──────────────────────────
// The stock backpack hijacks ` (backtick / tilde) to open and binds 1-9 to
// hotbar slots. We use ~ for the admin menu and I for our custom inventory,
// so the stock UI must be disabled. StarterGui.SetCoreGuiEnabled with
// Backpack=false also unbinds those hotkeys.
pcall(() => {
	StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false);
});

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
		initializeSoundEffects();
		initializeMovementSystem();

		// Setup NPC proximity system for custom assassination UI
		initializeNPCProximity();

		// ── Keyboard hotkeys (PC players) ────────────────────────────────
		// Inventory uses ContextActionService at a very high priority + Sink
		// so nothing else (Roblox CoreScripts, chat focus, plugins) can steal
		// `I`. Roblox's own CoreScript bindings cap out around 2000, so we
		// pick a number well above that.
		ContextActionService.BindActionAtPriority(
			"ToggleInventory",
			(_actionName, inputState) => {
				if (inputState === Enum.UserInputState.Begin) {
					toggleInventory();
				}
				return Enum.ContextActionResult.Sink;
			},
			false,
			100000,
			Enum.KeyCode.F,
		);

		UserInputService.InputBegan.Connect((input, gameProcessed) => {
			if (gameProcessed) return;

			if (input.KeyCode === Enum.KeyCode.V) {
				toggleKillBook();
			} else if (input.KeyCode === Enum.KeyCode.E) {
				fireCurrentAction();
			} else if (input.KeyCode === Enum.KeyCode.Q) {
				if (getAssassinateContext() !== "none") {
					fireAssassinateAction();
				}
			} else if (input.KeyCode === Enum.KeyCode.Z) {
				fireCampfireAction();
			}
		});

		// ── Assassination feedback quips ─────────────────────────────────
		getAssassinationFeedbackRemote().OnClientEvent.Connect((reason: unknown) => {
			showPlayerQuip(reason as QuipCategory);
		});

		print("(PLAYER INIT) Player Initalized");
		lifecycle.FireServer("ClientReady");
	}
});
