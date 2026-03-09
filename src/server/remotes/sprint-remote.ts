import { applySpeed, SPEEDS } from "shared/helpers";
import { getOrCreateSprintRemote } from "shared/remotes/sprint-remote";

const sprintRemote = getOrCreateSprintRemote();

sprintRemote.OnServerEvent.Connect((player, message) => {
	const character = player.Character;
	if (!character) return;

	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (!humanoid) return;

	if (message === "StartRun") {
		print(`[SPRINT] StartRun triggered for ${player.DisplayName}`);
		applySpeed(SPEEDS.RUN, humanoid);
	} else if (message === "StopRun") {
		print(`[SPRINT] StopRun triggered for ${player.DisplayName}`);
		applySpeed(SPEEDS.WALK, humanoid);
	}
});
