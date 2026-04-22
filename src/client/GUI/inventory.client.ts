import { Players, TweenService, UserInputService, Workspace } from "@rbxts/services";
import { onPlayerInitialized } from "../modules/client-init";
import { registerInventoryToggle } from "../modules/ui-toggles";
import {
	getActivateItemRemote,
	getInventorySyncRemote,
	getRequestInventoryRemote,
	getMockBountyKillRemote,
	getTurnInBountyRemote,
} from "shared/remotes/inventory-remote";
import {
	ITEMS,
	ITEM_LIST,
	RARITY_COLORS,
	RARITY_LABELS,
	RARITY_BG_COLORS,
	ItemDef,
	InventoryPayload,
	BountyScroll,
	BountyScrollPayload,
} from "shared/inventory";
import { UI_THEME, getUIScale } from "shared/ui-theme";
import { isNew, markSeen, setDotVisible, trackPresent } from "../modules/new-indicator";

const activateRemote = getActivateItemRemote();
const syncRemote = getInventorySyncRemote();
const requestRemote = getRequestInventoryRemote();
const mockBountyKillRemote = getMockBountyKillRemote();
const turnInBountyRemote = getTurnInBountyRemote();

// ── Scaling helper ────────────────────────────────────────────────────────────

function sc(base: number): number {
	return base * getUIScale();
}

// ── Filter type ───────────────────────────────────────────────────────────────

type InventoryFilter = "all" | "weapon" | "poison" | "elixir" | "scroll";

// ── State ─────────────────────────────────────────────────────────────────────

let inventoryOpen = false;
let rootFrame: Frame | undefined;
let currentOwned: Record<string, number> = {};
let currentEquippedWeapon: string | undefined;
let currentActivePoison: string | undefined;
let currentActiveElixirs: string[] = [];
let currentBountyScrolls: BountyScrollPayload = [];
let activeFilter: InventoryFilter = "all";

// Refs for live updates
let itemGrid: ScrollingFrame | undefined;
let tooltipFrame: Frame | undefined;
let tooltipName: TextLabel | undefined;
let tooltipType: TextLabel | undefined;
let tooltipRarity: TextLabel | undefined;
let tooltipDesc: TextLabel | undefined;
let tooltipEffect: TextLabel | undefined;
let tooltipConsumable: TextLabel | undefined;
let currentTooltipItem: string | undefined;

// Filter button refs
const filterButtons: Map<InventoryFilter, TextButton> = new Map();

// Active status bar refs
let activeWeaponLabel: TextLabel | undefined;
let activePoisonLabel: TextLabel | undefined;
let activeElixirLabel: TextLabel | undefined;
let inventoryBackdrop: TextButton | undefined;

// ── Build the UI ──────────────────────────────────────────────────────────────

