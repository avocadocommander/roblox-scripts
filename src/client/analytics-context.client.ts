/**
 * Analytics context reporter — fires platform / deviceType to the server once
 * after init so the AnalyticsTracker can attach those low-cardinality fields
 * to every event for this player.
 *
 * Detection is server-unfriendly (UserInputService is client-only) so we do
 * the classification here and ship the resolved strings.
 */

import { GuiService, UserInputService } from "@rbxts/services";
import { onPlayerInitialized } from "./modules/client-init";
import { getOrCreateAnalyticsContextRemote } from "shared/remotes/analytics-remote";

function detectDeviceType(): string {
	const [, , gamepadEnabled] = pcall(() => UserInputService.GamepadEnabled);
	const isConsole = GuiService.IsTenFootInterface();
	const isTouch = UserInputService.TouchEnabled;
	const isMouseKeyboard = UserInputService.MouseEnabled && UserInputService.KeyboardEnabled;

	if (isConsole) return "Console";
	if (isMouseKeyboard) return "PC";
	if (isTouch) return "Mobile";
	if (gamepadEnabled === true) return "Gamepad";
	return "Unknown";
}

function detectPlatform(): string {
	if (GuiService.IsTenFootInterface()) return "Console";
	if (UserInputService.MouseEnabled && UserInputService.KeyboardEnabled) return "Desktop";
	if (UserInputService.TouchEnabled) return "Mobile";
	return "Unknown";
}

onPlayerInitialized(() => {
	const remote = getOrCreateAnalyticsContextRemote();
	const platform = detectPlatform();
	const deviceType = detectDeviceType();
	const [ok, err] = pcall(() => remote.FireServer(platform, deviceType));
	if (!ok) {
		warn(`[ANALYTICS] context report failed: ${err}`);
	}
});
