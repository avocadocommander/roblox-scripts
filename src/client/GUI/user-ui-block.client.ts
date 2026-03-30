import { Players, ReplicatedStorage, TweenService } from "@rbxts/services";
import { onPlayerInitialized } from "../modules/client-init";
import {
	getBountyListSyncRemote,
	getPlayerWantedClearedRemote,
	getPlayerWantedRemote,
	PlayerWantedPayload,
} from "shared/remotes/bounty-remote";
import { UI_THEME, getUIScale } from "shared/ui-theme";
import { getEffectSyncRemote, EffectSyncPayload } from "shared/remotes/effect-remote";
import { POISONS } from "shared/config/poisons";
import { ELIXIRS } from "shared/config/elixirs";

const playerState = ReplicatedStorage.WaitForChild("PlayerState") as Folder;
const GetPlayerExpierence = playerState.WaitForChild("GetExpierence") as RemoteFunction;
const GetPlayerTitle = playerState.WaitForChild("GetTitle") as RemoteFunction;
const GetPlayerName = playerState.WaitForChild("GetName") as RemoteFunction;
const GetPlayerLevel = playerState.WaitForChild("GetLevel") as RemoteFunction;
const GetCoins = playerState.WaitForChild("GetCoins") as RemoteFunction;
const CoinsUpdated = playerState.WaitForChild("CoinsUpdated") as RemoteEvent;
const ExpierenceUpdated = playerState.WaitForChild("ExpierenceUpdated") as RemoteEvent;
const LevelUpdated = playerState.WaitForChild("LevelUpdated") as RemoteEvent;

// NPC visibility -- fires from server whenever an NPC starts/stops seeing this player
const npcStateFolder = ReplicatedStorage.WaitForChild("NPCState") as Folder;
const ViewsUpdated = npcStateFolder.WaitForChild("ViewsUpdated") as RemoteEvent;

// -- Scaling --------------------------------------------------------------------

function sc(baseSize: number): number {
	return baseSize * getUIScale();
}

// -- Live refs ------------------------------------------------------------------

let nameLabel: TextLabel | undefined;
let titleLabel: TextLabel | undefined;
let levelLabel: TextLabel | undefined;
let coinsLabel: TextLabel | undefined;
let xpBar: Frame | undefined;
let xpFill: Frame | undefined;
let xpPctLabel: TextLabel | undefined;
let wantedRow: Frame | undefined;
let wantedGoldLabel: TextLabel | undefined;

let expandedSection: Frame | undefined;
let isExpanded = false;
let isWantedActive = false;
let isStealthing = false;
let isSpotted = false;

// Effect row refs
let effectRow: Frame | undefined;
let poisonLabel: TextLabel | undefined;
let elixirLabel: TextLabel | undefined;
let effectTooltip: TextLabel | undefined;

// Cached effect state for tooltip
let cachedEffectPayload: EffectSyncPayload | undefined;

const XP_PER_LEVEL = 1000;
const TWEEN_XP = new TweenInfo(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);

// Muted green for "safe" stealth name highlight
const SAFE_GREEN = Color3.fromRGB(58, 120, 58);

// -- Builder --------------------------------------------------------------------

