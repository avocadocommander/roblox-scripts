import { Players, ReplicatedStorage, RunService, TweenService } from "@rbxts/services";
import { onPlayerInitialized } from "../modules/client-init";
import { UI_THEME, getUIScale } from "shared/ui-theme";
import { WEAPONS } from "shared/config/weapons";
import { FactionXP, FACTION_IDS, levelFromXP } from "shared/config/factions";
import { ITEMS, RARITY_COLORS, RARITY_BG_COLORS } from "shared/inventory";
import { getEffectSyncRemote, EffectSyncPayload } from "shared/remotes/effect-remote";

const playerState = ReplicatedStorage.WaitForChild("PlayerState") as Folder;
const GetPlayerTitle = playerState.WaitForChild("GetTitle") as RemoteFunction;
const GetPlayerName = playerState.WaitForChild("GetName") as RemoteFunction;
const GetFactionXP = playerState.WaitForChild("GetFactionXP") as RemoteFunction;
const FactionXPUpdated = playerState.WaitForChild("FactionXPUpdated") as RemoteEvent;
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
let titleRepLabel: TextLabel | undefined;
let weaponIconLabel: TextLabel | undefined;
let weaponNameLabel: TextLabel | undefined;
let goldLabel: TextLabel | undefined;
let nameRow: Frame | undefined;

let prevCoins = -1;

// Active timed effects (poison + elixir) shown as square icons under the banner.
interface ActiveEffectSlot {
	itemId: string;
	durationSecs: number;
	remainingSecs: number;
	lastSyncClock: number;
}
let effectsBar: Frame | undefined;
let effectsTooltip: Frame | undefined;
let effectsTTName: TextLabel | undefined;
let effectsTTSubtitle: TextLabel | undefined;
let effectsTTDesc: TextLabel | undefined;
let effectsTTEffect: TextLabel | undefined;
let effectsTTCountdown: TextLabel | undefined;
const activeEffects = new Map<string, ActiveEffectSlot>(); // slotKey -> data
const effectTiles = new Map<string, Frame>(); // slotKey -> tile frame
let hoveredEffectKey: string | undefined;

// Cached state for combined title+rep line
let cachedTitle = "";
let cachedReputation = "Unaligned";

// -- Helpers --------------------------------------------------------------------

function toRoman(n: number): string {
	if (n <= 0) return "I";
	const numerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
	if (n > numerals.size()) return tostring(n);
	return numerals[n - 1];
}

function reputationLine(fxp: FactionXP): string {
	let bestFaction = FACTION_IDS[0];
	let bestXP = 0;
	for (const fid of FACTION_IDS) {
		if (fxp[fid] > bestXP) {
			bestXP = fxp[fid];
			bestFaction = fid;
		}
	}
	if (bestXP <= 0) return "Unaligned";
	return bestFaction + " Reputation " + toRoman(levelFromXP(bestXP));
}

function refreshTitleRepLine(): void {
	if (!titleRepLabel) return;
	if (cachedTitle !== "" && cachedReputation !== "") {
		titleRepLabel.Text = cachedTitle + " - " + cachedReputation;
	} else if (cachedTitle !== "") {
		titleRepLabel.Text = cachedTitle;
	} else {
		titleRepLabel.Text = cachedReputation;
	}
}

function updateWeapon(weaponId: string | undefined): void {
	const id = weaponId !== undefined && weaponId !== "" ? weaponId : "fists";
	if (id === "fists") {
		if (weaponIconLabel) {
			weaponIconLabel.Text = "";
			weaponIconLabel.Visible = false;
		}
		if (weaponNameLabel) {
			weaponNameLabel.Text = "Unarmed";
			weaponNameLabel.TextColor3 = UI_THEME.textMuted;
		}
	} else {
		const def = WEAPONS[id];
		const wname = def !== undefined ? def.name : id;
		const wicon = def !== undefined ? def.icon : "/";
		if (weaponIconLabel) {
			weaponIconLabel.Text = wicon;
			weaponIconLabel.Visible = true;
		}
		if (weaponNameLabel) {
			weaponNameLabel.Text = wname;
			weaponNameLabel.TextColor3 = UI_THEME.textPrimary;
		}
	}
}

function updateReputation(fxp: FactionXP): void {
	cachedReputation = reputationLine(fxp);
	refreshTitleRepLine();
}

// -- Builder --------------------------------------------------------------------

