import { Players, TweenService, UserInputService } from "@rbxts/services";
import { onPlayerInitialized } from "../modules/client-init";
import { UI_THEME, getUIScale } from "shared/ui-theme";
import { AdminCommandResult, AdminMetricsStats, getAdminCommandRemote, ADMIN_USER_IDS } from "shared/remotes/admin-remote";
import { getMockBountyKillRemote, getTurnInBountyRemote } from "shared/remotes/inventory-remote";
import { POISON_LIST, getPoisonDisplayName } from "shared/config/poisons";
import { ELIXIR_LIST, getElixirDisplayName } from "shared/config/elixirs";
import { RARITY_COLORS } from "shared/inventory";

function sc(base: number): number {
	return math.floor(base * getUIScale());
}

// -- State --------------------------------------------------------------------

let feedbackLabel: TextLabel | undefined;
let panelRoot: Frame | undefined;
let metricsStatsBar: Frame | undefined;
let metricsTitleLabel: TextLabel | undefined;
let metricsStatLabels: TextLabel[] = [];
let panelOpen = false;

// -- Admin check --------------------------------------------------------------

function isAdmin(): boolean {
	if (ADMIN_USER_IDS.includes(0)) return true;
	return ADMIN_USER_IDS.includes(Players.LocalPlayer.UserId);
}

// -- Run admin command --------------------------------------------------------

