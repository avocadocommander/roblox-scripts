import { Players, TweenService, UserInputService, Workspace } from "@rbxts/services";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";
import {
	getBountyAssignedRemote,
	getBountyCompletedRemote,
	getBountyListSyncRemote,
	getPlayerWantedClearedRemote,
	getPlayerWantedRemote,
	NPCBountyPayload,
	PlayerWantedPayload,
} from "shared/remotes/bounty-remote";
import { MEDIEVAL_NPCS, NPCData } from "shared/module";
import { UI_THEME, STATUS_RARITY, getUIScale } from "shared/ui-theme";
import { RARITY_COLORS } from "shared/inventory";

const lifecycle = getOrCreateLifecycleRemote();

// ── Screen ratio scaling helpers ──────────────────────────────────────────────

function scaleSize(baseSize: number): number {
	return baseSize * getUIScale();
}

// ─────────────────────────────────────────────────────────────────────────────

// Module-level refs so update functions can reach the labels
let npcNameLabel: TextLabel | undefined;
let npcGoldLabel: TextLabel | undefined;
let npcStatusLabel: TextLabel | undefined;
let npcRouteLabel: TextLabel | undefined;
let npcOffenceLabel: TextLabel | undefined;
let npcSectionFrame: Frame | undefined;
let wantedList: Frame | undefined;
let wantedCount = 0;
let wantedEntries: PlayerWantedPayload[] = [];
const MAX_WANTED_DISPLAY = 5;
let infoMVPButton: TextButton | undefined;
let minimizeButton: TextButton | undefined;
let isInfoMode = true; // true = INFO, false = MVP
let isMinimized = false; // true = collapsed to icon
let bountyPanel: Frame | undefined;
let bountyContentsFrame: Frame | undefined; // Contains all content except header
let dividerWrapFrame: Frame | undefined;
let wantedHeaderFrame: TextLabel | undefined;
let scaledPanelWidth = 0; // Store panel width for toggle

// ─── UI builder ───────────────────────────────────────────────────────────────