function buildInventoryUI(screenGui: ScreenGui): void {
	// Full-screen backdrop — click to close
	const backdrop = new Instance("TextButton");
	backdrop.Name = "InventoryBackdrop";
	backdrop.Size = new UDim2(1, 0, 1, 0);
	backdrop.BackgroundColor3 = Color3.fromRGB(0, 0, 0);
	backdrop.BackgroundTransparency = 0.5;
	backdrop.Text = "";
	backdrop.BorderSizePixel = 0;
	backdrop.ZIndex = 29;
	backdrop.Visible = false;
	backdrop.Parent = screenGui;
	backdrop.MouseButton1Click.Connect(() => {
		if (inventoryOpen) toggleInventory();
	});
	inventoryBackdrop = backdrop;

	const root = new Instance("Frame");
	root.Name = "InventoryPanel";
	root.Size = new UDim2(0, sc(420), 0, sc(520));
	root.Position = new UDim2(0.5, 0, 0.5, 0);
	root.AnchorPoint = new Vector2(0.5, 0.5);
	root.BackgroundColor3 = UI_THEME.bg;
	root.BackgroundTransparency = UI_THEME.bgTransparency;
	root.BorderSizePixel = 0;
	root.Visible = false;
	root.ZIndex = 30;
	root.Parent = screenGui;
	rootFrame = root;

	const uiScale = new Instance("UIScale");
	uiScale.Scale = 1;
	uiScale.Parent = root;

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

	// ── Header ────────────────────────────────────────────────────────────
	const header = new Instance("TextLabel");
	header.Name = "Header";
	header.Size = new UDim2(1, 0, 0, sc(22));
	header.BackgroundTransparency = 1;
	header.Text = "-- INVENTORY --";
	header.TextColor3 = UI_THEME.textHeader;
	header.Font = UI_THEME.fontDisplay;
	header.TextSize = sc(20);
	header.ZIndex = 31;
	header.Parent = root;

	// ── Active status bar ─────────────────────────────────────────────────
	const statusBar = new Instance("Frame");
	statusBar.Name = "StatusBar";
	statusBar.Size = new UDim2(1, 0, 0, sc(32));
	statusBar.Position = new UDim2(0, 0, 0, sc(26));
	statusBar.BackgroundColor3 = UI_THEME.bgInset;
	statusBar.BackgroundTransparency = 0.4;
	statusBar.BorderSizePixel = 0;
	statusBar.ZIndex = 31;
	statusBar.Parent = root;

	const statusCorner = new Instance("UICorner");
	statusCorner.CornerRadius = new UDim(0, 3);
	statusCorner.Parent = statusBar;

	const wLabel = new Instance("TextLabel");
	wLabel.Name = "ActiveWeapon";
	wLabel.Size = new UDim2(0.34, 0, 1, 0);
	wLabel.Position = new UDim2(0, sc(4), 0, 0);
	wLabel.BackgroundTransparency = 1;
	wLabel.Text = "/ Fists";
	wLabel.TextColor3 = UI_THEME.textPrimary;
	wLabel.Font = UI_THEME.fontBold;
	wLabel.TextSize = sc(11);
	wLabel.TextXAlignment = Enum.TextXAlignment.Left;
	wLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	wLabel.ZIndex = 32;
	wLabel.Parent = statusBar;
	activeWeaponLabel = wLabel;

	const pLabel = new Instance("TextLabel");
	pLabel.Name = "ActivePoison";
	pLabel.Size = new UDim2(0.33, 0, 1, 0);
	pLabel.Position = new UDim2(0.34, 0, 0, 0);
	pLabel.BackgroundTransparency = 1;
	pLabel.Text = "~ None";
	pLabel.TextColor3 = UI_THEME.textMuted;
	pLabel.Font = UI_THEME.fontBody;
	pLabel.TextSize = sc(11);
	pLabel.TextXAlignment = Enum.TextXAlignment.Center;
	pLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	pLabel.ZIndex = 32;
	pLabel.Parent = statusBar;
	activePoisonLabel = pLabel;

	const eLabel = new Instance("TextLabel");
	eLabel.Name = "ActiveElixir";
	eLabel.Size = new UDim2(0.33, 0, 1, 0);
	eLabel.Position = new UDim2(0.67, 0, 0, 0);
	eLabel.BackgroundTransparency = 1;
	eLabel.Text = "+ None";
	eLabel.TextColor3 = UI_THEME.textMuted;
	eLabel.Font = UI_THEME.fontBody;
	eLabel.TextSize = sc(11);
	eLabel.TextXAlignment = Enum.TextXAlignment.Right;
	eLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	eLabel.ZIndex = 32;
	eLabel.Parent = statusBar;
	activeElixirLabel = eLabel;

	// ── Divider ───────────────────────────────────────────────────────────
	const divider = new Instance("Frame");
	divider.Size = new UDim2(1, 0, 0, 1);
	divider.Position = new UDim2(0, 0, 0, sc(62));
	divider.BackgroundColor3 = UI_THEME.divider;
	divider.BorderSizePixel = 0;
	divider.ZIndex = 31;
	divider.Parent = root;

	// ── Filter bar ────────────────────────────────────────────────────────
	const filterBar = new Instance("Frame");
	filterBar.Name = "FilterBar";
	filterBar.Size = new UDim2(1, 0, 0, sc(22));
	filterBar.Position = new UDim2(0, 0, 0, sc(66));
	filterBar.BackgroundTransparency = 1;
	filterBar.ZIndex = 31;
	filterBar.Parent = root;

	const filterLayout = new Instance("UIListLayout");
	filterLayout.FillDirection = Enum.FillDirection.Horizontal;
	filterLayout.HorizontalAlignment = Enum.HorizontalAlignment.Left;
	filterLayout.Padding = new UDim(0, sc(4));
	filterLayout.Parent = filterBar;

	const filters: Array<{ key: InventoryFilter; label: string }> = [
		{ key: "all", label: "ALL" },
		{ key: "weapon", label: "WEAPONS" },
		{ key: "poison", label: "POISONS" },
		{ key: "elixir", label: "ELIXIRS" },
		{ key: "scroll", label: "SCROLLS" },
	];
	for (const f of filters) {
		buildFilterButton(filterBar, f.key, f.label);
	}

	// ── Item grid (scrolling) ─────────────────────────────────────────────
	const grid = new Instance("ScrollingFrame");
	grid.Name = "ItemGrid";
	grid.Size = new UDim2(1, 0, 0, sc(390));
	grid.Position = new UDim2(0, 0, 0, sc(92));
	grid.BackgroundColor3 = UI_THEME.bgInset;
	grid.BackgroundTransparency = 0.5;
	grid.BorderSizePixel = 0;
	grid.ScrollBarThickness = sc(4);
	grid.ScrollBarImageColor3 = UI_THEME.border;
	grid.CanvasSize = new UDim2(0, 0, 0, 0);
	grid.AutomaticCanvasSize = Enum.AutomaticSize.Y;
	grid.ZIndex = 31;
	grid.Parent = root;
	itemGrid = grid;

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
}

