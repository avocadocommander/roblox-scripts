// import { Players, SoundService, UserInputService } from "@rbxts/services";
// import { applySpeed, SPEEDS } from "shared/helpers";

// const player = Players.LocalPlayer;

// player.CharacterAdded.Connect((character) => {
// 	const head = character.WaitForChild("Head") as BasePart;
// 	const humanoid = character.FindFirstChildOfClass("Humanoid");
// 	if (!humanoid) error("No Humaniod");

// 	SoundService.SetListener(Enum.ListenerType.ObjectCFrame, head);

// 	applySpeed(SPEEDS.WALK, humanoid);

// 	// User input started
// 	UserInputService.InputBegan.Connect((input, gameProcessed) => {
// 		const humanoid = character.FindFirstChildOfClass("Humanoid");
// 		if (gameProcessed || !humanoid) return;
// 		if (input.KeyCode === Enum.KeyCode.LeftShift) {
// 			applySpeed(SPEEDS.RUN, humanoid);
// 		}
// 	});

// 	// User input ended
// 	UserInputService.InputEnded.Connect((input, gameProcessed) => {
// 		const humanoid = character.FindFirstChildOfClass("Humanoid");
// 		if (gameProcessed || !humanoid) return;
// 		if (input.KeyCode === Enum.KeyCode.LeftShift) {
// 			applySpeed(SPEEDS.WALK, humanoid);
// 		}
// 	});
// });
