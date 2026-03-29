import { Players, TweenService, UserInputService, Workspace } from "@rbxts/services";
import { onPlayerInitialized } from "../modules/client-init";
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

// ── Scaling ───────────────────────────────────────────────────────────────────

function sc(base: number): number {
	return base * getUIScale();
}

// ── State ─────────────────────────────────────────────────────────────────────

let markNameLabel: TextLabel | undefined;
let markClassLabel: TextLabel | undefined;
let markGoldLabel: TextLabel | undefined;
let markOffenceLabel: TextLabel | undefined;

let wantedSummaryLabel: TextLabel | undefined;
let wantedExpandedFrame: Frame | undefined;
let wantedListFrame: Frame | undefined;
let isWantedExpanded = false;

let wantedEntries: PlayerWantedPayload[] = [];
const MAX_WANTED_DISPLAY = 5;

// ── Builder ───────────────────────────────────────────────────────────────────

function buildBountyCard(screenGui: ScreenGui): void {
	const W = sc(240);

	// ── Outer wrapper ────────────────────────────────────────────────────────
	const wrapper = new Instance("Frame");
	wrapper.Name = "BountyHUD";
	wrapper.Size = new UDim2(0, W, 0, 0);
	wrapper.Position = new UDim2(1, sc(-10) - W, 0, sc(10));
	wrapper.AutomaticSize = Enum.AutomaticSize.Y;
	wrapper.BackgroundTransparency = 1;
	wrapper.Parent = screenGui;

	const wrapLayout = new Instance("UIListLayout");
	wrapLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	wrapLayout.Padding = new UDim(0, sc(3));
	wrapLayout.Parent = wrapper;

	// ═════════════════════════════════════════════════════════════════════════
	//  MISSION CARD  (always visible)
	// ═════════════════════════════════════════════════════════════════════════
	const card = new Instance("Frame");
	card.Name = "MissionCard";
	card.LayoutOrder = 0;
	card.Size = new UDim2(1, 0, 0, 0);
	card.AutomaticSize = Enum.AutomaticSize.Y;
	card.BackgroundColor3 = UI_THEME.bg;
	card.BackgroundTransparency = UI_THEME.bgTransparency;
	card.BorderSizePixel = 0;
	card.Parent = wrapper;

	const cardCorner = new Instance("UICorner");
	cardCorner.CornerRadius = UI_THEME.cornerRadius;
	cardCorner.Parent = card;

	const cardStroke = new Instance("UIStroke");
	cardStroke.Color = UI_THEME.border;
	cardStroke.Thickness = UI_THEME.strokeThickness;
	cardStroke.Parent = card;

	const cardPad = new Instance("UIPadding");
	cardPad.PaddingTop = new UDim(0, sc(7));
	cardPad.PaddingBottom = new UDim(0, sc(7));
	cardPad.PaddingLeft = new UDim(0, sc(10));
	cardPad.PaddingRight = new UDim(0, sc(10));
	cardPad.Parent = card;

	const cardLayout = new Instance("UIListLayout");
	cardLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	cardLayout.Padding = new UDim(0, sc(2));
	cardLayout.Parent = card;

	// ── Section label ─────────────────────────────────────────────────────
	const sectionLabel = new Instance("TextLabel");
	sectionLabel.LayoutOrder = 0;
	sectionLabel.Size = new UDim2(1, 0, 0, sc(13));
	sectionLabel.BackgroundTransparency = 1;
	sectionLabel.Text = "YOUR MARK";
	sectionLabel.TextColor3 = UI_THEME.textSection;
	sectionLabel.Font = UI_THEME.fontBold;
	sectionLabel.TextSize = sc(10);
	sectionLabel.TextXAlignment = Enum.TextXAlignment.Left;
	sectionLabel.Parent = card;

	// ── Row 1: Mark name + gold ───────────────────────────────────────────
	const row1 = new Instance("Frame");
	row1.Name = "NameRow";
	row1.LayoutOrder = 1;
	row1.Size = new UDim2(1, 0, 0, sc(20));
	row1.BackgroundTransparency = 1;
	row1.Parent = card;

	markNameLabel = new Instance("TextLabel");
	markNameLabel.Name = "MarkName";
	markNameLabel.Size = new UDim2(0.68, 0, 1, 0);
	markNameLabel.BackgroundTransparency = 1;
	markNameLabel.Text = "Awaiting orders...";
	markNameLabel.TextColor3 = UI_THEME.textPrimary;
	markNameLabel.Font = UI_THEME.fontDisplay;
	markNameLabel.TextSize = sc(16);
	markNameLabel.TextXAlignment = Enum.TextXAlignment.Left;
	markNameLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	markNameLabel.Parent = row1;

	markGoldLabel = new Instance("TextLabel");
	markGoldLabel.Name = "MarkGold";
	markGoldLabel.Size = new UDim2(0.32, 0, 1, 0);
	markGoldLabel.Position = new UDim2(0.68, 0, 0, 0);
	markGoldLabel.BackgroundTransparency = 1;
	markGoldLabel.Text = "";
	markGoldLabel.TextColor3 = UI_THEME.gold;
	markGoldLabel.Font = UI_THEME.fontBold;
	markGoldLabel.TextSize = sc(14);
	markGoldLabel.TextXAlignment = Enum.TextXAlignment.Right;
	markGoldLabel.Parent = row1;

	// ── Row 2: Social class ───────────────────────────────────────────────
	markClassLabel = new Instance("TextLabel");
	markClassLabel.Name = "MarkClass";
	markClassLabel.LayoutOrder = 2;
	markClassLabel.Size = new UDim2(1, 0, 0, sc(13));
	markClassLabel.BackgroundTransparency = 1;
	markClassLabel.Text = "";
	markClassLabel.TextColor3 = UI_THEME.textMuted;
	markClassLabel.Font = UI_THEME.fontBold;
	markClassLabel.TextSize = sc(10);
	markClassLabel.TextXAlignment = Enum.TextXAlignment.Left;
	markClassLabel.Parent = card;

	// ── Row 3: Offence line ───────────────────────────────────────────────
	markOffenceLabel = new Instance("TextLabel");
	markOffenceLabel.Name = "MarkOffence";
	markOffenceLabel.LayoutOrder = 3;
	markOffenceLabel.Size = new UDim2(1, 0, 0, sc(13));
	markOffenceLabel.BackgroundTransparency = 1;
	markOffenceLabel.Text = "";
	markOffenceLabel.TextColor3 = UI_THEME.textMuted;
	markOffenceLabel.Font = UI_THEME.fontBody;
	markOffenceLabel.TextSize = sc(10);
	markOffenceLabel.TextXAlignment = Enum.TextXAlignment.Left;
	markOffenceLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	markOffenceLabel.Parent = card;

	// ═════════════════════════════════════════════════════════════════════════
	//  WANTED SUMMARY  (tap to expand)
	// ═════════════════════════════════════════════════════════════════════════
	const wantedBtn = new Instance("TextButton");
	wantedBtn.Name = "WantedSummary";
	wantedBtn.LayoutOrder = 1;
	wantedBtn.Size = new UDim2(1, 0, 0, sc(22));
	wantedBtn.BackgroundColor3 = UI_THEME.bg;
	wantedBtn.BackgroundTransparency = UI_THEME.bgTransparency;
	wantedBtn.BorderSizePixel = 0;
	wantedBtn.Text = "";
	wantedBtn.AutoButtonColor = false;
	wantedBtn.Parent = wrapper;

	const wBtnCorner = new Instance("UICorner");
	wBtnCorner.CornerRadius = UI_THEME.cornerRadius;
	wBtnCorner.Parent = wantedBtn;

	const wBtnStroke = new Instance("UIStroke");
	wBtnStroke.Color = UI_THEME.border;
	wBtnStroke.Thickness = UI_THEME.strokeThickness;
	wBtnStroke.Parent = wantedBtn;

	wantedSummaryLabel = new Instance("TextLabel");
	wantedSummaryLabel.Name = "Label";
	wantedSummaryLabel.Size = new UDim2(1, 0, 1, 0);
	wantedSummaryLabel.BackgroundTransparency = 1;
	wantedSummaryLabel.Text = "No known criminals";
	wantedSummaryLabel.TextColor3 = UI_THEME.textMuted;
	wantedSummaryLabel.Font = UI_THEME.fontBold;
	wantedSummaryLabel.TextSize = sc(11);
	wantedSummaryLabel.Parent = wantedBtn;

	wantedBtn.MouseButton1Click.Connect(() => {
		isWantedExpanded = !isWantedExpanded;
		if (wantedExpandedFrame) wantedExpandedFrame.Visible = isWantedExpanded;
	});

	// ═════════════════════════════════════════════════════════════════════════
	//  WANTED EXPANDED LIST  (hidden by default)
	// ═════════════════════════════════════════════════════════════════════════
	const expandFrame = new Instance("Frame");
	expandFrame.Name = "WantedExpanded";
	expandFrame.LayoutOrder = 2;
	expandFrame.Size = new UDim2(1, 0, 0, 0);
	expandFrame.AutomaticSize = Enum.AutomaticSize.Y;
	expandFrame.BackgroundColor3 = UI_THEME.bg;
	expandFrame.BackgroundTransparency = UI_THEME.bgTransparency;
	expandFrame.BorderSizePixel = 0;
	expandFrame.Visible = false;
	expandFrame.Parent = wrapper;
	wantedExpandedFrame = expandFrame;

	const expCorner = new Instance("UICorner");
	expCorner.CornerRadius = UI_THEME.cornerRadius;
	expCorner.Parent = expandFrame;

	const expStroke = new Instance("UIStroke");
	expStroke.Color = UI_THEME.border;
	expStroke.Thickness = UI_THEME.strokeThickness;
	expStroke.Parent = expandFrame;

	const expPad = new Instance("UIPadding");
	expPad.PaddingTop = new UDim(0, sc(6));
	expPad.PaddingBottom = new UDim(0, sc(6));
	expPad.PaddingLeft = new UDim(0, sc(10));
	expPad.PaddingRight = new UDim(0, sc(10));
	expPad.Parent = expandFrame;

	// Wanted header inside expanded
	const expHeader = new Instance("TextLabel");
	expHeader.Name = "Header";
	expHeader.Size = new UDim2(1, 0, 0, sc(16));
	expHeader.BackgroundTransparency = 1;
	expHeader.Text = "WANTED - TOP 5";
	expHeader.TextColor3 = UI_THEME.danger;
	expHeader.Font = UI_THEME.fontBold;
	expHeader.TextSize = sc(11);
	expHeader.TextXAlignment = Enum.TextXAlignment.Left;
	expHeader.Parent = expandFrame;

	// List container for wanted rows
	const listFrame = new Instance("Frame");
	listFrame.Name = "List";
	listFrame.Size = new UDim2(1, 0, 0, 0);
	listFrame.Position = new UDim2(0, 0, 0, sc(18));
	listFrame.AutomaticSize = Enum.AutomaticSize.Y;
	listFrame.BackgroundTransparency = 1;
	listFrame.Parent = expandFrame;
	wantedListFrame = listFrame;

	const listLayout = new Instance("UIListLayout");
	listLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	listLayout.Padding = new UDim(0, sc(2));
	listLayout.Parent = listFrame;
}