// ── Filter button ─────────────────────────────────────────────────────────────

function buildFilterButton(parent: Frame, key: InventoryFilter, label: string): void {
	const btn = new Instance("TextButton");
	btn.Name = "Filter_" + key;
	btn.Size = new UDim2(0, sc(key === "all" ? 40 : 68), 0, sc(20));
	btn.BackgroundColor3 = UI_THEME.bgInset;
	btn.BackgroundTransparency = key === activeFilter ? 0.1 : 0.6;
	btn.BorderSizePixel = 0;
	btn.Text = label;
	btn.TextColor3 = key === activeFilter ? UI_THEME.gold : UI_THEME.textMuted;
	btn.Font = UI_THEME.fontBold;
	btn.TextSize = sc(10);
	btn.AutoButtonColor = false;
	btn.ZIndex = 32;
	btn.Parent = parent;

	const c = new Instance("UICorner");
	c.CornerRadius = new UDim(0, 3);
	c.Parent = btn;

	const s = new Instance("UIStroke");
	s.Color = key === activeFilter ? UI_THEME.gold : UI_THEME.divider;
	s.Thickness = 1;
	s.Parent = btn;

	filterButtons.set(key, btn);

	btn.Activated.Connect(() => {
		activeFilter = key;
		refreshFilterButtons();
		refreshItemGrid();
	});
}

function refreshFilterButtons(): void {
	for (const [key, btn] of filterButtons) {
		const isActive = key === activeFilter;
		btn.BackgroundTransparency = isActive ? 0.1 : 0.6;
		btn.TextColor3 = isActive ? UI_THEME.gold : UI_THEME.textMuted;
		const s = btn.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
		if (s) s.Color = isActive ? UI_THEME.gold : UI_THEME.divider;
	}
}

// ── Active status display ─────────────────────────────────────────────────────

function refreshActiveStatusBar(): void {
	if (activeWeaponLabel) {
		const wId = currentEquippedWeapon ?? "fists";
		const wDef = ITEMS[wId];
		if (wDef) {
			const wColor = RARITY_COLORS[wDef.rarity] ?? UI_THEME.textPrimary;
			activeWeaponLabel.Text = wDef.icon + " " + wDef.name;
			activeWeaponLabel.TextColor3 = wColor;
		} else {
			activeWeaponLabel.Text = "/ Fists";
			activeWeaponLabel.TextColor3 = UI_THEME.textPrimary;
		}
	}

	if (activePoisonLabel) {
		if (currentActivePoison !== undefined) {
			const pDef = ITEMS[currentActivePoison];
			if (pDef) {
				const pColor = RARITY_COLORS[pDef.rarity] ?? UI_THEME.textPrimary;
				activePoisonLabel.Text = "~ " + pDef.name;
				activePoisonLabel.TextColor3 = pColor;
			}
		} else {
			activePoisonLabel.Text = "~ None";
			activePoisonLabel.TextColor3 = UI_THEME.textMuted;
		}
	}

	if (activeElixirLabel) {
		if (currentActiveElixirs.size() > 0) {
			const names: string[] = [];
			for (const eId of currentActiveElixirs) {
				const eDef = ITEMS[eId];
				if (eDef) names.push(eDef.name);
			}
			activeElixirLabel.Text = "+ " + (names.size() > 0 ? names.join(", ") : "None");
			activeElixirLabel.TextColor3 = UI_THEME.gold;
		} else {
			activeElixirLabel.Text = "+ None";
			activeElixirLabel.TextColor3 = UI_THEME.textMuted;
		}
	}
}

// ── Refresh the item grid ─────────────────────────────────────────────────────

const RARITY_ORDER: Record<string, number> = {
	common: 0,
	uncommon: 1,
	rare: 2,
	epic: 3,
	legendary: 4,
	player: 5,
};

