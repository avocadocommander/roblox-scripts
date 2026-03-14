import { Players } from "@rbxts/services";
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
import { UI_THEME, STATUS_RARITY } from "shared/ui-theme";

const lifecycle = getOrCreateLifecycleRemote();

// Module-level refs so update functions can reach the labels
let npcNameLabel: TextLabel | undefined;
let npcGoldLabel: TextLabel | undefined;
let npcStatusLabel: TextLabel | undefined;
let npcOffenceLabel: TextLabel | undefined;
let wantedList: Frame | undefined;
let wantedCount = 0;

// ─── UI builder ───────────────────────────────────────────────────────────────

function makeParchment(screenGui: ScreenGui): void {
	// ── Outer panel (top-right) ──────────────────────────────────────────────
	const panel = new Instance("Frame");
	panel.Name = "BountyHUD";
	panel.Size = new UDim2(0, 285, 0, 0);
	panel.Position = new UDim2(1, -300, 0, 12);
	panel.AutomaticSize = Enum.AutomaticSize.Y;
	panel.BackgroundColor3 = UI_THEME.bg;
	panel.BackgroundTransparency = UI_THEME.bgTransparency;
	panel.BorderSizePixel = 0;
	panel.Parent = screenGui;

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

	// ── Header bar ───────────────────────────────────────────────────────────
	const header = new Instance("TextLabel");
	header.LayoutOrder = 0;
	header.Size = new UDim2(1, 0, 0, 28);
	header.BackgroundColor3 = UI_THEME.headerBg;
	header.BackgroundTransparency = 0;
	header.BorderSizePixel = 0;
	header.Text = "⚔  BOUNTY BOARD";
	header.TextColor3 = UI_THEME.textHeader;
	header.Font = UI_THEME.fontDisplay;
	header.TextSize = 15;
	header.Parent = panel;

	const headerCorner = new Instance("UICorner");
	headerCorner.CornerRadius = UI_THEME.cornerRadius;
	headerCorner.Parent = header;

	// ── "YOUR MARK" section ──────────────────────────────────────────────────
	const npcSection = new Instance("Frame");
	npcSection.LayoutOrder = 1;
	npcSection.Size = new UDim2(1, -20, 0, 70);
	npcSection.BackgroundTransparency = 1;
	npcSection.Parent = panel;

	const npcPad = new Instance("UIPadding");
	npcPad.PaddingLeft = new UDim(0, 10);
	npcPad.PaddingTop = new UDim(0, 6);
	npcPad.Parent = npcSection;

	const markLabel = new Instance("TextLabel");
	markLabel.Size = new UDim2(1, 0, 0, 13);
	markLabel.Position = new UDim2(0, 0, 0, 0);
	markLabel.BackgroundTransparency = 1;
	markLabel.Text = "YOUR MARK";
	markLabel.TextColor3 = UI_THEME.textSection;
	markLabel.Font = UI_THEME.fontBold;
	markLabel.TextSize = 10;
	markLabel.TextXAlignment = Enum.TextXAlignment.Left;
	markLabel.Parent = npcSection;

	const nameRow = new Instance("Frame");
	nameRow.Size = new UDim2(1, 0, 0, 20);
	nameRow.Position = new UDim2(0, 0, 0, 15);
	nameRow.BackgroundTransparency = 1;
	nameRow.Parent = npcSection;

	npcNameLabel = new Instance("TextLabel");
	npcNameLabel.Name = "NPCName";
	npcNameLabel.Size = new UDim2(0.62, 0, 1, 0);
	npcNameLabel.BackgroundTransparency = 1;
	npcNameLabel.Text = "—";
	npcNameLabel.TextColor3 = UI_THEME.textPrimary;
	npcNameLabel.Font = UI_THEME.fontDisplay;
	npcNameLabel.TextSize = 15;
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
	npcGoldLabel.TextSize = 13;
	npcGoldLabel.TextXAlignment = Enum.TextXAlignment.Right;
	npcGoldLabel.Parent = nameRow;

	npcStatusLabel = new Instance("TextLabel");
	npcStatusLabel.Name = "NPCStatus";
	npcStatusLabel.Size = new UDim2(1, 0, 0, 13);
	npcStatusLabel.Position = new UDim2(0, 0, 0, 36);
	npcStatusLabel.BackgroundTransparency = 1;
	npcStatusLabel.Text = "";
	npcStatusLabel.TextColor3 = UI_THEME.textMuted;
	npcStatusLabel.Font = UI_THEME.fontBody;
	npcStatusLabel.TextSize = 10;
	npcStatusLabel.TextXAlignment = Enum.TextXAlignment.Left;
	npcStatusLabel.Parent = npcSection;

	npcOffenceLabel = new Instance("TextLabel");
	npcOffenceLabel.Name = "NPCOffence";
	npcOffenceLabel.Size = new UDim2(1, 0, 0, 12);
	npcOffenceLabel.Position = new UDim2(0, 0, 0, 51);
	npcOffenceLabel.BackgroundTransparency = 1;
	npcOffenceLabel.Text = "";
	npcOffenceLabel.TextColor3 = UI_THEME.textMuted;
	npcOffenceLabel.Font = UI_THEME.fontBody;
	npcOffenceLabel.TextSize = 9;
	npcOffenceLabel.TextXAlignment = Enum.TextXAlignment.Left;
	npcOffenceLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	npcOffenceLabel.Parent = npcSection;

	// ── Divider ──────────────────────────────────────────────────────────────
	const dividerWrap = new Instance("Frame");
	dividerWrap.LayoutOrder = 2;
	dividerWrap.Size = new UDim2(1, 0, 0, 9);
	dividerWrap.BackgroundTransparency = 1;
	dividerWrap.Parent = panel;

	const divider = new Instance("Frame");
	divider.Size = new UDim2(1, -20, 0, 1);
	divider.Position = new UDim2(0, 10, 0.5, 0);
	divider.BackgroundColor3 = UI_THEME.divider;
	divider.BackgroundTransparency = 0;
	divider.BorderSizePixel = 0;
	divider.Parent = dividerWrap;

	// ── "WANTED" header ───────────────────────────────────────────────────────
	const wantedHeader = new Instance("TextLabel");
	wantedHeader.LayoutOrder = 3;
	wantedHeader.Size = new UDim2(1, -20, 0, 18);
	wantedHeader.BackgroundTransparency = 1;
	wantedHeader.Text = "WANTED";
	wantedHeader.TextColor3 = UI_THEME.danger;
	wantedHeader.Font = UI_THEME.fontBold;
	wantedHeader.TextSize = 10;
	wantedHeader.TextXAlignment = Enum.TextXAlignment.Left;

	const wantedPad = new Instance("UIPadding");
	wantedPad.PaddingLeft = new UDim(0, 10);
	wantedPad.Parent = wantedHeader;
	wantedHeader.Parent = panel;

	// ── Wanted list container ────────────────────────────────────────────────
	const listContainer = new Instance("Frame");
	listContainer.LayoutOrder = 4;
	listContainer.Name = "WantedList";
	listContainer.Size = new UDim2(1, -20, 0, 0);
	listContainer.AutomaticSize = Enum.AutomaticSize.Y;
	listContainer.BackgroundTransparency = 1;
	listContainer.Parent = panel;
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
	emptyLabel.Size = new UDim2(1, 0, 0, 14);
	emptyLabel.BackgroundTransparency = 1;
	emptyLabel.Text = "No known criminals";
	emptyLabel.TextColor3 = UI_THEME.textMuted;
	emptyLabel.Font = UI_THEME.fontBody;
	emptyLabel.TextSize = 10;
	emptyLabel.TextXAlignment = Enum.TextXAlignment.Left;
	emptyLabel.Parent = listContainer;
}

