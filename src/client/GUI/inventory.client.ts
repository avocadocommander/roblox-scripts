import { Players, TweenService, UserInputService } from "@rbxts/services";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";
import {
	getEquipItemRemote,
	getUnequipSlotRemote,
	getInventorySyncRemote,
	getRequestInventoryRemote,
	getMockBountyKillRemote,
	getTurnInBountyRemote,
} from "shared/remotes/inventory-remote";
import {
	SLOT_LAYOUT,
	ITEMS,
	ITEM_LIST,
	RARITY_COLORS,
	RARITY_LABELS,
	RARITY_BG_COLORS,
	MAX_BOUNTY_SLOTS,
	SlotDef,
	ItemDef,
	InventoryPayload,
	EquippedSlots,
	BountyScroll,
	BountyScrollPayload,
} from "shared/inventory";
import { UI_THEME, getUIScale } from "shared/ui-theme";

const lifecycle = getOrCreateLifecycleRemote();
const equipRemote = getEquipItemRemote();
const unequipRemote = getUnequipSlotRemote();
const syncRemote = getInventorySyncRemote();
const requestRemote = getRequestInventoryRemote();
const mockBountyKillRemote = getMockBountyKillRemote();
const turnInBountyRemote = getTurnInBountyRemote();

// ── Scaling helper ────────────────────────────────────────────────────────────

function sc(base: number): number {
	return base * getUIScale();
}

// ── State ─────────────────────────────────────────────────────────────────────

let inventoryOpen = false;
let rootFrame: Frame | undefined;
let selectedSlotId: string | undefined;
let currentOwned: Record<string, number> = {};
let currentEquipped: EquippedSlots = {};

// Refs for live updates
const slotButtons: Map<string, TextButton> = new Map();
let itemGrid: ScrollingFrame | undefined;
const slotIconLabels: Map<string, TextLabel> = new Map();
const slotNameLabels: Map<string, TextLabel> = new Map();
let filterTitle: TextLabel | undefined;

let inventoryButton: TextButton | undefined;
let tooltipFrame: Frame | undefined;
let tooltipName: TextLabel | undefined;
let tooltipType: TextLabel | undefined;
let tooltipRarity: TextLabel | undefined;
let tooltipDesc: TextLabel | undefined;
let tooltipEffect: TextLabel | undefined;
let tooltipConsumable: TextLabel | undefined;
let currentTooltipItem: string | undefined;

// Bounty scroll state
let currentBountyScrolls: BountyScrollPayload = [];
let bountyScrollContainer: Frame | undefined;
const bountyScrollSlots: TextButton[] = [];

// Track last click time per item for double-click detection
const lastClickTime: Map<string, number> = new Map();
const DOUBLE_CLICK_THRESHOLD = 0.35;

// ── Build the UI ──────────────────────────────────────────────────────────────