function refreshItemGrid(): void {
	if (itemGrid === undefined) return;

	// Dismiss any lingering tooltip before destroying tiles
	if (tooltipFrame) tooltipFrame.Visible = false;
	currentTooltipItem = undefined;

	for (const child of itemGrid.GetChildren()) {
		if (child.IsA("TextButton")) {
			child.Destroy();
		}
	}

	let layoutOrder = 0;

	// ── Regular items ─────────────────────────────────────────────────
	if (activeFilter !== "scroll") {
		const items: ItemDef[] = [];
		for (const item of ITEM_LIST) {
			const count = currentOwned[item.id] ?? 0;
			if (count <= 0) continue;
			if (activeFilter !== "all" && item.category !== activeFilter) continue;
			items.push(item);
		}

		items.sort((a, b) => {
			const catOrder: Record<string, number> = { weapon: 0, poison: 1, elixir: 2 };
			const ca = catOrder[a.category] ?? 3;
			const cb = catOrder[b.category] ?? 3;
			if (ca !== cb) return ca < cb;

			const ra = RARITY_ORDER[a.rarity] ?? 0;
			const rb = RARITY_ORDER[b.rarity] ?? 0;
			if (ra !== rb) return ra < rb;
			return a.name < b.name;
		});

		for (const item of items) {
			buildItemTile(itemGrid, item, layoutOrder);
			layoutOrder++;
		}
	}

	// ── Bounty scrolls ────────────────────────────────────────────────
	if (activeFilter === "all" || activeFilter === "scroll") {
		for (const scroll of currentBountyScrolls) {
			buildScrollTile(itemGrid, scroll, layoutOrder);
			layoutOrder++;
		}
	}
}

// ── Item tile ─────────────────────────────────────────────────────────────────

function buildItemTile(parent: ScrollingFrame, item: ItemDef, order: number): void {
	const count = currentOwned[item.id] ?? 0;
	const rarityColor = RARITY_COLORS[item.rarity] ?? UI_THEME.textPrimary;

	const isActive =
		(item.category === "weapon" && currentEquippedWeapon === item.id) ||
		(item.category === "poison" && currentActivePoison === item.id) ||
		(item.category === "elixir" && currentActiveElixirs.includes(item.id));

	const tile = new Instance("TextButton");
	tile.Name = "Item_" + item.id;
	tile.LayoutOrder = order;
	tile.BackgroundColor3 = isActive ? (RARITY_BG_COLORS[item.rarity] ?? UI_THEME.bgInset) : UI_THEME.bgInset;
	tile.BackgroundTransparency = isActive ? 0 : 0.15;
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
	tileStroke.Thickness = isActive ? 2 : 1;
	tileStroke.Transparency = isActive ? 0 : 0.4;
	tileStroke.Parent = tile;

	// New-since-last-view dot
	setDotVisible(tile, isNew(sectionForCategory(item.category), item.id));

	const icon = new Instance("TextLabel");
	icon.Size = new UDim2(1, 0, 0, sc(28));
	icon.Position = new UDim2(0, 0, 0, sc(4));
	icon.BackgroundTransparency = 1;
	icon.Text = item.icon;
	icon.TextColor3 = rarityColor;
	icon.Font = UI_THEME.fontDisplay;
	icon.TextSize = sc(24);
	icon.ZIndex = 33;
	icon.Parent = tile;

	const nameLabel = new Instance("TextLabel");
	nameLabel.Size = new UDim2(1, -4, 0, sc(20));
	nameLabel.Position = new UDim2(0, 2, 0, sc(32));
	nameLabel.BackgroundTransparency = 1;
	nameLabel.Text = item.name;
	nameLabel.TextColor3 = UI_THEME.textPrimary;
	nameLabel.Font = UI_THEME.fontBody;
	nameLabel.TextSize = sc(10);
	nameLabel.TextWrapped = true;
	nameLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	nameLabel.ZIndex = 33;
	nameLabel.Parent = tile;

	if (count > 1) {
		const badge = new Instance("TextLabel");
		badge.Size = new UDim2(0, sc(18), 0, sc(12));
		badge.Position = new UDim2(1, sc(-20), 0, sc(2));
		badge.BackgroundColor3 = UI_THEME.headerBg;
		badge.BackgroundTransparency = 0.3;
		badge.Text = "x" + count;
		badge.TextColor3 = UI_THEME.gold;
		badge.Font = UI_THEME.fontBold;
		badge.TextSize = sc(10);
		badge.ZIndex = 34;
		badge.Parent = tile;

		const badgeCorner = new Instance("UICorner");
		badgeCorner.CornerRadius = new UDim(0, 3);
		badgeCorner.Parent = badge;
	}

	if (isActive) {
		const activeTag = new Instance("TextLabel");
		activeTag.Size = new UDim2(1, 0, 0, sc(10));
		activeTag.Position = new UDim2(0, 0, 1, sc(-12));
		activeTag.BackgroundTransparency = 1;
		activeTag.Text = "ACTIVE";
		activeTag.TextColor3 = UI_THEME.gold;
		activeTag.Font = UI_THEME.fontBold;
		activeTag.TextSize = sc(8);
		activeTag.ZIndex = 34;
		activeTag.Parent = tile;
	} else {
		const rarityBar = new Instance("Frame");
		rarityBar.Size = new UDim2(0.6, 0, 0, sc(2));
		rarityBar.Position = new UDim2(0.2, 0, 1, sc(-5));
		rarityBar.BackgroundColor3 = rarityColor;
		rarityBar.BackgroundTransparency = 0.3;
		rarityBar.BorderSizePixel = 0;
		rarityBar.ZIndex = 33;
		rarityBar.Parent = tile;
	}

	tile.MouseButton1Click.Connect(() => {
		activateRemote.FireServer(item.id);
		tileStroke.Transparency = 0;
		TweenService.Create(tileStroke, new TweenInfo(0.3, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			Transparency: 0.4,
		}).Play();
	});

	tile.MouseEnter.Connect(() => {
		tile.BackgroundTransparency = 0;
		tileStroke.Transparency = 0;
		showItemTooltip(item, tile);
	});
	tile.MouseLeave.Connect(() => {
		tile.BackgroundTransparency = isActive ? 0 : 0.15;
		tileStroke.Transparency = isActive ? 0 : 0.4;
		hideTooltip(item.id);
	});
}

