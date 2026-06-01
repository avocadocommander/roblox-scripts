import { Players, ReplicatedStorage, RunService, TweenService } from "@rbxts/services";
import { onPlayerInitialized } from "../modules/client-init";
import { UI_THEME, getUIScale } from "shared/ui-theme";
import { ITEMS, RARITY_COLORS, RARITY_BG_COLORS } from "shared/inventory";
import { getEffectSyncRemote, EffectSyncPayload } from "shared/remotes/effect-remote";

const playerState = ReplicatedStorage.WaitForChild("PlayerState") as Folder;
const GetPlayerTitle = playerState.WaitForChild("GetTitle") as RemoteFunction;
const GetPlayerName = playerState.WaitForChild("GetName") as RemoteFunction;
const GetCoins = playerState.WaitForChild("GetCoins") as RemoteFunction;
const CoinsUpdated = playerState.WaitForChild("CoinsUpdated") as RemoteEvent;

// Gold colours — reuse the theme gold for the total, distinct greens/reds for +/- deltas.
const GOLD_COLOR = UI_THEME.gold;
const COIN_DELTA_POS = Color3.fromRGB(140, 220, 130);
const COIN_DELTA_NEG = Color3.fromRGB(220, 100, 100);

// -- Scaling --------------------------------------------------------------------

function sc(baseSize: number): number {
	return baseSize * getUIScale();
}

// -- Live refs ------------------------------------------------------------------

let nameLabel: TextLabel | undefined;
let goldLabel: TextLabel | undefined;
let nameRow: Frame | undefined;

let currentTitle = "";
let currentName = "---";
let currentWeaponId = "fists";

let prevCoins = -1;

// Active timed effects (poison + elixir) shown as square icons under the banner.
interface ActiveEffectSlot {
	itemId: string;
	durationSecs: number;
	remainingSecs: number;
	lastSyncClock: number;
}
let effectsBarLeft: Frame | undefined;
let effectsBarRight: Frame | undefined;
let effectsTooltip: Frame | undefined;
let effectsTTName: TextLabel | undefined;
let effectsTTSubtitle: TextLabel | undefined;
let effectsTTDesc: TextLabel | undefined;
let effectsTTEffect: TextLabel | undefined;
let effectsTTCountdown: TextLabel | undefined;
const activeEffects = new Map<string, ActiveEffectSlot>(); // slotKey -> data
const effectTiles = new Map<string, Frame>(); // slotKey -> tile frame
let hoveredEffectKey: string | undefined;

// -- Helpers --------------------------------------------------------------------

function colorToHex(c: Color3): string {
	const r = math.floor(c.R * 255 + 0.5);
	const g = math.floor(c.G * 255 + 0.5);
	const b = math.floor(c.B * 255 + 0.5);
	return string.format("#%02X%02X%02X", r, g, b);
}

function refreshNameLine(): void {
	if (!nameLabel) return;
	const titleHex = colorToHex(UI_THEME.textSection);
	const nameHex = colorToHex(UI_THEME.textPrimary);
	if (currentTitle !== "") {
		nameLabel.Text =
			'<font color="' +
			titleHex +
			'">' +
			currentTitle +
			'</font> <font color="' +
			nameHex +
			'">' +
			currentName +
			"</font>";
	} else {
		nameLabel.Text = currentName;
	}
}

function updateWeapon(weaponId: string | undefined): void {
	const id = weaponId !== undefined && weaponId !== "" ? weaponId : "fists";
	currentWeaponId = id;
	refreshWeaponTile();
}

// -- Builder --------------------------------------------------------------------