function makeParchment(screenGui: ScreenGui): void {
	// ── Outer panel (top-right) ──────────────────────────────────────────────
	const basePanelWidth = 320;
	scaledPanelWidth = scaleSize(basePanelWidth);

	const panel = new Instance("Frame");
	panel.Name = "BountyHUD";
	panel.Size = new UDim2(0, scaledPanelWidth, 0, 0);
	panel.Position = new UDim2(1, -scaleSize(332), 0, scaleSize(12));
	panel.AutomaticSize = Enum.AutomaticSize.Y;
	panel.BackgroundColor3 = UI_THEME.bg;
	panel.BackgroundTransparency = UI_THEME.bgTransparency;
	panel.BorderSizePixel = 0;
	panel.Parent = screenGui;
	bountyPanel = panel;

	const corner = new Instance("UICorner");
	corner.CornerRadius = UI_THEME.cornerRadius;
	corner.Parent = panel;

	const stroke = new Instance("UIStroke");
	stroke.Color = UI_THEME.border;
	stroke.Thickness = UI_THEME.strokeThickness;
	stroke.Parent = panel;

	const padding = new Instance("UIPadding");
	padding.PaddingBottom = new UDim(0, 10);
	padding.Parent = panel;

	const layout = new Instance("UIListLayout");
	layout.SortOrder = Enum.SortOrder.LayoutOrder;
	layout.Padding = new UDim(0, 0);
	layout.Parent = panel;

	// ── Header bar with toggle buttons ───────────────────────────────────────
	const headerContainer = new Instance("Frame");
	headerContainer.LayoutOrder = 0;
	headerContainer.Size = new UDim2(1, 0, 0, scaleSize(34));
	headerContainer.BackgroundColor3 = UI_THEME.headerBg;
	headerContainer.BackgroundTransparency = 0;
	headerContainer.BorderSizePixel = 0;
	headerContainer.Parent = panel;

	const headerCorner = new Instance("UICorner");
	headerCorner.CornerRadius = UI_THEME.cornerRadius;
	headerCorner.Parent = headerContainer;

	const header = new Instance("TextLabel");
	header.Name = "Title";
	header.Size = new UDim2(0.5, 0, 1, 0);
	header.BackgroundTransparency = 1;
	header.Text = "⚔  BOUNTY BOARD";
	header.TextColor3 = UI_THEME.textHeader;
	header.Font = UI_THEME.fontDisplay;
	header.TextSize = scaleSize(18);
	header.TextXAlignment = Enum.TextXAlignment.Left;
	header.Parent = headerContainer;

	const headerPad = new Instance("UIPadding");
	headerPad.PaddingLeft = new UDim(0, 8);
	headerPad.Parent = header;

	// Info/MVP toggle button (right after title)
	infoMVPButton = new Instance("TextButton");
	infoMVPButton.Name = "ToggleInfoMVP";
	infoMVPButton.Size = new UDim2(0.25, -4, 1, 0);
	infoMVPButton.Position = new UDim2(0.5, 0, 0, 0);
	infoMVPButton.BackgroundColor3 = UI_THEME.bgInset;
	infoMVPButton.BackgroundTransparency = 0.3;
	infoMVPButton.BorderSizePixel = 0;
	infoMVPButton.Text = "INFO";
	infoMVPButton.TextColor3 = UI_THEME.textPrimary;
	infoMVPButton.Font = UI_THEME.fontBold;
	infoMVPButton.TextSize = scaleSize(12);
	infoMVPButton.Parent = headerContainer;

	const infoButtonCorner = new Instance("UICorner");
	infoButtonCorner.CornerRadius = new UDim(0, 3);
	infoButtonCorner.Parent = infoMVPButton;

	infoMVPButton.MouseButton1Click.Connect(() => {
		toggleInfoMVPMode();
	});

	// Minimize/Expand button (far right)
	minimizeButton = new Instance("TextButton");
	minimizeButton.Name = "MinimizeExpand";
	minimizeButton.Size = new UDim2(0.15, 0, 1, 0);
	minimizeButton.Position = new UDim2(0.85, 0, 0, 0);
	minimizeButton.BackgroundColor3 = UI_THEME.danger;
	minimizeButton.BackgroundTransparency = 0.2;
	minimizeButton.BorderSizePixel = 0;
	minimizeButton.Text = "⚔";
	minimizeButton.TextColor3 = Color3.fromRGB(255, 255, 255);
	minimizeButton.Font = UI_THEME.fontBold;
	minimizeButton.TextSize = scaleSize(20);
	minimizeButton.Parent = headerContainer;

	const minimizeButtonCorner = new Instance("UICorner");
	minimizeButtonCorner.CornerRadius = new UDim(0, 4);
	minimizeButtonCorner.Parent = minimizeButton;

	minimizeButton.MouseButton1Click.Connect(() => {
		toggleMinimized();
	});

	// ── Content wrapper (everything below header) ─────────────────────────────
	const contentsWrapper = new Instance("Frame");
	contentsWrapper.LayoutOrder = 1;
	contentsWrapper.Size = new UDim2(1, 0, 0, 0);
	contentsWrapper.AutomaticSize = Enum.AutomaticSize.Y;
	contentsWrapper.BackgroundTransparency = 1;
	contentsWrapper.Parent = panel;
	bountyContentsFrame = contentsWrapper;

	const wrapLayout = new Instance("UIListLayout");
	wrapLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	wrapLayout.Padding = new UDim(0, 0);
	wrapLayout.Parent = contentsWrapper;

	// ── "YOUR MARK" section ──────────────────────────────────────────────────
	const npcSection = new Instance("Frame");
	npcSection.LayoutOrder = 0;
	npcSection.Size = new UDim2(1, -20, 0, 85);
	npcSection.BackgroundTransparency = 1;
	npcSection.Parent = contentsWrapper;
	npcSectionFrame = npcSection;

	const npcPad = new Instance("UIPadding");
	npcPad.PaddingLeft = new UDim(0, 10);
	npcPad.PaddingTop = new UDim(0, 6);
	npcPad.Parent = npcSection;

	const markLabel = new Instance("TextLabel");
	markLabel.Size = new UDim2(1, 0, 0, 16);
	markLabel.Position = new UDim2(0, 0, 0, 0);
	markLabel.BackgroundTransparency = 1;
	markLabel.Text = "YOUR MARK";
	markLabel.TextColor3 = UI_THEME.textSection;
	markLabel.Font = UI_THEME.fontBold;
	markLabel.TextSize = scaleSize(13);
	markLabel.TextXAlignment = Enum.TextXAlignment.Left;
	markLabel.Parent = npcSection;

	const nameRow = new Instance("Frame");
	nameRow.Size = new UDim2(1, 0, 0, 24);
	nameRow.Position = new UDim2(0, 0, 0, 18);
	nameRow.BackgroundTransparency = 1;
	nameRow.Parent = npcSection;

	npcNameLabel = new Instance("TextLabel");
	npcNameLabel.Name = "NPCName";
	npcNameLabel.Size = new UDim2(0.62, 0, 1, 0);
	npcNameLabel.BackgroundTransparency = 1;
	npcNameLabel.Text = "—";
	npcNameLabel.TextColor3 = UI_THEME.textPrimary;
	npcNameLabel.Font = UI_THEME.fontDisplay;
	npcNameLabel.TextSize = scaleSize(18);
	npcNameLabel.TextXAlignment = Enum.TextXAlignment.Left;
	npcNameLabel.Parent = nameRow;

	npcGoldLabel = new Instance("TextLabel");
	npcGoldLabel.Name = "NPCGold";
	npcGoldLabel.Size = new UDim2(0.38, -10, 1, 0);
	npcGoldLabel.Position = new UDim2(0.62, 0, 0, 0);
	npcGoldLabel.BackgroundTransparency = 1;
	npcGoldLabel.Text = "";
	npcGoldLabel.TextColor3 = UI_THEME.gold;
	npcGoldLabel.Font = UI_THEME.fontBold;
	npcGoldLabel.TextSize = scaleSize(16);
	npcGoldLabel.TextXAlignment = Enum.TextXAlignment.Right;
	npcGoldLabel.Parent = nameRow;

	npcStatusLabel = new Instance("TextLabel");
	npcStatusLabel.Name = "NPCStatus";
	npcStatusLabel.Size = new UDim2(1, 0, 0, 16);
	npcStatusLabel.Position = new UDim2(0, 0, 0, 44);
	npcStatusLabel.BackgroundTransparency = 1;
	npcStatusLabel.Text = "";
	npcStatusLabel.TextColor3 = UI_THEME.textMuted;
	npcStatusLabel.Font = UI_THEME.fontBody;
	npcStatusLabel.TextSize = scaleSize(12);
	npcStatusLabel.TextXAlignment = Enum.TextXAlignment.Left;
	npcStatusLabel.Visible = true;
	npcStatusLabel.Parent = npcSection;

	npcRouteLabel = new Instance("TextLabel");
	npcRouteLabel.Name = "NPCRoute";
	npcRouteLabel.Size = new UDim2(1, 0, 0, 15);
	npcRouteLabel.Position = new UDim2(0, 0, 0, 28);
	npcRouteLabel.BackgroundTransparency = 1;
	npcRouteLabel.Text = "";
	npcRouteLabel.TextColor3 = UI_THEME.textSection;
	npcRouteLabel.Font = UI_THEME.fontBody;
	npcRouteLabel.TextSize = scaleSize(12);
	npcRouteLabel.TextXAlignment = Enum.TextXAlignment.Left;
	npcRouteLabel.Visible = true;
	npcRouteLabel.Parent = npcSection;

	npcOffenceLabel = new Instance("TextLabel");
	npcOffenceLabel.Name = "NPCOffence";
	npcOffenceLabel.Size = new UDim2(1, 0, 0, 15);
	npcOffenceLabel.Position = new UDim2(0, 0, 0, 62);
	npcOffenceLabel.BackgroundTransparency = 1;
	npcOffenceLabel.Text = "";
	npcOffenceLabel.TextColor3 = UI_THEME.textMuted;
	npcOffenceLabel.Font = UI_THEME.fontBody;
	npcOffenceLabel.TextSize = scaleSize(12);
	npcOffenceLabel.TextXAlignment = Enum.TextXAlignment.Left;
	npcOffenceLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	npcOffenceLabel.Visible = true;
	npcOffenceLabel.Parent = npcSection;

	// ── Divider ──────────────────────────────────────────────────────────────
	const dividerWrap = new Instance("Frame");
	dividerWrap.LayoutOrder = 1;
	dividerWrap.Size = new UDim2(1, 0, 0, 9);
	dividerWrap.BackgroundTransparency = 1;
	dividerWrap.Parent = contentsWrapper;
	dividerWrapFrame = dividerWrap;

	const divider = new Instance("Frame");
	divider.Size = new UDim2(1, -20, 0, 1);
	divider.Position = new UDim2(0, 10, 0.5, 0);
	divider.BackgroundColor3 = UI_THEME.divider;
	divider.BackgroundTransparency = 0;
	divider.BorderSizePixel = 0;
	divider.Parent = dividerWrap;

	// ── "WANTED" header ───────────────────────────────────────────────────────
	const wantedHeader = new Instance("TextLabel");
	wantedHeader.LayoutOrder = 2;
	wantedHeader.Size = new UDim2(1, -20, 0, 22);
	wantedHeader.BackgroundTransparency = 1;
	wantedHeader.Text = "WANTED - TOP 5";
	wantedHeader.TextColor3 = UI_THEME.danger;
	wantedHeader.Font = UI_THEME.fontBold;
	wantedHeader.TextSize = scaleSize(13);
	wantedHeader.TextXAlignment = Enum.TextXAlignment.Left;
	wantedHeader.Visible = true;

	const wantedPad = new Instance("UIPadding");
	wantedPad.PaddingLeft = new UDim(0, 10);
	wantedPad.Parent = wantedHeader;
	wantedHeader.Parent = contentsWrapper;
	wantedHeaderFrame = wantedHeader;

	// ── Wanted list container ────────────────────────────────────────────────
	const listContainer = new Instance("Frame");
	listContainer.LayoutOrder = 3;
	listContainer.Name = "WantedList";
	listContainer.Size = new UDim2(1, -20, 0, 0);
	listContainer.AutomaticSize = Enum.AutomaticSize.Y;
	listContainer.BackgroundTransparency = 1;
	listContainer.Parent = contentsWrapper;
	listContainer.Visible = true;
	wantedList = listContainer;

	const listPad = new Instance("UIPadding");
	listPad.PaddingLeft = new UDim(0, 10);
	listPad.Parent = listContainer;

	const listLayout = new Instance("UIListLayout");
	listLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	listLayout.Padding = new UDim(0, 2);
	listLayout.Parent = listContainer;

	const emptyLabel = new Instance("TextLabel");
	emptyLabel.Name = "Empty";
	emptyLabel.Size = new UDim2(1, 0, 0, 18);
	emptyLabel.BackgroundTransparency = 1;
	emptyLabel.Text = "No known criminals";
	emptyLabel.TextColor3 = UI_THEME.textMuted;
	emptyLabel.Font = UI_THEME.fontBody;
	emptyLabel.TextSize = scaleSize(12);
	emptyLabel.TextXAlignment = Enum.TextXAlignment.Left;
	emptyLabel.Parent = listContainer;
}