// ── "New" indicator section keys ──────────────────────────────────────────────

const INV_WEAPONS = "inventory:weapons";
const INV_POISONS = "inventory:poisons";
const INV_ELIXIRS = "inventory:elixirs";
const INV_SCROLLS = "inventory:scrolls";

function sectionForCategory(category: string): string {
	if (category === "weapon") return INV_WEAPONS;
	if (category === "poison") return INV_POISONS;
	if (category === "elixir") return INV_ELIXIRS;
	return INV_SCROLLS;
}

// ── Bounty scroll tile ────────────────────────────────────────────────────────

function buildScrollTile(parent: ScrollingFrame, scroll: BountyScroll, order: number): void {
	const rarityColor = RARITY_COLORS[scroll.rarity] ?? UI_THEME.textPrimary;
	const rarityBg = RARITY_BG_COLORS[scroll.rarity] ?? UI_THEME.bgInset;
	const scrollKey = "scroll_" + scroll.slotIndex;

	const tile = new Instance("TextButton");
	tile.Name = scrollKey;
	tile.LayoutOrder = order;
	tile.BackgroundColor3 = rarityBg;
	tile.BackgroundTransparency = 0.08;
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
	tileStroke.Transparency = 0;
	tileStroke.Parent = tile;

	// New-since-last-view dot
	setDotVisible(tile, isNew(INV_SCROLLS, scroll.targetName));

	const icon = new Instance("TextLabel");
	icon.Size = new UDim2(1, 0, 0, sc(28));
	icon.Position = new UDim2(0, 0, 0, sc(4));
	icon.BackgroundTransparency = 1;
	icon.Text = "#";
	icon.TextColor3 = rarityColor;
	icon.Font = UI_THEME.fontDisplay;
	icon.TextSize = sc(24);
	icon.ZIndex = 33;
	icon.Parent = tile;

	const nameLabel = new Instance("TextLabel");
	nameLabel.Size = new UDim2(1, -4, 0, sc(20));
	nameLabel.Position = new UDim2(0, 2, 0, sc(32));
	nameLabel.BackgroundTransparency = 1;
	nameLabel.Text = scroll.targetName;
	nameLabel.TextColor3 = UI_THEME.textPrimary;
	nameLabel.Font = UI_THEME.fontBody;
	nameLabel.TextSize = sc(9);
	nameLabel.TextWrapped = true;
	nameLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	nameLabel.ZIndex = 33;
	nameLabel.Parent = tile;

	const scrollTag = new Instance("TextLabel");
	scrollTag.Size = new UDim2(1, 0, 0, sc(10));
	scrollTag.Position = new UDim2(0, 0, 1, sc(-12));
	scrollTag.BackgroundTransparency = 1;
	scrollTag.Text = "SCROLL";
	scrollTag.TextColor3 = rarityColor;
	scrollTag.Font = UI_THEME.fontBold;
	scrollTag.TextSize = sc(8);
	scrollTag.ZIndex = 34;
	scrollTag.Parent = tile;

	const rarityBar = new Instance("Frame");
	rarityBar.Size = new UDim2(0.6, 0, 0, sc(2));
	rarityBar.Position = new UDim2(0.2, 0, 1, sc(-3));
	rarityBar.BackgroundColor3 = rarityColor;
	rarityBar.BackgroundTransparency = 0.3;
	rarityBar.BorderSizePixel = 0;
	rarityBar.ZIndex = 33;
	rarityBar.Parent = tile;

	tile.MouseEnter.Connect(() => {
		tile.BackgroundTransparency = 0;
		tileStroke.Thickness = 2;
		showScrollTooltip(scroll, tile);
	});
	tile.MouseLeave.Connect(() => {
		tile.BackgroundTransparency = 0.08;
		tileStroke.Thickness = 1;
		hideTooltip(scrollKey);
	});
}

