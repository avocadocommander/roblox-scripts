/**
 * NPC Dialog & Trade UI — client entry point (LocalScript).
 *
 * All logic lives in client/modules/npc-dialog.ts (a ModuleScript)
 * so other client modules can import from it.
 */

import { Players } from "@rbxts/services";
import { onPlayerInitialized } from "../modules/client-init";
import { initializeDialogUI } from "../modules/npc-dialog";

onPlayerInitialized(() => {
	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;
	initializeDialogUI(screenGui);
});