// ── Mark updates ──────────────────────────────────────────────────────────────

function applyNPCBounty(bounty: NPCBountyPayload): void {
	const npcData = MEDIEVAL_NPCS[bounty.npcName] as NPCData | undefined;
	const rarity = npcData ? STATUS_RARITY[npcData.status] : undefined;

	if (markNameLabel) {
		markNameLabel.Text = bounty.npcName;
		markNameLabel.TextColor3 = rarity ? rarity.color : UI_THEME.textPrimary;
	}
	if (markGoldLabel) markGoldLabel.Text = bounty.gold + "g";
	if (markClassLabel) {
		const status = npcData ? npcData.status : "Unknown";
		const rarityLabel = rarity ? rarity.label : "";
		markClassLabel.Text = status + (rarityLabel !== "" ? " -- " + rarityLabel : "");
		markClassLabel.TextColor3 = rarity ? rarity.color : UI_THEME.textMuted;
	}
	if (markOffenceLabel) markOffenceLabel.Text = bounty.offence !== "" ? '"' + bounty.offence + '"' : "";
}

function clearNPCBounty(): void {
	if (markNameLabel) {
		markNameLabel.Text = "Awaiting new mark...";
		markNameLabel.TextColor3 = UI_THEME.textPrimary;
	}
	if (markGoldLabel) markGoldLabel.Text = "";
	if (markClassLabel) {
		markClassLabel.Text = "";
		markClassLabel.TextColor3 = UI_THEME.textMuted;
	}
	if (markOffenceLabel) markOffenceLabel.Text = "";
}