// ── Item tooltip ──────────────────────────────────────────────────────────────

function buildTooltip(screenGui: ScreenGui): void {
	const tt = new Instance("Frame");
	tt.Name = "ItemTooltip";
	tt.Size = new UDim2(0, sc(230), 0, sc(155));
	tt.BackgroundColor3 = UI_THEME.bg;
	tt.BackgroundTransparency = 0.04;
	tt.BorderSizePixel = 0;
	tt.Visible = false;
	tt.ZIndex = 50;
	tt.Parent = screenGui;
	tooltipFrame = tt;

	const ttCorner = new Instance("UICorner");
	ttCorner.CornerRadius = new UDim(0, 4);
	ttCorner.Parent = tt;

	const ttStroke = new Instance("UIStroke");
	ttStroke.Name = "TooltipStroke";
	ttStroke.Color = UI_THEME.border;
	ttStroke.Thickness = 1.2;
	ttStroke.Parent = tt;

	const ttPad = new Instance("UIPadding");
	ttPad.PaddingTop = new UDim(0, sc(6));
	ttPad.PaddingBottom = new UDim(0, sc(6));
	ttPad.PaddingLeft = new UDim(0, sc(8));
	ttPad.PaddingRight = new UDim(0, sc(8));
	ttPad.Parent = tt;

	const nameLabel = new Instance("TextLabel");
	nameLabel.Name = "TT_Name";
	nameLabel.Size = new UDim2(1, 0, 0, sc(16));
	nameLabel.Position = new UDim2(0, 0, 0, 0);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.Text = "";
	nameLabel.TextColor3 = UI_THEME.textHeader;
	nameLabel.Font = UI_THEME.fontDisplay;
	nameLabel.TextSize = sc(16);
	nameLabel.ZIndex = 51;
	nameLabel.Parent = tt;
	tooltipName = nameLabel;

	const typeLabel = new Instance("TextLabel");
	typeLabel.Name = "TT_Type";
	typeLabel.Size = new UDim2(0.5, 0, 0, sc(12));
	typeLabel.Position = new UDim2(0, 0, 0, sc(18));
	typeLabel.BackgroundTransparency = 1;
	typeLabel.Text = "";
	typeLabel.TextColor3 = UI_THEME.textMuted;
	typeLabel.Font = UI_THEME.fontBody;
	typeLabel.TextSize = sc(11);
	typeLabel.TextXAlignment = Enum.TextXAlignment.Left;
	typeLabel.ZIndex = 51;
	typeLabel.Parent = tt;
	tooltipType = typeLabel;

	const rarityLabel = new Instance("TextLabel");
	rarityLabel.Name = "TT_Rarity";
	rarityLabel.Size = new UDim2(0.5, 0, 0, sc(12));
	rarityLabel.Position = new UDim2(0.5, 0, 0, sc(18));
	rarityLabel.BackgroundTransparency = 1;
	rarityLabel.Text = "";
	rarityLabel.TextColor3 = UI_THEME.textMuted;
	rarityLabel.Font = UI_THEME.fontBold;
	rarityLabel.TextSize = sc(11);
	rarityLabel.TextXAlignment = Enum.TextXAlignment.Right;
	rarityLabel.ZIndex = 51;
	rarityLabel.Parent = tt;
	tooltipRarity = rarityLabel;

	const ttDiv = new Instance("Frame");
	ttDiv.Size = new UDim2(1, 0, 0, 1);
	ttDiv.Position = new UDim2(0, 0, 0, sc(34));
	ttDiv.BackgroundColor3 = UI_THEME.divider;
	ttDiv.BorderSizePixel = 0;
	ttDiv.ZIndex = 51;
	ttDiv.Parent = tt;

	const descLabel = new Instance("TextLabel");
	descLabel.Name = "TT_Desc";
	descLabel.Size = new UDim2(1, 0, 0, sc(32));
	descLabel.Position = new UDim2(0, 0, 0, sc(38));
	descLabel.BackgroundTransparency = 1;
	descLabel.Text = "";
	descLabel.TextColor3 = UI_THEME.textPrimary;
	descLabel.Font = UI_THEME.fontBody;
	descLabel.TextSize = sc(11);
	descLabel.TextYAlignment = Enum.TextYAlignment.Top;
	descLabel.TextWrapped = true;
	descLabel.ZIndex = 51;
	descLabel.Parent = tt;
	tooltipDesc = descLabel;

	const effectLabel = new Instance("TextLabel");
	effectLabel.Name = "TT_Effect";
	effectLabel.Size = new UDim2(1, 0, 0, sc(28));
	effectLabel.Position = new UDim2(0, 0, 0, sc(74));
	effectLabel.BackgroundTransparency = 1;
	effectLabel.Text = "";
	effectLabel.TextColor3 = UI_THEME.gold;
	effectLabel.Font = UI_THEME.fontBold;
	effectLabel.TextSize = sc(11);
	effectLabel.TextYAlignment = Enum.TextYAlignment.Top;
	effectLabel.TextWrapped = true;
	effectLabel.ZIndex = 51;
	effectLabel.Parent = tt;
	tooltipEffect = effectLabel;

	const consumeLabel = new Instance("TextLabel");
	consumeLabel.Name = "TT_Consumable";
	consumeLabel.Size = new UDim2(1, 0, 0, sc(12));
	consumeLabel.Position = new UDim2(0, 0, 1, sc(-14));
	consumeLabel.BackgroundTransparency = 1;
	consumeLabel.Text = "";
	consumeLabel.TextColor3 = UI_THEME.textMuted;
	consumeLabel.Font = UI_THEME.fontBody;
	consumeLabel.TextSize = sc(10);
	consumeLabel.TextXAlignment = Enum.TextXAlignment.Left;
	consumeLabel.ZIndex = 51;
	consumeLabel.Parent = tt;
	tooltipConsumable = consumeLabel;
}

