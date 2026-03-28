import { Players, UserInputService } from "@rbxts/services";
import { onPlayerInitialized } from "../modules/client-init";
import { registerKillBookToggle } from "../modules/ui-toggles";
import {
	getAchievementUnlockedRemote,
	getKillBookDataRemote,
	getTurnInBountiesRemote,
	KillBookData,
	TurnInResult,
} from "shared/remotes/kill-book-remote";
import { ACHIEVEMENT_LIST, AchievementDef } from "shared/achievements";
import { TITLES, TITLE_LIST } from "shared/config/titles";
import { getEquipTitleRemote } from "shared/remotes/title-remote";
import { MEDIEVAL_NPCS, NPCData } from "shared/module";
import { NPCKillRecord } from "shared/kill-log";
import { UI_THEME, STATUS_RARITY, getUIScale } from "shared/ui-theme";
import { FACTIONS, FACTION_IDS, FactionId, levelFromXP, totalXPFromFactions, overallLevelFromFactions } from "shared/config/factions";

let bookGui: ScreenGui | undefined;
let bookFrame: Frame | undefined;
let contentFrame: ScrollingFrame | undefined;
let isOpen = false;
let isReady = false;

// Tab buttons
const TAB_NAMES = ["BOUNTIES", "BESTIARY", "PVP", "ACHIEVEMENTS"];
let activeTab = 0;
let tabButtons: TextButton[] = [];
let titleDropdownOpen = false;

/** Track expanded cards in bestiary / achievements (reset on tab switch). */
let bestiaryExpanded = new Set<string>();
let achievementExpanded = new Set<string>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearContent(): void {
	if (!contentFrame) return;
	for (const child of contentFrame.GetChildren()) {
		if (!child.IsA("UIListLayout") && !child.IsA("UIPadding")) child.Destroy();
	}
}

function makeLabel(
	parent: Instance,
	text: string,
	order: number,
	opts?: Partial<{
		color: Color3;
		font: Enum.Font;
		size: number;
		height: number;
	}>,
): TextLabel {
	const lbl = new Instance("TextLabel");
	lbl.Size = new UDim2(1, 0, 0, opts?.height ?? 22);
	lbl.BackgroundTransparency = 1;
	lbl.TextColor3 = opts?.color ?? UI_THEME.textPrimary;
	lbl.Font = opts?.font ?? UI_THEME.fontBody;
	lbl.TextSize = opts?.size ?? 13;
	lbl.Text = text;
	lbl.TextXAlignment = Enum.TextXAlignment.Left;
	lbl.LayoutOrder = order;
	lbl.Parent = parent;
	return lbl;
}

function makeDivider(parent: Instance, order: number): Frame {
	const div = new Instance("Frame");
	div.Size = new UDim2(1, 0, 0, 1);
	div.BackgroundColor3 = UI_THEME.divider;
	div.BorderSizePixel = 0;
	div.LayoutOrder = order;
	div.Parent = parent;
	return div;
}

function makeSectionHeader(parent: Instance, text: string, order: number): TextLabel {
	return makeLabel(parent, text, order, {
		color: UI_THEME.textSection,
		font: UI_THEME.fontBold,
		size: 11,
		height: 20,
	});
}

// ─── Tab: Bounties ────────────────────────────────────────────────────────────