function buildCharacterBanner(screenGui: ScreenGui): void {
	// Top-left banner -- anchored under Roblox system buttons
	const BANNER_W = sc(320);

	const banner = new Instance("Frame");
	banner.Name = "CharacterBanner";
	banner.Size = new UDim2(0, BANNER_W, 0, sc(50));
	banner.Position = new UDim2(0, sc(20), 0, sc(40));
	banner.AnchorPoint = new Vector2(0, 0);
	banner.BackgroundColor3 = UI_THEME.bg;
	banner.BackgroundTransparency = UI_THEME.bgTransparency;
	banner.BorderSizePixel = 0;
	banner.ZIndex = 30;
	banner.Parent = screenGui;

	const corner = new Instance("UICorner");
	corner.CornerRadius = UI_THEME.cornerRadius;
	corner.Parent = banner;

	const stroke = new Instance("UIStroke");
	stroke.Color = UI_THEME.border;
	stroke.Thickness = UI_THEME.strokeThickness;
	stroke.Parent = banner;

	const pad = new Instance("UIPadding");
	pad.PaddingTop = new UDim(0, sc(10));
	pad.PaddingBottom = new UDim(0, sc(10));
	pad.PaddingLeft = new UDim(0, sc(12));
	pad.PaddingRight = new UDim(0, sc(12));
	pad.Parent = banner;

	// ---- Single line: Title + Name + Gold ----------------------------------
	// Title prefix + name fill the left (RichText), gold pinned right.
	const GOLD_W = sc(72);

	nameRow = new Instance("Frame");
	nameRow.Name = "NameRow";
	nameRow.Size = new UDim2(1, 0, 0, sc(30));
	nameRow.BackgroundTransparency = 1;
	nameRow.ZIndex = 31;
	nameRow.ClipsDescendants = false;
	nameRow.Parent = banner;

	nameLabel = new Instance("TextLabel");
	nameLabel.Name = "Name";
	nameLabel.Size = new UDim2(1, -GOLD_W - sc(6), 1, 0);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.RichText = true;
	nameLabel.Text = "---";
	nameLabel.TextColor3 = UI_THEME.textPrimary;
	nameLabel.Font = UI_THEME.fontDisplay;
	nameLabel.TextSize = sc(24);
	nameLabel.TextXAlignment = Enum.TextXAlignment.Left;
	nameLabel.TextYAlignment = Enum.TextYAlignment.Center;
	nameLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	nameLabel.ZIndex = 31;
	nameLabel.Parent = nameRow;

	goldLabel = new Instance("TextLabel");
	goldLabel.Name = "Gold";
	goldLabel.AnchorPoint = new Vector2(1, 0);
	goldLabel.Position = new UDim2(1, 0, 0, 0);
	goldLabel.Size = new UDim2(0, GOLD_W, 1, 0);
	goldLabel.BackgroundTransparency = 1;
	goldLabel.Text = "0g";
	goldLabel.TextColor3 = GOLD_COLOR;
	goldLabel.Font = UI_THEME.fontDisplay;
	goldLabel.TextSize = sc(22);
	goldLabel.TextXAlignment = Enum.TextXAlignment.Right;
	goldLabel.TextYAlignment = Enum.TextYAlignment.Center;
	goldLabel.ZIndex = 31;
	goldLabel.ClipsDescendants = false;
	goldLabel.Parent = nameRow;
}

// -- Gold display ---------------------------------------------------------------

function formatGold(amount: number): string {
	return tostring(amount) + "g";
}

/**
 * Spawn a short "+N" (green) or "-N" (red) label that floats up and fades out
 * just above the Player Board gold total to telegraph the change.
 */
function spawnGoldDeltaFloater(delta: number): void {
	if (delta === 0 || !goldLabel) return;
	const sign = delta > 0 ? "+" : "-";
	const magnitude = math.abs(delta);
	const color = delta > 0 ? COIN_DELTA_POS : COIN_DELTA_NEG;

	const floater = new Instance("TextLabel");
	floater.Name = "GoldDelta";
	floater.AnchorPoint = new Vector2(1, 1);
	// Pin the floater's bottom-right corner to the gold label's top-right corner.
	floater.Position = new UDim2(1, 0, 0, -sc(2));
	floater.Size = new UDim2(0, sc(72), 0, sc(22));
	floater.BackgroundTransparency = 1;
	floater.Text = sign + tostring(magnitude) + "g";
	floater.TextColor3 = color;
	floater.Font = UI_THEME.fontBold;
	floater.TextSize = sc(18);
	floater.TextXAlignment = Enum.TextXAlignment.Right;
	floater.TextYAlignment = Enum.TextYAlignment.Center;
	floater.TextTransparency = 0;
	floater.TextStrokeColor3 = UI_THEME.bg;
	floater.TextStrokeTransparency = 0.2;
	floater.ZIndex = 32;
	floater.Parent = goldLabel;

	const tween = TweenService.Create(floater, new TweenInfo(0.9, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Position: new UDim2(1, 0, 0, -sc(22)),
		TextTransparency: 1,
		TextStrokeTransparency: 1,
	});
	tween.Play();
	task.delay(0.95, () => {
		if (floater.Parent !== undefined) floater.Destroy();
	});
}

