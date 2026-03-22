/**
 * NPC Dialog module — importable client-side logic for dialog & trade.
 *
 * Everything lives in ONE panel. When the player picks "Trade", the dialog
 * text area is replaced by the shop grid + tooltip inline. No second modal.
 */

import { Players, TweenService, Workspace, RunService } from "@rbxts/services";
import {
	getOpenDialogRemote,
	getPurchaseItemRemote,
	getCloseDialogRemote,
	getDialogPayloadRemote,
	getPurchaseResultRemote,
	getFloatingNPCTextRemote,
	DialogPayload,
	ShopItemPayload,
} from "shared/remotes/dialog-remote";
import { RARITY_COLORS, RARITY_LABELS, RARITY_BG_COLORS } from "shared/inventory";
import { UI_THEME, getUIScale } from "shared/ui-theme";
import { MEDIEVAL_NPCS } from "shared/module";
import { spawnFloatingText } from "./npc-floating-text";

// ── Remotes ───────────────────────────────────────────────────────────────────

const openDialogRemote = getOpenDialogRemote();
const purchaseRemote = getPurchaseItemRemote();
const closeDialogRemote = getCloseDialogRemote();
const dialogPayloadRemote = getDialogPayloadRemote();
const purchaseResultRemote = getPurchaseResultRemote();
const floatingTextRemote = getFloatingNPCTextRemote();

// ── Scaling ───────────────────────────────────────────────────────────────────