function renderBountiesTab(data: KillBookData): void {
	clearContent();
	if (!contentFrame) return;

	// Use a fixed-height wrapper with absolute positioning so the footer
	// (total + turn-in) sticks to the bottom and the bounty list fills
	// the space in between.
	const absY = contentFrame.AbsoluteSize.Y;
	const visibleH = absY > 0 ? absY - 8 : 430;

	const wrapper = new Instance("Frame");
	wrapper.Name = "BountyWrapper";
	wrapper.Size = new UDim2(1, 0, 0, visibleH);
	wrapper.BackgroundTransparency = 1;
	wrapper.LayoutOrder = 0;
	wrapper.Parent = contentFrame;

	// ── Active bounty (top) ─────────────────────────────────────────────────
	let topY = 0;

	const activeHeader = new Instance("TextLabel");
	activeHeader.Size = new UDim2(1, 0, 0, 18);
	activeHeader.Position = new UDim2(0, 0, 0, topY);
	activeHeader.BackgroundTransparency = 1;
	activeHeader.TextColor3 = UI_THEME.textSection;
	activeHeader.Font = UI_THEME.fontBold;
	activeHeader.TextSize = 11;
	activeHeader.Text = "ACTIVE BOUNTY";
	activeHeader.TextXAlignment = Enum.TextXAlignment.Left;
	activeHeader.Parent = wrapper;
	topY += 20;

	if (data.activeBountyName !== undefined) {
		const activeNpc = MEDIEVAL_NPCS[data.activeBountyName] as NPCData | undefined;
		const activeRarity = activeNpc ? STATUS_RARITY[activeNpc.status] : undefined;

		const nameLbl = new Instance("TextLabel");
		nameLbl.Size = new UDim2(1, 0, 0, 22);
		nameLbl.Position = new UDim2(0, 0, 0, topY);
		nameLbl.BackgroundTransparency = 1;
		nameLbl.TextColor3 = activeRarity?.color ?? UI_THEME.textHeader;
		nameLbl.Font = UI_THEME.fontDisplay;
		nameLbl.TextSize = 15;
		nameLbl.Text = data.activeBountyName;
		nameLbl.TextXAlignment = Enum.TextXAlignment.Left;
		nameLbl.Parent = wrapper;
		topY += 24;

		if (activeNpc) {
			const infoLine =
				activeNpc.race + "  |  " + activeNpc.status + (activeRarity ? "  |  " + activeRarity.label : "");
			const infoLbl = new Instance("TextLabel");
			infoLbl.Size = new UDim2(1, 0, 0, 14);
			infoLbl.Position = new UDim2(0, 0, 0, topY);
			infoLbl.BackgroundTransparency = 1;
			infoLbl.TextColor3 = activeRarity?.color ?? UI_THEME.textMuted;
			infoLbl.Font = UI_THEME.fontBody;
			infoLbl.TextSize = 11;
			infoLbl.Text = infoLine;
			infoLbl.TextXAlignment = Enum.TextXAlignment.Left;
			infoLbl.Parent = wrapper;
			topY += 16;
		}
	} else {
		const noLbl = new Instance("TextLabel");
		noLbl.Size = new UDim2(1, 0, 0, 18);
		noLbl.Position = new UDim2(0, 0, 0, topY);
		noLbl.BackgroundTransparency = 1;
		noLbl.TextColor3 = UI_THEME.textMuted;
		noLbl.Font = UI_THEME.fontBody;
		noLbl.TextSize = 13;
		noLbl.Text = "No active bounty";
		noLbl.TextXAlignment = Enum.TextXAlignment.Left;
		noLbl.Parent = wrapper;
		topY += 20;
	}

	// Divider
	const div1 = new Instance("Frame");
	div1.Size = new UDim2(1, 0, 0, 1);
	div1.Position = new UDim2(0, 0, 0, topY + 2);
	div1.BackgroundColor3 = UI_THEME.divider;
	div1.BorderSizePixel = 0;
	div1.Parent = wrapper;
	topY += 6;

	// "COMPLETED BOUNTIES" header
	const compHeader = new Instance("TextLabel");
	compHeader.Size = new UDim2(1, 0, 0, 18);
	compHeader.Position = new UDim2(0, 0, 0, topY);
	compHeader.BackgroundTransparency = 1;
	compHeader.TextColor3 = UI_THEME.textSection;
	compHeader.Font = UI_THEME.fontBold;
	compHeader.TextSize = 11;
	compHeader.Text = "COMPLETED BOUNTIES";
	compHeader.TextXAlignment = Enum.TextXAlignment.Left;
	compHeader.Parent = wrapper;
	topY += 22;

	// ── Bottom-anchored sections ────────────────────────────────────────────
	const HISTORY_HEADER_H = 26;
	const hasBounties = data.completedBounties.size() > 0;
	const FOOTER_H = hasBounties ? 66 : 0;
	const bottomReserved = FOOTER_H + HISTORY_HEADER_H + 4;

	// ── Bounty list (scrollable, fills middle stretch zone) ──────────────────
	const listHeight = math.max(40, visibleH - topY - bottomReserved);

	if (!hasBounties) {
		const emptyLbl = new Instance("TextLabel");
		emptyLbl.Size = new UDim2(1, 0, 0, 22);
		emptyLbl.Position = new UDim2(0, 0, 0, topY);
		emptyLbl.BackgroundTransparency = 1;
		emptyLbl.TextColor3 = UI_THEME.textMuted;
		emptyLbl.Font = UI_THEME.fontBody;
		emptyLbl.TextSize = 13;
		emptyLbl.Text = "No bounties to turn in";
		emptyLbl.TextXAlignment = Enum.TextXAlignment.Left;
		emptyLbl.Parent = wrapper;
	} else {
		const listFrame = new Instance("ScrollingFrame");
		listFrame.Name = "BountyList";
		listFrame.Size = new UDim2(1, 0, 0, listHeight);
		listFrame.Position = new UDim2(0, 0, 0, topY);
		listFrame.BackgroundTransparency = 1;
		listFrame.BorderSizePixel = 0;
		listFrame.ScrollBarThickness = 3;
		listFrame.ScrollBarImageColor3 = UI_THEME.border;
		listFrame.CanvasSize = new UDim2(0, 0, 0, 0);
		listFrame.AutomaticCanvasSize = Enum.AutomaticSize.Y;
		listFrame.Parent = wrapper;

		const listLayout = new Instance("UIListLayout");
		listLayout.SortOrder = Enum.SortOrder.LayoutOrder;
		listLayout.Padding = new UDim(0, 4);
		listLayout.Parent = listFrame;

		let totalGold = 0;
		let totalXP = 0;
		let idx = 0;

		for (const b of data.completedBounties) {
			const bNpc = MEDIEVAL_NPCS[b.npcName] as NPCData | undefined;
			const bRarity = bNpc ? STATUS_RARITY[bNpc.status] : undefined;

			const row = new Instance("Frame");
			row.Size = new UDim2(1, 0, 0, 32);
			row.BackgroundColor3 = UI_THEME.bgInset;
			row.BackgroundTransparency = 0.4;
			row.BorderSizePixel = 0;
			row.LayoutOrder = idx++;
			row.Parent = listFrame;

			const rc = new Instance("UICorner");
			rc.CornerRadius = new UDim(0, 3);
			rc.Parent = row;

			// Rarity accent bar
			if (bRarity) {
				const accent = new Instance("Frame");
				accent.Size = new UDim2(0, 3, 1, -4);
				accent.Position = new UDim2(0, 0, 0, 2);
				accent.BackgroundColor3 = bRarity.color;
				accent.BorderSizePixel = 0;
				accent.Parent = row;
			}

			const bNameLbl = new Instance("TextLabel");
			bNameLbl.Size = new UDim2(0.55, 0, 1, 0);
			bNameLbl.Position = new UDim2(0, 8, 0, 0);
			bNameLbl.BackgroundTransparency = 1;
			bNameLbl.TextColor3 = bRarity?.color ?? UI_THEME.textPrimary;
			bNameLbl.Font = UI_THEME.fontBody;
			bNameLbl.TextSize = 12;
			bNameLbl.Text = b.npcName;
			bNameLbl.TextXAlignment = Enum.TextXAlignment.Left;
			bNameLbl.Parent = row;

			const goldLbl = new Instance("TextLabel");
			goldLbl.Size = new UDim2(0.2, 0, 1, 0);
			goldLbl.Position = new UDim2(0.55, 0, 0, 0);
			goldLbl.BackgroundTransparency = 1;
			goldLbl.TextColor3 = UI_THEME.gold;
			goldLbl.Font = UI_THEME.fontBold;
			goldLbl.TextSize = 12;
			goldLbl.Text = b.gold + "g";
			goldLbl.Parent = row;

			const xpLbl = new Instance("TextLabel");
			xpLbl.Size = new UDim2(0.25, 0, 1, 0);
			xpLbl.Position = new UDim2(0.75, 0, 0, 0);
			xpLbl.BackgroundTransparency = 1;
			xpLbl.TextColor3 = Color3.fromRGB(180, 155, 80);
			xpLbl.Font = UI_THEME.fontBody;
			xpLbl.TextSize = 11;
			xpLbl.Text = b.xp + " XP";
			xpLbl.Parent = row;

			totalGold += b.gold;
			totalXP += b.xp;
		}

		// ── Footer: Total + Turn-in (anchored above history) ────────────────
		const footerTop = visibleH - bottomReserved;

		const footerDiv = new Instance("Frame");
		footerDiv.Size = new UDim2(1, 0, 0, 1);
		footerDiv.Position = new UDim2(0, 0, 0, footerTop);
		footerDiv.BackgroundColor3 = UI_THEME.divider;
		footerDiv.BorderSizePixel = 0;
		footerDiv.Parent = wrapper;

		const totalLbl = new Instance("TextLabel");
		totalLbl.Size = new UDim2(1, 0, 0, 22);
		totalLbl.Position = new UDim2(0, 0, 0, footerTop + 4);
		totalLbl.BackgroundTransparency = 1;
		totalLbl.TextColor3 = UI_THEME.gold;
		totalLbl.Font = UI_THEME.fontBold;
		totalLbl.TextSize = 13;
		totalLbl.Text = "Total: " + totalGold + " Gold  |  " + totalXP + " XP";
		totalLbl.TextXAlignment = Enum.TextXAlignment.Left;
		totalLbl.Parent = wrapper;

		const turnInBtn = new Instance("TextButton");
		turnInBtn.Name = "TurnInBtn";
		turnInBtn.Size = new UDim2(1, 0, 0, 32);
		turnInBtn.Position = new UDim2(0, 0, 0, footerTop + 30);
		turnInBtn.BackgroundColor3 = UI_THEME.headerBg;
		turnInBtn.TextColor3 = UI_THEME.gold;
		turnInBtn.Font = UI_THEME.fontBold;
		turnInBtn.TextSize = 14;
		turnInBtn.Text = "TURN IN BOUNTIES";
		turnInBtn.BorderSizePixel = 0;
		turnInBtn.Parent = wrapper;

		const btnCorner = new Instance("UICorner");
		btnCorner.CornerRadius = new UDim(0, 4);
		btnCorner.Parent = turnInBtn;

		const btnStroke = new Instance("UIStroke");
		btnStroke.Color = UI_THEME.gold;
		btnStroke.Thickness = 1;
		btnStroke.Parent = turnInBtn;

		turnInBtn.MouseButton1Click.Connect(() => {
			const result = getTurnInBountiesRemote().InvokeServer() as TurnInResult;
			if (result && result.count > 0) {
				fetchAndRender(0);
			}
		});
	}

	// ── History accordion (bottom, collapsed by default) ─────────────────────
	const historyTop = visibleH - HISTORY_HEADER_H;

	const historyDiv = new Instance("Frame");
	historyDiv.Size = new UDim2(1, 0, 0, 1);
	historyDiv.Position = new UDim2(0, 0, 0, historyTop - 3);
	historyDiv.BackgroundColor3 = UI_THEME.divider;
	historyDiv.BorderSizePixel = 0;
	historyDiv.Parent = wrapper;

	const historyToggle = new Instance("TextButton");
	historyToggle.Name = "HistoryToggle";
	historyToggle.Size = new UDim2(1, 0, 0, HISTORY_HEADER_H);
	historyToggle.Position = new UDim2(0, 0, 0, historyTop);
	historyToggle.BackgroundColor3 = UI_THEME.bgInset;
	historyToggle.BackgroundTransparency = 0.5;
	historyToggle.TextColor3 = UI_THEME.textSection;
	historyToggle.Font = UI_THEME.fontBold;
	historyToggle.TextSize = 10;
	historyToggle.Text = ">  BOUNTY HISTORY (" + data.turnedInBounties.size() + ")";
	historyToggle.TextXAlignment = Enum.TextXAlignment.Left;
	historyToggle.BorderSizePixel = 0;
	historyToggle.Parent = wrapper;

	const htCorner = new Instance("UICorner");
	htCorner.CornerRadius = new UDim(0, 3);
	htCorner.Parent = historyToggle;

	const htPad = new Instance("UIPadding");
	htPad.PaddingLeft = new UDim(0, 8);
	htPad.Parent = historyToggle;

	let historyExpanded = false;
	let historyContent: ScrollingFrame | undefined;

	historyToggle.MouseButton1Click.Connect(() => {
		historyExpanded = !historyExpanded;

		if (historyExpanded) {
			historyToggle.Text = "v  BOUNTY HISTORY (" + data.turnedInBounties.size() + ")";

			const entryCount = math.min(data.turnedInBounties.size(), 10);
			const contentH = math.min(140, entryCount * 20 + 8);

			historyContent = new Instance("ScrollingFrame");
			historyContent.Name = "HistoryContent";
			historyContent.Size = new UDim2(1, 0, 0, contentH);
			historyContent.Position = new UDim2(0, 0, 0, historyTop + HISTORY_HEADER_H + 2);
			historyContent.BackgroundColor3 = UI_THEME.bgInset;
			historyContent.BackgroundTransparency = 0.6;
			historyContent.BorderSizePixel = 0;
			historyContent.ScrollBarThickness = 3;
			historyContent.ScrollBarImageColor3 = UI_THEME.border;
			historyContent.CanvasSize = new UDim2(0, 0, 0, 0);
			historyContent.AutomaticCanvasSize = Enum.AutomaticSize.Y;
			historyContent.Parent = wrapper;

			const hcCorner = new Instance("UICorner");
			hcCorner.CornerRadius = new UDim(0, 3);
			hcCorner.Parent = historyContent;

			const hcLayout = new Instance("UIListLayout");
			hcLayout.SortOrder = Enum.SortOrder.LayoutOrder;
			hcLayout.Padding = new UDim(0, 2);
			hcLayout.Parent = historyContent;

			const hcPad = new Instance("UIPadding");
			hcPad.PaddingLeft = new UDim(0, 6);
			hcPad.PaddingTop = new UDim(0, 4);
			hcPad.PaddingRight = new UDim(0, 4);
			hcPad.Parent = historyContent;

			const histSlice = data.turnedInBounties;
			const startI = math.max(0, histSlice.size() - 10);
			let hIdx = 0;
			for (let i = histSlice.size() - 1; i >= startI; i--) {
				const b = histSlice[i];
				const hNpc = MEDIEVAL_NPCS[b.npcName] as NPCData | undefined;
				const hRarity = hNpc ? STATUS_RARITY[hNpc.status] : undefined;

				const hLbl = new Instance("TextLabel");
				hLbl.Size = new UDim2(1, 0, 0, 16);
				hLbl.BackgroundTransparency = 1;
				hLbl.TextColor3 = hRarity?.color ?? UI_THEME.textMuted;
				hLbl.Font = UI_THEME.fontBody;
				hLbl.TextSize = 11;
				hLbl.Text = b.npcName + "  " + b.gold + "g";
				hLbl.TextXAlignment = Enum.TextXAlignment.Left;
				hLbl.LayoutOrder = hIdx++;
				hLbl.Parent = historyContent;
			}

			// Expand wrapper so the outer scroll frame can reach the history
			wrapper.Size = new UDim2(1, 0, 0, visibleH + contentH + 4);
		} else {
			historyToggle.Text = ">  BOUNTY HISTORY (" + data.turnedInBounties.size() + ")";
			if (historyContent) {
				historyContent.Destroy();
				historyContent = undefined;
			}
			wrapper.Size = new UDim2(1, 0, 0, visibleH);
		}
	});
}