// ─── Update helpers ───────────────────────────────────────────────────────────

function toggleInfoMVPMode(): void {
	if (!infoMVPButton || !npcSectionFrame || !dividerWrapFrame || !wantedHeaderFrame || !wantedList) return;

	isInfoMode = !isInfoMode;

	// Update button appearance and text
	infoMVPButton.Text = isInfoMode ? "INFO" : "MVP";
	infoMVPButton.TextColor3 = isInfoMode ? UI_THEME.textPrimary : UI_THEME.danger;

	// Update NPC section height and detail visibility
	if (!isInfoMode) {
		// MVP mode: compact, show route, keep wanted visible
		npcSectionFrame.Size = new UDim2(1, -20, 0, 42);
		if (npcStatusLabel) npcStatusLabel.Visible = false;
		if (npcRouteLabel) npcRouteLabel.Visible = true;
		if (npcOffenceLabel) npcOffenceLabel.Visible = false;
		dividerWrapFrame.Visible = true;
		wantedHeaderFrame.Visible = true;
		wantedList.Visible = true;
	} else {
		// Info mode: full detail
		npcSectionFrame.Size = new UDim2(1, -20, 0, 85);
		if (npcStatusLabel) npcStatusLabel.Visible = true;
		if (npcRouteLabel) npcRouteLabel.Visible = false;
		if (npcOffenceLabel) npcOffenceLabel.Visible = true;
		dividerWrapFrame.Visible = true;
		wantedHeaderFrame.Visible = true;
		wantedList.Visible = true;
	}

	// Update all wanted rows font sizes
	updateWantedRowSizes();
}

