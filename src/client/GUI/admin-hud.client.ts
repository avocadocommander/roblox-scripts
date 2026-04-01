import { Players, TweenService } from "@rbxts/services";
import { onPlayerInitialized } from "../modules/client-init";
import { UI_THEME, getUIScale } from "shared/ui-theme";
import { getAdminCommandRemote, ADMIN_USER_IDS } from "shared/remotes/admin-remote";
import { getMockBountyKillRemote, getTurnInBountyRemote } from "shared/remotes/inventory-remote";
import { POISON_LIST } from "shared/config/poisons";
import { ELIXIR_LIST } from "shared/config/elixirs";
import { RARITY_COLORS } from "shared/inventory";

function sc(base: number): number {
	return math.floor(base * getUIScale());
}

// -- State --------------------------------------------------------------------

let feedbackLabel: TextLabel | undefined;
let activeId: string | undefined;
let clipFrame: Frame | undefined;
const panelFrames = new Map<string, Frame>();
const panelHeights = new Map<string, number>();
const tabRefs = new Map<string, { btn: TextButton; stroke: UIStroke; color: Color3 }>();

// -- Admin check --------------------------------------------------------------

function isAdmin(): boolean {
	if (ADMIN_USER_IDS.includes(0)) return true;
	return ADMIN_USER_IDS.includes(Players.LocalPlayer.UserId);
}

// -- Run admin command --------------------------------------------------------

