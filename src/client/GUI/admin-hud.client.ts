import { Players, TweenService } from "@rbxts/services";
import { onPlayerInitialized } from "../modules/client-init";
import { UI_THEME, getUIScale } from "shared/ui-theme";
import { getAdminCommandRemote, ADMIN_USER_IDS } from "shared/remotes/admin-remote";
import { getMockBountyKillRemote, getTurnInBountyRemote } from "shared/remotes/inventory-remote";

function sc(base: number): number {
	return math.floor(base * getUIScale());
}

// -- State --------------------------------------------------------------------

let isExpanded = false;
let panel: Frame | undefined;
let toggleBtn: TextButton | undefined;
let feedbackLabel: TextLabel | undefined;

// -- Admin check --------------------------------------------------------------

function isAdmin(): boolean {
	if (ADMIN_USER_IDS.includes(0)) return true;
	return ADMIN_USER_IDS.includes(Players.LocalPlayer.UserId);
}

// -- Run admin command --------------------------------------------------------

function runCommand(command: string, value?: number): void {
	task.spawn(() => {
		const remote = getAdminCommandRemote();
		const result = remote.InvokeServer(command, value ?? 0) as string;
		showFeedback(result);
	});
}

function showFeedback(msg: string): void {
	if (!feedbackLabel) return;
	feedbackLabel.Text = msg;
	feedbackLabel.TextTransparency = 0;
	TweenService.Create(feedbackLabel, new TweenInfo(2, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
		TextTransparency: 1,
	}).Play();
}

// -- Button definitions -------------------------------------------------------

interface AdminButton {
	label: string;
	color: Color3;
	action: () => void;
}

function getButtons(): AdminButton[] {
	const mockBountyKillRemote = getMockBountyKillRemote();
	const turnInBountyRemote = getTurnInBountyRemote();

	return [
		{
			label: "+100 Gold",
			color: UI_THEME.gold,
			action: () => runCommand("addCoins", 100),
		},
		{
			label: "+200 XP",
			color: UI_THEME.textHeader,
			action: () => runCommand("addXP", 200),
		},
		{
			label: "Level Up",
			color: Color3.fromRGB(80, 160, 80),
			action: () => runCommand("levelUp"),
		},
		{
			label: "Reset LVL/XP",
			color: UI_THEME.danger,
			action: () => runCommand("resetProgress"),
		},
		{
			label: "New Bounty",
			color: Color3.fromRGB(100, 80, 160),
			action: () => runCommand("randomBounty"),
		},
		{
			label: "Mock Kill",
			color: Color3.fromRGB(160, 80, 60),
			action: () => {
				mockBountyKillRemote.FireServer();
				showFeedback("Fired mock bounty kill");
			},
		},
		{
			label: "Turn In Scroll",
			color: Color3.fromRGB(60, 120, 160),
			action: () => {
				turnInBountyRemote.FireServer();
				showFeedback("Turned in bounty scroll");
			},
		},
	];
}

// -- Build --------------------------------------------------------------------

