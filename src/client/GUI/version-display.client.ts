import { Players } from "@rbxts/services";
import { onPlayerInitialized } from "../modules/client-init";
import { GAME_VERSION_LABEL } from "shared/config/game-version";
import { UI_THEME, getUIScale } from "shared/ui-theme";

function sc(base: number): number {
	return math.floor(base * getUIScale());
}

function buildVersionBadge(screenGui: ScreenGui): void {
	if (screenGui.FindFirstChild("VersionBadge")) return;

	const badge = new Instance("Frame");
	badge.Name = "VersionBadge";
	badge.AnchorPoint = new Vector2(1, 0);
	badge.Position = new UDim2(1, -sc(8), 0, sc(4));
	badge.Size = new UDim2(0, sc(64), 0, sc(18));
	badge.BackgroundColor3 = UI_THEME.bg;
	badge.BackgroundTransparency = 0.72;
	badge.BorderSizePixel = 0;
	badge.ZIndex = 80;
	badge.Parent = screenGui;

	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(0, sc(3));
	corner.Parent = badge;

	const stroke = new Instance("UIStroke");
	stroke.Color = UI_THEME.divider;
	stroke.Thickness = sc(1);
	stroke.Transparency = 0.45;
	stroke.Parent = badge;

	const label = new Instance("TextLabel");
	label.Name = "Label";
	label.Size = new UDim2(1, 0, 1, 0);
	label.BackgroundTransparency = 1;
	label.Text = GAME_VERSION_LABEL;
	label.TextColor3 = UI_THEME.textMuted;
	label.TextTransparency = 0.15;
	label.Font = UI_THEME.fontBody;
	label.TextSize = sc(10);
	label.TextXAlignment = Enum.TextXAlignment.Center;
	label.TextYAlignment = Enum.TextYAlignment.Center;
	label.ZIndex = 81;
	label.Parent = badge;
}

onPlayerInitialized(() => {
	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;
	buildVersionBadge(screenGui);
});