function buildPlayerPanel(screenGui: ScreenGui): void {
	const W = sc(240);

	// ── Outer wrapper ───────────────────────────────────────────────────────
	const wrapper = new Instance("Frame");
	wrapper.Name = "PlayerHUD";
	wrapper.Size = new UDim2(0, W, 0, 0);
	wrapper.Position = new UDim2(0, sc(10), 1, sc(-10));
	wrapper.AnchorPoint = new Vector2(0, 1);
	wrapper.AutomaticSize = Enum.AutomaticSize.Y;
	wrapper.BackgroundTransparency = 1;
	wrapper.Parent = screenGui;

	const wrapLayout = new Instance("UIListLayout");
	wrapLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	wrapLayout.Padding = new UDim(0, 0);
	wrapLayout.Parent = wrapper;

	// ═════════════════════════════════════════════════════════════════════════
	//  EFFECT ROW  (above compact card — icon + name, hover/tap for timer)
	// ═════════════════════════════════════════════════════════════════════════
	const effRow = new Instance("Frame");
	effRow.Name = "EffectRow";
	effRow.LayoutOrder = -1;
	effRow.Size = new UDim2(1, 0, 0, sc(16));
	effRow.BackgroundTransparency = 1;
	effRow.Visible = false;
	effRow.Parent = wrapper;
	effectRow = effRow;

	// Poison: icon + name as a single TextLabel (left-aligned)
	poisonLabel = new Instance("TextLabel");
	poisonLabel.Name = "PoisonLabel";
	poisonLabel.Size = new UDim2(0.5, 0, 1, 0);
	poisonLabel.Position = new UDim2(0, 0, 0, 0);
	poisonLabel.BackgroundTransparency = 1;
	poisonLabel.Text = "";
	poisonLabel.TextColor3 = Color3.fromRGB(178, 102, 255);
	poisonLabel.Font = UI_THEME.fontBold;
	poisonLabel.TextSize = sc(10);
	poisonLabel.TextXAlignment = Enum.TextXAlignment.Left;
	poisonLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	poisonLabel.Visible = false;
	poisonLabel.Parent = effRow;

	// Elixir: icon + name as a single TextLabel (right-aligned)
	elixirLabel = new Instance("TextLabel");
	elixirLabel.Name = "ElixirLabel";
	elixirLabel.Size = new UDim2(0.5, 0, 1, 0);
	elixirLabel.Position = new UDim2(0.5, 0, 0, 0);
	elixirLabel.BackgroundTransparency = 1;
	elixirLabel.Text = "";
	elixirLabel.TextColor3 = Color3.fromRGB(100, 210, 120);
	elixirLabel.Font = UI_THEME.fontBold;
	elixirLabel.TextSize = sc(10);
	elixirLabel.TextXAlignment = Enum.TextXAlignment.Left;
	elixirLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	elixirLabel.Visible = false;
	elixirLabel.Parent = effRow;

	// Invisible hover/tap button covering the entire row
	const effHoverBtn = new Instance("TextButton");
	effHoverBtn.Name = "EffectHover";
	effHoverBtn.Size = new UDim2(1, 0, 1, 0);
	effHoverBtn.BackgroundTransparency = 1;
	effHoverBtn.Text = "";
	effHoverBtn.ZIndex = 5;
	effHoverBtn.Parent = effRow;

	// Tooltip (positioned above the effect row, hidden by default)
	const tooltip = new Instance("TextLabel");
	tooltip.Name = "EffectTooltip";
	tooltip.Size = new UDim2(0, sc(220), 0, 0);
	tooltip.AutomaticSize = Enum.AutomaticSize.Y;
	tooltip.Position = new UDim2(0, 0, 0, sc(-4));
	tooltip.AnchorPoint = new Vector2(0, 1);
	tooltip.BackgroundColor3 = UI_THEME.bg;
	tooltip.BackgroundTransparency = 0.1;
	tooltip.BorderSizePixel = 0;
	tooltip.Text = "";
	tooltip.TextColor3 = UI_THEME.textPrimary;
	tooltip.Font = UI_THEME.fontBold;
	tooltip.TextSize = sc(10);
	tooltip.TextXAlignment = Enum.TextXAlignment.Left;
	tooltip.TextWrapped = true;
	tooltip.TextYAlignment = Enum.TextYAlignment.Top;
	tooltip.Visible = false;
	tooltip.ZIndex = 51;
	tooltip.Parent = effRow;
	effectTooltip = tooltip;

	const ttCorner = new Instance("UICorner");
	ttCorner.CornerRadius = new UDim(0, sc(4));
	ttCorner.Parent = tooltip;

	const ttStroke = new Instance("UIStroke");
	ttStroke.Color = UI_THEME.border;
	ttStroke.Thickness = sc(0.6);
	ttStroke.Parent = tooltip;

	const ttPad = new Instance("UIPadding");
	ttPad.PaddingTop = new UDim(0, sc(5));
	ttPad.PaddingBottom = new UDim(0, sc(5));
	ttPad.PaddingLeft = new UDim(0, sc(6));
	ttPad.PaddingRight = new UDim(0, sc(6));
	ttPad.Parent = tooltip;

	// Hover: show tooltip on mouse enter, hide on mouse leave
	effHoverBtn.MouseEnter.Connect(() => {
		if (!effectTooltip) return;
		refreshTooltipText();
		effectTooltip.Visible = true;
	});
	effHoverBtn.MouseLeave.Connect(() => {
		if (effectTooltip) effectTooltip.Visible = false;
	});

	// Tap: toggle tooltip (for mobile)
	effHoverBtn.MouseButton1Click.Connect(() => {
		if (!effectTooltip) return;
		if (effectTooltip.Visible) {
			effectTooltip.Visible = false;
			return;
		}
		refreshTooltipText();
		effectTooltip.Visible = true;
		task.delay(4, () => {
			if (effectTooltip) effectTooltip.Visible = false;
		});
	});

	// ═════════════════════════════════════════════════════════════════════════
	//  COMPACT CARD  (always visible — single row: Name + Title)
	// ═════════════════════════════════════════════════════════════════════════
	const card = new Instance("TextButton");
	card.Name = "CompactCard";
	card.LayoutOrder = 0;
	card.Size = new UDim2(1, 0, 0, 0);
	card.AutomaticSize = Enum.AutomaticSize.Y;
	card.BackgroundColor3 = UI_THEME.bg;
	card.BackgroundTransparency = UI_THEME.bgTransparency;
	card.BorderSizePixel = 0;
	card.Text = "";
	card.AutoButtonColor = false;
	card.Parent = wrapper;

	const cardCorner = new Instance("UICorner");
	cardCorner.CornerRadius = UI_THEME.cornerRadius;
	cardCorner.Parent = card;

	const cardStroke = new Instance("UIStroke");
	cardStroke.Color = UI_THEME.border;
	cardStroke.Thickness = UI_THEME.strokeThickness;
	cardStroke.Parent = card;

	const cardPad = new Instance("UIPadding");
	cardPad.PaddingTop = new UDim(0, sc(8));
	cardPad.PaddingBottom = new UDim(0, sc(8));
	cardPad.PaddingLeft = new UDim(0, sc(10));
	cardPad.PaddingRight = new UDim(0, sc(10));
	cardPad.Parent = card;

	// ── Row 1: Name  ·  Title ─────────────────────────────────────────────
	const row1 = new Instance("Frame");
	row1.Name = "Row1";
	row1.Size = new UDim2(1, 0, 0, sc(22));
	row1.BackgroundTransparency = 1;
	row1.Parent = card;

	nameLabel = new Instance("TextLabel");
	nameLabel.Name = "Name";
	nameLabel.Size = new UDim2(0.6, 0, 1, 0);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.Text = "---";
	nameLabel.TextColor3 = UI_THEME.textPrimary;
	nameLabel.Font = UI_THEME.fontDisplay;
	nameLabel.TextSize = sc(18);
	nameLabel.TextXAlignment = Enum.TextXAlignment.Left;
	nameLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	nameLabel.Parent = row1;

	titleLabel = new Instance("TextLabel");
	titleLabel.Name = "Title";
	titleLabel.Size = new UDim2(0.4, 0, 1, 0);
	titleLabel.Position = new UDim2(0.6, 0, 0, 0);
	titleLabel.BackgroundTransparency = 1;
	titleLabel.Text = "";
	titleLabel.TextColor3 = UI_THEME.textSection;
	titleLabel.Font = UI_THEME.fontBold;
	titleLabel.TextSize = sc(11);
	titleLabel.TextXAlignment = Enum.TextXAlignment.Right;
	titleLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	titleLabel.Parent = row1;

	// ── Tap to expand / collapse ────────────────────────────────────────
	card.MouseButton1Click.Connect(() => {
		toggleExpand();
	});

	// ═════════════════════════════════════════════════════════════════════════
	//  EXPANDED SECTION  (hidden — level, gold, XP, wanted)
	// ═════════════════════════════════════════════════════════════════════════
	const expand = new Instance("Frame");
	expand.Name = "ExpandedSection";
	expand.LayoutOrder = 1;
	expand.Size = new UDim2(1, 0, 0, 0);
	expand.AutomaticSize = Enum.AutomaticSize.Y;
	expand.BackgroundColor3 = UI_THEME.bg;
	expand.BackgroundTransparency = UI_THEME.bgTransparency;
	expand.BorderSizePixel = 0;
	expand.ClipsDescendants = true;
	expand.Visible = false;
	expand.Parent = wrapper;
	expandedSection = expand;

	const expCorner = new Instance("UICorner");
	expCorner.CornerRadius = UI_THEME.cornerRadius;
	expCorner.Parent = expand;

	const expStroke = new Instance("UIStroke");
	expStroke.Color = UI_THEME.border;
	expStroke.Thickness = UI_THEME.strokeThickness;
	expStroke.Parent = expand;

	const expPad = new Instance("UIPadding");
	expPad.PaddingTop = new UDim(0, sc(6));
	expPad.PaddingBottom = new UDim(0, sc(6));
	expPad.PaddingLeft = new UDim(0, sc(10));
	expPad.PaddingRight = new UDim(0, sc(10));
	expPad.Parent = expand;

	const expLayout = new Instance("UIListLayout");
	expLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	expLayout.Padding = new UDim(0, sc(4));
	expLayout.Parent = expand;

	// ── Level + Gold row ────────────────────────────────────────────────
	const statsRow = new Instance("Frame");
	statsRow.Name = "StatsRow";
	statsRow.LayoutOrder = 0;
	statsRow.Size = new UDim2(1, 0, 0, sc(20));
	statsRow.BackgroundTransparency = 1;
	statsRow.Parent = expand;

	levelLabel = new Instance("TextLabel");
	levelLabel.Name = "Level";
	levelLabel.Size = new UDim2(0.4, 0, 1, 0);
	levelLabel.BackgroundTransparency = 1;
	levelLabel.Text = "Lv 1";
	levelLabel.TextColor3 = UI_THEME.gold;
	levelLabel.Font = UI_THEME.fontDisplay;
	levelLabel.TextSize = sc(16);
	levelLabel.TextXAlignment = Enum.TextXAlignment.Left;
	levelLabel.Parent = statsRow;

	coinsLabel = new Instance("TextLabel");
	coinsLabel.Name = "Gold";
	coinsLabel.Size = new UDim2(0.6, 0, 1, 0);
	coinsLabel.Position = new UDim2(0.4, 0, 0, 0);
	coinsLabel.BackgroundTransparency = 1;
	coinsLabel.Text = "0g";
	coinsLabel.TextColor3 = UI_THEME.gold;
	coinsLabel.Font = UI_THEME.fontBold;
	coinsLabel.TextSize = sc(14);
	coinsLabel.TextXAlignment = Enum.TextXAlignment.Right;
	coinsLabel.Parent = statsRow;

	// ── XP bar ──────────────────────────────────────────────────────────
	const xpRow = new Instance("Frame");
	xpRow.Name = "XPRow";
	xpRow.LayoutOrder = 1;
	xpRow.Size = new UDim2(1, 0, 0, sc(14));
	xpRow.BackgroundTransparency = 1;
	xpRow.Parent = expand;

	xpBar = new Instance("Frame");
	xpBar.Name = "XPBar";
	xpBar.Size = new UDim2(1, 0, 0, sc(10));
	xpBar.Position = new UDim2(0, 0, 0.5, sc(-5));
	xpBar.BackgroundColor3 = UI_THEME.bgInset;
	xpBar.BackgroundTransparency = 0;
	xpBar.BorderSizePixel = 0;
	xpBar.Parent = xpRow;

	const xpBarCorner = new Instance("UICorner");
	xpBarCorner.CornerRadius = new UDim(1, 0);
	xpBarCorner.Parent = xpBar;

	const xpBarStroke = new Instance("UIStroke");
	xpBarStroke.Color = UI_THEME.divider;
	xpBarStroke.Thickness = sc(0.6);
	xpBarStroke.Parent = xpBar;

	xpFill = new Instance("Frame");
	xpFill.Name = "Fill";
	xpFill.Size = new UDim2(0, 0, 1, 0);
	xpFill.BackgroundColor3 = UI_THEME.border;
	xpFill.BackgroundTransparency = 0;
	xpFill.BorderSizePixel = 0;
	xpFill.Parent = xpBar;

	const fillCorner = new Instance("UICorner");
	fillCorner.CornerRadius = new UDim(1, 0);
	fillCorner.Parent = xpFill;

	xpPctLabel = new Instance("TextLabel");
	xpPctLabel.Name = "XPPct";
	xpPctLabel.Size = new UDim2(1, 0, 1, 0);
	xpPctLabel.BackgroundTransparency = 1;
	xpPctLabel.Text = "0%";
	xpPctLabel.TextColor3 = UI_THEME.textPrimary;
	xpPctLabel.Font = UI_THEME.fontBold;
	xpPctLabel.TextSize = sc(9);
	xpPctLabel.ZIndex = 2;
	xpPctLabel.Parent = xpBar;

	// ── Wanted badge ────────────────────────────────────────────────────
	const wantedRowFrame = new Instance("Frame");
	wantedRowFrame.Name = "WantedBadge";
	wantedRowFrame.LayoutOrder = 2;
	wantedRowFrame.Size = new UDim2(1, 0, 0, sc(20));
	wantedRowFrame.BackgroundColor3 = UI_THEME.danger;
	wantedRowFrame.BackgroundTransparency = 0.4;
	wantedRowFrame.BorderSizePixel = 0;
	wantedRowFrame.Visible = false;
	wantedRowFrame.Parent = expand;
	wantedRow = wantedRowFrame;

	const wantedCorner = new Instance("UICorner");
	wantedCorner.CornerRadius = new UDim(0, sc(3));
	wantedCorner.Parent = wantedRowFrame;

	const wantedBadgePad = new Instance("UIPadding");
	wantedBadgePad.PaddingLeft = new UDim(0, sc(6));
	wantedBadgePad.PaddingRight = new UDim(0, sc(6));
	wantedBadgePad.Parent = wantedRowFrame;

	const wantedTitleLabel = new Instance("TextLabel");
	wantedTitleLabel.Size = new UDim2(0.55, 0, 1, 0);
	wantedTitleLabel.BackgroundTransparency = 1;
	wantedTitleLabel.Text = "WANTED";
	wantedTitleLabel.TextColor3 = UI_THEME.textPrimary;
	wantedTitleLabel.Font = UI_THEME.fontBold;
	wantedTitleLabel.TextSize = sc(12);
	wantedTitleLabel.TextXAlignment = Enum.TextXAlignment.Left;
	wantedTitleLabel.Parent = wantedRowFrame;

	wantedGoldLabel = new Instance("TextLabel");
	wantedGoldLabel.Name = "WantedGold";
	wantedGoldLabel.Size = new UDim2(0.45, 0, 1, 0);
	wantedGoldLabel.Position = new UDim2(0.55, 0, 0, 0);
	wantedGoldLabel.BackgroundTransparency = 1;
	wantedGoldLabel.Text = "";
	wantedGoldLabel.TextColor3 = UI_THEME.gold;
	wantedGoldLabel.Font = UI_THEME.fontBold;
	wantedGoldLabel.TextSize = sc(12);
	wantedGoldLabel.TextXAlignment = Enum.TextXAlignment.Right;
	wantedGoldLabel.Parent = wantedRowFrame;
}