function buildCharacterBanner(screenGui: ScreenGui): void {
	// Top-left banner -- anchored under Roblox system buttons
	const BANNER_W = sc(320);

	const banner = new Instance("Frame");
	banner.Name = "CharacterBanner";
	banner.Size = new UDim2(0, BANNER_W, 0, 0);
	banner.AutomaticSize = Enum.AutomaticSize.Y;
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

	const layout = new Instance("UIListLayout");
	layout.SortOrder = Enum.SortOrder.LayoutOrder;
	layout.Padding = new UDim(0, sc(3));
	layout.Parent = banner;

	// ---- Line 1: Player name + gold total ----------------------------------
	// Name fills the left; gold value is pinned to the right edge of the row.
	// A +N / -N floater spawns from the gold label position on every change.
	const GOLD_W = sc(72);

	nameRow = new Instance("Frame");
	nameRow.Name = "NameRow";
	nameRow.LayoutOrder = 0;
	nameRow.Size = new UDim2(1, 0, 0, sc(30));
	nameRow.BackgroundTransparency = 1;
	nameRow.ZIndex = 31;
	nameRow.ClipsDescendants = false;
	nameRow.Parent = banner;

	nameLabel = new Instance("TextLabel");
	nameLabel.Name = "Name";
	nameLabel.Size = new UDim2(1, -GOLD_W - sc(6), 1, 0);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.Text = "---";
	nameLabel.TextColor3 = UI_THEME.textPrimary;
	nameLabel.Font = UI_THEME.fontDisplay;
	nameLabel.TextSize = sc(26);
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

	// ---- Line 2: Title - Reputation (combined) -----------------------------
	titleRepLabel = new Instance("TextLabel");
	titleRepLabel.Name = "TitleRep";
	titleRepLabel.LayoutOrder = 1;
	titleRepLabel.Size = new UDim2(1, 0, 0, sc(20));
	titleRepLabel.BackgroundTransparency = 1;
	titleRepLabel.Text = "";
	titleRepLabel.TextColor3 = UI_THEME.textSection;
	titleRepLabel.Font = UI_THEME.fontBold;
	titleRepLabel.TextSize = sc(16);
	titleRepLabel.TextXAlignment = Enum.TextXAlignment.Left;
	titleRepLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	titleRepLabel.ZIndex = 31;
	titleRepLabel.Parent = banner;

	// ---- Divider line -------------------------------------------------------
	const divider = new Instance("Frame");
	divider.Name = "Divider";
	divider.LayoutOrder = 2;
	divider.Size = new UDim2(1, 0, 0, sc(1));
	divider.BackgroundColor3 = UI_THEME.divider;
	divider.BackgroundTransparency = 0.4;
	divider.BorderSizePixel = 0;
	divider.ZIndex = 31;
	divider.Parent = banner;

	// ---- Line 3: Weapon (icon + name) --------------------------------------
	const weaponRow = new Instance("Frame");
	weaponRow.Name = "WeaponRow";
	weaponRow.LayoutOrder = 3;
	weaponRow.Size = new UDim2(1, 0, 0, sc(22));
	weaponRow.BackgroundTransparency = 1;
	weaponRow.ZIndex = 31;
	weaponRow.Parent = banner;

	weaponIconLabel = new Instance("TextLabel");
	weaponIconLabel.Name = "WeaponIcon";
	weaponIconLabel.Size = new UDim2(0, sc(18), 1, 0);
	weaponIconLabel.BackgroundTransparency = 1;
	weaponIconLabel.Text = "";
	weaponIconLabel.TextColor3 = UI_THEME.textHeader;
	weaponIconLabel.Font = UI_THEME.fontDisplay;
	weaponIconLabel.TextSize = sc(16);
	weaponIconLabel.TextXAlignment = Enum.TextXAlignment.Center;
	weaponIconLabel.Visible = false;
	weaponIconLabel.ZIndex = 31;
	weaponIconLabel.Parent = weaponRow;

	weaponNameLabel = new Instance("TextLabel");
	weaponNameLabel.Name = "WeaponName";
	weaponNameLabel.Size = new UDim2(1, sc(-20), 1, 0);
	weaponNameLabel.Position = new UDim2(0, sc(20), 0, 0);
	weaponNameLabel.BackgroundTransparency = 1;
	weaponNameLabel.Text = "Unarmed";
	weaponNameLabel.TextColor3 = UI_THEME.textMuted;
	weaponNameLabel.Font = UI_THEME.fontBold;
	weaponNameLabel.TextSize = sc(16);
	weaponNameLabel.TextXAlignment = Enum.TextXAlignment.Left;
	weaponNameLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	weaponNameLabel.ZIndex = 31;
	weaponNameLabel.Parent = weaponRow;
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
	const bar = new Instance("Frame");
	bar.Name = "ActiveEffectsBar";
	// Pinned below the banner's bottom-left corner. The banner uses
	// AutomaticSize.Y so we follow its AbsoluteSize each frame.
	bar.AnchorPoint = new Vector2(0, 0);
	bar.Position = new UDim2(0, sc(20), 0, sc(40));
	bar.Size = new UDim2(0, sc(EFFECT_TILE_SIZE * 6 + EFFECT_TILE_GAP * 5), 0, sc(EFFECT_TILE_SIZE));
	bar.BackgroundTransparency = 1;
	bar.BorderSizePixel = 0;
	bar.ZIndex = 30;
	bar.Parent = screenGui;

	const layout = new Instance("UIListLayout");
	layout.FillDirection = Enum.FillDirection.Horizontal;
	layout.SortOrder = Enum.SortOrder.LayoutOrder;
	layout.Padding = new UDim(0, sc(EFFECT_TILE_GAP));
	layout.Parent = bar;

	effectsBar = bar;

	// Reposition the bar to sit just below the banner whenever the banner resizes.
	const reposition = (): void => {
		const bSize = banner.AbsoluteSize;
		const bPos = banner.AbsolutePosition;
		bar.Position = new UDim2(0, bPos.X, 0, bPos.Y + bSize.Y + sc(6));
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
	tile.LayoutOrder = slotKey === "elixir" ? 0 : 1;
	tile.Size = new UDim2(0, sc(EFFECT_TILE_SIZE), 0, sc(EFFECT_TILE_SIZE));
	tile.BackgroundColor3 = rarityBg;
	tile.BackgroundTransparency = 0.05;
	tile.BorderSizePixel = 0;
	tile.ZIndex = 31;
	tile.Parent = effectsBar;

	const c = new Instance("UICorner");
	c.CornerRadius = new UDim(0, 4);
	c.Parent = tile;

	const s = new Instance("UIStroke");
	s.Color = rarityColor;
	s.Thickness = 1.2;
	s.Parent = tile;

	const icon = new Instance("TextLabel");
	icon.Name = "Icon";
	icon.Size = new UDim2(1, 0, 1, -sc(10));
	icon.BackgroundTransparency = 1;
	icon.Text = def ? def.icon : "?";
	icon.TextColor3 = rarityColor;
	icon.Font = UI_THEME.fontDisplay;
	icon.TextSize = sc(20);
	icon.ZIndex = 32;
	icon.Parent = tile;

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
		const elapsed = os.clock() - slot.lastSyncClock;
		const remaining = math.max(0, slot.remainingSecs - elapsed);
		effectsTTCountdown.Text = "Time left: " + formatRemaining(remaining);
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

function tickEffectTiles(): void {
	const now = os.clock();
	for (const [key, slot] of activeEffects) {
		const tile = effectTiles.get(key);
		if (!tile) continue;
		const elapsed = now - slot.lastSyncClock;
		const remaining = math.max(0, slot.remainingSecs - elapsed);
		const cd = tile.FindFirstChild("Countdown") as TextLabel | undefined;
		if (cd) cd.Text = formatRemaining(remaining);
	}
	if (hoveredEffectKey !== undefined && effectsTTCountdown) {
		const slot = activeEffects.get(hoveredEffectKey);
		if (slot) {
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
	const initFactionXP = GetFactionXP.InvokeServer() as FactionXP;

	if (nameLabel) nameLabel.Text = initName;
	cachedTitle = initTitle;
	cachedReputation = reputationLine(initFactionXP);
	refreshTitleRepLine();

	// Initial weapon state
	const initWeapon = Players.LocalPlayer.GetAttribute("EquippedWeapon") as string | undefined;
	updateWeapon(initWeapon);

	// Live weapon changes
	Players.LocalPlayer.GetAttributeChangedSignal("EquippedWeapon").Connect(() => {
		const wId = Players.LocalPlayer.GetAttribute("EquippedWeapon") as string | undefined;
		updateWeapon(wId);
	});

	// Faction XP updates
	FactionXPUpdated.OnClientEvent.Connect((fxp) => {
		updateReputation(fxp as FactionXP);
	});

	// Initial gold + live updates (delta floater on every change).
	const initCoins = GetCoins.InvokeServer() as number;
	setGold(initCoins, false);
	CoinsUpdated.OnClientEvent.Connect((newTotalRaw: unknown) => {
		setGold(newTotalRaw as number, true);
	});
});