function buildInventoryUI(screenGui: ScreenGui): void {
	// Main container — centred, dark panel
	const root = new Instance("Frame");
	root.Name = "InventoryPanel";
	root.Size = new UDim2(0, sc(420), 0, sc(560));
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

	// ── Slot bar ──────────────────────────────────────────────────────────
	const slotBar = new Instance("Frame");
	slotBar.Name = "SlotBar";
	slotBar.Size = new UDim2(1, 0, 0, sc(80));
	slotBar.Position = new UDim2(0, 0, 0, sc(28));
	slotBar.BackgroundTransparency = 1;
	slotBar.ZIndex = 31;
	slotBar.Parent = root;

	const slotLayout = new Instance("UIListLayout");
	slotLayout.FillDirection = Enum.FillDirection.Horizontal;
	slotLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center;
	slotLayout.Padding = new UDim(0, sc(6));
	slotLayout.Parent = slotBar;

	for (const slotDef of SLOT_LAYOUT) {
		buildSlotButton(slotBar, slotDef);
	}

	// ── Divider ───────────────────────────────────────────────────────────
	const divider = new Instance("Frame");
	divider.Size = new UDim2(1, 0, 0, 1);
	divider.Position = new UDim2(0, 0, 0, sc(104));
	divider.BackgroundColor3 = UI_THEME.divider;
	divider.BorderSizePixel = 0;
	divider.ZIndex = 31;
	divider.Parent = root;

	// ── Filter title ──────────────────────────────────────────────────────
	const fTitle = new Instance("TextLabel");
	fTitle.Name = "FilterTitle";
	fTitle.Size = new UDim2(1, 0, 0, sc(18));
	fTitle.Position = new UDim2(0, 0, 0, sc(108));
	fTitle.BackgroundTransparency = 1;
	fTitle.Text = "ALL ITEMS";
	fTitle.TextColor3 = UI_THEME.textSection;
	fTitle.Font = UI_THEME.fontBold;
	fTitle.TextSize = sc(13);
	fTitle.TextXAlignment = Enum.TextXAlignment.Left;
	fTitle.ZIndex = 31;
	fTitle.Parent = root;
	filterTitle = fTitle;

	// ── Item grid (scrolling) ─────────────────────────────────────────────
	const grid = new Instance("ScrollingFrame");
	grid.Name = "ItemGrid";
	grid.Size = new UDim2(1, 0, 0, sc(258));
	grid.Position = new UDim2(0, 0, 0, sc(128));
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

	// ── Bounty Scrolls section ────────────────────────────────────────
	const bountyDivider = new Instance("Frame");
	bountyDivider.Size = new UDim2(1, 0, 0, 1);
	bountyDivider.Position = new UDim2(0, 0, 0, sc(390));
	bountyDivider.BackgroundColor3 = UI_THEME.divider;
	bountyDivider.BorderSizePixel = 0;
	bountyDivider.ZIndex = 31;
	bountyDivider.Parent = root;

	const bountyTitle = new Instance("TextLabel");
	bountyTitle.Name = "BountyTitle";
	bountyTitle.Size = new UDim2(1, 0, 0, sc(16));
	bountyTitle.Position = new UDim2(0, 0, 0, sc(394));
	bountyTitle.BackgroundTransparency = 1;
	bountyTitle.Text = "BOUNTY SCROLLS";
	bountyTitle.TextColor3 = UI_THEME.textSection;
	bountyTitle.Font = UI_THEME.fontBold;
	bountyTitle.TextSize = sc(13);
	bountyTitle.TextXAlignment = Enum.TextXAlignment.Left;
	bountyTitle.ZIndex = 31;
	bountyTitle.Parent = root;

	const bContainer = new Instance("Frame");
	bContainer.Name = "BountyScrollBar";
	bContainer.Size = new UDim2(1, 0, 0, sc(80));
	bContainer.Position = new UDim2(0, 0, 0, sc(412));
	bContainer.BackgroundTransparency = 1;
	bContainer.ZIndex = 31;
	bContainer.Parent = root;
	bountyScrollContainer = bContainer;

	const bLayout = new Instance("UIListLayout");
	bLayout.FillDirection = Enum.FillDirection.Horizontal;
	bLayout.HorizontalAlignment = Enum.HorizontalAlignment.Left;
	bLayout.Padding = new UDim(0, sc(6));
	bLayout.Parent = bContainer;

	// Create the 4 empty scroll slots
	for (let i = 0; i < MAX_BOUNTY_SLOTS; i++) {
		const slot = buildBountyScrollSlot(bContainer, i);
		bountyScrollSlots.push(slot);
	}
}

// ── Bounty scroll slot ────────────────────────────────────────────────────────