// ─── Tab: Bestiary (NPC Pokédex) — Card Layout ──────────────────────────────

function renderBestiaryTab(data: KillBookData): void {
	clearContent();
	if (!contentFrame) return;
	let order = 0;

	makeSectionHeader(contentFrame, "NPC BESTIARY", order++);
	makeLabel(contentFrame, "Total kills: " + data.totalNPCKills, order++, {
		color: UI_THEME.textMuted,
		size: 11,
	});

	makeDivider(contentFrame, order++);

	// Group by race
	const races = ["Human", "Elf", "Goblin"];
	for (const race of races) {
		makeSectionHeader(contentFrame, race.upper() + "S", order++);

		for (const [npcName, npcData] of pairs(MEDIEVAL_NPCS)) {
			if (npcData.race !== race) continue;
			const name = npcName as string;
			const record = data.killLog[name] as NPCKillRecord | undefined;
			const kills = record?.count ?? 0;
			const bountyKills = record?.bountyKills ?? 0;
			const discovered = kills > 0;
			const rarity = STATUS_RARITY[npcData.status];
			const isExpanded = bestiaryExpanded.has(name);

			const CARD_COLLAPSED = 56;
			const CARD_EXPANDED = 110;
			const cardHeight = isExpanded ? CARD_EXPANDED : CARD_COLLAPSED;

			// ── Card container (tappable) ───────────────────────────────────
			const card = new Instance("TextButton");
			card.Name = "Card_" + name;
			card.Size = new UDim2(1, 0, 0, cardHeight);
			card.BackgroundColor3 = discovered && rarity ? rarity.bgColor : UI_THEME.bg;
			card.BackgroundTransparency = discovered ? 0.15 : 0.6;
			card.BorderSizePixel = 0;
			card.Text = "";
			card.AutoButtonColor = false;
			card.LayoutOrder = order++;
			card.ClipsDescendants = true;
			card.Parent = contentFrame;

			const rc = new Instance("UICorner");
			rc.CornerRadius = new UDim(0, 5);
			rc.Parent = card;

			// Rarity stroke on discovered cards
			if (discovered && rarity) {
				const cardStroke = new Instance("UIStroke");
				cardStroke.Color = rarity.color;
				cardStroke.Thickness = 0.8;
				cardStroke.Parent = card;
			}

			// Rarity accent bar (left edge)
			if (rarity) {
				const accent = new Instance("Frame");
				accent.Size = new UDim2(0, 4, 1, 0);
				accent.Position = new UDim2(0, 0, 0, 0);
				accent.BackgroundColor3 = discovered ? rarity.color : UI_THEME.textMuted;
				accent.BackgroundTransparency = discovered ? 0 : 0.6;
				accent.BorderSizePixel = 0;
				accent.Parent = card;

				const accentCorner = new Instance("UICorner");
				accentCorner.CornerRadius = new UDim(0, 5);
				accentCorner.Parent = accent;
			}

			// ── Top row: Name + chevron ─────────────────────────────────────
			const nameLbl = new Instance("TextLabel");
			nameLbl.Size = new UDim2(1, -52, 0, 22);
			nameLbl.Position = new UDim2(0, 14, 0, 6);
			nameLbl.BackgroundTransparency = 1;
			nameLbl.TextColor3 = discovered && rarity ? rarity.color : UI_THEME.textMuted;
			nameLbl.Font = UI_THEME.fontBold;
			nameLbl.TextSize = 13;
			nameLbl.Text = discovered ? name : "???";
			nameLbl.TextXAlignment = Enum.TextXAlignment.Left;
			nameLbl.Parent = card;

			const chevron = new Instance("TextLabel");
			chevron.Size = new UDim2(0, 20, 0, 22);
			chevron.Position = new UDim2(1, -30, 0, 6);
			chevron.BackgroundTransparency = 1;
			chevron.TextColor3 = UI_THEME.textMuted;
			chevron.Font = UI_THEME.fontBold;
			chevron.TextSize = 12;
			chevron.Text = isExpanded ? "v" : ">";
			chevron.Parent = card;

			// ── Sub-row: Status + kill stats ────────────────────────────────
			const statusLbl = new Instance("TextLabel");
			statusLbl.Size = new UDim2(0.45, 0, 0, 16);
			statusLbl.Position = new UDim2(0, 14, 0, 30);
			statusLbl.BackgroundTransparency = 1;
			statusLbl.TextColor3 = rarity ? rarity.color : UI_THEME.textMuted;
			statusLbl.Font = UI_THEME.fontBody;
			statusLbl.TextSize = 11;
			statusLbl.Text = discovered ? npcData.status + " (" + (rarity?.label ?? "") + ")" : "--";
			statusLbl.TextXAlignment = Enum.TextXAlignment.Left;
			statusLbl.Parent = card;

			const killBadge = new Instance("TextLabel");
			killBadge.Size = new UDim2(0.5, -14, 0, 16);
			killBadge.Position = new UDim2(0.5, 0, 0, 30);
			killBadge.BackgroundTransparency = 1;
			killBadge.TextColor3 = kills > 0 ? UI_THEME.danger : UI_THEME.textMuted;
			killBadge.Font = UI_THEME.fontBold;
			killBadge.TextSize = 11;
			killBadge.Text = kills + " kills  |  " + bountyKills + " bounty";
			killBadge.TextXAlignment = Enum.TextXAlignment.Right;
			killBadge.Parent = card;

			// ── Expanded detail section ─────────────────────────────────────
			if (isExpanded && discovered) {
				const detailDiv = new Instance("Frame");
				detailDiv.Size = new UDim2(1, -28, 0, 1);
				detailDiv.Position = new UDim2(0, 14, 0, 54);
				detailDiv.BackgroundColor3 = UI_THEME.divider;
				detailDiv.BorderSizePixel = 0;
				detailDiv.Parent = card;

				const raceLbl = new Instance("TextLabel");
				raceLbl.Size = new UDim2(0.5, 0, 0, 18);
				raceLbl.Position = new UDim2(0, 14, 0, 60);
				raceLbl.BackgroundTransparency = 1;
				raceLbl.TextColor3 = UI_THEME.textPrimary;
				raceLbl.Font = UI_THEME.fontBody;
				raceLbl.TextSize = 11;
				raceLbl.Text = "Race: " + npcData.race;
				raceLbl.TextXAlignment = Enum.TextXAlignment.Left;
				raceLbl.Parent = card;

				const genderLbl = new Instance("TextLabel");
				genderLbl.Size = new UDim2(0.5, -14, 0, 18);
				genderLbl.Position = new UDim2(0.5, 0, 0, 60);
				genderLbl.BackgroundTransparency = 1;
				genderLbl.TextColor3 = UI_THEME.textPrimary;
				genderLbl.Font = UI_THEME.fontBody;
				genderLbl.TextSize = 11;
				genderLbl.Text = "Gender: " + npcData.gender;
				genderLbl.TextXAlignment = Enum.TextXAlignment.Right;
				genderLbl.Parent = card;

				const bountyVal = rarity
					? [100, 200, 350, 600, 1200][math.clamp(rarity.order, 0, 4)]
					: 0;
				const rewardLbl = new Instance("TextLabel");
				rewardLbl.Size = new UDim2(1, -28, 0, 18);
				rewardLbl.Position = new UDim2(0, 14, 0, 82);
				rewardLbl.BackgroundTransparency = 1;
				rewardLbl.TextColor3 = UI_THEME.gold;
				rewardLbl.Font = UI_THEME.fontBold;
				rewardLbl.TextSize = 11;
				rewardLbl.Text = "Bounty value: " + bountyVal + "g";
				rewardLbl.TextXAlignment = Enum.TextXAlignment.Left;
				rewardLbl.Parent = card;
			}

			// ── Tap to expand/collapse ──────────────────────────────────────
			card.MouseButton1Click.Connect(() => {
				if (bestiaryExpanded.has(name)) {
					bestiaryExpanded.delete(name);
				} else {
					bestiaryExpanded.add(name);
				}
				renderBestiaryTab(data);
			});
		}
	}
}