function setGold(total: number, animateDelta: boolean): void {
	if (!goldLabel) return;
	const delta = animateDelta && prevCoins >= 0 ? total - prevCoins : 0;
	goldLabel.Text = formatGold(total);
	if (delta !== 0) spawnGoldDeltaFloater(delta);
	prevCoins = total;
}

// -- Active timed effects bar --------------------------------------------------

const EFFECT_TILE_SIZE = 36;
const EFFECT_TILE_GAP = 6;

function buildEffectsBar(screenGui: ScreenGui, banner: Frame): void {
	// Left bar: equipped weapon. Pinned under the banner's bottom-left corner.
	const leftBar = new Instance("Frame");
	leftBar.Name = "ActiveEffectsBarLeft";
	leftBar.AnchorPoint = new Vector2(0, 0);
	leftBar.Position = new UDim2(0, sc(20), 0, sc(40));
	leftBar.Size = new UDim2(0, sc(EFFECT_TILE_SIZE * 2 + EFFECT_TILE_GAP), 0, sc(EFFECT_TILE_SIZE));
	leftBar.BackgroundTransparency = 1;
	leftBar.BorderSizePixel = 0;
	leftBar.ZIndex = 30;
	leftBar.Parent = screenGui;

	const leftLayout = new Instance("UIListLayout");
	leftLayout.FillDirection = Enum.FillDirection.Horizontal;
	leftLayout.HorizontalAlignment = Enum.HorizontalAlignment.Left;
	leftLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	leftLayout.Padding = new UDim(0, sc(EFFECT_TILE_GAP));
	leftLayout.Parent = leftBar;

	effectsBarLeft = leftBar;

	// Right bar: consumable effects (poison + elixir). Pinned under banner's bottom-right.
	const rightBar = new Instance("Frame");
	rightBar.Name = "ActiveEffectsBarRight";
	rightBar.AnchorPoint = new Vector2(1, 0);
	rightBar.Position = new UDim2(0, sc(20), 0, sc(40));
	rightBar.Size = new UDim2(0, sc(EFFECT_TILE_SIZE * 4 + EFFECT_TILE_GAP * 3), 0, sc(EFFECT_TILE_SIZE));
	rightBar.BackgroundTransparency = 1;
	rightBar.BorderSizePixel = 0;
	rightBar.ZIndex = 30;
	rightBar.Parent = screenGui;

	const rightLayout = new Instance("UIListLayout");
	rightLayout.FillDirection = Enum.FillDirection.Horizontal;
	rightLayout.HorizontalAlignment = Enum.HorizontalAlignment.Right;
	rightLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	rightLayout.Padding = new UDim(0, sc(EFFECT_TILE_GAP));
	rightLayout.Parent = rightBar;

	effectsBarRight = rightBar;

	// Reposition the bars to sit just below the banner whenever it moves/resizes.
	const reposition = (): void => {
		const bSize = banner.AbsoluteSize;
		const bPos = banner.AbsolutePosition;
		const y = bPos.Y + bSize.Y + sc(6);
		leftBar.Position = new UDim2(0, bPos.X, 0, y);
		rightBar.Position = new UDim2(0, bPos.X + bSize.X, 0, y);
	};
	banner.GetPropertyChangedSignal("AbsoluteSize").Connect(reposition);
	banner.GetPropertyChangedSignal("AbsolutePosition").Connect(reposition);
	task.defer(reposition);

	buildEffectsTooltip(screenGui);
}

