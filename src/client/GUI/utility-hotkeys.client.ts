import { UserInputService } from "@rbxts/services";
import { onPlayerInitialized } from "../modules/client-init";
import { UI_THEME, getUIScale } from "shared/ui-theme";
import { toggleInventory, toggleKillBook, fireCampfireAction } from "../modules/ui-toggles";
import { fireAssassinateAction } from "../modules/npc-proximity";

// ── Scaling ───────────────────────────────────────────────────────────────────

function sc(base: number): number {
	return base * getUIScale();
}

// ── Mobile check — hide entirely on touch-only devices ────────────────────────

const IS_MOBILE = UserInputService.TouchEnabled && !UserInputService.KeyboardEnabled;

// ── Utility definitions ───────────────────────────────────────────────────────

interface UtilityEntry {
	icon: string;
	label: string;
	hotkey: string;
	action: () => void;
	color?: Color3;
}

const KILL_RED = Color3.fromRGB(190, 50, 50);

const UTILITIES: UtilityEntry[] = [
	{ icon: "x", label: "Assassinate", hotkey: "Q", action: fireAssassinateAction, color: KILL_RED },
	{ icon: "~", label: "Inventory", hotkey: "I", action: toggleInventory },
	{ icon: "=", label: "Book", hotkey: "V", action: toggleKillBook },
	{ icon: "*", label: "Campfire", hotkey: "Z", action: fireCampfireAction },
];

// ── Colours ───────────────────────────────────────────────────────────────────

const KEY_BG = Color3.fromRGB(22, 18, 12);
const KEY_BORDER = Color3.fromRGB(85, 68, 32);
const HOVER_BG = Color3.fromRGB(28, 24, 16);

// ── Builder ───────────────────────────────────────────────────────────────────

function buildUtilityMenu(screenGui: ScreenGui): void {
	const ROW_H = sc(26);
	const ROW_W = sc(140);
	const GAP = sc(3);
	const ICON_W = sc(22);
	const KEY_W = sc(32);
	const FONT_SZ = sc(13);
	const KEY_FONT_SZ = sc(11);

	// Container — right side, vertically centered-ish (below bounty, above mobile area)
	const container = new Instance("Frame");
	container.Name = "UtilityHotkeys";
	container.Size = new UDim2(0, ROW_W, 0, 0);
	container.AutomaticSize = Enum.AutomaticSize.Y;
	container.Position = new UDim2(1, sc(-20) - ROW_W, 0.45, 0);
	container.AnchorPoint = new Vector2(0, 0.5);
	container.BackgroundTransparency = 1;
	container.ZIndex = 30;
	container.Parent = screenGui;

	const listLayout = new Instance("UIListLayout");
	listLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	listLayout.Padding = new UDim(0, GAP);
	listLayout.Parent = container;

	for (let i = 0; i < UTILITIES.size(); i++) {
		const entry = UTILITIES[i];

		// Row frame
		const row = new Instance("TextButton");
		row.Name = entry.label;
		row.LayoutOrder = i;
		row.Size = new UDim2(1, 0, 0, ROW_H);
		row.BackgroundColor3 = UI_THEME.bg;
		row.BackgroundTransparency = 0.15;
		row.BorderSizePixel = 0;
		row.Text = "";
		row.AutoButtonColor = false;
		row.ZIndex = 30;
		row.Parent = container;

		const rowCorner = new Instance("UICorner");
		rowCorner.CornerRadius = new UDim(0, 4);
		rowCorner.Parent = row;

		const rowStroke = new Instance("UIStroke");
		rowStroke.Color = UI_THEME.border;
		rowStroke.Thickness = 0.8;
		rowStroke.Transparency = 0.4;
		rowStroke.Parent = row;

		// Icon (left)
		const icon = new Instance("TextLabel");
		icon.Name = "Icon";
		icon.Size = new UDim2(0, ICON_W, 1, 0);
		icon.Position = new UDim2(0, sc(4), 0, 0);
		icon.BackgroundTransparency = 1;
		icon.Text = entry.icon;
		icon.TextColor3 = entry.color ?? UI_THEME.textHeader;
		icon.Font = UI_THEME.fontDisplay;
		icon.TextSize = FONT_SZ;
		icon.TextXAlignment = Enum.TextXAlignment.Center;
		icon.ZIndex = 31;
		icon.Parent = row;

		// Label (center)
		const label = new Instance("TextLabel");
		label.Name = "Label";
		label.Size = new UDim2(1, -(ICON_W + KEY_W + sc(12)), 1, 0);
		label.Position = new UDim2(0, ICON_W + sc(6), 0, 0);
		label.BackgroundTransparency = 1;
		label.Text = entry.label;
		label.TextColor3 = entry.color ?? UI_THEME.textPrimary;
		label.Font = UI_THEME.fontBold;
		label.TextSize = FONT_SZ;
		label.TextXAlignment = Enum.TextXAlignment.Left;
		label.TextTruncate = Enum.TextTruncate.AtEnd;
		label.ZIndex = 31;
		label.Parent = row;

		// Hotkey badge (right)
		const keyBadge = new Instance("Frame");
		keyBadge.Name = "KeyBadge";
		keyBadge.Size = new UDim2(0, KEY_W, 0, sc(18));
		keyBadge.Position = new UDim2(1, -(KEY_W + sc(5)), 0.5, 0);
		keyBadge.AnchorPoint = new Vector2(0, 0.5);
		keyBadge.BackgroundColor3 = KEY_BG;
		keyBadge.BorderSizePixel = 0;
		keyBadge.ZIndex = 31;
		keyBadge.Parent = row;

		const badgeCorner = new Instance("UICorner");
		badgeCorner.CornerRadius = new UDim(0, 3);
		badgeCorner.Parent = keyBadge;

		const badgeStroke = new Instance("UIStroke");
		badgeStroke.Color = KEY_BORDER;
		badgeStroke.Thickness = 1;
		badgeStroke.Parent = keyBadge;

		const keyLabel = new Instance("TextLabel");
		keyLabel.Name = "Key";
		keyLabel.Size = new UDim2(1, 0, 1, 0);
		keyLabel.BackgroundTransparency = 1;
		keyLabel.Text = entry.hotkey;
		keyLabel.TextColor3 = entry.color ?? UI_THEME.textHeader;
		keyLabel.Font = UI_THEME.fontBold;
		keyLabel.TextSize = KEY_FONT_SZ;
		keyLabel.TextXAlignment = Enum.TextXAlignment.Center;
		keyLabel.ZIndex = 32;
		keyLabel.Parent = keyBadge;

		// Click action (backup for mouse users)
		row.MouseButton1Click.Connect(() => entry.action());

		// Hover — subtle highlight
		row.MouseEnter.Connect(() => {
			row.BackgroundColor3 = HOVER_BG;
			row.BackgroundTransparency = 0.08;
			if (rowStroke) rowStroke.Transparency = 0.1;
		});
		row.MouseLeave.Connect(() => {
			row.BackgroundColor3 = UI_THEME.bg;
			row.BackgroundTransparency = 0.15;
			if (rowStroke) rowStroke.Transparency = 0.4;
		});
	}
}

// ── Init ──────────────────────────────────────────────────────────────────────

if (!IS_MOBILE) {
	onPlayerInitialized(() => {
		const playerGui = game.GetService("Players").LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
		const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;
		buildUtilityMenu(screenGui);
	});
}
