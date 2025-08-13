import { UserInputService } from "@rbxts/services";
import { applySpeed, SPEEDS } from "shared/helpers";
const Players = game.GetService("Players");
const player = Players.LocalPlayer;
const [character] = player.Character ? [player.Character] : player.CharacterAdded.Wait();

function initCharacter() {
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (!humanoid) return;
	applySpeed(SPEEDS.WALK, humanoid);
}

initCharacter();

UserInputService.InputBegan.Connect((input, gameProcessed) => {
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (gameProcessed || !humanoid) return;
	if (input.KeyCode === Enum.KeyCode.LeftShift) {
		applySpeed(SPEEDS.RUN, humanoid);
	}
});

UserInputService.InputEnded.Connect((input, gameProcessed) => {
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (gameProcessed || !humanoid) return;
	if (input.KeyCode === Enum.KeyCode.LeftShift) {
		applySpeed(SPEEDS.WALK, humanoid);
	}
});
