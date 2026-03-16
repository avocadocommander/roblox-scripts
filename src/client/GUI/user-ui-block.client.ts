import { Players, ReplicatedStorage, TweenService, UserInputService, Workspace } from "@rbxts/services";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";
import {
	getBountyListSyncRemote,
	getPlayerWantedClearedRemote,
	getPlayerWantedRemote,
	PlayerWantedPayload,
} from "shared/remotes/bounty-remote";
import { getOrCreateMovementRemote } from "shared/remotes/movement-remote";
import { getPlaceCampfireRemote } from "shared/remotes/campfire-remote";
import { UI_THEME, getUIScale } from "shared/ui-theme";

const playerState = ReplicatedStorage.WaitForChild("PlayerState") as Folder;
const GetPlayerExpierence = playerState.WaitForChild("GetExpierence") as RemoteFunction;
const GetPlayerTitle = playerState.WaitForChild("GetTitle") as RemoteFunction;
const GetPlayerName = playerState.WaitForChild("GetName") as RemoteFunction;
const GetPlayerLevel = playerState.WaitForChild("GetLevel") as RemoteFunction;
const GetCoins = playerState.WaitForChild("GetCoins") as RemoteFunction;
const CoinsUpdated = playerState.WaitForChild("CoinsUpdated") as RemoteEvent;
const ExpierenceUpdated = playerState.WaitForChild("ExpierenceUpdated") as RemoteEvent;
const LevelUpdated = playerState.WaitForChild("LevelUpdated") as RemoteEvent;

// NPC visibility — fires from server whenever an NPC starts/stops seeing this player
const npcStateFolder = ReplicatedStorage.WaitForChild("NPCState") as Folder;
const ViewsUpdated = npcStateFolder.WaitForChild("ViewsUpdated") as RemoteEvent;

const lifecycle = getOrCreateLifecycleRemote();

// ── Screen ratio scaling helpers ──────────────────────────────────────────────

function scaleSize(baseSize: number): number {
	return baseSize * getUIScale();
}

// ─────────────────────────────────────────────────────────────────────────────

// ── Live label refs — set once in buildPlayerPanel, updated by events
let nameLabel: TextLabel | undefined;
let titleLabel: TextLabel | undefined;
let levelLabel: TextLabel | undefined;
let coinsLabel: TextLabel | undefined;
let xpBar: Frame | undefined;
let xpFill: Frame | undefined;
let wantedRow: Frame | undefined;
let wantedGoldLabel: TextLabel | undefined;
let eyeWidget: Frame | undefined;
let eyeCountLabel: TextLabel | undefined;
let lastViewerCount = 0;
let sneakButton: TextButton | undefined;
let isStealthMode = false;
let campfireButton: TextButton | undefined;
let campfireOnCooldown = false;
const CAMPFIRE_COOLDOWN = 2; // seconds

const XP_PER_LEVEL = 1000;

// ── Builder ───────────────────────────────────────────────────────────────────

