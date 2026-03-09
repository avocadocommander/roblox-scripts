import { Players, SoundService, UserInputService } from "@rbxts/services";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";
import { getOrCreateSprintRemote } from "shared/remotes/sprint-remote";

const lifecycle = getOrCreateLifecycleRemote();

lifecycle.OnClientEvent.Connect(async (message: string, data: unknown) => {
	if (message === "InitializePlayer") {
		print("(PLAYER INIT) Player Initalizing...");
		const player = Players.LocalPlayer;
		const sprintRemote = getOrCreateSprintRemote();

		player.CharacterAdded.Connect((character) => {
			const head = character.WaitForChild("Head") as BasePart;
			const humanoid = character.WaitForChild("Humanoid") as Humanoid;

			SoundService.SetListener(Enum.ListenerType.ObjectCFrame, head);
		});

		UserInputService.InputBegan.Connect((input, gameProcessed) => {
			if (gameProcessed) return;
			if (input.KeyCode === Enum.KeyCode.LeftShift) {
				sprintRemote.FireServer("StartRun");
			}
		});

		UserInputService.InputEnded.Connect((input, gameProcessed) => {
			if (gameProcessed) return;
			if (input.KeyCode === Enum.KeyCode.LeftShift) {
				sprintRemote.FireServer("StopRun");
			}
		});

		print("(PLAYER INIT) Player Initalized");
		lifecycle.FireServer("ClientReady");
	}
});
