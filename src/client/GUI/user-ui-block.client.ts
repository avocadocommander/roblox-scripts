import { Players, ReplicatedStorage, TweenService } from "@rbxts/services";
import { onPlayerInitialized } from "../modules/client-init";
import { UI_THEME, getUIScale } from "shared/ui-theme";
import { WEAPONS } from "shared/config/weapons";
import { FactionXP, FACTION_IDS, levelFromXP } from "shared/config/factions";

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

// -- Init -----------------------------------------------------------------------

onPlayerInitialized(() => {
	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

	buildCharacterBanner(screenGui);

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