function buildPlayerPanel(screenGui: ScreenGui): void {
	// Outer panel — bottom-left
	const panel = new Instance("Frame");
	panel.Name = "PlayerHUD";
	const baseWidth = 260;
	const scaledWidth = scaleSize(baseWidth);
	panel.Size = new UDim2(0, scaledWidth, 0, 0);
	panel.Position = new UDim2(0, 12, 1, -12);
	panel.AnchorPoint = new Vector2(0, 1);
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

	const outerPad = new Instance("UIPadding");
	outerPad.PaddingTop = new UDim(0, scaleSize(10));
	outerPad.PaddingBottom = new UDim(0, scaleSize(10));
	outerPad.PaddingLeft = new UDim(0, scaleSize(12));
	outerPad.PaddingRight = new UDim(0, scaleSize(12));
	outerPad.Parent = panel;

	const layout = new Instance("UIListLayout");
	layout.SortOrder = Enum.SortOrder.LayoutOrder;
	layout.Padding = new UDim(0, scaleSize(5));
	layout.Parent = panel;

	// ── Name + title row ───────────────────────────────────────────────────
	const nameRow = new Instance("Frame");
	nameRow.LayoutOrder = 0;
	nameRow.Size = new UDim2(1, 0, 0, scaleSize(44));
	nameRow.BackgroundTransparency = 1;
	nameRow.Parent = panel;

	nameLabel = new Instance("TextLabel");
	nameLabel.Name = "PlayerName";
	nameLabel.Size = new UDim2(0.68, 0, 0, scaleSize(26));
	nameLabel.Position = new UDim2(0, 0, 0, 0);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.Text = "—";
	nameLabel.TextColor3 = UI_THEME.textPrimary;
	nameLabel.Font = UI_THEME.fontDisplay;
	nameLabel.TextSize = scaleSize(22);
	nameLabel.TextXAlignment = Enum.TextXAlignment.Left;
	nameLabel.Parent = nameRow;

	// ── Eye / visibility indicator (right side of name, stealth-only) ───
	const eyeFrame = new Instance("Frame");
	eyeFrame.Name = "EyeIndicator";
	eyeFrame.Size = new UDim2(0.32, scaleSize(-4), 0, scaleSize(20));
	eyeFrame.Position = new UDim2(0.68, scaleSize(4), 0, scaleSize(1));
	eyeFrame.BackgroundColor3 = UI_THEME.bgInset;
	eyeFrame.BackgroundTransparency = 0.1;
	eyeFrame.BorderSizePixel = 0;
	eyeFrame.Visible = false; // hidden until stealth active
	eyeFrame.Parent = nameRow;
	eyeWidget = eyeFrame;

	const eyeCorner = new Instance("UICorner");
	eyeCorner.CornerRadius = new UDim(0, scaleSize(3));
	eyeCorner.Parent = eyeFrame;

	const eyeStroke = new Instance("UIStroke");
	eyeStroke.Color = UI_THEME.textMuted;
	eyeStroke.Thickness = scaleSize(0.8);
	eyeStroke.Parent = eyeFrame;

	const eyeLabel = new Instance("TextLabel");
	eyeLabel.Name = "EyeCount";
	eyeLabel.Size = new UDim2(1, 0, 1, 0);
	eyeLabel.BackgroundTransparency = 1;
	eyeLabel.Text = "👁 0";
	eyeLabel.TextColor3 = UI_THEME.textMuted;
	eyeLabel.Font = UI_THEME.fontBold;
	eyeLabel.TextSize = scaleSize(13);
	eyeLabel.Parent = eyeFrame;
	eyeCountLabel = eyeLabel;

	titleLabel = new Instance("TextLabel");
	titleLabel.Name = "PlayerTitle";
	titleLabel.Size = new UDim2(1, 0, 0, scaleSize(16));
	titleLabel.Position = new UDim2(0, 0, 0, scaleSize(27));
	titleLabel.BackgroundTransparency = 1;
	titleLabel.Text = "";
	titleLabel.TextColor3 = UI_THEME.textSection;
	titleLabel.Font = UI_THEME.fontBold;
	titleLabel.TextSize = scaleSize(13);
	titleLabel.TextXAlignment = Enum.TextXAlignment.Left;
	titleLabel.Parent = nameRow;

	// ── Wanted badge (hidden until player breaks the law) ───────────────
	const wantedRowFrame = new Instance("Frame");
	wantedRowFrame.Name = "WantedBadge";
	wantedRowFrame.LayoutOrder = 1;
	wantedRowFrame.Size = new UDim2(1, 0, 0, scaleSize(22));
	wantedRowFrame.BackgroundColor3 = UI_THEME.danger;
	wantedRowFrame.BackgroundTransparency = 0.4;
	wantedRowFrame.BorderSizePixel = 0;
	wantedRowFrame.Visible = false;
	wantedRowFrame.Parent = panel;
	wantedRow = wantedRowFrame;

	const wantedCorner = new Instance("UICorner");
	wantedCorner.CornerRadius = new UDim(0, scaleSize(3));
	wantedCorner.Parent = wantedRowFrame;

	const wantedBadgePad = new Instance("UIPadding");
	wantedBadgePad.PaddingLeft = new UDim(0, scaleSize(6));
	wantedBadgePad.PaddingRight = new UDim(0, scaleSize(6));
	wantedBadgePad.Parent = wantedRowFrame;

	const wantedTitleLabel = new Instance("TextLabel");
	wantedTitleLabel.Size = new UDim2(0.55, 0, 1, 0);
	wantedTitleLabel.BackgroundTransparency = 1;
	wantedTitleLabel.Text = "⚑  WANTED";
	wantedTitleLabel.TextColor3 = UI_THEME.textPrimary;
	wantedTitleLabel.Font = UI_THEME.fontBold;
	wantedTitleLabel.TextSize = scaleSize(13);
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
	wantedGoldLabel.TextSize = scaleSize(13);
	wantedGoldLabel.TextXAlignment = Enum.TextXAlignment.Right;
	wantedGoldLabel.Parent = wantedRowFrame;

	// ── Divider ───────────────────────────────────────────────────────────
	const divider = new Instance("Frame");
	divider.LayoutOrder = 2;
	divider.Size = new UDim2(1, 0, 0, scaleSize(1));
	divider.BackgroundColor3 = UI_THEME.divider;
	divider.BackgroundTransparency = 0;
	divider.BorderSizePixel = 0;
	divider.Parent = panel;

	// ── Stats row (level | coins) ─────────────────────────────────────────
	const statsRow = new Instance("Frame");
	statsRow.LayoutOrder = 3;
	statsRow.Size = new UDim2(1, 0, 0, scaleSize(22));
	statsRow.BackgroundTransparency = 1;
	statsRow.Parent = panel;

	// Level — left side
	const lvlCap = new Instance("TextLabel");
	lvlCap.Size = new UDim2(0.18, 0, 1, 0);
	lvlCap.BackgroundTransparency = 1;
	lvlCap.Text = "LVL";
	lvlCap.TextColor3 = UI_THEME.textSection;
	lvlCap.Font = UI_THEME.fontBold;
	lvlCap.TextSize = scaleSize(12);
	lvlCap.TextXAlignment = Enum.TextXAlignment.Left;
	lvlCap.TextYAlignment = Enum.TextYAlignment.Center;
	lvlCap.Parent = statsRow;

	levelLabel = new Instance("TextLabel");
	levelLabel.Name = "LevelValue";
	levelLabel.Size = new UDim2(0.22, 0, 1, 0);
	levelLabel.Position = new UDim2(0.18, 0, 0, 0);
	levelLabel.BackgroundTransparency = 1;
	levelLabel.Text = "1";
	levelLabel.TextColor3 = UI_THEME.textPrimary;
	levelLabel.Font = UI_THEME.fontDisplay;
	levelLabel.TextSize = scaleSize(18);
	levelLabel.TextXAlignment = Enum.TextXAlignment.Left;
	levelLabel.Parent = statsRow;

	// Coins — right side
	const coinCap = new Instance("TextLabel");
	coinCap.Size = new UDim2(0.12, 0, 1, 0);
	coinCap.Position = new UDim2(0.44, 0, 0, 0);
	coinCap.BackgroundTransparency = 1;
	coinCap.Text = "🪙";
	coinCap.TextColor3 = UI_THEME.gold;
	coinCap.Font = UI_THEME.fontBold;
	coinCap.TextSize = scaleSize(14);
	coinCap.TextXAlignment = Enum.TextXAlignment.Left;
	coinCap.TextYAlignment = Enum.TextYAlignment.Center;
	coinCap.Parent = statsRow;

	coinsLabel = new Instance("TextLabel");
	coinsLabel.Name = "CoinsValue";
	coinsLabel.Size = new UDim2(0.44, 0, 1, 0);
	coinsLabel.Position = new UDim2(0.56, 0, 0, 0);
	coinsLabel.BackgroundTransparency = 1;
	coinsLabel.Text = "0";
	coinsLabel.TextColor3 = UI_THEME.gold;
	coinsLabel.Font = UI_THEME.fontDisplay;
	coinsLabel.TextSize = scaleSize(17);
	coinsLabel.TextXAlignment = Enum.TextXAlignment.Left;
	coinsLabel.Parent = statsRow;

	// ── XP bar ────────────────────────────────────────────────────────────────
	const xpRow = new Instance("Frame");
	xpRow.LayoutOrder = 4;
	xpRow.Size = new UDim2(1, 0, 0, scaleSize(18));
	xpRow.BackgroundTransparency = 1;
	xpRow.Parent = panel;

	const xpCap = new Instance("TextLabel");
	xpCap.Size = new UDim2(0.18, 0, 1, 0);
	xpCap.BackgroundTransparency = 1;
	xpCap.Text = "XP";
	xpCap.TextColor3 = UI_THEME.textSection;
	xpCap.Font = UI_THEME.fontBold;
	xpCap.TextSize = scaleSize(12);
	xpCap.TextXAlignment = Enum.TextXAlignment.Left;
	xpCap.TextYAlignment = Enum.TextYAlignment.Center;
	xpCap.Parent = xpRow;

	xpBar = new Instance("Frame");
	xpBar.Size = new UDim2(0.82, 0, 0, scaleSize(8));
	xpBar.Position = new UDim2(0.18, 0, 0.5, scaleSize(-4));
	xpBar.BackgroundColor3 = UI_THEME.bgInset;
	xpBar.BackgroundTransparency = 0;
	xpBar.BorderSizePixel = 0;
	xpBar.Parent = xpRow;

	const xpBarCorner = new Instance("UICorner");
	xpBarCorner.CornerRadius = new UDim(1, 0);
	xpBarCorner.Parent = xpBar;

	xpFill = new Instance("Frame");
	xpFill.Name = "Fill";
	xpFill.Size = new UDim2(0, 0, 1, 0);
	xpFill.BackgroundColor3 = UI_THEME.border; // tarnished brass fill
	xpFill.BackgroundTransparency = 0;
	xpFill.BorderSizePixel = 0;
	xpFill.Parent = xpBar;

	const fillCorner = new Instance("UICorner");
	fillCorner.CornerRadius = new UDim(1, 0);
	fillCorner.Parent = xpFill;
}