function toggleMinimized(): void {
	if (!minimizeButton || !bountyContentsFrame || !bountyPanel) return;

	isMinimized = !isMinimized;

	// Update button appearance
	minimizeButton.Text = isMinimized ? "⚔" : "⚔";
	minimizeButton.Position = isMinimized ? new UDim2(0, 0, 0, 0) : new UDim2(0.85, 0, 0, 0);
	minimizeButton.Size = isMinimized ? new UDim2(1, 0, 1, 0) : new UDim2(0.15, 0, 1, 0);

	// Hide/show content
	bountyContentsFrame.Visible = !isMinimized;

	// Adjust panel size
	if (isMinimized) {
		const collapsedSize = scaleSize(40);
		bountyPanel.Size = new UDim2(0, collapsedSize, 0, collapsedSize);
		minimizeButton.TextSize = scaleSize(22);
	} else {
		bountyPanel.Size = new UDim2(0, scaledPanelWidth, 0, 0);
		bountyPanel.AutomaticSize = Enum.AutomaticSize.Y;
		minimizeButton.TextSize = scaleSize(20);
	}
}

function updateWantedRowSizes(): void {
	if (!wantedList) return;
	for (const child of wantedList.GetChildren()) {
		// Skip non-frames and layout elements
		if (!child.IsA("Frame")) continue;

		const frameName = child.Name as string;
		// Only process rows that start with "Wanted_" (7 characters for "Wanted_")
		if (frameName.sub(1, 7) !== "Wanted_") continue;

		const row = child as Frame;

		if (!isInfoMode) {
			// MVP mode: compact
			row.Size = new UDim2(1, 0, 0, 18);
			const nameL = row.FindFirstChild("ChildName") as TextLabel | undefined;
			const goldL = row.FindFirstChild("Gold") as TextLabel | undefined;
			if (nameL) nameL.TextSize = 12;
			if (goldL) goldL.TextSize = 11;
		} else {
			// Info mode: regular
			row.Size = new UDim2(1, 0, 0, 22);
			const nameL = row.FindFirstChild("ChildName") as TextLabel | undefined;
			const goldL = row.FindFirstChild("Gold") as TextLabel | undefined;
			if (nameL) nameL.TextSize = 14;
			if (goldL) goldL.TextSize = 14;
		}
	}
}