function buildEffectsTooltip(screenGui: ScreenGui): void {
	const tt = new Instance("Frame");
	tt.Name = "EffectTooltip";
	tt.Size = new UDim2(0, sc(220), 0, sc(140));
	tt.BackgroundColor3 = UI_THEME.bgInset;
	tt.BackgroundTransparency = 0.05;
	tt.BorderSizePixel = 0;
	tt.Visible = false;
	tt.ZIndex = 60;
	tt.Parent = screenGui;

	const c = new Instance("UICorner");
	c.CornerRadius = new UDim(0, 4);
	c.Parent = tt;

	const s = new Instance("UIStroke");
	s.Name = "TTStroke";
	s.Color = UI_THEME.border;
	s.Thickness = 1.2;
	s.Parent = tt;

	const pad = new Instance("UIPadding");
	pad.PaddingTop = new UDim(0, sc(8));
	pad.PaddingBottom = new UDim(0, sc(8));
	pad.PaddingLeft = new UDim(0, sc(10));
	pad.PaddingRight = new UDim(0, sc(10));
	pad.Parent = tt;

	const nm = new Instance("TextLabel");
	nm.Size = new UDim2(1, 0, 0, sc(18));
	nm.BackgroundTransparency = 1;
	nm.Text = "";
	nm.TextColor3 = UI_THEME.textPrimary;
	nm.Font = UI_THEME.fontDisplay;
	nm.TextSize = sc(15);
	nm.TextXAlignment = Enum.TextXAlignment.Left;
	nm.ZIndex = 61;
	nm.Parent = tt;
	effectsTTName = nm;

	const sub = new Instance("TextLabel");
	sub.Size = new UDim2(1, 0, 0, sc(14));
	sub.Position = new UDim2(0, 0, 0, sc(20));
	sub.BackgroundTransparency = 1;
	sub.Text = "";
	sub.TextColor3 = UI_THEME.textMuted;
	sub.Font = UI_THEME.fontBold;
	sub.TextSize = sc(11);
	sub.TextXAlignment = Enum.TextXAlignment.Left;
	sub.ZIndex = 61;
	sub.Parent = tt;
	effectsTTSubtitle = sub;

	const desc = new Instance("TextLabel");
	desc.Size = new UDim2(1, 0, 0, sc(50));
	desc.Position = new UDim2(0, 0, 0, sc(38));
	desc.BackgroundTransparency = 1;
	desc.Text = "";
	desc.TextColor3 = UI_THEME.textPrimary;
	desc.Font = UI_THEME.fontBody;
	desc.TextSize = sc(11);
	desc.TextWrapped = true;
	desc.TextXAlignment = Enum.TextXAlignment.Left;
	desc.TextYAlignment = Enum.TextYAlignment.Top;
	desc.ZIndex = 61;
	desc.Parent = tt;
	effectsTTDesc = desc;

	const eff = new Instance("TextLabel");
	eff.Size = new UDim2(1, 0, 0, sc(16));
	eff.Position = new UDim2(0, 0, 1, -sc(34));
	eff.BackgroundTransparency = 1;
	eff.Text = "";
	eff.TextColor3 = UI_THEME.gold;
	eff.Font = UI_THEME.fontBold;
	eff.TextSize = sc(11);
	eff.TextXAlignment = Enum.TextXAlignment.Left;
	eff.TextWrapped = true;
	eff.ZIndex = 61;
	eff.Parent = tt;
	effectsTTEffect = eff;

	const cd = new Instance("TextLabel");
	cd.Size = new UDim2(1, 0, 0, sc(16));
	cd.Position = new UDim2(0, 0, 1, -sc(16));
	cd.BackgroundTransparency = 1;
	cd.Text = "";
	cd.TextColor3 = UI_THEME.textHeader;
	cd.Font = UI_THEME.fontBold;
	cd.TextSize = sc(12);
	cd.TextXAlignment = Enum.TextXAlignment.Left;
	cd.ZIndex = 61;
	cd.Parent = tt;
	effectsTTCountdown = cd;

	effectsTooltip = tt;
}