// -- Expand / Collapse ----------------------------------------------------------

function toggleExpand(): void {
	if (!expandedSection) return;
	isExpanded = !isExpanded;
	expandedSection.Visible = isExpanded;
}

// -- Update helpers -------------------------------------------------------------

/** Recalculate the name label colour based on wanted + spotted + stealth state. */
function refreshNameColor(): void {
	if (!nameLabel || !titleLabel) return;
	if (isWantedActive) {
		// Wanted always overrides — red
		nameLabel.TextColor3 = UI_THEME.danger;
		titleLabel.TextColor3 = UI_THEME.danger;
	} else if (isStealthing && isSpotted) {
		// Stealthing + being seen — danger red
		nameLabel.TextColor3 = UI_THEME.danger;
		titleLabel.TextColor3 = UI_THEME.danger;
	} else if (isStealthing) {
		// Stealthing + safe — green
		nameLabel.TextColor3 = SAFE_GREEN;
		titleLabel.TextColor3 = SAFE_GREEN;
	} else {
		// Normal
		nameLabel.TextColor3 = UI_THEME.textPrimary;
		titleLabel.TextColor3 = UI_THEME.textSection;
	}
}

function setXP(xp: number) {
	if (!xpFill || !xpBar) return;
	const progress = math.clamp((xp % XP_PER_LEVEL) / XP_PER_LEVEL, 0, 1);
	TweenService.Create(xpFill, TWEEN_XP, {
		Size: new UDim2(progress, 0, 1, 0),
	}).Play();
	if (xpPctLabel) {
		xpPctLabel.Text = math.floor(progress * 100) + "%";
	}
}