// ── Update helpers ─────────────────────────────────────────────────────────────

function buildSneakButton(screenGui: ScreenGui): void {
	const buttonSize = scaleSize(50);
	const buttonPadding = scaleSize(12);

	// Container for the button
	const buttonContainer = new Instance("Frame");
	buttonContainer.Name = "SneakButtonContainer";
	buttonContainer.Size = new UDim2(0, buttonSize, 0, buttonSize);
	buttonContainer.Position = new UDim2(1, -buttonSize - buttonPadding, 1, -buttonSize - buttonPadding);
	buttonContainer.AnchorPoint = new Vector2(1, 1);
	buttonContainer.BackgroundTransparency = 1;
	buttonContainer.Parent = screenGui;

	// The actual button
	sneakButton = new Instance("TextButton");
	sneakButton.Name = "SneakButton";
	sneakButton.Size = new UDim2(1, 0, 1, 0);
	sneakButton.BackgroundColor3 = UI_THEME.bgInset;
	sneakButton.BackgroundTransparency = 0.2;
	sneakButton.BorderSizePixel = 0;
	sneakButton.Text = "🥷";
	sneakButton.TextColor3 = UI_THEME.textMuted;
	sneakButton.Font = UI_THEME.fontBold;
	sneakButton.TextSize = scaleSize(24);
	sneakButton.Parent = buttonContainer;

	// Rounded corners for sneak button
	const buttonCorner = new Instance("UICorner");
	buttonCorner.CornerRadius = new UDim(0.5, 0);
	buttonCorner.Parent = sneakButton;

	// Border stroke
	const buttonStroke = new Instance("UIStroke");
	buttonStroke.Color = UI_THEME.textMuted;
	buttonStroke.Thickness = scaleSize(1.5);
	buttonStroke.Parent = sneakButton;

	// Mouse hover effects
	let isHovering = false;

	sneakButton.MouseEnter.Connect(() => {
		isHovering = true;
		sneakButton!.BackgroundTransparency = 0;
		const stroke = sneakButton!.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
		if (stroke) {
			stroke.Color = UI_THEME.textPrimary;
		}
	});

	sneakButton.MouseLeave.Connect(() => {
		isHovering = false;
		if (!isStealthMode) {
			sneakButton!.BackgroundTransparency = 0.2;
			const stroke = sneakButton!.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
			if (stroke) {
				stroke.Color = UI_THEME.textMuted;
			}
		}
	});

	// Click to toggle stealth
	sneakButton.Activated.Connect(() => {
		toggleSneak();
	});
}