function applyNPCBounty(bounty: NPCBountyPayload): void {
	const npcData = MEDIEVAL_NPCS[bounty.npcName] as NPCData | undefined;
	const rarity = npcData ? STATUS_RARITY[npcData.status] : undefined;
	if (npcNameLabel) {
		npcNameLabel.Text = bounty.npcName;
		npcNameLabel.TextColor3 = rarity ? rarity.color : UI_THEME.textPrimary;
	}
	if (npcGoldLabel) npcGoldLabel.Text = bounty.gold + "g";
	if (npcStatusLabel) {
		if (npcData && rarity) {
			npcStatusLabel.Text = npcData.status + "  |  " + rarity.label;
			npcStatusLabel.TextColor3 = rarity.color;
		} else {
			npcStatusLabel.Text = "";
		}
	}
	if (npcRouteLabel) npcRouteLabel.Text = bounty.route ? "📍 " + bounty.route : "";
	if (npcOffenceLabel) npcOffenceLabel.Text = `"${bounty.offence}"`;
}

function clearNPCBounty(): void {
	if (npcNameLabel) {
		npcNameLabel.Text = "Awaiting new mark...";
		npcNameLabel.TextColor3 = UI_THEME.textPrimary;
	}
	if (npcGoldLabel) npcGoldLabel.Text = "";
	if (npcStatusLabel) npcStatusLabel.Text = "";
	if (npcRouteLabel) npcRouteLabel.Text = "";
	if (npcOffenceLabel) npcOffenceLabel.Text = "";
}