function runCommand(command: string, value?: string | number): void {
	task.spawn(() => {
		const remote = getAdminCommandRemote();
		const result = remote.InvokeServer(command, value !== undefined ? value : 0) as string | AdminCommandResult;
		if (typeOf(result) === "table") {
			const commandResult = result as AdminCommandResult;
			showFeedback(commandResult.message);
			if (commandResult.metricsActive === false) hideMetricsStatsBar();
			else if (commandResult.metricsStats !== undefined) showMetricsStatsBar(commandResult.metricsStats);
		} else {
			showFeedback(result as string);
		}
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

function setStatText(index: number, label: string, value: string): void {
	const stat = metricsStatLabels[index];
	if (!stat) return;
	stat.Text = label + "\n" + value;
}

function showMetricsStatsBar(stats: AdminMetricsStats): void {
	if (!metricsStatsBar || !metricsTitleLabel) return;
	metricsTitleLabel.Text = stats.modeLabel.upper();
	setStatText(0, "Sessions", tostring(stats.sessions));
	setStatText(1, "Players", tostring(stats.players));
	setStatText(2, "Paths", tostring(stats.paths));
	setStatText(3, "Points", tostring(stats.points));
	setStatText(4, "Longest", stats.longestSession);
	setStatText(5, "Window", stats.window);
	metricsStatsBar.Visible = true;
	metricsStatsBar.BackgroundTransparency = 0.12;
}

function hideMetricsStatsBar(): void {
	if (!metricsStatsBar) return;
	metricsStatsBar.Visible = false;
}

function buildMetricsStatsBar(screenGui: ScreenGui): void {
	const bar = new Instance("Frame");
	bar.Name = "MetricsStatsBar";
	bar.Size = new UDim2(0, sc(760), 0, sc(56));
	bar.Position = new UDim2(0.5, 0, 0, sc(8));
	bar.AnchorPoint = new Vector2(0.5, 0);
	bar.BackgroundColor3 = UI_THEME.bg;
	bar.BackgroundTransparency = 0.12;
	bar.BorderSizePixel = 0;
	bar.Visible = false;
	bar.ZIndex = 70;
	bar.Parent = screenGui;
	metricsStatsBar = bar;

	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(0, sc(6));
	corner.Parent = bar;

	const stroke = new Instance("UIStroke");
	stroke.Color = Color3.fromRGB(120, 98, 44);
	stroke.Thickness = sc(1.2);
	stroke.Transparency = 0.15;
	stroke.Parent = bar;

	const layout = new Instance("UIListLayout");
	layout.FillDirection = Enum.FillDirection.Horizontal;
	layout.SortOrder = Enum.SortOrder.LayoutOrder;
	layout.VerticalAlignment = Enum.VerticalAlignment.Center;
	layout.Padding = new UDim(0, sc(8));
	layout.Parent = bar;

	const pad = new Instance("UIPadding");
	pad.PaddingLeft = new UDim(0, sc(12));
	pad.PaddingRight = new UDim(0, sc(12));
	pad.Parent = bar;

	const title = new Instance("TextLabel");
	title.Name = "Title";
	title.LayoutOrder = 0;
	title.Size = new UDim2(0, sc(150), 1, 0);
	title.BackgroundTransparency = 1;
	title.Font = UI_THEME.fontBold;
	title.Text = "METRICS";
	title.TextColor3 = Color3.fromRGB(220, 178, 74);
	title.TextSize = sc(13);
	title.TextXAlignment = Enum.TextXAlignment.Left;
	title.TextWrapped = true;
	title.ZIndex = 71;
	title.Parent = bar;
	metricsTitleLabel = title;

	metricsStatLabels = [];
	const statWidth = sc(92);
	for (let i = 0; i < 6; i++) {
		const stat = new Instance("TextLabel");
		stat.Name = "Stat_" + tostring(i);
		stat.LayoutOrder = i + 1;
		stat.Size = new UDim2(0, statWidth, 1, 0);
		stat.BackgroundTransparency = 1;
		stat.Font = UI_THEME.fontBold;
		stat.Text = "";
		stat.TextColor3 = UI_THEME.textPrimary;
		stat.TextSize = sc(11);
		stat.TextXAlignment = Enum.TextXAlignment.Center;
		stat.TextYAlignment = Enum.TextYAlignment.Center;
		stat.TextWrapped = true;
		stat.ZIndex = 71;
		stat.Parent = bar;
		metricsStatLabels.push(stat);
	}
}

// -- Panel toggle -------------------------------------------------------------

function setPanelOpen(open: boolean): void {
	if (!panelRoot) return;
	if (open === panelOpen) return;
	panelOpen = open;
	panelRoot.Visible = open;
}

function togglePanel(): void {
	setPanelOpen(!panelOpen);
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
	// Group by rarity, then by family, then by tier so families read "Base, +, ++" together.
	const sortedPoisons = POISON_LIST.map((p) => p);
	sortedPoisons.sort((a, b) => {
		const ra = rarityOrder.indexOf(a.rarity);
		const rb = rarityOrder.indexOf(b.rarity);
		if (ra !== rb) return ra < rb;
		if (a.familyId !== b.familyId) return a.familyId < b.familyId;
		return a.tier < b.tier;
	});
	const sortedElixirs = ELIXIR_LIST.map((e) => e);
	sortedElixirs.sort((a, b) => {
		const ra = rarityOrder.indexOf(a.rarity);
		const rb = rarityOrder.indexOf(b.rarity);
		if (ra !== rb) return ra < rb;
		if (a.familyId !== b.familyId) return a.familyId < b.familyId;
		return a.tier < b.tier;
	});

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
			],
		},
		{
			id: "events",
			label: "Events",
			color: Color3.fromRGB(90, 170, 220),
			buttons: [
				{
					label: "Trigger Special Event",
					color: Color3.fromRGB(200, 140, 60),
					action: () => runCommand("triggerSpecialEvent", "Royal Decree: A Special Event Has Begun"),
				},
				{
					label: "Dream Clouds Toggle",
					color: Color3.fromRGB(105, 185, 235),
					action: () => runCommand("toggleDreamClouds"),
				},
				{
					label: "Traveling Merchant Toggle",
					color: Color3.fromRGB(80, 180, 120),
					action: () => runCommand("toggleTravelingMerchant"),
				},
			],
		},
		{
			id: "metrics",
			label: "Metrics",
			color: Color3.fromRGB(150, 210, 230),
			buttons: [
				{
					label: "Live Trails Toggle",
					color: Color3.fromRGB(150, 210, 230),
					action: () => runCommand("togglePositionTrails"),
				},
				{
					label: "Historical Toggle",
					color: Color3.fromRGB(190, 150, 230),
					action: () => runCommand("toggleHistoricalPositionTrails"),
				},
				{
					label: "1 Today Activity",
					color: Color3.fromRGB(80, 180, 160),
					action: () => runCommand("showTodayPositionTrails"),
				},
				{
					label: "2 Yesterday Activity",
					color: Color3.fromRGB(120, 150, 210),
					action: () => runCommand("showYesterdayPositionTrails"),
				},
				{
					label: "3 Latest Sessions",
					color: Color3.fromRGB(190, 150, 230),
					action: () => runCommand("showLatestPositionTrails"),
				},
			],
		},
		{
			id: "reset",
			label: "Reset",
			color: UI_THEME.danger,
			buttons: [
				{
					label: "Reset Spawn",
					color: Color3.fromRGB(210, 130, 60),
					action: () => runCommand("resetSpawn"),
				},
				{
					label: "Reset Achievements",
					color: Color3.fromRGB(180, 100, 60),
					action: () => runCommand("resetAchievements"),
				},
				{ label: "Reset All", color: UI_THEME.danger, action: () => runCommand("resetAll") },
			],
		},
		{
			id: "potions",
			label: "Potions",
			color: Color3.fromRGB(128, 68, 148),
			buttons: sortedPoisons.map((p) => ({
				label: getPoisonDisplayName(p) + " (" + p.rarity + ")",
				color: RARITY_COLORS[p.rarity] ?? UI_THEME.textPrimary,
				action: () => runCommand("givePoison", p.id),
			})),
		},
		{
			id: "elixirs",
			label: "Elixirs",
			color: Color3.fromRGB(68, 138, 82),
			buttons: sortedElixirs.map((e) => ({
				label: getElixirDisplayName(e) + " (" + e.rarity + ")",
				color: RARITY_COLORS[e.rarity] ?? UI_THEME.textPrimary,
				action: () => runCommand("giveElixir", e.id),
			})),
		},
	];
}