function formatRemaining(secs: number): string {
	const s = math.max(0, math.floor(secs));
	if (s >= 60) {
		const m = math.floor(s / 60);
		const r = s - m * 60;
		return string.format("%d:%02d", m, r);
	}
	return string.format("0:%02d", s);
}

function ensureEffectTile(slotKey: string, itemId: string): Frame {
	let tile = effectTiles.get(slotKey);
	if (tile && tile.Parent) return tile;

	const def = ITEMS[itemId];
	const rarityColor = def ? (RARITY_COLORS[def.rarity] ?? UI_THEME.textPrimary) : UI_THEME.textPrimary;
	const rarityBg = def ? (RARITY_BG_COLORS[def.rarity] ?? UI_THEME.bgInset) : UI_THEME.bgInset;

	tile = new Instance("Frame");
	tile.Name = "Effect_" + slotKey;
	const parentBar = slotKey === "weapon" ? effectsBarLeft : effectsBarRight;
	if (slotKey === "elixir") tile.LayoutOrder = 0;
	else if (slotKey === "poison") tile.LayoutOrder = 1;
	else tile.LayoutOrder = 0;
	tile.Size = new UDim2(0, sc(EFFECT_TILE_SIZE), 0, sc(EFFECT_TILE_SIZE));
	tile.BackgroundColor3 = rarityBg;
	tile.BackgroundTransparency = 0.05;
	tile.BorderSizePixel = 0;
	tile.ZIndex = 31;
	tile.Parent = parentBar;

	const c = new Instance("UICorner");
	c.CornerRadius = new UDim(0, 4);
	c.Parent = tile;

	const s = new Instance("UIStroke");
	s.Color = rarityColor;
	s.Thickness = 1.2;
	s.Parent = tile;

	const icon = new Instance("TextLabel");
	icon.Name = "Icon";
	const showCountdown = slotKey !== "weapon";
	icon.Size = showCountdown ? new UDim2(1, 0, 1, -sc(10)) : new UDim2(1, 0, 1, 0);
	icon.BackgroundTransparency = 1;
	icon.Text = def ? def.icon : "?";
	icon.TextColor3 = rarityColor;
	icon.Font = UI_THEME.fontDisplay;
	icon.TextSize = sc(20);
	icon.ZIndex = 32;
	icon.Parent = tile;

	if (showCountdown) {
		const cd = new Instance("TextLabel");
		cd.Name = "Countdown";
		cd.AnchorPoint = new Vector2(0.5, 1);
		cd.Position = new UDim2(0.5, 0, 1, -sc(1));
		cd.Size = new UDim2(1, 0, 0, sc(10));
		cd.BackgroundTransparency = 1;
		cd.Text = "";
		cd.TextColor3 = UI_THEME.textHeader;
		cd.Font = UI_THEME.fontBold;
		cd.TextSize = sc(10);
		cd.ZIndex = 32;
		cd.Parent = tile;
	}

	// Hover handlers
	const hoverIn = (): void => {
		hoveredEffectKey = slotKey;
		showEffectTooltip(slotKey, tile!);
	};
	const hoverOut = (): void => {
		if (hoveredEffectKey === slotKey) hideEffectTooltip();
	};
	tile.MouseEnter.Connect(hoverIn);
	tile.MouseLeave.Connect(hoverOut);

	effectTiles.set(slotKey, tile);
	return tile;
}