function runCommand(command: string, value?: string | number): void {
	task.spawn(() => {
		const remote = getAdminCommandRemote();
		const result = remote.InvokeServer(command, value !== undefined ? value : 0) as string;
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

// -- Dropdown toggle ----------------------------------------------------------

function toggleDropdown(id: string): void {
	if (!clipFrame) return;

	const updateTabs = (currentId: string | undefined) => {
		for (const [tid, data] of tabRefs) {
			if (tid === currentId) {
				data.stroke.Color = data.color;
				data.btn.BackgroundTransparency = 0;
			} else {
				data.stroke.Color = UI_THEME.border;
				data.btn.BackgroundTransparency = 0.15;
			}
		}
	};

	if (activeId === id) {
		const closing = id;
		activeId = undefined;
		updateTabs(undefined);
		TweenService.Create(clipFrame, new TweenInfo(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
			Size: new UDim2(1, 0, 0, 0),
		}).Play();
		task.delay(0.2, () => {
			if (activeId === undefined) {
				const f = panelFrames.get(closing);
				if (f) f.Visible = false;
			}
		});
		return;
	}

	if (activeId !== undefined) {
		const prev = panelFrames.get(activeId);
		if (prev) prev.Visible = false;
	}

	const openPanel = panelFrames.get(id);
	if (openPanel) openPanel.Visible = true;
	activeId = id;
	updateTabs(id);

	const h = panelHeights.get(id) ?? 0;
	TweenService.Create(clipFrame, new TweenInfo(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Size: new UDim2(1, 0, 0, h),
	}).Play();
}

// -- Dropdown definitions -----------------------------------------------------

interface AdminButton {
	label: string;
	color: Color3;
	action: () => void;
}

interface DropdownDef {
	id: string;
	label: string;
	color: Color3;
	buttons: AdminButton[];
}

function getDropdowns(): DropdownDef[] {
	const mockBountyKillRemote = getMockBountyKillRemote();
	const turnInBountyRemote = getTurnInBountyRemote();

	const rarityOrder = ["common", "uncommon", "rare", "epic", "legendary"];
	const sortedPoisons = POISON_LIST.map((p) => p);
	sortedPoisons.sort((a, b) => rarityOrder.indexOf(a.rarity) < rarityOrder.indexOf(b.rarity));
	const sortedElixirs = ELIXIR_LIST.map((e) => e);
	sortedElixirs.sort((a, b) => rarityOrder.indexOf(a.rarity) < rarityOrder.indexOf(b.rarity));

	return [
		{
			id: "action",
			label: "Action",
			color: UI_THEME.gold,
			buttons: [
				{ label: "+100 Gold", color: UI_THEME.gold, action: () => runCommand("addCoins", 100) },
				{ label: "+5000 Gold", color: UI_THEME.gold, action: () => runCommand("addCurrency5k") },
				{ label: "+200 XP", color: UI_THEME.textHeader, action: () => runCommand("addXP", 200) },
				{
					label: "Random XP (20-100)",
					color: Color3.fromRGB(80, 180, 200),
					action: () => runCommand("randomXP"),
				},
				{ label: "Level Up", color: Color3.fromRGB(80, 160, 80), action: () => runCommand("levelUp") },
				{
					label: "+500 Night XP",
					color: Color3.fromRGB(89, 64, 140),
					action: () => runCommand("addGuildXP", "Night"),
				},
				{
					label: "+500 Dawn XP",
					color: Color3.fromRGB(204, 166, 64),
					action: () => runCommand("addGuildXP", "Dawn"),
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
				{ label: "Reset All", color: UI_THEME.danger, action: () => runCommand("resetAll") },
			],
		},
		{
			id: "potions",
			label: "Potions",
			color: Color3.fromRGB(128, 68, 148),
			buttons: sortedPoisons.map((p) => ({
				label: p.name + " (" + p.rarity + ")",
				color: RARITY_COLORS[p.rarity] ?? UI_THEME.textPrimary,
				action: () => runCommand("givePoison", p.id),
			})),
		},
		{
			id: "elixirs",
			label: "Elixirs",
			color: Color3.fromRGB(68, 138, 82),
			buttons: sortedElixirs.map((e) => ({
				label: e.name + " (" + e.rarity + ")",
				color: RARITY_COLORS[e.rarity] ?? UI_THEME.textPrimary,
				action: () => runCommand("giveElixir", e.id),
			})),
		},
	];
}

// -- Build --------------------------------------------------------------------

function buildAdminHUD(screenGui: ScreenGui): void {
	const dropdowns = getDropdowns();
	const barHeight = sc(28);
	const tabWidth = sc(86);
	const tabGap = sc(3);
	const btnHeight = sc(26);
	const btnGap = sc(3);
	const panelPad = sc(6);
	const totalBarWidth = dropdowns.size() * tabWidth + (dropdowns.size() - 1) * tabGap;
	const containerWidth = math.max(totalBarWidth, sc(220));

	// Main container at top-center
	const container = new Instance("Frame");
	container.Name = "AdminHUD";
	container.Size = new UDim2(0, containerWidth, 0, barHeight);
	container.Position = new UDim2(0.5, 0, 0, sc(4));
	container.AnchorPoint = new Vector2(0.5, 0);
	container.BackgroundTransparency = 1;
	container.ZIndex = 40;
	container.Parent = screenGui;

	// -- Tab bar
	const bar = new Instance("Frame");
	bar.Name = "TabBar";
	bar.Size = new UDim2(1, 0, 0, barHeight);
	bar.BackgroundTransparency = 1;
	bar.ZIndex = 40;
	bar.Parent = container;

	const barLayout = new Instance("UIListLayout");
	barLayout.FillDirection = Enum.FillDirection.Horizontal;
	barLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	barLayout.Padding = new UDim(0, tabGap);
	barLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center;
	barLayout.Parent = bar;

	// -- Clip frame for dropdown panels
	clipFrame = new Instance("Frame");
	clipFrame.Name = "DropdownClip";
	clipFrame.Size = new UDim2(1, 0, 0, 0);
	clipFrame.Position = new UDim2(0, 0, 0, barHeight);
	clipFrame.BackgroundTransparency = 1;
	clipFrame.ClipsDescendants = true;
	clipFrame.ZIndex = 41;
	clipFrame.Parent = container;

	// -- Build each dropdown
	for (let i = 0; i < dropdowns.size(); i++) {
		const dd = dropdowns[i];

		// Tab button
		const tab = new Instance("TextButton");
		tab.Name = "Tab_" + dd.id;
		tab.LayoutOrder = i;
		tab.Size = new UDim2(0, tabWidth, 1, 0);
		tab.BackgroundColor3 = UI_THEME.bg;
		tab.BackgroundTransparency = 0.15;
		tab.BorderSizePixel = 0;
		tab.Text = dd.label;
		tab.TextColor3 = dd.color;
		tab.Font = UI_THEME.fontBold;
		tab.TextSize = sc(13);
		tab.AutoButtonColor = false;
		tab.ZIndex = 40;
		tab.Parent = bar;

		const tabCorner = new Instance("UICorner");
		tabCorner.CornerRadius = new UDim(0, sc(4));
		tabCorner.Parent = tab;

		const tabStroke = new Instance("UIStroke");
		tabStroke.Color = UI_THEME.border;
		tabStroke.Thickness = sc(1);
		tabStroke.Parent = tab;

		tabRefs.set(dd.id, { btn: tab, stroke: tabStroke, color: dd.color });
		tab.Activated.Connect(() => toggleDropdown(dd.id));

		// Panel (inside clip frame)
		const contentHeight = panelPad * 2 + dd.buttons.size() * (btnHeight + btnGap) - btnGap;
		panelHeights.set(dd.id, contentHeight);

		const ddPanel = new Instance("Frame");
		ddPanel.Name = "Panel_" + dd.id;
		ddPanel.Size = new UDim2(1, 0, 0, contentHeight);
		ddPanel.Position = UDim2.fromScale(0, 0);
		ddPanel.BackgroundColor3 = UI_THEME.bg;
		ddPanel.BackgroundTransparency = 0.06;
		ddPanel.BorderSizePixel = 0;
		ddPanel.Visible = false;
		ddPanel.ZIndex = 41;
		ddPanel.Parent = clipFrame;
		panelFrames.set(dd.id, ddPanel);

		const panelCorner = new Instance("UICorner");
		panelCorner.CornerRadius = UI_THEME.cornerRadius;
		panelCorner.Parent = ddPanel;

		const panelStroke = new Instance("UIStroke");
		panelStroke.Color = UI_THEME.border;
		panelStroke.Thickness = sc(1);
		panelStroke.Parent = ddPanel;

		const pad = new Instance("UIPadding");
		pad.PaddingTop = new UDim(0, panelPad);
		pad.PaddingBottom = new UDim(0, panelPad);
		pad.PaddingLeft = new UDim(0, panelPad);
		pad.PaddingRight = new UDim(0, panelPad);
		pad.Parent = ddPanel;

		const layout = new Instance("UIListLayout");
		layout.SortOrder = Enum.SortOrder.LayoutOrder;
		layout.Padding = new UDim(0, btnGap);
		layout.Parent = ddPanel;

		// Command buttons
		for (let j = 0; j < dd.buttons.size(); j++) {
			const def = dd.buttons[j];
			const btn = new Instance("TextButton");
			btn.LayoutOrder = j;
			btn.Size = new UDim2(1, 0, 0, btnHeight);
			btn.BackgroundColor3 = UI_THEME.bgInset;
			btn.BackgroundTransparency = 0.1;
			btn.BorderSizePixel = 0;
			btn.Text = def.label;
			btn.TextColor3 = def.color;
			btn.Font = UI_THEME.fontBold;
			btn.TextSize = sc(12);
			btn.AutoButtonColor = false;
			btn.ZIndex = 42;
			btn.Parent = ddPanel;

			const btnCorner = new Instance("UICorner");
			btnCorner.CornerRadius = new UDim(0, sc(4));
			btnCorner.Parent = btn;

			const btnStroke = new Instance("UIStroke");
			btnStroke.Color = UI_THEME.divider;
			btnStroke.Thickness = sc(0.8);
			btnStroke.Parent = btn;

			btn.Activated.Connect(() => {
				def.action();
				btn.BackgroundColor3 = def.color;
				btn.BackgroundTransparency = 0.4;
				task.delay(0.15, () => {
					btn.BackgroundColor3 = UI_THEME.bgInset;
					btn.BackgroundTransparency = 0.1;
				});
			});
		}
	}

	// -- Feedback label (to the right of the bar)
	feedbackLabel = new Instance("TextLabel");
	feedbackLabel.Name = "Feedback";
	feedbackLabel.Size = new UDim2(0, sc(200), 0, barHeight);
	feedbackLabel.Position = new UDim2(1, sc(8), 0, 0);
	feedbackLabel.BackgroundTransparency = 1;
	feedbackLabel.Text = "";
	feedbackLabel.TextColor3 = UI_THEME.textPrimary;
	feedbackLabel.Font = UI_THEME.fontBody;
	feedbackLabel.TextSize = sc(11);
	feedbackLabel.TextWrapped = true;
	feedbackLabel.TextTransparency = 1;
	feedbackLabel.TextXAlignment = Enum.TextXAlignment.Left;
	feedbackLabel.ZIndex = 50;
	feedbackLabel.Parent = container;
}

// -- Init ---------------------------------------------------------------------

onPlayerInitialized(() => {
	if (!isAdmin()) return;

	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

	buildAdminHUD(screenGui);
});