function positionTooltip(anchor: GuiObject): void {
	if (tooltipFrame === undefined) return;
	const aPos = anchor.AbsolutePosition;
	const aSize = anchor.AbsoluteSize;
	const ttW = sc(210);
	const ttH = sc(140);
	const camera = (game.GetService("Workspace") as Workspace).CurrentCamera;
	const vpX = camera ? camera.ViewportSize.X : 1920;

	let posX = aPos.X + aSize.X + sc(6);
	if (posX + ttW > vpX - 10) {
		posX = aPos.X - ttW - sc(6);
	}
	const posY = aPos.Y;

	tooltipFrame.Position = new UDim2(0, posX, 0, posY);
	tooltipFrame.Size = new UDim2(0, ttW, 0, ttH);
	tooltipFrame.Visible = true;
}

function showItemTooltip(item: ItemDef, tile: TextButton): void {
	if (tooltipFrame === undefined) return;
	currentTooltipItem = item.id;

	const rarityColor = RARITY_COLORS[item.rarity] ?? UI_THEME.textPrimary;
	const rarityBg = RARITY_BG_COLORS[item.rarity] ?? UI_THEME.bg;
	const rarityLbl = RARITY_LABELS[item.rarity] ?? "Common";

	if (tooltipName) {
		tooltipName.Text = item.name;
		tooltipName.TextColor3 = rarityColor;
	}
	if (tooltipType) tooltipType.Text = item.itemType;
	if (tooltipRarity) {
		tooltipRarity.Text = rarityLbl;
		tooltipRarity.TextColor3 = rarityColor;
	}
	if (tooltipDesc) tooltipDesc.Text = item.description;
	if (tooltipEffect) tooltipEffect.Text = item.effect;
	if (tooltipConsumable) {
		tooltipConsumable.Text = item.consumable ? "Consumable - click to activate" : "Click to equip";
	}

	tooltipFrame.BackgroundColor3 = rarityBg;
	const strokeRef = tooltipFrame.FindFirstChild("TooltipStroke") as UIStroke | undefined;
	if (strokeRef) strokeRef.Color = rarityColor;

	positionTooltip(tile);
}