// ── Wanted list ───────────────────────────────────────────────────────────────

function updateWantedSummary(): void {
	if (!wantedSummaryLabel) return;
	const count = wantedEntries.size();
	if (count === 0) {
		wantedSummaryLabel.Text = "No known criminals";
		wantedSummaryLabel.TextColor3 = UI_THEME.textMuted;
	} else {
		// Show top bounty name + count
		const sorted = [...wantedEntries];
		sorted.sort((a, b) => a.gold > b.gold);
		const top = sorted[0];
		const suffix = count > 1 ? "  +" + (count - 1) + " more" : "";
		wantedSummaryLabel.Text = "WANTED: " + top.displayName + " " + top.gold + "g" + suffix;
		wantedSummaryLabel.TextColor3 = UI_THEME.danger;
	}
}

function refreshWantedList(): void {
	if (!wantedListFrame) return;

	// Clear old rows
	for (const child of wantedListFrame.GetChildren()) {
		if (child.IsA("Frame")) child.Destroy();
	}

	const sorted = [...wantedEntries];
	sorted.sort((a, b) => a.gold > b.gold);
	const limit = math.min(sorted.size(), MAX_WANTED_DISPLAY);

	if (limit === 0) {
		const empty = new Instance("TextLabel");
		empty.Name = "Empty";
		empty.Size = new UDim2(1, 0, 0, sc(16));
		empty.BackgroundTransparency = 1;
		empty.Text = "No known criminals";
		empty.TextColor3 = UI_THEME.textMuted;
		empty.Font = UI_THEME.fontBody;
		empty.TextSize = sc(10);
		empty.TextXAlignment = Enum.TextXAlignment.Left;
		empty.Parent = wantedListFrame;
		return;
	}

	for (let i = 0; i < limit; i++) {
		buildWantedRow(sorted[i], i);
	}

	updateWantedSummary();
}