function buildAdminHUD(screenGui: ScreenGui): void {
	const buttons = getButtons();
	const btnHeight = sc(32);
	const btnGap = sc(6);
	const panelWidth = sc(150);
	const panelPad = sc(8);
	const panelHeight = panelPad * 2 + buttons.size() * (btnHeight + btnGap) - btnGap + sc(24);
	const tabWidth = sc(28);
	const tabHeight = sc(80);

	// Container holds both the tab and the panel
	const container = new Instance("Frame");
	container.Name = "AdminHUD";
	container.Size = new UDim2(0, panelWidth + tabWidth, 0, panelHeight);
	container.Position = new UDim2(1, 0, 0.5, -panelHeight / 2);
	container.AnchorPoint = new Vector2(0, 0);
	container.BackgroundTransparency = 1;
	container.Parent = screenGui;

	// -- Tab button (always visible, right edge of screen) --------------------
	toggleBtn = new Instance("TextButton");
	toggleBtn.Name = "AdminTab";
	toggleBtn.Size = new UDim2(0, tabWidth, 0, tabHeight);
	toggleBtn.Position = new UDim2(0, 0, 0.5, -tabHeight / 2);
	toggleBtn.AnchorPoint = new Vector2(0, 0);
	toggleBtn.BackgroundColor3 = UI_THEME.bg;
	toggleBtn.BackgroundTransparency = 0.1;
	toggleBtn.BorderSizePixel = 0;
	toggleBtn.Text = "<";
	toggleBtn.TextColor3 = UI_THEME.gold;
	toggleBtn.Font = UI_THEME.fontBold;
	toggleBtn.TextSize = sc(16);
	toggleBtn.AutoButtonColor = false;
	toggleBtn.Parent = container;

	const tabCorner = new Instance("UICorner");
	tabCorner.CornerRadius = new UDim(0, sc(4));
	tabCorner.Parent = toggleBtn;

	const tabStroke = new Instance("UIStroke");
	tabStroke.Color = UI_THEME.border;
	tabStroke.Thickness = sc(1);
	tabStroke.Parent = toggleBtn;

	// -- Panel (slides out to the left of the tab) ----------------------------
	panel = new Instance("Frame");
	panel.Name = "AdminPanel";
	panel.Size = new UDim2(0, panelWidth, 1, 0);
	panel.Position = new UDim2(0, tabWidth, 0, 0);
	panel.BackgroundColor3 = UI_THEME.bg;
	panel.BackgroundTransparency = 0.06;
	panel.BorderSizePixel = 0;
	panel.ClipsDescendants = true;
	panel.Visible = false;
	panel.Parent = container;

	const panelCorner = new Instance("UICorner");
	panelCorner.CornerRadius = UI_THEME.cornerRadius;
	panelCorner.Parent = panel;

	const panelStroke = new Instance("UIStroke");
	panelStroke.Color = UI_THEME.border;
	panelStroke.Thickness = sc(1.2);
	panelStroke.Parent = panel;

	const pad = new Instance("UIPadding");
	pad.PaddingTop = new UDim(0, panelPad);
	pad.PaddingBottom = new UDim(0, panelPad);
	pad.PaddingLeft = new UDim(0, panelPad);
	pad.PaddingRight = new UDim(0, panelPad);
	pad.Parent = panel;

	const layout = new Instance("UIListLayout");
	layout.SortOrder = Enum.SortOrder.LayoutOrder;
	layout.Padding = new UDim(0, btnGap);
	layout.Parent = panel;

	// -- Title label -----------------------------------------------------------
	const title = new Instance("TextLabel");
	title.LayoutOrder = 0;
	title.Size = new UDim2(1, 0, 0, sc(18));
	title.BackgroundTransparency = 1;
	title.Text = "ADMIN";
	title.TextColor3 = UI_THEME.gold;
	title.Font = UI_THEME.fontDisplay;
	title.TextSize = sc(14);
	title.TextXAlignment = Enum.TextXAlignment.Center;
	title.Parent = panel;

	// -- Command buttons -------------------------------------------------------
	for (let i = 0; i < buttons.size(); i++) {
		const def = buttons[i];
		const btn = new Instance("TextButton");
		btn.LayoutOrder = i + 1;
		btn.Size = new UDim2(1, 0, 0, btnHeight);
		btn.BackgroundColor3 = UI_THEME.bgInset;
		btn.BackgroundTransparency = 0.1;
		btn.BorderSizePixel = 0;
		btn.Text = def.label;
		btn.TextColor3 = def.color;
		btn.Font = UI_THEME.fontBold;
		btn.TextSize = sc(13);
		btn.AutoButtonColor = false;
		btn.Parent = panel;

		const btnCorner = new Instance("UICorner");
		btnCorner.CornerRadius = new UDim(0, sc(4));
		btnCorner.Parent = btn;

		const btnStroke = new Instance("UIStroke");
		btnStroke.Color = UI_THEME.divider;
		btnStroke.Thickness = sc(0.8);
		btnStroke.Parent = btn;

		btn.Activated.Connect(() => {
			def.action();
			// Flash feedback
			btn.BackgroundColor3 = def.color;
			btn.BackgroundTransparency = 0.4;
			task.delay(0.15, () => {
				btn.BackgroundColor3 = UI_THEME.bgInset;
				btn.BackgroundTransparency = 0.1;
			});
		});
	}

	// -- Feedback label --------------------------------------------------------
	feedbackLabel = new Instance("TextLabel");
	feedbackLabel.LayoutOrder = 100;
	feedbackLabel.Size = new UDim2(1, 0, 0, sc(16));
	feedbackLabel.BackgroundTransparency = 1;
	feedbackLabel.Text = "";
	feedbackLabel.TextColor3 = UI_THEME.textPrimary;
	feedbackLabel.Font = UI_THEME.fontBody;
	feedbackLabel.TextSize = sc(11);
	feedbackLabel.TextWrapped = true;
	feedbackLabel.TextTransparency = 1;
	feedbackLabel.Parent = panel;

	// -- Toggle expand / collapse ---------------------------------------------
	toggleBtn.Activated.Connect(() => {
		togglePanel(container, panelWidth, tabWidth);
	});
}

// -- Slide animation ----------------------------------------------------------

function togglePanel(container: Frame, panelWidth: number, tabWidth: number): void {
	isExpanded = !isExpanded;

	if (!panel || !toggleBtn) return;

	if (isExpanded) {
		panel.Visible = true;
		// Slide the container to the left so the panel is visible
		TweenService.Create(container, new TweenInfo(0.25, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			Position: new UDim2(1, -(panelWidth + tabWidth), 0.5, -container.Size.Y.Offset / 2),
		}).Play();
		toggleBtn.Text = ">";
	} else {
		TweenService.Create(container, new TweenInfo(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
			Position: new UDim2(1, 0, 0.5, -container.Size.Y.Offset / 2),
		}).Play();
		toggleBtn.Text = "<";
		task.delay(0.2, () => {
			if (!isExpanded && panel) panel.Visible = false;
		});
	}
}

// -- Init ---------------------------------------------------------------------

onPlayerInitialized(() => {
	if (!isAdmin()) return; // Only show for admins

	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

	buildAdminHUD(screenGui);
});