// ─── Update helpers ───────────────────────────────────────────────────────────

function applyNPCBounty(bounty: NPCBountyPayload): void {
	const npcData = MEDIEVAL_NPCS[bounty.npcName] as NPCData | undefined;
	const rarity = npcData ? STATUS_RARITY[npcData.status] : undefined;
	if (npcNameLabel) {
		npcNameLabel.Text = bounty.npcName;
		npcNameLabel.TextColor3 = rarity ? rarity.color : UI_THEME.textPrimary;
	}
	if (npcGoldLabel) npcGoldLabel.Text = bounty.gold + " " + "🪙";
	if (npcStatusLabel) {
		if (npcData && rarity) {
			npcStatusLabel.Text = npcData.status + "  |  " + rarity.label;
			npcStatusLabel.TextColor3 = rarity.color;
		} else {
			npcStatusLabel.Text = "";
		}
	}
	if (npcOffenceLabel) npcOffenceLabel.Text = `"${bounty.offence}"`;
}

function clearNPCBounty(): void {
	if (npcNameLabel) {
		npcNameLabel.Text = "Awaiting new mark...";
		npcNameLabel.TextColor3 = UI_THEME.textPrimary;
	}
	if (npcGoldLabel) npcGoldLabel.Text = "";
	if (npcStatusLabel) npcStatusLabel.Text = "";
	if (npcOffenceLabel) npcOffenceLabel.Text = "";
}