// ─── Tab: PvP Stats ───────────────────────────────────────────────────────────

function renderPvPTab(data: KillBookData): void {
	clearContent();
	if (!contentFrame) return;
	let order = 0;

	makeSectionHeader(contentFrame, "PLAYER vs PLAYER", order++);
	makeDivider(contentFrame, order++);

	const kd =
		data.playerDeaths > 0 ? math.floor((data.playerKills / data.playerDeaths) * 100) / 100 : data.playerKills;

	makeLabel(contentFrame, "Player Kills", order++, {
		color: UI_THEME.textSection,
		font: UI_THEME.fontBold,
		size: 11,
	});
	makeLabel(contentFrame, "" + data.playerKills, order++, {
		color: UI_THEME.danger,
		font: UI_THEME.fontDisplay,
		size: 28,
		height: 36,
	});

	makeLabel(contentFrame, "Player Deaths", order++, {
		color: UI_THEME.textSection,
		font: UI_THEME.fontBold,
		size: 11,
	});
	makeLabel(contentFrame, "" + data.playerDeaths, order++, {
		color: UI_THEME.textPrimary,
		font: UI_THEME.fontDisplay,
		size: 28,
		height: 36,
	});

	makeDivider(contentFrame, order++);

	makeLabel(contentFrame, "K/D Ratio", order++, { color: UI_THEME.textSection, font: UI_THEME.fontBold, size: 11 });
	makeLabel(contentFrame, "" + kd, order++, {
		color: UI_THEME.gold,
		font: UI_THEME.fontDisplay,
		size: 24,
		height: 32,
	});

	makeDivider(contentFrame, order++);

	makeLabel(contentFrame, "Total Score", order++, { color: UI_THEME.textSection, font: UI_THEME.fontBold, size: 11 });
	makeLabel(contentFrame, "" + data.score, order++, {
		color: UI_THEME.textHeader,
		font: UI_THEME.fontDisplay,
		size: 22,
		height: 30,
	});
}