function buildCampfireButton(screenGui: ScreenGui): void {
	const buttonSize = scaleSize(50);
	const buttonPadding = scaleSize(12);
	const sneak_button_width = buttonSize + buttonPadding; // Account for sneak button

	// Container for the button (to the left of sneak button)
	const buttonContainer = new Instance("Frame");
	buttonContainer.Name = "CampfireButtonContainer";
	buttonContainer.Size = new UDim2(0, buttonSize, 0, buttonSize);
	buttonContainer.Position = new UDim2(1, -(sneak_button_width * 2) - buttonPadding, 1, -buttonSize - buttonPadding);
	buttonContainer.AnchorPoint = new Vector2(1, 1);
	buttonContainer.BackgroundTransparency = 1;
	buttonContainer.Parent = screenGui;

	// The actual button
	campfireButton = new Instance("TextButton");
	campfireButton.Name = "CampfireButton";
	campfireButton.Size = new UDim2(1, 0, 1, 0);
	campfireButton.BackgroundColor3 = UI_THEME.bgInset;
	campfireButton.BackgroundTransparency = 0.2;
	campfireButton.BorderSizePixel = 0;
	campfireButton.Text = "🔥";
	campfireButton.TextColor3 = UI_THEME.textMuted;
	campfireButton.Font = UI_THEME.fontBold;
	campfireButton.TextSize = scaleSize(24);
	campfireButton.Parent = buttonContainer;

	// Rounded corners for campfire button
	const buttonCorner = new Instance("UICorner");
	buttonCorner.CornerRadius = new UDim(0.5, 0);
	buttonCorner.Parent = campfireButton;

	// Border stroke
	const buttonStroke = new Instance("UIStroke");
	buttonStroke.Color = UI_THEME.gold;
	buttonStroke.Thickness = scaleSize(1.5);
	buttonStroke.Parent = campfireButton;

	// Mouse hover effects
	campfireButton.MouseEnter.Connect(() => {
		if (!campfireOnCooldown) {
			campfireButton!.BackgroundTransparency = 0;
			const stroke = campfireButton!.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
			if (stroke) {
				stroke.Color = UI_THEME.danger;
			}
		}
	});

	campfireButton.MouseLeave.Connect(() => {
		if (!campfireOnCooldown) {
			campfireButton!.BackgroundTransparency = 0.2;
			const stroke = campfireButton!.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
			if (stroke) {
				stroke.Color = UI_THEME.gold;
			}
		}
	});

	// Click to place campfire
	campfireButton.Activated.Connect(() => {
		placeCampfire();
	});
}