function addWantedRow(payload: PlayerWantedPayload): void {
	if (!wantedList) return;

	// If a row already exists for this player, just update the gold amount
	const existing = wantedList.FindFirstChild(`Wanted_${payload.playerName}`) as Frame | undefined;
	if (existing) {
		const goldL = existing.FindFirstChild("Gold") as TextLabel | undefined;
		if (goldL) goldL.Text = payload.gold + " " + "🪙";
		return;
	}

	wantedList.FindFirstChild("Empty")?.Destroy();
	wantedCount++;

	const row = new Instance("Frame");
	row.Name = `Wanted_${payload.playerName}`;
	row.Size = new UDim2(1, 0, 0, 18);
	row.BackgroundTransparency = 1;
	row.Parent = wantedList;

	const nameL = new Instance("TextLabel");
	nameL.Size = new UDim2(0.62, 0, 1, 0);
	nameL.BackgroundTransparency = 1;
	nameL.Text = payload.displayName;
	nameL.TextColor3 = UI_THEME.textWanted;
	nameL.Font = UI_THEME.fontBody;
	nameL.TextSize = 12;
	nameL.TextXAlignment = Enum.TextXAlignment.Left;
	nameL.Parent = row;

	const goldL = new Instance("TextLabel");
	goldL.Name = "Gold";
	goldL.Size = new UDim2(0.38, -10, 1, 0);
	goldL.Position = new UDim2(0.62, 0, 0, 0);
	goldL.BackgroundTransparency = 1;
	goldL.Text = payload.gold + " " + "🪙";
	goldL.TextColor3 = UI_THEME.gold;
	goldL.Font = UI_THEME.fontBold;
	goldL.TextSize = 12;
	goldL.TextXAlignment = Enum.TextXAlignment.Right;
	goldL.Parent = row;
}

function removeWantedRow(playerName: string): void {
	if (!wantedList) return;
	wantedList.FindFirstChild(`Wanted_${playerName}`)?.Destroy();
	wantedCount = math.max(0, wantedCount - 1);

	if (wantedCount === 0) {
		const empty = new Instance("TextLabel");
		empty.Name = "Empty";
		empty.Size = new UDim2(1, 0, 0, 14);
		empty.BackgroundTransparency = 1;
		empty.Text = "No known criminals";
		empty.TextColor3 = UI_THEME.textMuted;
		empty.Font = UI_THEME.fontBody;
		empty.TextSize = 10;
		empty.TextXAlignment = Enum.TextXAlignment.Left;
		empty.Parent = wantedList;
	}
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