function showEffectTooltip(slotKey: string, anchor: Frame): void {
	if (!effectsTooltip) return;
	const slot = activeEffects.get(slotKey);
	if (!slot) return;
	const def = ITEMS[slot.itemId];
	if (!def) return;

	const rarityColor = RARITY_COLORS[def.rarity] ?? UI_THEME.textPrimary;
	const rarityBg = RARITY_BG_COLORS[def.rarity] ?? UI_THEME.bgInset;

	if (effectsTTName) {
		effectsTTName.Text = def.name;
		effectsTTName.TextColor3 = rarityColor;
	}
	if (effectsTTSubtitle) {
		effectsTTSubtitle.Text = def.itemType;
		effectsTTSubtitle.TextColor3 = rarityColor;
	}
	if (effectsTTDesc) effectsTTDesc.Text = def.description;
	if (effectsTTEffect) effectsTTEffect.Text = def.effect;
	if (effectsTTCountdown) {
		if (slot.remainingSecs < 0) {
			effectsTTCountdown.Text = "";
		} else {
			const elapsed = os.clock() - slot.lastSyncClock;
			const remaining = math.max(0, slot.remainingSecs - elapsed);
			effectsTTCountdown.Text = "Time left: " + formatRemaining(remaining);
		}
	}

	effectsTooltip.BackgroundColor3 = rarityBg;
	const strokeRef = effectsTooltip.FindFirstChild("TTStroke") as UIStroke | undefined;
	if (strokeRef) strokeRef.Color = rarityColor;

	// Position below the tile (or above if not enough room)
	const aPos = anchor.AbsolutePosition;
	const aSize = anchor.AbsoluteSize;
	const ttW = effectsTooltip.AbsoluteSize.X;
	const ttH = effectsTooltip.AbsoluteSize.Y;
	const camera = game.Workspace.CurrentCamera;
	const vpY = camera ? camera.ViewportSize.Y : 1080;
	let posY = aPos.Y + aSize.Y + sc(4);
	if (posY + ttH > vpY - 10) posY = aPos.Y - ttH - sc(4);
	effectsTooltip.Position = new UDim2(0, aPos.X, 0, posY);
	effectsTooltip.Size = new UDim2(0, sc(220), 0, sc(140));
	effectsTooltip.Visible = true;
}

function hideEffectTooltip(): void {
	if (effectsTooltip) effectsTooltip.Visible = false;
	hoveredEffectKey = undefined;
}

function applyEffectSync(payload: EffectSyncPayload): void {
	const now = os.clock();

	// Elixir slot
	if (payload.activeElixirId !== undefined && payload.elixirRemainingSecs > 0) {
		activeEffects.set("elixir", {
			itemId: payload.activeElixirId,
			durationSecs: payload.elixirRemainingSecs,
			remainingSecs: payload.elixirRemainingSecs,
			lastSyncClock: now,
		});
		ensureEffectTile("elixir", payload.activeElixirId);
	} else {
		activeEffects.delete("elixir");
		const tile = effectTiles.get("elixir");
		if (tile) {
			tile.Destroy();
			effectTiles.delete("elixir");
		}
		if (hoveredEffectKey === "elixir") hideEffectTooltip();
	}

	// Poison slot
	if (payload.activePoisonId !== undefined && payload.poisonRemainingSecs > 0) {
		activeEffects.set("poison", {
			itemId: payload.activePoisonId,
			durationSecs: payload.poisonRemainingSecs,
			remainingSecs: payload.poisonRemainingSecs,
			lastSyncClock: now,
		});
		ensureEffectTile("poison", payload.activePoisonId);
	} else {
		activeEffects.delete("poison");
		const tile = effectTiles.get("poison");
		if (tile) {
			tile.Destroy();
			effectTiles.delete("poison");
		}
		if (hoveredEffectKey === "poison") hideEffectTooltip();
	}

	// If a tile is replaced (different itemId for same slot), rebuild it cleanly.
	for (const [key, slot] of activeEffects) {
		const tile = effectTiles.get(key);
		const iconLabel = tile?.FindFirstChild("Icon") as TextLabel | undefined;
		const def = ITEMS[slot.itemId];
		if (tile && def && iconLabel && iconLabel.Text !== def.icon) {
			tile.Destroy();
			effectTiles.delete(key);
			ensureEffectTile(key, slot.itemId);
		}
	}
}