function placeCampfire(): void {
	if (campfireOnCooldown) return;

	const player = Players.LocalPlayer;
	const character = player.Character;
	if (!character || !character.PrimaryPart) return;

	// Position + look direction so the server can toss the campfire forward
	const hrp = character.PrimaryPart;
	const campfirePos = hrp.Position;
	const lookDir = hrp.CFrame.LookVector;

	const campfireRemote = getPlaceCampfireRemote();
	campfireRemote.FireServer(campfirePos, lookDir);

	// Start cooldown
	campfireOnCooldown = true;
	if (campfireButton) {
		campfireButton.BackgroundTransparency = 0.5;
		const stroke = campfireButton.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
		if (stroke) {
			stroke.Color = UI_THEME.textMuted;
		}
	}

	// Cooldown timer
	let cooldownRemaining = CAMPFIRE_COOLDOWN;
	const cooldownLabel = campfireButton?.FindFirstChild("CooldownLabel") as TextLabel;

	const updateCooldown = () => {
		if (campfireButton && cooldownRemaining > 0) {
			if (!cooldownLabel) {
				const label = new Instance("TextLabel");
				label.Name = "CooldownLabel";
				label.Size = new UDim2(1, 0, 1, 0);
				label.BackgroundTransparency = 1;
				label.TextColor3 = UI_THEME.danger;
				label.Font = UI_THEME.fontBold;
				label.TextSize = scaleSize(14);
				label.Parent = campfireButton;
			}
		}
		cooldownRemaining -= 0.1;
		if (cooldownRemaining <= 0) {
			campfireOnCooldown = false;
			campfireButton!.BackgroundTransparency = 0.2;
			const stroke = campfireButton!.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
			if (stroke) {
				stroke.Color = UI_THEME.gold;
			}
			const label = campfireButton!.FindFirstChild("CooldownLabel") as TextLabel | undefined;
			if (label) label.Destroy();
		}
	};

	for (let i = 0; i < CAMPFIRE_COOLDOWN * 10; i++) {
		task.delay(i * 0.1, () => {
			updateCooldown();
		});
	}
}