function addWantedRow(payload: PlayerWantedPayload): void {
	const idx = wantedEntries.findIndex((e) => e.playerName === payload.playerName);
	if (idx !== -1) {
		wantedEntries[idx] = payload;
	} else {
		wantedEntries.push(payload);
	}
	refreshWantedDisplay();
}

function refreshWantedDisplay(): void {
	if (!wantedList) return;

	// Clear all existing rows
	for (const child of wantedList.GetChildren()) {
		if (child.IsA("Frame") || (child.IsA("TextLabel") && child.Name === "Empty")) {
			child.Destroy();
		}
	}

	// Sort by gold descending and take top 5
	const sorted = [...wantedEntries];
	sorted.sort((a, b) => a.gold > b.gold);
	const limit = math.min(sorted.size(), MAX_WANTED_DISPLAY);
	wantedCount = limit;

	if (limit === 0) {
		const empty = new Instance("TextLabel");
		empty.Name = "Empty";
		empty.Size = new UDim2(1, 0, 0, 18);
		empty.BackgroundTransparency = 1;
		empty.Text = "No known criminals";
		empty.TextColor3 = UI_THEME.textMuted;
		empty.Font = UI_THEME.fontBody;
		empty.TextSize = scaleSize(12);
		empty.TextXAlignment = Enum.TextXAlignment.Left;
		empty.Parent = wantedList;
		return;
	}

	for (let i = 0; i < limit; i++) {
		buildWantedRow(sorted[i], i);
	}
}