// ─── Tab: Achievements ────────────────────────────────────────────────────────

function renderAchievementsTab(data: KillBookData): void {
	clearContent();
	if (!contentFrame) return;
	let order = 0;

	// ── Title selector ────────────────────────────────────────────────────────
	makeSectionHeader(contentFrame, "ACTIVE TITLE", order++);

	const equippedTitleId = data.equippedTitle;
	const equippedTitleDef = TITLES[equippedTitleId];

	const currentTitleRow = new Instance("Frame");
	currentTitleRow.Size = new UDim2(1, 0, 0, 36);
	currentTitleRow.BackgroundColor3 = UI_THEME.bgInset;
	currentTitleRow.BackgroundTransparency = 0.3;
	currentTitleRow.BorderSizePixel = 0;
	currentTitleRow.LayoutOrder = order++;
	currentTitleRow.Parent = contentFrame;

	const ctCorner = new Instance("UICorner");
	ctCorner.CornerRadius = new UDim(0, 4);
	ctCorner.Parent = currentTitleRow;

	if (equippedTitleDef !== undefined) {
		const ctStroke = new Instance("UIStroke");
		ctStroke.Color = equippedTitleDef.color;
		ctStroke.Thickness = 0.8;
		ctStroke.Parent = currentTitleRow;
	}

	const currentLbl = new Instance("TextLabel");
	currentLbl.Size = new UDim2(1, -62, 1, 0);
	currentLbl.Position = new UDim2(0, 8, 0, 0);
	currentLbl.BackgroundTransparency = 1;
	currentLbl.TextColor3 = equippedTitleDef !== undefined ? equippedTitleDef.color : UI_THEME.textMuted;
	currentLbl.Font = UI_THEME.fontDisplay;
	currentLbl.TextSize = 13;
	currentLbl.Text = equippedTitleDef !== undefined ? equippedTitleDef.symbol + " " + equippedTitleDef.name : "None";
	currentLbl.TextXAlignment = Enum.TextXAlignment.Left;
	currentLbl.Parent = currentTitleRow;

	const changeBtn = new Instance("TextButton");
	changeBtn.Size = new UDim2(0, 52, 0, 24);
	changeBtn.Position = new UDim2(1, -58, 0.5, -12);
	changeBtn.BackgroundColor3 = UI_THEME.headerBg;
	changeBtn.BackgroundTransparency = 0.2;
	changeBtn.TextColor3 = UI_THEME.textSection;
	changeBtn.Font = UI_THEME.fontBold;
	changeBtn.TextSize = 10;
	changeBtn.Text = titleDropdownOpen ? "CLOSE" : "CHANGE";
	changeBtn.BorderSizePixel = 0;
	changeBtn.Parent = currentTitleRow;

	const changeBtnCorner = new Instance("UICorner");
	changeBtnCorner.CornerRadius = new UDim(0, 3);
	changeBtnCorner.Parent = changeBtn;

	changeBtn.MouseButton1Click.Connect(() => {
		titleDropdownOpen = !titleDropdownOpen;
		fetchAndRender(3);
	});

	// Dropdown list of owned titles
	if (titleDropdownOpen) {
		for (const td of TITLE_LIST) {
			if (!data.ownedTitles.includes(td.id)) continue;
			const isEquipped = td.id === equippedTitleId;

			const optBtn = new Instance("TextButton");
			optBtn.Size = new UDim2(1, 0, 0, 30);
			optBtn.BackgroundColor3 = isEquipped ? UI_THEME.bgInset : UI_THEME.bg;
			optBtn.BackgroundTransparency = isEquipped ? 0.2 : 0.5;
			optBtn.BorderSizePixel = 0;
			optBtn.Text = "";
			optBtn.LayoutOrder = order++;
			optBtn.Parent = contentFrame;

			const optCorner = new Instance("UICorner");
			optCorner.CornerRadius = new UDim(0, 3);
			optCorner.Parent = optBtn;

			const optStroke = new Instance("UIStroke");
			optStroke.Color = td.color;
			optStroke.Thickness = isEquipped ? 1.2 : 0.5;
			optStroke.Parent = optBtn;

			const optLbl = new Instance("TextLabel");
			optLbl.Size = new UDim2(1, -8, 1, 0);
			optLbl.Position = new UDim2(0, 8, 0, 0);
			optLbl.BackgroundTransparency = 1;
			optLbl.TextColor3 = td.color;
			optLbl.Font = UI_THEME.fontDisplay;
			optLbl.TextSize = 12;
			optLbl.Text = td.symbol + " " + td.name + (isEquipped ? "  [active]" : "");
			optLbl.TextXAlignment = Enum.TextXAlignment.Left;
			optLbl.Parent = optBtn;

			if (!isEquipped) {
				optBtn.MouseButton1Click.Connect(() => {
					getEquipTitleRemote().FireServer(td.id);
					titleDropdownOpen = false;
					fetchAndRender(3);
				});
			}
		}
	}

	makeDivider(contentFrame, order++);

	// ── Guilds / Faction XP ─────────────────────────────────────────────────────
	const fxp = data.factionXP;
	const combinedLevel = overallLevelFromFactions(fxp);
	makeSectionHeader(contentFrame, "GUILDS  (Level " + combinedLevel + ")", order++);

	for (const fid of FACTION_IDS) {
		const def = FACTIONS[fid];
		const xp = fxp[fid] ?? 0;
		const lvl = levelFromXP(xp);

		const guildRow = new Instance("Frame");
		guildRow.Size = new UDim2(1, 0, 0, 42);
		guildRow.BackgroundColor3 = UI_THEME.bgInset;
		guildRow.BackgroundTransparency = 0.3;
		guildRow.BorderSizePixel = 0;
		guildRow.LayoutOrder = order++;
		guildRow.Parent = contentFrame;

		const gCorner = new Instance("UICorner");
		gCorner.CornerRadius = new UDim(0, 4);
		gCorner.Parent = guildRow;

		const gStroke = new Instance("UIStroke");
		gStroke.Color = def.color;
		gStroke.Thickness = 0.8;
		gStroke.Parent = guildRow;

		const nameLbl = new Instance("TextLabel");
		nameLbl.Size = new UDim2(0.6, -8, 0, 18);
		nameLbl.Position = new UDim2(0, 8, 0, 4);
		nameLbl.BackgroundTransparency = 1;
		nameLbl.TextColor3 = def.color;
		nameLbl.Font = UI_THEME.fontBold;
		nameLbl.TextSize = 13;
		nameLbl.Text = def.name;
		nameLbl.TextXAlignment = Enum.TextXAlignment.Left;
		nameLbl.Parent = guildRow;

		const lvlLbl = new Instance("TextLabel");
		lvlLbl.Size = new UDim2(0.4, -8, 0, 18);
		lvlLbl.Position = new UDim2(0.6, 0, 0, 4);
		lvlLbl.BackgroundTransparency = 1;
		lvlLbl.TextColor3 = UI_THEME.textHeader;
		lvlLbl.Font = UI_THEME.fontDisplay;
		lvlLbl.TextSize = 13;
		lvlLbl.Text = "Lvl " + lvl;
		lvlLbl.TextXAlignment = Enum.TextXAlignment.Right;
		lvlLbl.Parent = guildRow;

		const xpLbl = new Instance("TextLabel");
		xpLbl.Size = new UDim2(1, -16, 0, 14);
		xpLbl.Position = new UDim2(0, 8, 0, 24);
		xpLbl.BackgroundTransparency = 1;
		xpLbl.TextColor3 = UI_THEME.textMuted;
		xpLbl.Font = UI_THEME.fontBody;
		xpLbl.TextSize = 11;
		xpLbl.Text = xp + " XP";
		xpLbl.TextXAlignment = Enum.TextXAlignment.Left;
		xpLbl.Parent = guildRow;
	}

	makeDivider(contentFrame, order++);

	// ── Achievements list — Card Layout ─────────────────────────────────────
	const unlocked = data.unlockedAchievements.size();
	const total = ACHIEVEMENT_LIST.size();
	makeSectionHeader(contentFrame, "ACHIEVEMENTS  " + unlocked + "/" + total, order++);
	makeDivider(contentFrame, order++);

	for (const achievement of ACHIEVEMENT_LIST) {
		const isUnlocked = data.unlockedAchievements.includes(achievement.id);
		const isExpanded = achievementExpanded.has(achievement.id);
		const titleDef = achievement.titleId ? TITLES[achievement.titleId] : undefined;

		const CARD_COLLAPSED = 64;
		const CARD_EXPANDED = 130;
		const cardHeight = isExpanded ? CARD_EXPANDED : CARD_COLLAPSED;

		// ── Card container (tappable) ───────────────────────────────────
		const card = new Instance("TextButton");
		card.Name = "AchCard_" + achievement.id;
		card.Size = new UDim2(1, 0, 0, cardHeight);
		card.BackgroundColor3 = isUnlocked ? UI_THEME.bgInset : UI_THEME.bg;
		card.BackgroundTransparency = isUnlocked ? 0.15 : 0.6;
		card.BorderSizePixel = 0;
		card.Text = "";
		card.AutoButtonColor = false;
		card.LayoutOrder = order++;
		card.ClipsDescendants = true;
		card.Parent = contentFrame;

		const rc = new Instance("UICorner");
		rc.CornerRadius = new UDim(0, 5);
		rc.Parent = card;

		if (isUnlocked) {
			const cardStroke = new Instance("UIStroke");
			cardStroke.Color = UI_THEME.gold;
			cardStroke.Thickness = 0.8;
			cardStroke.Parent = card;
		}

		// ── Left accent bar ─────────────────────────────────────────────
		const accent = new Instance("Frame");
		accent.Size = new UDim2(0, 4, 1, 0);
		accent.Position = new UDim2(0, 0, 0, 0);
		accent.BackgroundColor3 = isUnlocked ? UI_THEME.gold : UI_THEME.textMuted;
		accent.BackgroundTransparency = isUnlocked ? 0 : 0.6;
		accent.BorderSizePixel = 0;
		accent.Parent = card;

		const accentCorner = new Instance("UICorner");
		accentCorner.CornerRadius = new UDim(0, 5);
		accentCorner.Parent = accent;

		// ── Icon badge ──────────────────────────────────────────────────
		const badge = new Instance("TextLabel");
		badge.Size = new UDim2(0, 40, 0, 40);
		badge.Position = new UDim2(0, 12, 0, 10);
		badge.BackgroundColor3 = isUnlocked ? UI_THEME.headerBg : UI_THEME.bg;
		badge.BackgroundTransparency = 0.1;
		badge.TextColor3 = isUnlocked ? UI_THEME.gold : UI_THEME.textMuted;
		badge.Font = UI_THEME.fontDisplay;
		badge.TextSize = 20;
		badge.Text = achievement.icon;
		badge.BorderSizePixel = 0;
		badge.Parent = card;

		const badgeCorner = new Instance("UICorner");
		badgeCorner.CornerRadius = new UDim(0, 5);
		badgeCorner.Parent = badge;

		if (isUnlocked) {
			const badgeStroke = new Instance("UIStroke");
			badgeStroke.Color = UI_THEME.gold;
			badgeStroke.Thickness = 0.6;
			badgeStroke.Parent = badge;
		}

		// ── Name + chevron ──────────────────────────────────────────────
		const nameLbl = new Instance("TextLabel");
		nameLbl.Size = new UDim2(1, -82, 0, 22);
		nameLbl.Position = new UDim2(0, 60, 0, 8);
		nameLbl.BackgroundTransparency = 1;
		nameLbl.TextColor3 = isUnlocked ? UI_THEME.textHeader : UI_THEME.textMuted;
		nameLbl.Font = UI_THEME.fontBold;
		nameLbl.TextSize = 14;
		nameLbl.Text = isUnlocked ? achievement.name : "???";
		nameLbl.TextXAlignment = Enum.TextXAlignment.Left;
		nameLbl.Parent = card;

		const chevron = new Instance("TextLabel");
		chevron.Size = new UDim2(0, 20, 0, 22);
		chevron.Position = new UDim2(1, -30, 0, 8);
		chevron.BackgroundTransparency = 1;
		chevron.TextColor3 = UI_THEME.textMuted;
		chevron.Font = UI_THEME.fontBold;
		chevron.TextSize = 12;
		chevron.Text = isExpanded ? "v" : ">";
		chevron.Parent = card;

		// ── Description preview ─────────────────────────────────────────
		const descLbl = new Instance("TextLabel");
		descLbl.Size = new UDim2(1, -72, 0, 16);
		descLbl.Position = new UDim2(0, 60, 0, 32);
		descLbl.BackgroundTransparency = 1;
		descLbl.TextColor3 = isUnlocked ? UI_THEME.textPrimary : UI_THEME.textMuted;
		descLbl.Font = UI_THEME.fontBody;
		descLbl.TextSize = 11;
		descLbl.Text = isUnlocked ? achievement.description : "Locked";
		descLbl.TextXAlignment = Enum.TextXAlignment.Left;
		descLbl.Parent = card;

		// ── Expanded detail section ─────────────────────────────────────
		if (isExpanded) {
			const detailDiv = new Instance("Frame");
			detailDiv.Size = new UDim2(1, -24, 0, 1);
			detailDiv.Position = new UDim2(0, 12, 0, 62);
			detailDiv.BackgroundColor3 = UI_THEME.divider;
			detailDiv.BorderSizePixel = 0;
			detailDiv.Parent = card;

			if (isUnlocked && titleDef) {
				const titleRewardLbl = new Instance("TextLabel");
				titleRewardLbl.Size = new UDim2(1, -24, 0, 20);
				titleRewardLbl.Position = new UDim2(0, 12, 0, 70);
				titleRewardLbl.BackgroundTransparency = 1;
				titleRewardLbl.TextColor3 = titleDef.color;
				titleRewardLbl.Font = UI_THEME.fontDisplay;
				titleRewardLbl.TextSize = 13;
				titleRewardLbl.Text = "Title: " + titleDef.symbol + " " + titleDef.name;
				titleRewardLbl.TextXAlignment = Enum.TextXAlignment.Left;
				titleRewardLbl.Parent = card;
			}

			const statusLbl = new Instance("TextLabel");
			statusLbl.Size = new UDim2(1, -24, 0, 20);
			statusLbl.Position = new UDim2(0, 12, 0, titleDef && isUnlocked ? 94 : 70);
			statusLbl.BackgroundTransparency = 1;
			statusLbl.TextColor3 = isUnlocked ? UI_THEME.gold : UI_THEME.danger;
			statusLbl.Font = UI_THEME.fontBold;
			statusLbl.TextSize = 12;
			statusLbl.Text = isUnlocked ? "UNLOCKED" : "LOCKED";
			statusLbl.TextXAlignment = Enum.TextXAlignment.Left;
			statusLbl.Parent = card;
		}

		// ── Tap to expand/collapse ──────────────────────────────────────
		card.MouseButton1Click.Connect(() => {
			if (achievementExpanded.has(achievement.id)) {
				achievementExpanded.delete(achievement.id);
			} else {
				achievementExpanded.add(achievement.id);
			}
			renderAchievementsTab(data);
		});
	}
}