function setWanted(gold: number): void {
	if (!wantedRow || !wantedGoldLabel) return;
	wantedGoldLabel.Text = gold + "g";
	wantedRow.Visible = true;
	isWantedActive = true;
	refreshNameColor();
}

function clearWanted(): void {
	if (wantedRow) wantedRow.Visible = false;
	isWantedActive = false;
	refreshNameColor();
}

function setEyeCount(viewers: string[]): void {
	if (viewers === undefined || viewers.size() === 0) {
		isSpotted = false;
	} else {
		isSpotted = viewers.size() > 0;
	}
	// Store as attribute so npc-proximity can read it for button coloring
	Players.LocalPlayer.SetAttribute("IsSpotted", isSpotted);
	refreshNameColor();
}

/** Format seconds into "Xm Ys" display. */
function formatTime(secs: number): string {
	if (secs <= 0) return "0s";
	const m = math.floor(secs / 60);
	const s = secs % 60;
	if (m > 0) return m + "m " + s + "s";
	return s + "s";
}

/** Build the tooltip text from cached effect state. */
function refreshTooltipText(): void {
	if (!effectTooltip || !cachedEffectPayload) return;
	const lines: string[] = [];
	if (cachedEffectPayload.activePoisonId && cachedEffectPayload.poisonRemainingSecs > 0) {
		const def = POISONS[cachedEffectPayload.activePoisonId];
		const name = def ? def.name : "Poison";
		lines.push("~ " + name + "  --  " + formatTime(cachedEffectPayload.poisonRemainingSecs));
	}
	if (cachedEffectPayload.activeElixirId && cachedEffectPayload.elixirRemainingSecs > 0) {
		const def = ELIXIRS[cachedEffectPayload.activeElixirId];
		const name = def ? def.name : "Elixir";
		lines.push("+ " + name + "  --  " + formatTime(cachedEffectPayload.elixirRemainingSecs));
	}
	effectTooltip.Text = lines.size() > 0 ? lines.join("\n") : "";
}

