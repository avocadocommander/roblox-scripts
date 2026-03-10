import { applySpeed, SPEEDS } from "shared/helpers";
import { getOrCreateSprintRemote } from "shared/remotes/sprint-remote";
import { log } from "shared/helpers";

const sprintRemote = getOrCreateSprintRemote();

// This file is deprecated - all movement is now handled by the unified movement system
// in server/modules/movement.ts. This listener is kept for backward compatibility only.

sprintRemote.OnServerEvent.Connect((player, message) => {
	log(`[SPRINT] Deprecated sprint remote received - use movement system instead`, "WARN");

	const character = player.Character;
	if (!character) {
		log("[SPRINT] No character found", "WARN");
		return;
	}

	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (!humanoid) {
		log("[SPRINT] No humanoid found", "WARN");
		return;
	}

	if (message === "StartRun") {
		log(`[SPRINT] StartRun triggered for ${player.DisplayName}`);
		applySpeed(SPEEDS.RUN, humanoid);
	} else if (message === "StopRun") {
		log(`[SPRINT] StopRun triggered for ${player.DisplayName}`);
		applySpeed(SPEEDS.WALK, humanoid);
	}
});