// ─── Tab rendering dispatcher ─────────────────────────────────────────────────

function fetchAndRender(tabIndex: number): void {
	// Reset expanded state when switching to a different tab
	if (tabIndex !== activeTab) {
		bestiaryExpanded = new Set<string>();
		achievementExpanded = new Set<string>();
	}

	activeTab = tabIndex;
	updateTabHighlights();

	const data = getKillBookDataRemote().InvokeServer() as KillBookData | undefined;
	if (!data) return;

	if (tabIndex === 0) renderBountiesTab(data);
	else if (tabIndex === 1) renderBestiaryTab(data);
	else if (tabIndex === 2) renderPvPTab(data);
	else if (tabIndex === 3) renderAchievementsTab(data);
}

function updateTabHighlights(): void {
	for (let i = 0; i < tabButtons.size(); i++) {
		const btn = tabButtons[i];
		const isActive = i === activeTab;
		btn.BackgroundColor3 = isActive ? UI_THEME.headerBg : UI_THEME.bg;
		btn.TextColor3 = isActive ? UI_THEME.textHeader : UI_THEME.textMuted;

		const stroke = btn.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
		if (stroke) stroke.Color = isActive ? UI_THEME.border : UI_THEME.divider;
	}
}

// ─── Build the book UI ────────────────────────────────────────────────────────