function toggleSneak(): void {
	isStealthMode = !isStealthMode;
	print(`[SNEAK BUTTON] Toggling stealth mode: ${isStealthMode}`);

	if (!sneakButton) return;

	// Update button appearance
	const btnStroke = sneakButton.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
	const targetColor = isStealthMode ? UI_THEME.danger : UI_THEME.textMuted;
	const targetTransparency = isStealthMode ? 0.1 : 0.2;

	if (btnStroke) {
		btnStroke.Color = targetColor;
	}

	sneakButton.BackgroundTransparency = targetTransparency;

	// Set the attribute so other systems know about stealth state
	Players.LocalPlayer.SetAttribute("IsStealthing", isStealthMode);

	// Fire the movement remote to toggle on server
	const movementRemote = getOrCreateMovementRemote();
	movementRemote.FireServer(isStealthMode ? "Stealth" : "Walk");
}

function setXP(xp: number) {
	if (!xpFill || !xpBar) return;
	const progress = math.clamp((xp % XP_PER_LEVEL) / XP_PER_LEVEL, 0, 1);
	TweenService.Create(xpFill, new TweenInfo(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Size: new UDim2(progress, 0, 1, 0),
	}).Play();
}

/** Show the WANTED badge and tint the player's name red. */
function setWanted(gold: number): void {
	if (!wantedRow || !wantedGoldLabel) return;
	wantedGoldLabel.Text = gold + " " + "🪙";
	wantedRow.Visible = true;
	if (nameLabel) nameLabel.TextColor3 = UI_THEME.danger;
	if (titleLabel) titleLabel.TextColor3 = UI_THEME.danger;
}

/** Hide the WANTED badge and restore the player's name colour. */
function clearWanted(): void {
	if (wantedRow) wantedRow.Visible = false;
	if (nameLabel) nameLabel.TextColor3 = UI_THEME.textPrimary;
	if (titleLabel) titleLabel.TextColor3 = UI_THEME.textSection;
}

/** Update the eye indicator count. Always runs — widget may be hidden. */
function setEyeCount(viewers: string[]): void {
	// Guard: viewers can arrive as nil from the remote if no one has been added yet
	if (viewers === undefined || viewers.size() === 0) {
		lastViewerCount = 0;
	} else {
		lastViewerCount = viewers.size();
	}
	print("[EYE] ViewsUpdated received, count=", lastViewerCount);
	if (!eyeCountLabel || !eyeWidget) return;
	// Always keep label text up-to-date even if widget is hidden — when stealth
	// is toggled on the correct count will already be in the label.
	const isSpotted = lastViewerCount > 0;
	eyeCountLabel.Text = "Eye: " + lastViewerCount;
	eyeCountLabel.TextColor3 = isSpotted ? UI_THEME.danger : UI_THEME.textMuted;
	const stroke = eyeWidget.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
	if (stroke !== undefined) stroke.Color = isSpotted ? UI_THEME.danger : UI_THEME.textMuted;
}