function buildBountyScrollSlot(parent: Frame, index: number): TextButton {
	const slot = new Instance("TextButton");
	slot.Name = "BountySlot_" + index;
	slot.Size = new UDim2(0, sc(82), 0, sc(72));
	slot.BackgroundColor3 = UI_THEME.bgInset;
	slot.BackgroundTransparency = 0.3;
	slot.BorderSizePixel = 0;
	slot.Text = "";
	slot.AutoButtonColor = false;
	slot.ZIndex = 32;
	slot.Parent = parent;

	const slotCorner = new Instance("UICorner");
	slotCorner.CornerRadius = new UDim(0, 4);
	slotCorner.Parent = slot;

	const slotStroke = new Instance("UIStroke");
	slotStroke.Name = "SlotStroke";
	slotStroke.Color = UI_THEME.divider;
	slotStroke.Thickness = 1;
	slotStroke.Parent = slot;

	// Empty state icon
	const emptyIcon = new Instance("TextLabel");
	emptyIcon.Name = "EmptyIcon";
	emptyIcon.Size = new UDim2(1, 0, 0, sc(24));
	emptyIcon.Position = new UDim2(0, 0, 0, sc(8));
	emptyIcon.BackgroundTransparency = 1;
	emptyIcon.Text = "?";
	emptyIcon.TextColor3 = UI_THEME.textMuted;
	emptyIcon.Font = UI_THEME.fontDisplay;
	emptyIcon.TextSize = sc(22);
	emptyIcon.ZIndex = 33;
	emptyIcon.Parent = slot;

	// Target name label
	const nameLabel = new Instance("TextLabel");
	nameLabel.Name = "TargetName";
	nameLabel.Size = new UDim2(1, -4, 0, sc(14));
	nameLabel.Position = new UDim2(0, 2, 0, sc(32));
	nameLabel.BackgroundTransparency = 1;
	nameLabel.Text = "Empty";
	nameLabel.TextColor3 = UI_THEME.textMuted;
	nameLabel.Font = UI_THEME.fontBody;
	nameLabel.TextSize = sc(9);
	nameLabel.TextWrapped = true;
	nameLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	nameLabel.ZIndex = 33;
	nameLabel.Parent = slot;

	// Status label at bottom
	const statusLabel = new Instance("TextLabel");
	statusLabel.Name = "StatusLabel";
	statusLabel.Size = new UDim2(1, -4, 0, sc(12));
	statusLabel.Position = new UDim2(0, 2, 1, sc(-14));
	statusLabel.BackgroundTransparency = 1;
	statusLabel.Text = "";
	statusLabel.TextColor3 = UI_THEME.gold;
	statusLabel.Font = UI_THEME.fontBold;
	statusLabel.TextSize = sc(8);
	statusLabel.ZIndex = 33;
	statusLabel.Parent = slot;

	// Hover events for tooltip
	slot.MouseEnter.Connect(() => {
		const scroll = currentBountyScrolls[index] as BountyScroll | undefined;
		if (scroll === undefined) return;
		const rarityColor = RARITY_COLORS[scroll.rarity] ?? UI_THEME.textPrimary;
		slotStroke.Transparency = 0;
		slot.BackgroundTransparency = 0;
		slotStroke.Color = rarityColor;
		showScrollTooltip(scroll, slot);
	});
	slot.MouseLeave.Connect(() => {
		const scroll = currentBountyScrolls[index] as BountyScroll | undefined;
		if (scroll !== undefined) {
			const rarityColor = RARITY_COLORS[scroll.rarity] ?? UI_THEME.textPrimary;
			slot.BackgroundTransparency = 0.08;
			slotStroke.Color = rarityColor;
		} else {
			slot.BackgroundTransparency = 0.3;
			slotStroke.Color = UI_THEME.divider;
		}
		slotStroke.Transparency = 0;
		hideTooltip("scroll_" + index);
	});

	return slot;
}

function refreshBountyScrolls(): void {
	for (let i = 0; i < MAX_BOUNTY_SLOTS; i++) {
		const slot = bountyScrollSlots[i];
		if (!slot) continue;

		const scroll = currentBountyScrolls[i] as BountyScroll | undefined;
		const emptyIcon = slot.FindFirstChild("EmptyIcon") as TextLabel | undefined;
		const nameLabel = slot.FindFirstChild("TargetName") as TextLabel | undefined;
		const statusLabel = slot.FindFirstChild("StatusLabel") as TextLabel | undefined;
		const stroke = slot.FindFirstChild("SlotStroke") as UIStroke | undefined;

		if (scroll !== undefined) {
			const rarityColor = RARITY_COLORS[scroll.rarity] ?? UI_THEME.textPrimary;
			const rarityBg = RARITY_BG_COLORS[scroll.rarity] ?? UI_THEME.bgInset;

			slot.BackgroundColor3 = rarityBg;
			slot.BackgroundTransparency = 0.08;
			if (stroke) stroke.Color = rarityColor;

			if (emptyIcon) {
				emptyIcon.Text = "#";
				emptyIcon.TextColor3 = rarityColor;
			}
			if (nameLabel) {
				nameLabel.Text = scroll.targetName;
				nameLabel.TextColor3 = rarityColor;
			}
			if (statusLabel) {
				statusLabel.Text = "COLLECTED";
				statusLabel.TextColor3 = UI_THEME.gold;
			}
		} else {
			// Empty slot
			slot.BackgroundColor3 = UI_THEME.bgInset;
			slot.BackgroundTransparency = 0.3;
			if (stroke) stroke.Color = UI_THEME.divider;

			if (emptyIcon) {
				emptyIcon.Text = "?";
				emptyIcon.TextColor3 = UI_THEME.textMuted;
			}
			if (nameLabel) {
				nameLabel.Text = "Empty";
				nameLabel.TextColor3 = UI_THEME.textMuted;
			}
			if (statusLabel) {
				statusLabel.Text = "";
			}
		}
	}
}