function updateEffects(payload: EffectSyncPayload): void {
	if (!effectRow) return;
	cachedEffectPayload = payload;

	const hasPoisonActive = payload.activePoisonId !== undefined && payload.poisonRemainingSecs > 0;
	const hasElixirActive = payload.activeElixirId !== undefined && payload.elixirRemainingSecs > 0;
	const bothActive = hasPoisonActive && hasElixirActive;

	// Poison label: "~ Name"
	if (poisonLabel) {
		poisonLabel.Visible = hasPoisonActive;
		if (hasPoisonActive) {
			const def = POISONS[payload.activePoisonId!];
			poisonLabel.Text = "~ " + (def ? def.name : "Poison");
			// If only poison, take full width; if both, take half
			poisonLabel.Size = bothActive ? new UDim2(0.5, 0, 1, 0) : new UDim2(1, 0, 1, 0);
			poisonLabel.Position = new UDim2(0, 0, 0, 0);
		}
	}

	// Elixir label: "+ Name"
	if (elixirLabel) {
		elixirLabel.Visible = hasElixirActive;
		if (hasElixirActive) {
			const def = ELIXIRS[payload.activeElixirId!];
			elixirLabel.Text = "+ " + (def ? def.name : "Elixir");
			// If only elixir, take full width from left; if both, right half
			elixirLabel.Size = bothActive ? new UDim2(0.5, 0, 1, 0) : new UDim2(1, 0, 1, 0);
			elixirLabel.Position = bothActive ? new UDim2(0.5, 0, 0, 0) : new UDim2(0, 0, 0, 0);
		}
	}

	// Show/hide the effect row
	effectRow.Visible = hasPoisonActive || hasElixirActive;

	// Auto-refresh tooltip if visible
	if (effectTooltip && effectTooltip.Visible) {
		refreshTooltipText();
	}
}

