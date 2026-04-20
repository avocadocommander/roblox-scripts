import { Players, ReplicatedStorage } from "@rbxts/services";
import { onPlayerInitialized } from "../modules/client-init";
import { UI_THEME, getUIScale } from "shared/ui-theme";
import { WEAPONS } from "shared/config/weapons";
import { FactionXP, FACTION_IDS, levelFromXP } from "shared/config/factions";

const playerState = ReplicatedStorage.WaitForChild("PlayerState") as Folder;
const GetPlayerTitle = playerState.WaitForChild("GetTitle") as RemoteFunction;
const GetPlayerName = playerState.WaitForChild("GetName") as RemoteFunction;
const GetFactionXP = playerState.WaitForChild("GetFactionXP") as RemoteFunction;
const FactionXPUpdated = playerState.WaitForChild("FactionXPUpdated") as RemoteEvent;

// -- Scaling --------------------------------------------------------------------

function sc(baseSize: number): number {
	return baseSize * getUIScale();
}

// -- Live refs ------------------------------------------------------------------

let nameLabel: TextLabel | undefined;
let titleRepLabel: TextLabel | undefined;
let weaponIconLabel: TextLabel | undefined;
let weaponNameLabel: TextLabel | undefined;

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

	// ---- Line 1: Player name (largest text) --------------------------------
	nameLabel = new Instance("TextLabel");
	nameLabel.Name = "Name";
	nameLabel.LayoutOrder = 0;
	nameLabel.Size = new UDim2(1, 0, 0, sc(30));
	nameLabel.BackgroundTransparency = 1;
	nameLabel.Text = "---";
	nameLabel.TextColor3 = UI_THEME.textPrimary;
	nameLabel.Font = UI_THEME.fontDisplay;
	nameLabel.TextSize = sc(26);
	nameLabel.TextXAlignment = Enum.TextXAlignment.Left;
	nameLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	nameLabel.ZIndex = 31;
	nameLabel.Parent = banner;

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
});