function showScrollTooltip(scroll: BountyScroll, tile: TextButton): void {
	if (tooltipFrame === undefined) return;
	const scrollKey = "scroll_" + scroll.slotIndex;
	currentTooltipItem = scrollKey;

	const rarityColor = RARITY_COLORS[scroll.rarity] ?? UI_THEME.textPrimary;
	const rarityBg = RARITY_BG_COLORS[scroll.rarity] ?? UI_THEME.bg;
	const rarityLbl = RARITY_LABELS[scroll.rarity] ?? "Common";

	if (tooltipName) {
		tooltipName.Text = "Bounty: " + scroll.targetName;
		tooltipName.TextColor3 = rarityColor;
	}
	if (tooltipType) tooltipType.Text = "Bounty Scroll";
	if (tooltipRarity) {
		tooltipRarity.Text = rarityLbl;
		tooltipRarity.TextColor3 = rarityColor;
	}
	if (tooltipDesc) tooltipDesc.Text = "Proof of assassination. Turn in to claim your reward.";
	if (tooltipEffect) tooltipEffect.Text = "+" + scroll.gold + " Gold  |  +" + scroll.xp + " XP";
	if (tooltipConsumable) tooltipConsumable.Text = "COLLECTED";

	tooltipFrame.BackgroundColor3 = rarityBg;
	const strokeRef = tooltipFrame.FindFirstChild("TooltipStroke") as UIStroke | undefined;
	if (strokeRef) strokeRef.Color = rarityColor;

	positionTooltip(tile);
}

function hideTooltip(itemId: string): void {
	if (currentTooltipItem !== itemId) return;
	if (tooltipFrame) tooltipFrame.Visible = false;
	currentTooltipItem = undefined;
}

// ── Toggle visibility ─────────────────────────────────────────────────────────

function toggleInventory(): void {
	if (rootFrame === undefined) return;
	inventoryOpen = !inventoryOpen;

	if (inventoryOpen) {
		refreshFilterButtons();
		refreshActiveStatusBar();
		refreshItemGrid();

		if (inventoryBackdrop) inventoryBackdrop.Visible = true;
		rootFrame.Visible = true;
		rootFrame.Size = new UDim2(0, sc(200), 0, sc(220));
		rootFrame.BackgroundTransparency = 0.6;
		TweenService.Create(rootFrame, new TweenInfo(0.22, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
			Size: new UDim2(0, sc(380), 0, sc(500)),
			BackgroundTransparency: UI_THEME.bgTransparency,
		}).Play();
	} else {
		// Clear "new" indicators for everything the player just saw.
		markSeen(INV_WEAPONS);
		markSeen(INV_POISONS);
		markSeen(INV_ELIXIRS);
		markSeen(INV_SCROLLS);

		if (inventoryBackdrop) inventoryBackdrop.Visible = false;
		const tween = TweenService.Create(
			rootFrame,
			new TweenInfo(0.15, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
			{
				Size: new UDim2(0, sc(200), 0, sc(220)),
				BackgroundTransparency: 0.6,
			},
		);
		tween.Play();
		tween.Completed.Once(() => {
			if (rootFrame) rootFrame.Visible = false;
		});
	}
}

// ── Sync handler ──────────────────────────────────────────────────────────────

function applyInventorySync(payload: InventoryPayload): void {
	currentOwned = payload.ownedItems;
	currentEquippedWeapon = payload.equippedWeapon;
	currentActivePoison = payload.activePoison;
	currentActiveElixirs = payload.activeElixirs ?? [];
	currentBountyScrolls = payload.bountyScrolls ?? [];
	// Let other client scripts detect the active weapon via attribute
	Players.LocalPlayer.SetAttribute("EquippedWeapon", currentEquippedWeapon ?? "fists");

	// Track "new since last viewed" per category.
	const weaponIds: string[] = [];
	const poisonIds: string[] = [];
	const elixirIds: string[] = [];
	for (const item of ITEM_LIST) {
		const count = currentOwned[item.id] ?? 0;
		if (count <= 0) continue;
		if (item.category === "weapon") weaponIds.push(item.id);
		else if (item.category === "poison") poisonIds.push(item.id);
		else if (item.category === "elixir") elixirIds.push(item.id);
	}
	trackPresent(INV_WEAPONS, weaponIds);
	trackPresent(INV_POISONS, poisonIds);
	trackPresent(INV_ELIXIRS, elixirIds);
	const scrollIds: string[] = [];
	for (const s of currentBountyScrolls) scrollIds.push(s.targetName);
	trackPresent(INV_SCROLLS, scrollIds);

	refreshActiveStatusBar();
	if (inventoryOpen) {
		refreshItemGrid();
	}
}

// ── Init ──────────────────────────────────────────────────────────────────────

onPlayerInitialized(() => {
	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

	buildInventoryUI(screenGui);
	buildTooltip(screenGui);

	// Register toggle so the mobile HUD can open/close inventory
	registerInventoryToggle(() => toggleInventory());

	syncRemote.OnClientEvent.Connect((data: unknown) => {
		applyInventorySync(data as InventoryPayload);
	});

	task.spawn(() => {
		const data = requestRemote.InvokeServer() as InventoryPayload | undefined;
		if (data !== undefined) {
			applyInventorySync(data);
		}
	});

	// [DISABLED] B/N keyboard hotkeys removed — use admin HUD panel instead
});