function buildWantedRow(payload: PlayerWantedPayload, order: number): void {
	if (!wantedList) return;

	const row = new Instance("Frame");
	row.Name = `Wanted_${payload.playerName}`;
	row.LayoutOrder = order;
	row.Size = new UDim2(1, 0, 0, isInfoMode ? 22 : 18);
	row.BackgroundTransparency = 1;
	row.Parent = wantedList;

	const nameL = new Instance("TextLabel");
	nameL.Name = "ChildName";
	nameL.Size = new UDim2(0.42, 0, 1, 0);
	nameL.BackgroundTransparency = 1;
	nameL.Text = payload.displayName;
	nameL.TextColor3 = UI_THEME.textWanted;
	nameL.Font = UI_THEME.fontBody;
	nameL.TextSize = scaleSize(isInfoMode ? 14 : 12);
	nameL.TextXAlignment = Enum.TextXAlignment.Left;
	nameL.TextTruncate = Enum.TextTruncate.AtEnd;
	nameL.Parent = row;

	// Scroll rarity indicators container (colored #)
	const scrollBar = new Instance("Frame");
	scrollBar.Name = "ScrollIndicators";
	scrollBar.Size = new UDim2(0.22, 0, 1, 0);
	scrollBar.Position = new UDim2(0.42, 0, 0, 0);
	scrollBar.BackgroundTransparency = 1;
	scrollBar.Parent = row;

	const scrollLayout = new Instance("UIListLayout");
	scrollLayout.FillDirection = Enum.FillDirection.Horizontal;
	scrollLayout.HorizontalAlignment = Enum.HorizontalAlignment.Left;
	scrollLayout.VerticalAlignment = Enum.VerticalAlignment.Center;
	scrollLayout.Padding = new UDim(0, 1);
	scrollLayout.Parent = scrollBar;

	updateScrollIndicators(row, payload.scrollRarities ?? []);

	const goldL = new Instance("TextLabel");
	goldL.Name = "Gold";
	goldL.Size = new UDim2(0.36, -10, 1, 0);
	goldL.Position = new UDim2(0.64, 0, 0, 0);
	goldL.BackgroundTransparency = 1;
	goldL.Text = payload.gold + "g";
	goldL.TextColor3 = UI_THEME.gold;
	goldL.Font = UI_THEME.fontBold;
	goldL.TextSize = scaleSize(isInfoMode ? 14 : 11);
	goldL.TextXAlignment = Enum.TextXAlignment.Right;
	goldL.Parent = row;
}

function updateScrollIndicators(row: Frame, rarities: string[]): void {
	const scrollBar = row.FindFirstChild("ScrollIndicators") as Frame | undefined;
	if (!scrollBar) return;

	// Remove old indicators (keep the UIListLayout)
	for (const child of scrollBar.GetChildren()) {
		if (child.IsA("TextLabel")) child.Destroy();
	}

	for (let i = 0; i < rarities.size(); i++) {
		const rarity = rarities[i];
		const color = RARITY_COLORS[rarity] ?? UI_THEME.textMuted;

		const indicator = new Instance("TextLabel");
		indicator.Name = "Scroll_" + i;
		indicator.Size = new UDim2(0, scaleSize(10), 1, 0);
		indicator.BackgroundTransparency = 1;
		indicator.Text = "#";
		indicator.TextColor3 = color;
		indicator.Font = UI_THEME.fontBold;
		indicator.TextSize = scaleSize(11);
		indicator.LayoutOrder = i;
		indicator.Parent = scrollBar;
	}
}

function removeWantedRow(playerName: string): void {
	wantedEntries = wantedEntries.filter((e) => e.playerName !== playerName);
	refreshWantedDisplay();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

lifecycle.OnClientEvent.Connect((message: unknown) => {
	if (message === "InitializePlayer") {
		const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
		const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

		makeParchment(screenGui);

		// Personal NPC bounty assigned / renewed
		getBountyAssignedRemote().OnClientEvent.Connect((data: unknown) => {
			applyNPCBounty(data as NPCBountyPayload);
		});

		// Personal NPC bounty completed (target died)
		getBountyCompletedRemote().OnClientEvent.Connect(() => {
			clearNPCBounty();
		});

		// A player became wanted
		getPlayerWantedRemote().OnClientEvent.Connect((data: unknown) => {
			addWantedRow(data as PlayerWantedPayload);
		});

		// A wanted player was cleared
		getPlayerWantedClearedRemote().OnClientEvent.Connect((playerName: unknown) => {
			removeWantedRow(playerName as string);
		});

		// Full state sync fired once when server receives "ClientReady"
		getBountyListSyncRemote().OnClientEvent.Connect((npcBounty: unknown, wanted: unknown) => {
			if (npcBounty !== undefined) {
				applyNPCBounty(npcBounty as NPCBountyPayload);
			}
			for (const entry of wanted as PlayerWantedPayload[]) {
				addWantedRow(entry);
			}
		});
	}
});