function refreshWeaponTile(): void {
	if (!effectsBarLeft) return;
	const id = currentWeaponId;
	// Fists = unarmed, no tile.
	if (id === "fists" || id === "" || ITEMS[id] === undefined) {
		activeEffects.delete("weapon");
		const existing = effectTiles.get("weapon");
		if (existing) {
			existing.Destroy();
			effectTiles.delete("weapon");
		}
		if (hoveredEffectKey === "weapon") hideEffectTooltip();
		return;
	}
	const existing = effectTiles.get("weapon");
	const prev = activeEffects.get("weapon");
	activeEffects.set("weapon", {
		itemId: id,
		durationSecs: 0,
		remainingSecs: -1,
		lastSyncClock: 0,
	});
	// If the weapon changed (or no tile yet), rebuild.
	if (!existing || !prev || prev.itemId !== id) {
		if (existing) {
			existing.Destroy();
			effectTiles.delete("weapon");
		}
		ensureEffectTile("weapon", id);
	}
}

function tickEffectTiles(): void {
	const now = os.clock();
	for (const [key, slot] of activeEffects) {
		if (slot.remainingSecs < 0) continue;
		const tile = effectTiles.get(key);
		if (!tile) continue;
		const elapsed = now - slot.lastSyncClock;
		const remaining = math.max(0, slot.remainingSecs - elapsed);
		const cd = tile.FindFirstChild("Countdown") as TextLabel | undefined;
		if (cd) cd.Text = formatRemaining(remaining);
	}
	if (hoveredEffectKey !== undefined && effectsTTCountdown) {
		const slot = activeEffects.get(hoveredEffectKey);
		if (slot && slot.remainingSecs >= 0) {
			const elapsed = now - slot.lastSyncClock;
			const remaining = math.max(0, slot.remainingSecs - elapsed);
			effectsTTCountdown.Text = "Time left: " + formatRemaining(remaining);
		}
	}
}

// -- Init -----------------------------------------------------------------------

onPlayerInitialized(() => {
	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

	buildCharacterBanner(screenGui);
	const bannerFrame = screenGui.WaitForChild("CharacterBanner") as Frame;
	buildEffectsBar(screenGui, bannerFrame);

	// Listen for active poison / elixir state.
	getEffectSyncRemote().OnClientEvent.Connect((data: unknown) => {
		applyEffectSync(data as EffectSyncPayload);
	});

	// Local countdown tick (server sends EffectSync occasionally; we interpolate
	// between syncs to keep the displayed seconds smooth).
	RunService.Heartbeat.Connect((_dt) => {
		tickEffectTiles();
	});

	// Fetch initial values
	const initTitle = GetPlayerTitle.InvokeServer() as string;
	const initName = GetPlayerName.InvokeServer() as string;

	currentName = initName;
	currentTitle = initTitle ?? "";
	refreshNameLine();

	// Initial weapon state — render weapon tile in active row
	const initWeapon = Players.LocalPlayer.GetAttribute("EquippedWeapon") as string | undefined;
	updateWeapon(initWeapon);

	// Live weapon changes
	Players.LocalPlayer.GetAttributeChangedSignal("EquippedWeapon").Connect(() => {
		const wId = Players.LocalPlayer.GetAttribute("EquippedWeapon") as string | undefined;
		updateWeapon(wId);
	});

	// Fallback: if inventory.client's first SetAttribute fired before our
	// AttributeChanged listener connected, re-check the attribute for a few
	// seconds so the weapon tile shows up on first join without re-equipping.
	task.spawn(() => {
		const deadline = os.clock() + 5;
		while (os.clock() < deadline) {
			task.wait(0.25);
			const wId = Players.LocalPlayer.GetAttribute("EquippedWeapon") as string | undefined;
			if (wId !== undefined && wId !== "" && wId !== currentWeaponId) {
				updateWeapon(wId);
				break;
			}
			if (wId !== undefined && wId === currentWeaponId && currentWeaponId !== "fists") break;
		}
	});

	// Initial gold + live updates (delta floater on every change).
	const initCoins = GetCoins.InvokeServer() as number;
	setGold(initCoins, false);
	CoinsUpdated.OnClientEvent.Connect((newTotalRaw: unknown) => {
		setGold(newTotalRaw as number, true);
	});
});