/** Show or hide the eye indicator based on stealth state. */
function setEyeStealth(stealthing: boolean): void {
	if (!eyeWidget) return;
	eyeWidget.Visible = stealthing;
	// Label is always kept current by setEyeCount, nothing extra to do
}

// ── Init ───────────────────────────────────────────────────────────────────────

lifecycle.OnClientEvent.Connect((message: string) => {
	if (message !== "InitializePlayer") return;

	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

	buildPlayerPanel(screenGui);
	buildSneakButton(screenGui);
	buildCampfireButton(screenGui);

	// Fetch initial values from server
	const initXP = GetPlayerExpierence.InvokeServer() as number;
	const initTitle = GetPlayerTitle.InvokeServer() as string;
	const initName = GetPlayerName.InvokeServer() as string;
	const initLevel = GetPlayerLevel.InvokeServer() as number;
	const initCoins = GetCoins.InvokeServer() as number;

	if (nameLabel) nameLabel.Text = initName;
	if (titleLabel) titleLabel.Text = initTitle.upper();
	if (levelLabel) levelLabel.Text = `${initLevel}`;
	if (coinsLabel) coinsLabel.Text = `${initCoins}`;
	setXP(initXP);

	// Live updates
	ExpierenceUpdated.OnClientEvent.Connect((xp: number) => {
		setXP(xp);
	});

	LevelUpdated.OnClientEvent.Connect((level: number) => {
		if (levelLabel) levelLabel.Text = `${level}`;
	});

	CoinsUpdated.OnClientEvent.Connect((coins: number) => {
		if (coinsLabel) coinsLabel.Text = `${coins}`;
	});

	// Wanted status — fires to ALL clients so we check if it's us
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

	// Initial full-state sync (handles rejoining while already wanted)
	getBountyListSyncRemote().OnClientEvent.Connect((_npcBounty: unknown, wanted: unknown) => {
		for (const entry of wanted as PlayerWantedPayload[]) {
			if (entry.playerName === Players.LocalPlayer.Name) {
				setWanted(entry.gold);
				break;
			}
		}
	});

	// Eye indicator — NPC visibility updates from server
	ViewsUpdated.OnClientEvent.Connect((viewers: unknown) => {
		print("[EYE] ViewsUpdated event fired on client, raw viewers:", viewers);
		setEyeCount((viewers ?? []) as string[]);
	});

	// Eye indicator — show/hide when stealth is toggled (Q key or sneak button sets this attribute)
	Players.LocalPlayer.GetAttributeChangedSignal("IsStealthing").Connect(() => {
		const stealthing = Players.LocalPlayer.GetAttribute("IsStealthing") as boolean | undefined;
		const stealthState = stealthing === true;
		setEyeStealth(stealthState);
		isStealthMode = stealthState;
		updateButtonStateFromAttribute();
	});

	// Support Q key for stealth toggle (syncs with button)
	UserInputService.InputBegan.Connect((input, gameProcessed) => {
		if (gameProcessed) return;
		if (input.KeyCode === Enum.KeyCode.Q) {
			toggleSneak();
		} else if (input.KeyCode === Enum.KeyCode.Z) {
			placeCampfire();
		}
	});
});

function updateButtonStateFromAttribute(): void {
	if (!sneakButton) return;
	const btnStroke = sneakButton.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
	const targetColor = isStealthMode ? UI_THEME.danger : UI_THEME.textMuted;
	const targetTransparency = isStealthMode ? 0.1 : 0.2;

	if (btnStroke) {
		btnStroke.Color = targetColor;
	}
	sneakButton.BackgroundTransparency = targetTransparency;
}