// ── Slot button ───────────────────────────────────────────────────────────────

function buildSlotButton(parent: Frame, slotDef: SlotDef): void {
	const btn = new Instance("TextButton");
	btn.Name = "Slot_" + slotDef.id;
	btn.Size = new UDim2(0, sc(70), 0, sc(80));
	btn.BackgroundColor3 = UI_THEME.bgInset;
	btn.BackgroundTransparency = 0.3;
	btn.BorderSizePixel = 0;
	btn.Text = "";
	btn.AutoButtonColor = false;
	btn.ZIndex = 32;
	btn.Parent = parent;

	const btnCorner = new Instance("UICorner");
	btnCorner.CornerRadius = new UDim(0, 4);
	btnCorner.Parent = btn;

	const btnStroke = new Instance("UIStroke");
	btnStroke.Color = UI_THEME.divider;
	btnStroke.Thickness = 1;
	btnStroke.Parent = btn;

	// Slot type label at top
	const typeLabel = new Instance("TextLabel");
	typeLabel.Name = "SlotType";
	typeLabel.Size = new UDim2(1, 0, 0, sc(12));
	typeLabel.Position = new UDim2(0, 0, 0, sc(2));
	typeLabel.BackgroundTransparency = 1;
	typeLabel.Text = slotDef.label.upper();
	typeLabel.TextColor3 = UI_THEME.textMuted;
	typeLabel.Font = UI_THEME.fontBold;
	typeLabel.TextSize = sc(10);
	typeLabel.ZIndex = 33;
	typeLabel.Parent = btn;

	// Icon / item name in centre
	const iconLabel = new Instance("TextLabel");
	iconLabel.Name = "SlotIcon";
	iconLabel.Size = new UDim2(1, 0, 0, sc(28));
	iconLabel.Position = new UDim2(0, 0, 0, sc(16));
	iconLabel.BackgroundTransparency = 1;
	iconLabel.Text = slotDef.emptyIcon;
	iconLabel.TextColor3 = UI_THEME.textMuted;
	iconLabel.Font = UI_THEME.fontDisplay;
	iconLabel.TextSize = sc(24);
	iconLabel.ZIndex = 33;
	iconLabel.Parent = btn;
	slotIconLabels.set(slotDef.id, iconLabel);

	// Item name at bottom
	const nameLabel = new Instance("TextLabel");
	nameLabel.Name = "SlotName";
	nameLabel.Size = new UDim2(1, 0, 0, sc(14));
	nameLabel.Position = new UDim2(0, 0, 1, sc(-16));
	nameLabel.BackgroundTransparency = 1;
	nameLabel.Text = "Empty";
	nameLabel.TextColor3 = UI_THEME.textMuted;
	nameLabel.Font = UI_THEME.fontBody;
	nameLabel.TextSize = sc(10);
	nameLabel.ZIndex = 33;
	nameLabel.Parent = btn;
	slotNameLabels.set(slotDef.id, nameLabel);

	slotButtons.set(slotDef.id, btn);

	// Click: select this slot (or deselect if already selected)
	btn.MouseButton1Click.Connect(() => {
		if (selectedSlotId === slotDef.id) {
			selectedSlotId = undefined;
		} else {
			selectedSlotId = slotDef.id;
		}
		refreshSlotHighlights();
		refreshItemGrid();
	});

	// Right-click: unequip
	btn.MouseButton2Click.Connect(() => {
		// Don't allow unequipping the weapon slot — always need fists at minimum
		if (slotDef.id === "weapon") return;
		unequipRemote.FireServer(slotDef.id);
	});
}

// ── Slot highlight state ──────────────────────────────────────────────────────

function refreshSlotHighlights(): void {
	for (const [slotId, btn] of slotButtons) {
		const btnStroke = btn.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
		if (slotId === selectedSlotId) {
			btn.BackgroundTransparency = 0.1;
			if (btnStroke) btnStroke.Color = UI_THEME.gold;
		} else {
			btn.BackgroundTransparency = 0.3;
			if (btnStroke) btnStroke.Color = UI_THEME.divider;
		}
	}
}