function sc(base: number): number {
	return base * getUIScale();
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PANEL_W = 340;
const DIALOG_H = 300; // height in dialog mode
const TRADE_H = 520; // height in trade mode (grid + tooltip + purchase)

// ── State ─────────────────────────────────────────────────────────────────────

let dialogOpen = false;
let tradeOpen = false;
let currentPayload: DialogPayload | undefined;
let currentChatIndex = 0;
let selectedShopItem: ShopItemPayload | undefined;

// ── UI refs — single panel ────────────────────────────────────────────────────

let dialogRoot: Frame | undefined;
let headshotViewport: ViewportFrame | undefined;
let npcNameLabel: TextLabel | undefined;
let dialogTextLabel: TextLabel | undefined;
let optionsFrame: Frame | undefined;

// Trade section (lives inside dialogRoot, toggled visible)
let tradeSection: Frame | undefined;
let playerGoldLabel: TextLabel | undefined;
let tradeGrid: ScrollingFrame | undefined;
let tradeTooltip: Frame | undefined;
let tradeTTName: TextLabel | undefined;
let tradeTTRarity: TextLabel | undefined;
let tradeTTType: TextLabel | undefined;
let tradeTTDesc: TextLabel | undefined;
let tradeTTEffect: TextLabel | undefined;
let tradeTTPriceLabel: TextLabel | undefined;
let tradePurchaseBtn: TextButton | undefined;
let tradeStatusLabel: TextLabel | undefined;
let currentTooltipItemId: string | undefined;

// ── Headshot refs ─────────────────────────────────────────────────────────────

let headshotCamera: Camera | undefined;
let headshotModel: Model | undefined;

// ══════════════════════════════════════════════════════════════════════════════
//  BUILD: UNIFIED DIALOG PANEL
// ══════════════════════════════════════════════════════════════════════════════

function buildDialogPanel(screenGui: ScreenGui): void {
	const root = new Instance("Frame");
	root.Name = "DialogPanel";
	root.Size = new UDim2(0, sc(PANEL_W), 0, sc(DIALOG_H));
	root.Position = new UDim2(0.5, 0, 1, -sc(20));
	root.AnchorPoint = new Vector2(0.5, 1);
	root.BackgroundColor3 = UI_THEME.bg;
	root.BackgroundTransparency = UI_THEME.bgTransparency;
	root.BorderSizePixel = 0;
	root.Visible = false;
	root.ZIndex = 30;
	root.ClipsDescendants = true;
	root.Parent = screenGui;
	dialogRoot = root;

	const corner = new Instance("UICorner");
	corner.CornerRadius = UI_THEME.cornerRadius;
	corner.Parent = root;

	const stroke = new Instance("UIStroke");
	stroke.Color = UI_THEME.border;
	stroke.Thickness = UI_THEME.strokeThickness;
	stroke.Parent = root;

	const pad = new Instance("UIPadding");
	pad.PaddingTop = new UDim(0, sc(8));
	pad.PaddingBottom = new UDim(0, sc(8));
	pad.PaddingLeft = new UDim(0, sc(10));
	pad.PaddingRight = new UDim(0, sc(10));
	pad.Parent = root;

	// ── Top section: headshot + NPC name ──────────────────────────────────

	const topRow = new Instance("Frame");
	topRow.Name = "TopRow";
	topRow.Size = new UDim2(1, 0, 0, sc(80));
	topRow.BackgroundTransparency = 1;
	topRow.ZIndex = 31;
	topRow.Parent = root;

	// Headshot viewport
	const viewport = new Instance("ViewportFrame");
	viewport.Name = "Headshot";
	viewport.Size = new UDim2(0, sc(70), 0, sc(70));
	viewport.Position = new UDim2(0, 0, 0, sc(4));
	viewport.BackgroundColor3 = UI_THEME.bgInset;
	viewport.BackgroundTransparency = 0.2;
	viewport.BorderSizePixel = 0;
	viewport.ZIndex = 32;
	viewport.Parent = topRow;
	headshotViewport = viewport;

	const vpCorner = new Instance("UICorner");
	vpCorner.CornerRadius = new UDim(0, 6);
	vpCorner.Parent = viewport;

	const vpStroke = new Instance("UIStroke");
	vpStroke.Color = UI_THEME.border;
	vpStroke.Thickness = 1;
	vpStroke.Parent = viewport;

	// NPC name
	const nameLabel = new Instance("TextLabel");
	nameLabel.Name = "NPCName";
	nameLabel.Size = new UDim2(1, -sc(82), 0, sc(20));
	nameLabel.Position = new UDim2(0, sc(80), 0, sc(8));
	nameLabel.BackgroundTransparency = 1;
	nameLabel.Text = "";
	nameLabel.TextColor3 = UI_THEME.textHeader;
	nameLabel.Font = UI_THEME.fontDisplay;
	nameLabel.TextSize = sc(17);
	nameLabel.TextXAlignment = Enum.TextXAlignment.Left;
	nameLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	nameLabel.ZIndex = 32;
	nameLabel.Parent = topRow;
	npcNameLabel = nameLabel;

	// Status subtitle
	const statusLabel = new Instance("TextLabel");
	statusLabel.Name = "NPCStatus";
	statusLabel.Size = new UDim2(1, -sc(82), 0, sc(14));
	statusLabel.Position = new UDim2(0, sc(80), 0, sc(30));
	statusLabel.BackgroundTransparency = 1;
	statusLabel.Text = "";
	statusLabel.TextColor3 = UI_THEME.textMuted;
	statusLabel.Font = UI_THEME.fontBody;
	statusLabel.TextSize = sc(11);
	statusLabel.TextXAlignment = Enum.TextXAlignment.Left;
	statusLabel.ZIndex = 32;
	statusLabel.Parent = topRow;

	// Gold display — next to status, right-aligned (only visible in trade mode)
	const goldLabel = new Instance("TextLabel");
	goldLabel.Name = "PlayerGold";
	goldLabel.Size = new UDim2(0, sc(90), 0, sc(14));
	goldLabel.Position = new UDim2(1, -sc(90), 0, sc(30));
	goldLabel.BackgroundTransparency = 1;
	goldLabel.Text = "";
	goldLabel.TextColor3 = UI_THEME.gold;
	goldLabel.Font = UI_THEME.fontBold;
	goldLabel.TextSize = sc(11);
	goldLabel.TextXAlignment = Enum.TextXAlignment.Right;
	goldLabel.Visible = false;
	goldLabel.ZIndex = 32;
	goldLabel.Parent = topRow;
	playerGoldLabel = goldLabel;

	// Divider
	const div = new Instance("Frame");
	div.Name = "TopDivider";
	div.Size = new UDim2(1, 0, 0, 1);
	div.Position = new UDim2(0, 0, 0, sc(86));
	div.BackgroundColor3 = UI_THEME.divider;
	div.BorderSizePixel = 0;
	div.ZIndex = 31;
	div.Parent = root;

	// ── Dialog text (visible in talk mode) ────────────────────────────────

	const textLabel = new Instance("TextLabel");
	textLabel.Name = "DialogText";
	textLabel.Size = new UDim2(1, 0, 0, sc(80));
	textLabel.Position = new UDim2(0, 0, 0, sc(92));
	textLabel.BackgroundTransparency = 1;
	textLabel.Text = "";
	textLabel.TextColor3 = UI_THEME.textPrimary;
	textLabel.Font = UI_THEME.fontBody;
	textLabel.TextSize = sc(13);
	textLabel.TextWrapped = true;
	textLabel.TextYAlignment = Enum.TextYAlignment.Top;
	textLabel.TextXAlignment = Enum.TextXAlignment.Left;
	textLabel.ZIndex = 31;
	textLabel.Parent = root;
	dialogTextLabel = textLabel;

	// ── Trade section (visible in trade mode, same position as dialog text)

	buildTradeSection(root);

	// ── Options frame (always at bottom) ──────────────────────────────────

	const opts = new Instance("Frame");
	opts.Name = "Options";
	opts.Size = new UDim2(1, 0, 0, sc(110));
	opts.Position = new UDim2(0, 0, 1, -sc(118));
	opts.BackgroundTransparency = 1;
	opts.ZIndex = 31;
	opts.Parent = root;
	optionsFrame = opts;

	const optsLayout = new Instance("UIListLayout");
	optsLayout.FillDirection = Enum.FillDirection.Vertical;
	optsLayout.Padding = new UDim(0, sc(5));
	optsLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	optsLayout.Parent = opts;
}

// ── Trade section (embedded in dialog root) ───────────────────────────────────

function buildTradeSection(root: Frame): void {
	const section = new Instance("Frame");
	section.Name = "TradeSection";
	section.Size = new UDim2(1, 0, 0, sc(380));
	section.Position = new UDim2(0, 0, 0, sc(92));
	section.BackgroundTransparency = 1;
	section.Visible = false;
	section.ZIndex = 31;
	section.Parent = root;
	tradeSection = section;

	// ── Shop grid ─────────────────────────────────────────────────────────

	const grid = new Instance("ScrollingFrame");
	grid.Name = "ShopGrid";
	grid.Size = new UDim2(1, 0, 0, sc(200));
	grid.Position = new UDim2(0, 0, 0, 0);
	grid.BackgroundColor3 = UI_THEME.bgInset;
	grid.BackgroundTransparency = 0.5;
	grid.BorderSizePixel = 0;
	grid.ScrollBarThickness = sc(4);
	grid.ScrollBarImageColor3 = UI_THEME.border;
	grid.CanvasSize = new UDim2(0, 0, 0, 0);
	grid.AutomaticCanvasSize = Enum.AutomaticSize.Y;
	grid.ZIndex = 31;
	grid.Parent = section;
	tradeGrid = grid;

	const gridCorner = new Instance("UICorner");
	gridCorner.CornerRadius = new UDim(0, 3);
	gridCorner.Parent = grid;

	const gridLayout = new Instance("UIGridLayout");
	gridLayout.CellSize = new UDim2(0, sc(72), 0, sc(84));
	gridLayout.CellPadding = new UDim2(0, sc(7), 0, sc(7));
	gridLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	gridLayout.Parent = grid;

	const gridPad = new Instance("UIPadding");
	gridPad.PaddingTop = new UDim(0, sc(4));
	gridPad.PaddingLeft = new UDim(0, sc(4));
	gridPad.PaddingRight = new UDim(0, sc(4));
	gridPad.PaddingBottom = new UDim(0, sc(4));
	gridPad.Parent = grid;

	// ── Divider between grid and tooltip ──────────────────────────────────

	const div = new Instance("Frame");
	div.Size = new UDim2(1, 0, 0, 1);
	div.Position = new UDim2(0, 0, 0, sc(204));
	div.BackgroundColor3 = UI_THEME.divider;
	div.BorderSizePixel = 0;
	div.ZIndex = 31;
	div.Parent = section;

	// ── Tooltip area ──────────────────────────────────────────────────────

	buildTradeTooltip(section);

	// ── Status label ──────────────────────────────────────────────────────

	const status = new Instance("TextLabel");
	status.Name = "StatusLabel";
	status.Size = new UDim2(1, 0, 0, sc(14));
	status.Position = new UDim2(0, 0, 0, sc(342));
	status.BackgroundTransparency = 1;
	status.Text = "";
	status.TextColor3 = UI_THEME.textMuted;
	status.Font = UI_THEME.fontBody;
	status.TextSize = sc(10);
	status.ZIndex = 31;
	status.Parent = section;
	tradeStatusLabel = status;
}

function buildTradeTooltip(parent: Frame): void {
	const tt = new Instance("Frame");
	tt.Name = "TradeTooltip";
	tt.Size = new UDim2(1, 0, 0, sc(130));
	tt.Position = new UDim2(0, 0, 0, sc(208));
	tt.BackgroundColor3 = UI_THEME.bgInset;
	tt.BackgroundTransparency = 0.2;
	tt.BorderSizePixel = 0;
	tt.Visible = false;
	tt.ZIndex = 32;
	tt.Parent = parent;
	tradeTooltip = tt;

	const ttCorner = new Instance("UICorner");
	ttCorner.CornerRadius = new UDim(0, 4);
	ttCorner.Parent = tt;

	const ttStroke = new Instance("UIStroke");
	ttStroke.Name = "TTStroke";
	ttStroke.Color = UI_THEME.border;
	ttStroke.Thickness = 1;
	ttStroke.Parent = tt;

	const ttPad = new Instance("UIPadding");
	ttPad.PaddingTop = new UDim(0, sc(6));
	ttPad.PaddingLeft = new UDim(0, sc(8));
	ttPad.PaddingRight = new UDim(0, sc(8));
	ttPad.PaddingBottom = new UDim(0, sc(6));
	ttPad.Parent = tt;

	const nLabel = new Instance("TextLabel");
	nLabel.Name = "TT_Name";
	nLabel.Size = new UDim2(0.65, 0, 0, sc(16));
	nLabel.BackgroundTransparency = 1;
	nLabel.Text = "";
	nLabel.TextColor3 = UI_THEME.textHeader;
	nLabel.Font = UI_THEME.fontDisplay;
	nLabel.TextSize = sc(14);
	nLabel.TextXAlignment = Enum.TextXAlignment.Left;
	nLabel.ZIndex = 33;
	nLabel.Parent = tt;
	tradeTTName = nLabel;

	const rLabel = new Instance("TextLabel");
	rLabel.Name = "TT_Rarity";
	rLabel.Size = new UDim2(0.35, 0, 0, sc(14));
	rLabel.Position = new UDim2(0.65, 0, 0, sc(1));
	rLabel.BackgroundTransparency = 1;
	rLabel.Text = "";
	rLabel.TextColor3 = UI_THEME.textMuted;
	rLabel.Font = UI_THEME.fontBold;
	rLabel.TextSize = sc(10);
	rLabel.TextXAlignment = Enum.TextXAlignment.Right;
	rLabel.ZIndex = 33;
	rLabel.Parent = tt;
	tradeTTRarity = rLabel;

	const tLabel = new Instance("TextLabel");
	tLabel.Name = "TT_Type";
	tLabel.Size = new UDim2(1, 0, 0, sc(12));
	tLabel.Position = new UDim2(0, 0, 0, sc(18));
	tLabel.BackgroundTransparency = 1;
	tLabel.Text = "";
	tLabel.TextColor3 = UI_THEME.textMuted;
	tLabel.Font = UI_THEME.fontBody;
	tLabel.TextSize = sc(10);
	tLabel.TextXAlignment = Enum.TextXAlignment.Left;
	tLabel.ZIndex = 33;
	tLabel.Parent = tt;
	tradeTTType = tLabel;

	const dLabel = new Instance("TextLabel");
	dLabel.Name = "TT_Desc";
	dLabel.Size = new UDim2(1, 0, 0, sc(24));
	dLabel.Position = new UDim2(0, 0, 0, sc(32));
	dLabel.BackgroundTransparency = 1;
	dLabel.Text = "";
	dLabel.TextColor3 = UI_THEME.textPrimary;
	dLabel.Font = UI_THEME.fontBody;
	dLabel.TextSize = sc(10);
	dLabel.TextWrapped = true;
	dLabel.TextYAlignment = Enum.TextYAlignment.Top;
	dLabel.ZIndex = 33;
	dLabel.Parent = tt;
	tradeTTDesc = dLabel;

	const eLabel = new Instance("TextLabel");
	eLabel.Name = "TT_Effect";
	eLabel.Size = new UDim2(1, 0, 0, sc(14));
	eLabel.Position = new UDim2(0, 0, 0, sc(58));
	eLabel.BackgroundTransparency = 1;
	eLabel.Text = "";
	eLabel.TextColor3 = UI_THEME.gold;
	eLabel.Font = UI_THEME.fontBold;
	eLabel.TextSize = sc(10);
	eLabel.TextWrapped = true;
	eLabel.ZIndex = 33;
	eLabel.Parent = tt;
	tradeTTEffect = eLabel;

	// Price + Purchase button row
	const priceRow = new Instance("Frame");
	priceRow.Name = "PriceRow";
	priceRow.Size = new UDim2(1, 0, 0, sc(24));
	priceRow.Position = new UDim2(0, 0, 1, -sc(28));
	priceRow.BackgroundTransparency = 1;
	priceRow.ZIndex = 33;
	priceRow.Parent = tt;

	const priceLabel = new Instance("TextLabel");
	priceLabel.Name = "PriceLabel";
	priceLabel.Size = new UDim2(0.5, 0, 1, 0);
	priceLabel.BackgroundTransparency = 1;
	priceLabel.Text = "";
	priceLabel.TextColor3 = UI_THEME.gold;
	priceLabel.Font = UI_THEME.fontBold;
	priceLabel.TextSize = sc(12);
	priceLabel.TextXAlignment = Enum.TextXAlignment.Left;
	priceLabel.ZIndex = 34;
	priceLabel.Parent = priceRow;
	tradeTTPriceLabel = priceLabel;

	const purchaseBtn = new Instance("TextButton");
	purchaseBtn.Name = "PurchaseBtn";
	purchaseBtn.Size = new UDim2(0.45, 0, 1, 0);
	purchaseBtn.Position = new UDim2(0.55, 0, 0, 0);
	purchaseBtn.BackgroundColor3 = Color3.fromRGB(30, 55, 25);
	purchaseBtn.BackgroundTransparency = 0.2;
	purchaseBtn.BorderSizePixel = 0;
	purchaseBtn.Text = "PURCHASE";
	purchaseBtn.TextColor3 = Color3.fromRGB(120, 180, 90);
	purchaseBtn.Font = UI_THEME.fontBold;
	purchaseBtn.TextSize = sc(11);
	purchaseBtn.AutoButtonColor = false;
	purchaseBtn.ZIndex = 34;
	purchaseBtn.Parent = priceRow;
	tradePurchaseBtn = purchaseBtn;

	const btnCorner = new Instance("UICorner");
	btnCorner.CornerRadius = new UDim(0, 4);
	btnCorner.Parent = purchaseBtn;

	const btnStroke = new Instance("UIStroke");
	btnStroke.Color = Color3.fromRGB(80, 130, 60);
	btnStroke.Thickness = 1;
	btnStroke.Parent = purchaseBtn;

	purchaseBtn.MouseEnter.Connect(() => {
		purchaseBtn.BackgroundTransparency = 0;
	});
	purchaseBtn.MouseLeave.Connect(() => {
		purchaseBtn.BackgroundTransparency = 0.2;
	});
	purchaseBtn.Activated.Connect(() => {
		handlePurchaseClick();
	});
}

// ── Dialog option button ──────────────────────────────────────────────────────

function addDialogOption(parent: Frame, order: number, label: string, color: Color3, callback: () => void): TextButton {
	const btn = new Instance("TextButton");
	btn.Name = "Opt_" + label;
	btn.LayoutOrder = order;
	btn.Size = new UDim2(1, 0, 0, sc(28));
	btn.BackgroundColor3 = UI_THEME.bgInset;
	btn.BackgroundTransparency = 0.3;
	btn.BorderSizePixel = 0;
	btn.Text = tostring(order) + ".  " + label;
	btn.TextColor3 = color;
	btn.Font = UI_THEME.fontBold;
	btn.TextSize = sc(13);
	btn.TextXAlignment = Enum.TextXAlignment.Left;
	btn.AutoButtonColor = false;
	btn.ZIndex = 32;
	btn.Parent = parent;

	const c = new Instance("UICorner");
	c.CornerRadius = new UDim(0, 4);
	c.Parent = btn;

	const s = new Instance("UIStroke");
	s.Color = UI_THEME.divider;
	s.Thickness = 1;
	s.Parent = btn;

	const p = new Instance("UIPadding");
	p.PaddingLeft = new UDim(0, sc(10));
	p.Parent = btn;

	btn.MouseEnter.Connect(() => {
		btn.BackgroundTransparency = 0.05;
		const st = btn.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
		if (st) st.Color = color;
	});
	btn.MouseLeave.Connect(() => {
		btn.BackgroundTransparency = 0.3;
		const st = btn.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
		if (st) st.Color = UI_THEME.divider;
	});
	btn.Activated.Connect(callback);

	return btn;
}

function clearOptions(): void {
	if (optionsFrame === undefined) return;
	for (const child of optionsFrame.GetChildren()) {
		if (child.IsA("TextButton")) child.Destroy();
	}
}

// ══════════════════════════════════════════════════════════════════════════════
//  SHOP TILES
// ══════════════════════════════════════════════════════════════════════════════

function refreshShopGrid(): void {
	if (tradeGrid === undefined || currentPayload === undefined) return;
	for (const child of tradeGrid.GetChildren()) {
		if (child.IsA("TextButton")) child.Destroy();
	}
	let order = 0;
	for (const si of currentPayload.shopItems) {
		buildShopTile(tradeGrid, si, order);
		order++;
	}
}

function buildShopTile(parent: ScrollingFrame, shopItem: ShopItemPayload, order: number): void {
	const rarityColor = RARITY_COLORS[shopItem.rarity] ?? UI_THEME.textPrimary;

	const tile = new Instance("TextButton");
	tile.Name = "Shop_" + shopItem.itemId;
	tile.LayoutOrder = order;
	tile.BackgroundColor3 = UI_THEME.bgInset;
	tile.BackgroundTransparency = 0.15;
	tile.BorderSizePixel = 0;
	tile.Text = "";
	tile.AutoButtonColor = false;
	tile.ZIndex = 32;
	tile.Parent = parent;

	const tileCorner = new Instance("UICorner");
	tileCorner.CornerRadius = new UDim(0, 4);
	tileCorner.Parent = tile;

	const tileStroke = new Instance("UIStroke");
	tileStroke.Color = rarityColor;
	tileStroke.Thickness = 1;
	tileStroke.Transparency = 0.4;
	tileStroke.Parent = tile;

	const icon = new Instance("TextLabel");
	icon.Size = new UDim2(1, 0, 0, sc(24));
	icon.Position = new UDim2(0, 0, 0, sc(4));
	icon.BackgroundTransparency = 1;
	icon.Text = shopItem.icon;
	icon.TextColor3 = rarityColor;
	icon.Font = UI_THEME.fontDisplay;
	icon.TextSize = sc(20);
	icon.ZIndex = 33;
	icon.Parent = tile;

	const nameLabel = new Instance("TextLabel");
	nameLabel.Size = new UDim2(1, -4, 0, sc(20));
	nameLabel.Position = new UDim2(0, 2, 0, sc(28));
	nameLabel.BackgroundTransparency = 1;
	nameLabel.Text = shopItem.name;
	nameLabel.TextColor3 = UI_THEME.textPrimary;
	nameLabel.Font = UI_THEME.fontBody;
	nameLabel.TextSize = sc(9);
	nameLabel.TextWrapped = true;
	nameLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	nameLabel.ZIndex = 33;
	nameLabel.Parent = tile;

	const priceTag = new Instance("TextLabel");
	priceTag.Size = new UDim2(1, 0, 0, sc(12));
	priceTag.Position = new UDim2(0, 0, 1, -sc(14));
	priceTag.BackgroundTransparency = 1;
	priceTag.Text = shopItem.price + "g";
	priceTag.TextColor3 = UI_THEME.gold;
	priceTag.Font = UI_THEME.fontBold;
	priceTag.TextSize = sc(10);
	priceTag.ZIndex = 34;
	priceTag.Parent = tile;

	if (shopItem.owned > 0) {
		const badge = new Instance("TextLabel");
		badge.Size = new UDim2(0, sc(18), 0, sc(12));
		badge.Position = new UDim2(1, sc(-20), 0, sc(2));
		badge.BackgroundColor3 = UI_THEME.headerBg;
		badge.BackgroundTransparency = 0.3;
		badge.Text = "x" + shopItem.owned;
		badge.TextColor3 = UI_THEME.textMuted;
		badge.Font = UI_THEME.fontBold;
		badge.TextSize = sc(9);
		badge.ZIndex = 34;
		badge.Parent = tile;

		const badgeCorner = new Instance("UICorner");
		badgeCorner.CornerRadius = new UDim(0, 3);
		badgeCorner.Parent = badge;
	}

	const rarityBar = new Instance("Frame");
	rarityBar.Size = new UDim2(0.6, 0, 0, sc(2));
	rarityBar.Position = new UDim2(0.2, 0, 1, -sc(3));
	rarityBar.BackgroundColor3 = rarityColor;
	rarityBar.BackgroundTransparency = 0.3;
	rarityBar.BorderSizePixel = 0;
	rarityBar.ZIndex = 33;
	rarityBar.Parent = tile;

	tile.MouseEnter.Connect(() => {
		tile.BackgroundTransparency = 0;
		tileStroke.Transparency = 0;
		showShopTooltip(shopItem);
	});
	tile.MouseLeave.Connect(() => {
		tile.BackgroundTransparency = 0.15;
		tileStroke.Transparency = 0.4;
		if (currentTooltipItemId === shopItem.itemId) {
			hideShopTooltip();
		}
	});
	tile.Activated.Connect(() => {
		showShopTooltip(shopItem);
	});
}

// ── Shop tooltip ──────────────────────────────────────────────────────────────

function showShopTooltip(shopItem: ShopItemPayload): void {
	if (tradeTooltip === undefined) return;
	selectedShopItem = shopItem;
	currentTooltipItemId = shopItem.itemId;

	const rarityColor = RARITY_COLORS[shopItem.rarity] ?? UI_THEME.textPrimary;
	const rarityBg = RARITY_BG_COLORS[shopItem.rarity] ?? UI_THEME.bgInset;
	const rarityLbl = RARITY_LABELS[shopItem.rarity] ?? "Common";

	if (tradeTTName) {
		tradeTTName.Text = shopItem.name;
		tradeTTName.TextColor3 = rarityColor;
	}
	if (tradeTTRarity) {
		tradeTTRarity.Text = rarityLbl;
		tradeTTRarity.TextColor3 = rarityColor;
	}
	if (tradeTTType) tradeTTType.Text = shopItem.itemType;
	if (tradeTTDesc) tradeTTDesc.Text = shopItem.description;
	if (tradeTTEffect) tradeTTEffect.Text = shopItem.effect;
	if (tradeTTPriceLabel) tradeTTPriceLabel.Text = shopItem.price + " Gold";

	tradeTooltip.BackgroundColor3 = rarityBg;
	const strokeRef = tradeTooltip.FindFirstChild("TTStroke") as UIStroke | undefined;
	if (strokeRef) strokeRef.Color = rarityColor;

	tradeTooltip.Visible = true;
}

function hideShopTooltip(): void {
	if (tradeTooltip) tradeTooltip.Visible = false;
	selectedShopItem = undefined;
	currentTooltipItemId = undefined;
}

// ── Purchase logic ────────────────────────────────────────────────────────────

function handlePurchaseClick(): void {
	if (selectedShopItem === undefined || currentPayload === undefined) return;

	const npcName = currentPayload.npcName;
	const itemId = selectedShopItem.itemId;

	if (tradePurchaseBtn) {
		tradePurchaseBtn.Active = false;
		tradePurchaseBtn.Text = "...";
	}

	task.spawn(() => {
		const result = purchaseRemote.InvokeServer(npcName, itemId) as
			| { success: boolean; message: string; newOwned: number }
			| undefined;

		if (result !== undefined) {
			if (result.success) {
				if (tradeStatusLabel) {
					tradeStatusLabel.Text = result.message;
					tradeStatusLabel.TextColor3 = Color3.fromRGB(100, 170, 80);
				}
				for (const si of currentPayload!.shopItems) {
					if (si.itemId === itemId) {
						si.owned = result.newOwned;
					}
				}
				refreshShopGrid();
				refreshGoldDisplay();
				if (selectedShopItem !== undefined && selectedShopItem.itemId === itemId) {
					const updatedItem = currentPayload!.shopItems.find((si) => si.itemId === itemId);
					if (updatedItem) showShopTooltip(updatedItem);
				}
			} else {
				if (tradeStatusLabel) {
					tradeStatusLabel.Text = result.message;
					tradeStatusLabel.TextColor3 = UI_THEME.danger;
				}
			}
		}

		if (tradePurchaseBtn) {
			tradePurchaseBtn.Active = true;
			tradePurchaseBtn.Text = "PURCHASE";
		}

		task.delay(3, () => {
			if (tradeStatusLabel) tradeStatusLabel.Text = "";
		});
	});
}

// ── Gold display ──────────────────────────────────────────────────────────────

function refreshGoldDisplay(): void {
	if (playerGoldLabel === undefined) return;
	const repStorage = game.GetService("ReplicatedStorage") as ReplicatedStorage;
	const psFolder = repStorage.FindFirstChild("PlayerState") as Folder | undefined;
	const getCoinsRF = psFolder?.FindFirstChild("GetCoins") as RemoteFunction | undefined;
	if (getCoinsRF) {
		task.spawn(() => {
			const coins = getCoinsRF.InvokeServer() as number;
			if (playerGoldLabel) playerGoldLabel.Text = coins + " Gold";
		});
	}
}

// ══════════════════════════════════════════════════════════════════════════════
//  HEADSHOT VIEWPORT
// ══════════════════════════════════════════════════════════════════════════════

function clearHeadshot(): void {
	if (headshotViewport === undefined) return;
	for (const child of headshotViewport.GetChildren()) {
		if (child.IsA("Model") || child.IsA("Camera")) {
			child.Destroy();
		}
	}
	headshotModel = undefined;
	headshotCamera = undefined;
}

function setupHeadshot(npcName: string): void {
	if (headshotViewport === undefined) return;
	clearHeadshot();

	const npcModel = Workspace.FindFirstChild(npcName) as Model | undefined;
	if (!npcModel) return;

	const clone = npcModel.Clone();
	clone.Name = "HeadshotClone";

	const hideParts = new Set([
		"LowerTorso",
		"LeftUpperLeg",
		"RightUpperLeg",
		"LeftLowerLeg",
		"RightLowerLeg",
		"LeftFoot",
		"RightFoot",
		"LeftUpperArm",
		"RightUpperArm",
		"LeftLowerArm",
		"RightLowerArm",
		"LeftHand",
		"RightHand",
	]);

	for (const child of clone.GetDescendants()) {
		if (child.IsA("BasePart") && hideParts.has(child.Name)) {
			child.Transparency = 1;
		}
		if (child.IsA("Script") || child.IsA("LocalScript")) {
			child.Destroy();
		}
	}

	const hum = clone.FindFirstChildOfClass("Humanoid");
	if (hum) hum.Destroy();

	clone.Parent = headshotViewport;
	headshotModel = clone;

	const cam = new Instance("Camera");
	cam.FieldOfView = 30;
	cam.Parent = headshotViewport;
	headshotViewport.CurrentCamera = cam;
	headshotCamera = cam;

	const head = clone.FindFirstChild("Head") as BasePart | undefined;
	if (head) {
		const headPos = head.Position;
		cam.CFrame = new CFrame(headPos.add(new Vector3(0, 0.2, 3.5)), headPos.add(new Vector3(0, 0.1, 0)));
	}
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODE SWITCHING — resize panel, swap content area
// ══════════════════════════════════════════════════════════════════════════════

function switchToDialogMode(): void {
	tradeOpen = false;
	hideShopTooltip();
	selectedShopItem = undefined;

	if (tradeSection) tradeSection.Visible = false;
	if (dialogTextLabel) dialogTextLabel.Visible = true;
	if (playerGoldLabel) playerGoldLabel.Visible = false;

	// Restore full-size options frame for dialog mode (3 buttons)
	if (optionsFrame) {
		optionsFrame.Size = new UDim2(1, 0, 0, sc(110));
		optionsFrame.Position = new UDim2(0, 0, 1, -sc(118));
	}

	// Shrink panel back to dialog size
	if (dialogRoot) {
		TweenService.Create(dialogRoot, new TweenInfo(0.15, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			Size: new UDim2(0, sc(PANEL_W), 0, sc(DIALOG_H)),
		}).Play();
	}
}

function switchToTradeMode(): void {
	tradeOpen = true;

	if (dialogTextLabel) dialogTextLabel.Visible = false;
	if (playerGoldLabel) playerGoldLabel.Visible = true;

	// Compact options for trade mode (only Back + Leave)
	if (optionsFrame) {
		optionsFrame.Size = new UDim2(1, 0, 0, sc(64));
		optionsFrame.Position = new UDim2(0, 0, 1, -sc(70));
	}

	refreshGoldDisplay();
	refreshShopGrid();
	hideShopTooltip();
	if (tradeStatusLabel) tradeStatusLabel.Text = "";

	// Grow panel to trade size
	if (dialogRoot) {
		TweenService.Create(dialogRoot, new TweenInfo(0.15, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			Size: new UDim2(0, sc(PANEL_W), 0, sc(TRADE_H)),
		}).Play();
	}

	// Show trade section after brief delay so resize is visible
	task.delay(0.05, () => {
		if (tradeSection) tradeSection.Visible = true;
	});
}

// ══════════════════════════════════════════════════════════════════════════════
//  DIALOG FLOW
// ══════════════════════════════════════════════════════════════════════════════

const STATUS_TO_RARITY: Record<string, string> = {
	Serf: "common",
	Commoner: "uncommon",
	Merchant: "rare",
	Nobility: "epic",
	Royalty: "legendary",
};

function openDialog(payload: DialogPayload): void {
	currentPayload = payload;
	currentChatIndex = 0;
	dialogOpen = true;
	tradeOpen = false;
	selectedShopItem = undefined;

	setupHeadshot(payload.npcName);

	if (npcNameLabel) npcNameLabel.Text = payload.npcName;

	const npcData = MEDIEVAL_NPCS[payload.npcName];
	const statusColor = npcData
		? (RARITY_COLORS[STATUS_TO_RARITY[npcData.status] ?? "common"] ?? UI_THEME.textPrimary)
		: UI_THEME.textPrimary;

	if (npcNameLabel) npcNameLabel.TextColor3 = statusColor;

	const statusSub = dialogRoot?.FindFirstChild("TopRow")?.FindFirstChild("NPCStatus") as TextLabel | undefined;
	if (statusSub && npcData) {
		statusSub.Text = npcData.status + " " + npcData.race;
		statusSub.TextColor3 = UI_THEME.textMuted;
	}

	// Ensure we start in dialog mode
	if (tradeSection) tradeSection.Visible = false;
	if (dialogTextLabel) {
		dialogTextLabel.Visible = true;
		dialogTextLabel.Text = '"' + payload.greeting + '"';
	}
	if (playerGoldLabel) playerGoldLabel.Visible = false;

	showMainOptions();

	if (dialogRoot) {
		dialogRoot.Visible = true;
		dialogRoot.BackgroundTransparency = 0.6;
		dialogRoot.Size = new UDim2(0, sc(260), 0, sc(220));
		TweenService.Create(dialogRoot, new TweenInfo(0.2, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
			Size: new UDim2(0, sc(PANEL_W), 0, sc(DIALOG_H)),
			BackgroundTransparency: UI_THEME.bgTransparency,
		}).Play();
	}
}

function showMainOptions(): void {
	clearOptions();
	if (optionsFrame === undefined || currentPayload === undefined) return;

	addDialogOption(optionsFrame, 1, "Talk", UI_THEME.textPrimary, () => {
		handleTalk();
	});

	if (currentPayload.hasShop) {
		addDialogOption(optionsFrame, 2, "Trade", UI_THEME.gold, () => {
			handleOpenTrade();
		});
	}

	addDialogOption(optionsFrame, currentPayload.hasShop ? 3 : 2, "Leave", UI_THEME.textMuted, () => {
		handleLeave();
	});
}

function handleTalk(): void {
	if (currentPayload === undefined || dialogTextLabel === undefined) return;

	// If we were in trade mode, switch back
	if (tradeOpen) {
		switchToDialogMode();
		showMainOptions();
	}

	if (currentPayload.chatLines.size() === 0) {
		dialogTextLabel.Text = '"..."';
		return;
	}

	const line = currentPayload.chatLines[currentChatIndex % currentPayload.chatLines.size()];
	currentChatIndex++;
	dialogTextLabel.Text = '"' + line + '"';
}

function handleOpenTrade(): void {
	if (currentPayload === undefined) return;

	switchToTradeMode();

	clearOptions();
	if (optionsFrame) {
		addDialogOption(optionsFrame, 1, "Back", UI_THEME.textPrimary, () => {
			handleCloseTrade();
		});
		addDialogOption(optionsFrame, 2, "Leave", UI_THEME.textMuted, () => {
			handleLeave();
		});
	}
}

function handleCloseTrade(): void {
	switchToDialogMode();

	if (dialogTextLabel && currentPayload) {
		dialogTextLabel.Text = '"Anything else?"';
	}
	showMainOptions();
}

function handleLeave(): void {
	if (currentPayload === undefined) return;

	// If in trade mode, switch back first for a clean close
	if (tradeOpen) {
		switchToDialogMode();
	}

	if (dialogTextLabel) {
		dialogTextLabel.Text = '"' + currentPayload.farewell + '"';
	}

	task.delay(0.8, () => {
		closeDialog();
	});
}

function closeDialog(): void {
	dialogOpen = false;
	tradeOpen = false;
	currentPayload = undefined;
	selectedShopItem = undefined;

	closeDialogRemote.FireServer();

	if (tradeSection) tradeSection.Visible = false;
	if (playerGoldLabel) playerGoldLabel.Visible = false;

	if (dialogRoot) {
		const tween = TweenService.Create(
			dialogRoot,
			new TweenInfo(0.15, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
			{
				Size: new UDim2(0, sc(260), 0, sc(220)),
				BackgroundTransparency: 0.6,
			},
		);
		tween.Play();
		tween.Completed.Once(() => {
			if (dialogRoot) dialogRoot.Visible = false;
			clearHeadshot();
		});
	}
}

// ══════════════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════════════════════════════════════════

export function isDialogOpen(): boolean {
	return dialogOpen;
}

export function requestOpenDialog(npcModel: Model): void {
	if (dialogOpen) return;
	openDialogRemote.FireServer(npcModel);
}

export function initializeDialogUI(screenGui: ScreenGui): void {
	buildDialogPanel(screenGui);

	dialogPayloadRemote.OnClientEvent.Connect((data: unknown) => {
		openDialog(data as DialogPayload);
	});

	purchaseResultRemote.OnClientEvent.Connect((_success: unknown, _message: unknown) => {
		// Handled in the purchase invoke callback; this is a secondary channel.
	});

	// Ambient floating text for non-vendor NPCs (guards, commoners, etc.)
	floatingTextRemote.OnClientEvent.Connect((npcName: unknown, message: unknown) => {
		spawnFloatingText(npcName as string, message as string);
	});
}