// -- Build --------------------------------------------------------------------

function buildAdminHUD(screenGui: ScreenGui): void {
	const dropdowns = getDropdowns();

	// Debug panel is keyboard-only: Ctrl + `. There is intentionally no
	// on-screen button so it cannot be opened on mobile/console builds and
	// stays invisible to non-admin players.

	// ── Root popup (hidden by default) ─────────────────────────────────────
	const root = new Instance("Frame");
	root.Name = "AdminPanel";
	root.Size = new UDim2(0.8, 0, 0.78, 0);
	root.Position = new UDim2(0.5, 0, 0.5, 0);
	root.AnchorPoint = new Vector2(0.5, 0.5);
	root.BackgroundColor3 = UI_THEME.bg;
	root.BackgroundTransparency = 0.45; // quite transparent — control-panel feel
	root.BorderSizePixel = 0;
	root.Visible = false;
	root.ZIndex = 60;
	root.Parent = screenGui;
	panelRoot = root;

	const rootCorner = new Instance("UICorner");
	rootCorner.CornerRadius = new UDim(0, sc(6));
	rootCorner.Parent = root;

	const rootStroke = new Instance("UIStroke");
	rootStroke.Color = UI_THEME.border;
	rootStroke.Thickness = sc(1.2);
	rootStroke.Transparency = 0.2;
	rootStroke.Parent = root;

	const rootPad = new Instance("UIPadding");
	rootPad.PaddingTop = new UDim(0, sc(14));
	rootPad.PaddingBottom = new UDim(0, sc(14));
	rootPad.PaddingLeft = new UDim(0, sc(16));
	rootPad.PaddingRight = new UDim(0, sc(16));
	rootPad.Parent = root;

	// ── Header row (title + close hint) ────────────────────────────────────
	const headerRow = new Instance("Frame");
	headerRow.Name = "Header";
	headerRow.Size = new UDim2(1, 0, 0, sc(28));
	headerRow.BackgroundTransparency = 1;
	headerRow.ZIndex = 61;
	headerRow.Parent = root;

	const title = new Instance("TextLabel");
	title.Size = new UDim2(0.7, 0, 1, 0);
	title.BackgroundTransparency = 1;
	title.Text = "DEBUG CONTROL PANEL";
	title.TextColor3 = UI_THEME.textHeader;
	title.Font = UI_THEME.fontDisplay;
	title.TextSize = sc(20);
	title.TextXAlignment = Enum.TextXAlignment.Left;
	title.ZIndex = 61;
	title.Parent = headerRow;

	const closeHint = new Instance("TextLabel");
	closeHint.Size = new UDim2(0.3, 0, 1, 0);
	closeHint.Position = new UDim2(0.7, 0, 0, 0);
	closeHint.BackgroundTransparency = 1;
	closeHint.Text = "press Ctrl+` to close";
	closeHint.TextColor3 = UI_THEME.textMuted;
	closeHint.Font = UI_THEME.fontBody;
	closeHint.TextSize = sc(12);
	closeHint.TextXAlignment = Enum.TextXAlignment.Right;
	closeHint.ZIndex = 61;
	closeHint.Parent = headerRow;

	// ── Feedback line under header ─────────────────────────────────────────
	feedbackLabel = new Instance("TextLabel");
	feedbackLabel.Name = "Feedback";
	feedbackLabel.Size = new UDim2(1, 0, 0, sc(16));
	feedbackLabel.Position = new UDim2(0, 0, 0, sc(30));
	feedbackLabel.BackgroundTransparency = 1;
	feedbackLabel.Text = "";
	feedbackLabel.TextColor3 = UI_THEME.textPrimary;
	feedbackLabel.Font = UI_THEME.fontBody;
	feedbackLabel.TextSize = sc(12);
	feedbackLabel.TextTransparency = 1;
	feedbackLabel.TextXAlignment = Enum.TextXAlignment.Left;
	feedbackLabel.ZIndex = 61;
	feedbackLabel.Parent = root;

	// ── Scrollable body holding one column per section ─────────────────────
	const body = new Instance("ScrollingFrame");
	body.Name = "Body";
	body.Size = new UDim2(1, 0, 1, sc(-52));
	body.Position = new UDim2(0, 0, 0, sc(52));
	body.BackgroundTransparency = 1;
	body.BorderSizePixel = 0;
	body.CanvasSize = new UDim2(0, 0, 0, 0);
	body.AutomaticCanvasSize = Enum.AutomaticSize.Y;
	body.ScrollBarThickness = sc(6);
	body.ScrollBarImageColor3 = UI_THEME.border;
	body.ScrollBarImageTransparency = 0.4;
	body.ScrollingDirection = Enum.ScrollingDirection.Y;
	body.ZIndex = 61;
	body.Parent = root;

	const columns = new Instance("Frame");
	columns.Size = new UDim2(1, 0, 0, 0);
	columns.AutomaticSize = Enum.AutomaticSize.Y;
	columns.BackgroundTransparency = 1;
	columns.ZIndex = 61;
	columns.Parent = body;

	const columnsLayout = new Instance("UIListLayout");
	columnsLayout.FillDirection = Enum.FillDirection.Horizontal;
	columnsLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	columnsLayout.Padding = new UDim(0, sc(12));
	columnsLayout.HorizontalAlignment = Enum.HorizontalAlignment.Left;
	columnsLayout.VerticalAlignment = Enum.VerticalAlignment.Top;
	columnsLayout.Parent = columns;

	const btnHeight = sc(26);
	const btnGap = sc(4);

	// ── Build each section as a column ─────────────────────────────────────
	for (let i = 0; i < dropdowns.size(); i++) {
		const dd = dropdowns[i];

		const col = new Instance("Frame");
		col.Name = "Col_" + dd.id;
		col.LayoutOrder = i;
		col.Size = new UDim2(0, sc(220), 0, 0);
		col.AutomaticSize = Enum.AutomaticSize.Y;
		col.BackgroundTransparency = 1;
		col.ZIndex = 61;
		col.Parent = columns;

		const colLayout = new Instance("UIListLayout");
		colLayout.SortOrder = Enum.SortOrder.LayoutOrder;
		colLayout.Padding = new UDim(0, btnGap);
		colLayout.Parent = col;

		// Section header
		const sectionLabel = new Instance("TextLabel");
		sectionLabel.Name = "SectionHeader";
		sectionLabel.LayoutOrder = 0;
		sectionLabel.Size = new UDim2(1, 0, 0, sc(22));
		sectionLabel.BackgroundTransparency = 1;
		sectionLabel.Text = dd.label.upper();
		sectionLabel.TextColor3 = dd.color;
		sectionLabel.Font = UI_THEME.fontBold;
		sectionLabel.TextSize = sc(13);
		sectionLabel.TextXAlignment = Enum.TextXAlignment.Left;
		sectionLabel.ZIndex = 61;
		sectionLabel.Parent = col;

		const divider = new Instance("Frame");
		divider.Name = "Divider";
		divider.LayoutOrder = 1;
		divider.Size = new UDim2(1, 0, 0, 1);
		divider.BackgroundColor3 = dd.color;
		divider.BackgroundTransparency = 0.5;
		divider.BorderSizePixel = 0;
		divider.ZIndex = 61;
		divider.Parent = col;

		// Buttons
		for (let j = 0; j < dd.buttons.size(); j++) {
			const def = dd.buttons[j];
			const btn = new Instance("TextButton");
			btn.LayoutOrder = 2 + j;
			btn.Size = new UDim2(1, 0, 0, btnHeight);
			btn.BackgroundColor3 = UI_THEME.bgInset;
			btn.BackgroundTransparency = 0.35;
			btn.BorderSizePixel = 0;
			btn.Text = def.label;
			btn.TextColor3 = def.color;
			btn.Font = UI_THEME.fontBold;
			btn.TextSize = sc(12);
			btn.TextXAlignment = Enum.TextXAlignment.Left;
			btn.AutoButtonColor = false;
			btn.ZIndex = 62;
			btn.Parent = col;

			const btnCorner = new Instance("UICorner");
			btnCorner.CornerRadius = new UDim(0, sc(4));
			btnCorner.Parent = btn;

			const btnStroke = new Instance("UIStroke");
			btnStroke.Color = UI_THEME.divider;
			btnStroke.Thickness = sc(0.8);
			btnStroke.Transparency = 0.3;
			btnStroke.Parent = btn;

			const btnPad = new Instance("UIPadding");
			btnPad.PaddingLeft = new UDim(0, sc(8));
			btnPad.PaddingRight = new UDim(0, sc(8));
			btnPad.Parent = btn;

			btn.MouseEnter.Connect(() => {
				btn.BackgroundTransparency = 0.15;
			});
			btn.MouseLeave.Connect(() => {
				btn.BackgroundTransparency = 0.35;
			});
			btn.Activated.Connect(() => {
				def.action();
				btn.BackgroundColor3 = def.color;
				btn.BackgroundTransparency = 0.5;
				task.delay(0.15, () => {
					btn.BackgroundColor3 = UI_THEME.bgInset;
					btn.BackgroundTransparency = 0.35;
				});
			});
		}
	}
}

// -- Init ---------------------------------------------------------------------

onPlayerInitialized(() => {
	if (!isAdmin()) return;

	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

	buildAdminHUD(screenGui);
	buildMetricsStatsBar(screenGui);

	// Toggle with Ctrl + ` (backquote). Keyboard-only -- not reachable on
	// mobile/console which have no Ctrl key. Same combo on Windows and macOS.
	UserInputService.InputBegan.Connect((input, processed) => {
		if (processed) return;
		if (input.KeyCode !== Enum.KeyCode.Backquote) return;
		const ctrlHeld =
			UserInputService.IsKeyDown(Enum.KeyCode.LeftControl) ||
			UserInputService.IsKeyDown(Enum.KeyCode.RightControl);
		if (!ctrlHeld) return;
		togglePanel();
	});
});