// ── Refresh equipped slot display ─────────────────────────────────────────────

function refreshSlotDisplays(): void {
	for (const slotDef of SLOT_LAYOUT) {
		const equippedItemId = currentEquipped[slotDef.id];
		const iconLabel = slotIconLabels.get(slotDef.id);
		const nameLabel = slotNameLabels.get(slotDef.id);
		const btn = slotButtons.get(slotDef.id);

		if (equippedItemId !== undefined) {
			const itemDef = ITEMS[equippedItemId];
			if (itemDef && iconLabel && nameLabel) {
				iconLabel.Text = itemDef.icon;
				iconLabel.TextColor3 = RARITY_COLORS[itemDef.rarity] ?? UI_THEME.textPrimary;
				nameLabel.Text = itemDef.name;
				nameLabel.TextColor3 = RARITY_COLORS[itemDef.rarity] ?? UI_THEME.textPrimary;
			}
			// Tint the slot stroke with rarity colour
			if (btn && itemDef) {
				const s = btn.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
				if (s && slotDef.id !== selectedSlotId) {
					s.Color = RARITY_COLORS[itemDef.rarity] ?? UI_THEME.divider;
				}
			}
		} else {
			if (iconLabel) {
				iconLabel.Text = slotDef.emptyIcon;
				iconLabel.TextColor3 = UI_THEME.textMuted;
			}
			if (nameLabel) {
				nameLabel.Text = "Empty";
				nameLabel.TextColor3 = UI_THEME.textMuted;
			}
		}
	}
}

// ── Refresh the item grid ─────────────────────────────────────────────────────

function refreshItemGrid(): void {
	if (itemGrid === undefined) return;

	// Clear old tiles
	for (const child of itemGrid.GetChildren()) {
		if (child.IsA("TextButton")) {
			child.Destroy();
		}
	}

	// Determine which slot type to filter by
	let filterSlotType: string | undefined;
	if (selectedSlotId !== undefined) {
		const slotDef = SLOT_LAYOUT.find((s) => s.id === selectedSlotId);
		if (slotDef) {
			filterSlotType = slotDef.slotType;
		}
	}

	// Update filter title
	if (filterTitle) {
		if (filterSlotType !== undefined) {
			filterTitle.Text = filterSlotType.upper() + " ITEMS";
		} else {
			filterTitle.Text = "ALL ITEMS";
		}
	}

	// Build sorted item list
	const items: ItemDef[] = [];
	for (const item of ITEM_LIST) {
		const count = currentOwned[item.id] ?? 0;
		if (count <= 0) continue;
		if (filterSlotType !== undefined && item.slotType !== filterSlotType) continue;
		items.push(item);
	}

	// Sort by rarity (common first), then name
	const rarityOrder: Record<string, number> = {
		common: 0,
		uncommon: 1,
		rare: 2,
		epic: 3,
		legendary: 4,
	};
	items.sort((a, b) => {
		const ra = rarityOrder[a.rarity] ?? 0;
		const rb = rarityOrder[b.rarity] ?? 0;
		if (ra !== rb) return ra < rb;
		return a.name < b.name;
	});

	let layoutOrder = 0;
	for (const item of items) {
		buildItemTile(itemGrid, item, layoutOrder);
		layoutOrder++;
	}
}

// ── Item tile ─────────────────────────────────────────────────────────────────