function buildKillBook(playerGui: PlayerGui): void {
	bookGui = new Instance("ScreenGui");
	bookGui.Name = "KillBookGui";
	bookGui.ResetOnSpawn = false;
	bookGui.IgnoreGuiInset = true;
	bookGui.DisplayOrder = 5;
	bookGui.Parent = playerGui;

	// Backdrop
	const backdrop = new Instance("TextButton");
	backdrop.Name = "Backdrop";
	backdrop.Size = new UDim2(1, 0, 1, 0);
	backdrop.BackgroundColor3 = Color3.fromRGB(0, 0, 0);
	backdrop.BackgroundTransparency = 0.5;
	backdrop.Text = "";
	backdrop.BorderSizePixel = 0;
	backdrop.Parent = bookGui;
	backdrop.MouseButton1Click.Connect(() => toggleBook());

	// Main frame — centered, scaled to viewport
	const scale = getUIScale();
	const frameW = math.floor(440 * scale);
	const frameH = math.floor(520 * scale);

	bookFrame = new Instance("Frame");
	bookFrame.Name = "KillBook";
	bookFrame.Size = new UDim2(0, frameW, 0, frameH);
	bookFrame.Position = new UDim2(0.5, -math.floor(frameW / 2), 0.5, -math.floor(frameH / 2));
	bookFrame.BackgroundColor3 = UI_THEME.bg;
	bookFrame.BackgroundTransparency = UI_THEME.bgTransparency;
	bookFrame.BorderSizePixel = 0;
	bookFrame.Parent = bookGui;

	// Apply UIScale so all children (text sizes, padding, rows) scale proportionally
	const uiScale = new Instance("UIScale");
	uiScale.Scale = scale;
	uiScale.Parent = bookFrame;

	const corner = new Instance("UICorner");
	corner.CornerRadius = UI_THEME.cornerRadius;
	corner.Parent = bookFrame;

	const stroke = new Instance("UIStroke");
	stroke.Color = UI_THEME.border;
	stroke.Thickness = UI_THEME.strokeThickness;
	stroke.Parent = bookFrame;

	// Title bar
	const titleBar = new Instance("Frame");
	titleBar.Name = "TitleBar";
	titleBar.Size = new UDim2(1, 0, 0, 36);
	titleBar.BackgroundColor3 = UI_THEME.headerBg;
	titleBar.BorderSizePixel = 0;
	titleBar.Parent = bookFrame;

	const titleCorner = new Instance("UICorner");
	titleCorner.CornerRadius = UI_THEME.cornerRadius;
	titleCorner.Parent = titleBar;

	const titleLabel = new Instance("TextLabel");
	titleLabel.Size = new UDim2(1, 0, 1, 0);
	titleLabel.BackgroundTransparency = 1;
	titleLabel.TextColor3 = UI_THEME.textHeader;
	titleLabel.Font = UI_THEME.fontDisplay;
	titleLabel.TextSize = 18;
	titleLabel.Text = "KILL BOOK";
	titleLabel.Parent = titleBar;

	// Tab bar
	const tabBar = new Instance("Frame");
	tabBar.Name = "TabBar";
	tabBar.Size = new UDim2(1, 0, 0, 28);
	tabBar.Position = new UDim2(0, 0, 0, 38);
	tabBar.BackgroundTransparency = 1;
	tabBar.BorderSizePixel = 0;
	tabBar.Parent = bookFrame;

	const tabLayout = new Instance("UIListLayout");
	tabLayout.FillDirection = Enum.FillDirection.Horizontal;
	tabLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center;
	tabLayout.Padding = new UDim(0, 4);
	tabLayout.Parent = tabBar;

	tabButtons = [];
	for (let i = 0; i < TAB_NAMES.size(); i++) {
		const tabName = TAB_NAMES[i];
		const btn = new Instance("TextButton");
		btn.Name = "Tab_" + tabName;
		btn.Size = new UDim2(0, 100, 1, 0);
		btn.BackgroundColor3 = UI_THEME.bg;
		btn.TextColor3 = UI_THEME.textMuted;
		btn.Font = UI_THEME.fontBold;
		btn.TextSize = 10;
		btn.Text = tabName;
		btn.BorderSizePixel = 0;
		btn.Parent = tabBar;

		const btnCorner = new Instance("UICorner");
		btnCorner.CornerRadius = new UDim(0, 3);
		btnCorner.Parent = btn;

		const btnStroke = new Instance("UIStroke");
		btnStroke.Color = UI_THEME.divider;
		btnStroke.Thickness = 0.8;
		btnStroke.Parent = btn;

		const tabIndex = i;
		btn.MouseButton1Click.Connect(() => fetchAndRender(tabIndex));

		tabButtons.push(btn);
	}

	// Content area — scrollable
	const scrollFrame = new Instance("ScrollingFrame");
	scrollFrame.Name = "Content";
	scrollFrame.Size = new UDim2(1, -20, 1, -78);
	scrollFrame.Position = new UDim2(0, 10, 0, 70);
	scrollFrame.BackgroundTransparency = 1;
	scrollFrame.BorderSizePixel = 0;
	scrollFrame.ScrollBarThickness = 4;
	scrollFrame.ScrollBarImageColor3 = UI_THEME.border;
	scrollFrame.CanvasSize = new UDim2(0, 0, 0, 0);
	scrollFrame.AutomaticCanvasSize = Enum.AutomaticSize.Y;
	scrollFrame.Parent = bookFrame;
	contentFrame = scrollFrame;

	const contentLayout = new Instance("UIListLayout");
	contentLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	contentLayout.Padding = new UDim(0, 4);
	contentLayout.Parent = contentFrame;

	const contentPadding = new Instance("UIPadding");
	contentPadding.PaddingLeft = new UDim(0, 4);
	contentPadding.PaddingRight = new UDim(0, 4);
	contentPadding.PaddingTop = new UDim(0, 4);
	contentPadding.Parent = contentFrame;

	bookGui.Enabled = false;
}

function toggleBook(): void {
	if (!bookGui) return;
	isOpen = !isOpen;
	bookGui.Enabled = isOpen;
	if (isOpen) {
		fetchAndRender(activeTab);
	}
}

// ─── Init ─────────────────────────────────────────────────────────────────────

onPlayerInitialized(() => {
	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
	buildKillBook(playerGui);
	isReady = true;

	// Register toggle so the mobile HUD can open/close the book
	registerKillBookToggle(() => toggleBook());

	// Listen for achievement unlocks
	getAchievementUnlockedRemote().OnClientEvent.Connect((achievementId: unknown) => {
		print("[ACHIEVEMENT] Unlocked: " + (achievementId as string));
		// If book is open on achievements tab, refresh
		if (isOpen && activeTab === 3) {
			fetchAndRender(3);
		}
	});

	// [DISABLED] B key toggle removed — use mobile HUD codex button instead
});