function buildWantedRow(payload: PlayerWantedPayload, order: number): void {
	if (!wantedListFrame) return;

	const row = new Instance("Frame");
	row.Name = "W_" + payload.playerName;
	row.LayoutOrder = order;
	row.Size = new UDim2(1, 0, 0, sc(18));
	row.BackgroundTransparency = 1;
	row.Parent = wantedListFrame;

	// Name
	const nameL = new Instance("TextLabel");
	nameL.Name = "Name";
	nameL.Size = new UDim2(0.42, 0, 1, 0);
	nameL.BackgroundTransparency = 1;
	nameL.Text = payload.displayName;
	nameL.TextColor3 = UI_THEME.textWanted;
	nameL.Font = UI_THEME.fontBody;
	nameL.TextSize = sc(11);
	nameL.TextXAlignment = Enum.TextXAlignment.Left;
	nameL.TextTruncate = Enum.TextTruncate.AtEnd;
	nameL.Parent = row;

	// Scroll rarity indicators
	const scrollBar = new Instance("Frame");
	scrollBar.Name = "Scrolls";
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

	const rarities = payload.scrollRarities ?? [];
	for (let j = 0; j < rarities.size(); j++) {
		const color = RARITY_COLORS[rarities[j]] ?? UI_THEME.textMuted;
		const ind = new Instance("TextLabel");
		ind.Name = "S" + j;
		ind.Size = new UDim2(0, sc(9), 1, 0);
		ind.BackgroundTransparency = 1;
		ind.Text = "#";
		ind.TextColor3 = color;
		ind.Font = UI_THEME.fontBold;
		ind.TextSize = sc(10);
		ind.LayoutOrder = j;
		ind.Parent = scrollBar;
	}

	// Gold
	const goldL = new Instance("TextLabel");
	goldL.Name = "Gold";
	goldL.Size = new UDim2(0.36, 0, 1, 0);
	goldL.Position = new UDim2(0.64, 0, 0, 0);
	goldL.BackgroundTransparency = 1;
	goldL.Text = payload.gold + "g";
	goldL.TextColor3 = UI_THEME.gold;
	goldL.Font = UI_THEME.fontBold;
	goldL.TextSize = sc(11);
	goldL.TextXAlignment = Enum.TextXAlignment.Right;
	goldL.Parent = row;
}

function addWantedEntry(payload: PlayerWantedPayload): void {
	const idx = wantedEntries.findIndex((e) => e.playerName === payload.playerName);
	if (idx !== -1) {
		wantedEntries[idx] = payload;
	} else {
		wantedEntries.push(payload);
	}
	refreshWantedList();
	updateWantedSummary();
}

function removeWantedEntry(playerName: string): void {
	wantedEntries = wantedEntries.filter((e) => e.playerName !== playerName);
	refreshWantedList();
	updateWantedSummary();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

onPlayerInitialized(() => {
	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

	buildBountyCard(screenGui);

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
		addWantedEntry(data as PlayerWantedPayload);
	});

	// A wanted player was cleared
	getPlayerWantedClearedRemote().OnClientEvent.Connect((playerName: unknown) => {
		removeWantedEntry(playerName as string);
	});

	// Full state sync
	getBountyListSyncRemote().OnClientEvent.Connect((npcBounty: unknown, wanted: unknown) => {
		if (npcBounty !== undefined) {
			applyNPCBounty(npcBounty as NPCBountyPayload);
		}
		for (const entry of wanted as PlayerWantedPayload[]) {
			addWantedEntry(entry);
		}
	});
});