function buildItemTile(parent: ScrollingFrame, item: ItemDef, order: number): void {
	const count = currentOwned[item.id] ?? 0;
	const rarityColor = RARITY_COLORS[item.rarity] ?? UI_THEME.textPrimary;

	const tile = new Instance("TextButton");
	tile.Name = "Item_" + item.id;
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

	// Icon
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

	// Name
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

	// Count badge
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
		badge.Parent = tile;

		const badgeCorner = new Instance("UICorner");
		badgeCorner.CornerRadius = new UDim(0, 3);
		badgeCorner.Parent = badge;
	}

	// Rarity bar at bottom
	const rarityBar = new Instance("Frame");
	rarityBar.Size = new UDim2(0.6, 0, 0, sc(2));
	rarityBar.Position = new UDim2(0.2, 0, 1, sc(-5));
	rarityBar.BackgroundColor3 = rarityColor;
	rarityBar.BackgroundTransparency = 0.3;
	rarityBar.BorderSizePixel = 0;
	rarityBar.ZIndex = 33;
	rarityBar.Parent = tile;

	// ── Click / double-click handling ─────────────────────────────────────
	tile.MouseButton1Click.Connect(() => {
		const now = tick();
		const prev = lastClickTime.get(item.id) ?? 0;
		lastClickTime.set(item.id, now);

		const isDoubleClick = now - prev < DOUBLE_CLICK_THRESHOLD;

		if (isDoubleClick) {
			// Double click: auto-equip to first compatible empty slot
			autoEquip(item);
		} else if (selectedSlotId !== undefined) {
			// Single click with slot selected: equip into that slot
			const slotDef = SLOT_LAYOUT.find((s) => s.id === selectedSlotId);
			if (slotDef && slotDef.slotType === item.slotType) {
				equipRemote.FireServer(selectedSlotId, item.id);
			}
		}

		// Brief highlight flash on tile
		tileStroke.Transparency = 0;
		TweenService.Create(tileStroke, new TweenInfo(0.3, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			Transparency: 0.4,
		}).Play();
	});

	// Hover effect + tooltip
	tile.MouseEnter.Connect(() => {
		tile.BackgroundTransparency = 0;
		tileStroke.Transparency = 0;
		showTooltip(item, tile);
	});
	tile.MouseLeave.Connect(() => {
		tile.BackgroundTransparency = 0.15;
		tileStroke.Transparency = 0.4;
		hideTooltip(item.id);
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

	// Row 1: Item name (full width, left-aligned)
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

	// Row 2 left: Item type
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

	// Row 2 right: Rarity label
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

	// Divider
	const divider = new Instance("Frame");
	divider.Size = new UDim2(1, 0, 0, 1);
	divider.Position = new UDim2(0, 0, 0, sc(34));
	divider.BackgroundColor3 = UI_THEME.divider;
	divider.BorderSizePixel = 0;
	divider.ZIndex = 51;
	divider.Parent = tt;

	// Description (wrapping text)
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

	// Effect line (mechanical stats)
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

	// Consumable tag (bottom)
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

function showTooltip(item: ItemDef, tile: TextButton): void {
	if (tooltipFrame === undefined) return;
	currentTooltipItem = item.id;

	const rarityColor = RARITY_COLORS[item.rarity] ?? UI_THEME.textPrimary;
	const rarityBg = RARITY_BG_COLORS[item.rarity] ?? UI_THEME.bg;
	const rarityLabel = RARITY_LABELS[item.rarity] ?? "Common";

	// Populate text
	if (tooltipName) {
		tooltipName.Text = item.name;
		tooltipName.TextColor3 = rarityColor;
	}
	if (tooltipType) {
		tooltipType.Text = item.itemType;
	}
	if (tooltipRarity) {
		tooltipRarity.Text = rarityLabel;
		tooltipRarity.TextColor3 = rarityColor;
	}
	if (tooltipDesc) {
		tooltipDesc.Text = item.description;
	}
	if (tooltipEffect) {
		tooltipEffect.Text = item.effect;
	}
	if (tooltipConsumable) {
		tooltipConsumable.Text = item.consumable ? "Consumable - used on activation" : "";
	}

	// Style the card border + background to match rarity
	tooltipFrame.BackgroundColor3 = rarityBg;
	const stroke = tooltipFrame.FindFirstChild("TooltipStroke") as UIStroke | undefined;
	if (stroke) stroke.Color = rarityColor;

	// Position the tooltip to the right of the tile (or left if it would overflow)
	const tileAbsPos = tile.AbsolutePosition;
	const tileAbsSize = tile.AbsoluteSize;
	const tooltipWidth = sc(210);
	const tooltipHeight = sc(140);
	const camera = (game.GetService("Workspace") as Workspace).CurrentCamera;
	const vpX = camera ? camera.ViewportSize.X : 1920;

	let posX = tileAbsPos.X + tileAbsSize.X + sc(6);
	// If tooltip would go off screen right, show it to the left
	if (posX + tooltipWidth > vpX - 10) {
		posX = tileAbsPos.X - tooltipWidth - sc(6);
	}
	const posY = tileAbsPos.Y;

	tooltipFrame.Position = new UDim2(0, posX, 0, posY);
	tooltipFrame.Size = new UDim2(0, tooltipWidth, 0, tooltipHeight);
	tooltipFrame.Visible = true;
}

function showScrollTooltip(scroll: BountyScroll, slot: TextButton): void {
	if (tooltipFrame === undefined) return;
	const scrollKey = "scroll_" + scroll.slotIndex;
	currentTooltipItem = scrollKey;

	const rarityColor = RARITY_COLORS[scroll.rarity] ?? UI_THEME.textPrimary;
	const rarityBg = RARITY_BG_COLORS[scroll.rarity] ?? UI_THEME.bg;
	const rarityLabel = RARITY_LABELS[scroll.rarity] ?? "Common";

	// Populate text
	if (tooltipName) {
		tooltipName.Text = "Bounty: " + scroll.targetName;
		tooltipName.TextColor3 = rarityColor;
	}
	if (tooltipType) {
		tooltipType.Text = "Bounty Scroll";
	}
	if (tooltipRarity) {
		tooltipRarity.Text = rarityLabel;
		tooltipRarity.TextColor3 = rarityColor;
	}
	if (tooltipDesc) {
		tooltipDesc.Text = "Proof of assassination. Turn in to claim your reward.";
	}
	if (tooltipEffect) {
		tooltipEffect.Text = "+" + scroll.gold + " Gold  |  +" + scroll.xp + " XP";
	}
	if (tooltipConsumable) {
		tooltipConsumable.Text = "COLLECTED - press N to turn in";
	}

	// Style the card
	tooltipFrame.BackgroundColor3 = rarityBg;
	const stroke = tooltipFrame.FindFirstChild("TooltipStroke") as UIStroke | undefined;
	if (stroke) stroke.Color = rarityColor;

	// Position above the slot (scrolls are near the bottom of the panel)
	const slotAbsPos = slot.AbsolutePosition;
	const slotAbsSize = slot.AbsoluteSize;
	const tooltipWidth = sc(210);
	const tooltipHeight = sc(140);
	const camera = (game.GetService("Workspace") as Workspace).CurrentCamera;
	const vpX = camera ? camera.ViewportSize.X : 1920;

	let posX = slotAbsPos.X + slotAbsSize.X + sc(6);
	if (posX + tooltipWidth > vpX - 10) {
		posX = slotAbsPos.X - tooltipWidth - sc(6);
	}
	// Position above the slot so it doesn't go off-screen at the bottom
	const posY = slotAbsPos.Y - tooltipHeight - sc(4);

	tooltipFrame.Position = new UDim2(0, posX, 0, posY > 0 ? posY : slotAbsPos.Y);
	tooltipFrame.Size = new UDim2(0, tooltipWidth, 0, tooltipHeight);
	tooltipFrame.Visible = true;
}

function hideTooltip(itemId: string): void {
	// Only hide if this item is still the one being shown (prevents flicker)
	if (currentTooltipItem !== itemId) return;
	if (tooltipFrame) tooltipFrame.Visible = false;
	currentTooltipItem = undefined;
}

// ── Auto-equip logic ──────────────────────────────────────────────────────────

function autoEquip(item: ItemDef): void {
	// Find the first compatible slot that is empty
	let targetSlot: string | undefined;
	for (const slotDef of SLOT_LAYOUT) {
		if (slotDef.slotType !== item.slotType) continue;
		if (currentEquipped[slotDef.id] === undefined) {
			targetSlot = slotDef.id;
			break;
		}
	}
	// If all slots occupied, equip into the first compatible slot (replace)
	if (targetSlot === undefined) {
		for (const slotDef of SLOT_LAYOUT) {
			if (slotDef.slotType === item.slotType) {
				targetSlot = slotDef.id;
				break;
			}
		}
	}
	if (targetSlot !== undefined) {
		equipRemote.FireServer(targetSlot, item.id);
	}
}

// ── Inventory button (bottom-right, left of campfire) ─────────────────────────

function buildInventoryButton(screenGui: ScreenGui): void {
	const buttonSize = sc(50);
	const buttonPadding = sc(12);
	// Position: 3rd button from right (sneak = 1st, campfire = 2nd, inventory = 3rd)
	const offsetX = (buttonSize + buttonPadding) * 3;

	const container = new Instance("Frame");
	container.Name = "InventoryButtonContainer";
	container.Size = new UDim2(0, buttonSize, 0, buttonSize);
	container.Position = new UDim2(1, -offsetX, 1, -buttonSize - buttonPadding);
	container.AnchorPoint = new Vector2(1, 1);
	container.BackgroundTransparency = 1;
	container.Parent = screenGui;

	const btn = new Instance("TextButton");
	btn.Name = "InventoryButton";
	btn.Size = new UDim2(1, 0, 1, 0);
	btn.BackgroundColor3 = UI_THEME.bgInset;
	btn.BackgroundTransparency = 0.2;
	btn.BorderSizePixel = 0;
	btn.Text = "=";
	btn.TextColor3 = UI_THEME.textMuted;
	btn.Font = UI_THEME.fontDisplay;
	btn.TextSize = sc(26);
	btn.AutoButtonColor = false;
	btn.Parent = container;
	inventoryButton = btn;

	const btnCorner = new Instance("UICorner");
	btnCorner.CornerRadius = new UDim(0.5, 0);
	btnCorner.Parent = btn;

	const btnStroke = new Instance("UIStroke");
	btnStroke.Color = UI_THEME.textMuted;
	btnStroke.Thickness = sc(1.5);
	btnStroke.Parent = btn;

	btn.MouseEnter.Connect(() => {
		btn.BackgroundTransparency = 0;
		const s = btn.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
		if (s) s.Color = UI_THEME.textPrimary;
	});

	btn.MouseLeave.Connect(() => {
		const activeColor = inventoryOpen ? UI_THEME.gold : UI_THEME.textMuted;
		btn.BackgroundTransparency = inventoryOpen ? 0.1 : 0.2;
		const s = btn.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
		if (s) s.Color = activeColor;
	});

	btn.Activated.Connect(() => {
		toggleInventory();
	});
}

function updateInventoryButtonState(): void {
	if (inventoryButton === undefined) return;
	const s = inventoryButton.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
	if (inventoryOpen) {
		inventoryButton.BackgroundTransparency = 0.1;
		if (s) s.Color = UI_THEME.gold;
	} else {
		inventoryButton.BackgroundTransparency = 0.2;
		if (s) s.Color = UI_THEME.textMuted;
	}
}

// ── Toggle visibility ─────────────────────────────────────────────────────────

function toggleInventory(): void {
	if (rootFrame === undefined) return;
	inventoryOpen = !inventoryOpen;
	updateInventoryButtonState();

	if (inventoryOpen) {
		// Reset selection
		selectedSlotId = undefined;
		refreshSlotHighlights();
		refreshSlotDisplays();
		refreshItemGrid();
		refreshBountyScrolls();

		rootFrame.Visible = true;
		rootFrame.Size = new UDim2(0, sc(200), 0, sc(220));
		rootFrame.BackgroundTransparency = 0.6;
		TweenService.Create(rootFrame, new TweenInfo(0.22, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
			Size: new UDim2(0, sc(380), 0, sc(520)),
			BackgroundTransparency: UI_THEME.bgTransparency,
		}).Play();
	} else {
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
	currentEquipped = payload.equipped;
	currentBountyScrolls = payload.bountyScrolls ?? [];
	refreshSlotDisplays();
	refreshBountyScrolls();
	if (inventoryOpen) {
		refreshItemGrid();
	}
}

// ── Init ──────────────────────────────────────────────────────────────────────

lifecycle.OnClientEvent.Connect((message: string) => {
	if (message !== "InitializePlayer") return;

	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

	buildInventoryUI(screenGui);
	buildInventoryButton(screenGui);
	buildTooltip(screenGui);

	// Listen for inventory syncs from server
	syncRemote.OnClientEvent.Connect((data: unknown) => {
		applyInventorySync(data as InventoryPayload);
	});

	// Fetch initial inventory
	task.spawn(() => {
		const data = requestRemote.InvokeServer() as InventoryPayload | undefined;
		if (data !== undefined) {
			applyInventorySync(data);
		}
	});

	// ── B / N key bindings (bounty scroll testing) ────────────────────────
	UserInputService.InputBegan.Connect((io, gameProcessed) => {
		if (gameProcessed) return;
		if (io.KeyCode === Enum.KeyCode.B) {
			mockBountyKillRemote.FireServer();
		} else if (io.KeyCode === Enum.KeyCode.N) {
			turnInBountyRemote.FireServer();
		}
	});
});