// -- Init -----------------------------------------------------------------------

onPlayerInitialized(() => {
	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

	buildPlayerPanel(screenGui);

	// Fetch initial values from server
	const initXP = GetPlayerExpierence.InvokeServer() as number;
	const initTitle = GetPlayerTitle.InvokeServer() as string;
	const initName = GetPlayerName.InvokeServer() as string;
	const initLevel = GetPlayerLevel.InvokeServer() as number;
	const initCoins = GetCoins.InvokeServer() as number;

	if (nameLabel) nameLabel.Text = initName;
	if (titleLabel) titleLabel.Text = initTitle.upper();
	if (levelLabel) levelLabel.Text = "Lv " + initLevel;
	if (coinsLabel) coinsLabel.Text = initCoins + "g";
	setXP(initXP);

	// Live updates
	ExpierenceUpdated.OnClientEvent.Connect((xp: number) => {
		setXP(xp);
	});

	LevelUpdated.OnClientEvent.Connect((level: number) => {
		if (levelLabel) levelLabel.Text = "Lv " + level;
	});

	CoinsUpdated.OnClientEvent.Connect((coins: number) => {
		if (coinsLabel) coinsLabel.Text = coins + "g";
	});

	// Wanted status
	getPlayerWantedRemote().OnClientEvent.Connect((data: unknown) => {
		const payload = data as PlayerWantedPayload;
		if (payload.playerName === Players.LocalPlayer.Name) {
			setWanted(payload.gold);
		}
	});

	getPlayerWantedClearedRemote().OnClientEvent.Connect((playerName: unknown) => {
		if (playerName === Players.LocalPlayer.Name) {
			clearWanted();
		}
	});

	getBountyListSyncRemote().OnClientEvent.Connect((_npcBounty: unknown, wanted: unknown) => {
		for (const entry of wanted as PlayerWantedPayload[]) {
			if (entry.playerName === Players.LocalPlayer.Name) {
				setWanted(entry.gold);
				break;
			}
		}
	});

	// Eye / vision updates from server — drive name color + IsSpotted attribute
	ViewsUpdated.OnClientEvent.Connect((viewers: unknown) => {
		setEyeCount((viewers ?? []) as string[]);
	});

	// Track stealth state for name color
	Players.LocalPlayer.GetAttributeChangedSignal("IsStealthing").Connect(() => {
		const val = Players.LocalPlayer.GetAttribute("IsStealthing") as boolean | undefined;
		isStealthing = val === true;
		refreshNameColor();
	});

	// Effect sync — active poison / elixir timers
	getEffectSyncRemote().OnClientEvent.Connect((data: unknown) => {
		updateEffects(data as EffectSyncPayload);
	});
});
