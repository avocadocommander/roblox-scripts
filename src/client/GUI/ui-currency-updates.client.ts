import { Players, ReplicatedStorage, TweenService } from "@rbxts/services";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";
import { getAchievementUnlockedRemote } from "shared/remotes/achievement-remote";
import { UI_THEME } from "shared/ui-theme";

const playerState = ReplicatedStorage.WaitForChild("PlayerState") as Folder;
const ExpierenceUpdated = playerState.WaitForChild("ExpierenceUpdated") as RemoteEvent;
const LevelUpdated = playerState.WaitForChild("LevelUpdated") as RemoteEvent;
const CoinsUpdated = playerState.WaitForChild("CoinsUpdated") as RemoteEvent;

const lifecycle = getOrCreateLifecycleRemote();

// Track previous totals to derive deltas. -1 = not yet initialised, skip
// animation on the very first event (which would show the full saved total).
let prevCoins = -1;
let prevXP = -1;

// ── Core float-pop ────────────────────────────────────────────────────────────
// All animations are built entirely in code — no ReplicatedStorage templates.

/**
 * Spawns a text label near the bottom-left HUD that punches in then drifts
 * upward while fading out.
 *   pixelX / pixelY — pixel offset from the left / bottom of the screen.
 */
function spawnFloatPop(
	screenGui: ScreenGui,
	text: string,
	color: Color3,
	pixelX: number,
	pixelY: number,
	fontSize: number,
): void {
	const jX = math.random(-26, 26);
	const jY = math.random(-8, 8);
	const startOffsetY = -(pixelY + jY);
	const endOffsetY = startOffsetY - 74;

	const label = new Instance("TextLabel");
	label.Size = new UDim2(0, 180, 0, fontSize + 14);
	label.Position = new UDim2(0, pixelX + jX, 1, startOffsetY);
	label.AnchorPoint = new Vector2(0.5, 0.5);
	label.BackgroundTransparency = 1;
	label.Text = text;
	label.TextColor3 = color;
	label.TextTransparency = 0;
	label.TextStrokeColor3 = UI_THEME.bg;
	label.TextStrokeTransparency = 0;
	label.Font = UI_THEME.fontDisplay;
	label.TextSize = fontSize;
	label.ZIndex = 15;
	label.Parent = screenGui;

	// Phase 1 — punch in: snap to slightly larger …
	const punchIn = TweenService.Create(label, new TweenInfo(0.13, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
		TextSize: fontSize + 5,
	});
	// Phase 2 — settle: pull back to just below original size …
	const settle = TweenService.Create(label, new TweenInfo(0.09, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		TextSize: fontSize - 1,
	});
	// Phase 3 — drift up and fade out
	const floatUp = TweenService.Create(label, new TweenInfo(1.05, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Position: new UDim2(0, pixelX + jX, 1, endOffsetY),
		TextTransparency: 1,
		TextStrokeTransparency: 1,
	});

	punchIn.Play();
	punchIn.Completed.Once(() => {
		settle.Play();
		settle.Completed.Once(() => {
			floatUp.Play();
			floatUp.Completed.Once(() => label.Destroy());
		});
	});
}

// ── Coin gain ─────────────────────────────────────────────────────────────────

function showCoinGain(delta: number, screenGui: ScreenGui): void {
	// Tarnished gold, large, centred over the player HUD coin row
	spawnFloatPop(screenGui, "+" + delta + "g", UI_THEME.gold, 128, 148, 25);
}

// ── XP gain ───────────────────────────────────────────────────────────────────

function showXPGain(delta: number, screenGui: ScreenGui): void {
	// Dull amber, slightly smaller, spawns a touch higher than coins so they
	// don't perfectly overlap when both fire on the same assassination.
	spawnFloatPop(screenGui, "+" + delta + " xp", UI_THEME.textHeader, 128, 176, 18);
}

// ── Level up ─────────────────────────────────────────────────────────────────

function showLevelUp(level: number, screenGui: ScreenGui): void {
	// Dramatic dark vignette flash
	const flash = new Instance("Frame");
	flash.Size = new UDim2(1, 0, 1, 0);
	flash.BackgroundColor3 = UI_THEME.bg;
	flash.BackgroundTransparency = 0.42;
	flash.BorderSizePixel = 0;
	flash.ZIndex = 20;
	flash.Parent = screenGui;

	const flashFade = TweenService.Create(flash, new TweenInfo(1.1, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		BackgroundTransparency: 1,
	});
	flashFade.Play();
	flashFade.Completed.Once(() => flash.Destroy());

	// Card — starts small, scales to full size
	const card = new Instance("Frame");
	card.Size = new UDim2(0, 140, 0, 38); // start compressed
	card.Position = new UDim2(0.5, 0, 0.44, 0);
	card.AnchorPoint = new Vector2(0.5, 0.5);
	card.BackgroundColor3 = UI_THEME.headerBg;
	card.BackgroundTransparency = 0;
	card.BorderSizePixel = 0;
	card.ZIndex = 21;
	card.Parent = screenGui;

	const cardCorner = new Instance("UICorner");
	cardCorner.CornerRadius = UI_THEME.cornerRadius;
	cardCorner.Parent = card;

	const cardStroke = new Instance("UIStroke");
	cardStroke.Color = UI_THEME.border;
	cardStroke.Thickness = 1.5;
	cardStroke.Parent = card;

	// Sub-header
	const topLine = new Instance("TextLabel");
	topLine.Size = new UDim2(1, 0, 0.4, 0);
	topLine.BackgroundTransparency = 1;
	topLine.Text = "—  LEVEL UP  —";
	topLine.TextColor3 = UI_THEME.textSection;
	topLine.TextTransparency = 1; // fades in alongside scale
	topLine.Font = UI_THEME.fontBold;
	topLine.TextSize = 10;
	topLine.ZIndex = 22;
	topLine.Parent = card;

	// Big level number
	const levelLine = new Instance("TextLabel");
	levelLine.Size = new UDim2(1, 0, 0.68, 0);
	levelLine.Position = new UDim2(0, 0, 0.34, 0);
	levelLine.BackgroundTransparency = 1;
	levelLine.Text = "Level " + level;
	levelLine.TextColor3 = UI_THEME.textHeader;
	levelLine.TextTransparency = 1;
	levelLine.Font = UI_THEME.fontDisplay;
	levelLine.TextSize = 30;
	levelLine.ZIndex = 22;
	levelLine.Parent = card;

	// Scale card in + fade text in simultaneously
	TweenService.Create(card, new TweenInfo(0.28, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
		Size: new UDim2(0, 310, 0, 76),
	}).Play();
	TweenService.Create(topLine, new TweenInfo(0.3, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		TextTransparency: 0,
	}).Play();
	TweenService.Create(levelLine, new TweenInfo(0.3, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		TextTransparency: 0,
	}).Play();

	// Hold then fade out
	task.delay(2.2, () => {
		TweenService.Create(card, new TweenInfo(0.45, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
			BackgroundTransparency: 1,
		}).Play();
		TweenService.Create(topLine, new TweenInfo(0.45, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
			TextTransparency: 1,
		}).Play();
		const finish = TweenService.Create(
			levelLine,
			new TweenInfo(0.45, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
			{ TextTransparency: 1 },
		);
		finish.Play();
		finish.Completed.Once(() => card.Destroy());
	});
}

// ── Achievement unlocked ──────────────────────────────────────────────────────

function showAchievement(achievementName: string, description: string, icon: string, screenGui: ScreenGui): void {
	// Subtle dark flash
	const flash = new Instance("Frame");
	flash.Size = new UDim2(1, 0, 1, 0);
	flash.BackgroundColor3 = UI_THEME.bg;
	flash.BackgroundTransparency = 0.55;
	flash.BorderSizePixel = 0;
	flash.ZIndex = 20;
	flash.Parent = screenGui;

	const flashFade = TweenService.Create(flash, new TweenInfo(1.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		BackgroundTransparency: 1,
	});
	flashFade.Play();
	flashFade.Completed.Once(() => flash.Destroy());

	// Card — starts compressed, scales out
	const card = new Instance("Frame");
	card.Size = new UDim2(0, 120, 0, 30);
	card.Position = new UDim2(0.5, 0, 0.38, 0);
	card.AnchorPoint = new Vector2(0.5, 0.5);
	card.BackgroundColor3 = UI_THEME.headerBg;
	card.BackgroundTransparency = 0;
	card.BorderSizePixel = 0;
	card.ZIndex = 21;
	card.Parent = screenGui;

	const cardCorner = new Instance("UICorner");
	cardCorner.CornerRadius = UI_THEME.cornerRadius;
	cardCorner.Parent = card;

	const cardStroke = new Instance("UIStroke");
	cardStroke.Color = UI_THEME.gold;
	cardStroke.Thickness = 1.5;
	cardStroke.Parent = card;

	// Icon badge — left side
	const iconLabel = new Instance("TextLabel");
	iconLabel.Size = new UDim2(0, 44, 1, 0);
	iconLabel.BackgroundTransparency = 1;
	iconLabel.Text = icon;
	iconLabel.TextColor3 = UI_THEME.gold;
	iconLabel.TextTransparency = 1;
	iconLabel.Font = UI_THEME.fontDisplay;
	iconLabel.TextSize = 32;
	iconLabel.ZIndex = 22;
	iconLabel.Parent = card;

	// "ACHIEVEMENT UNLOCKED" sub-header
	const topLine = new Instance("TextLabel");
	topLine.Size = new UDim2(1, -48, 0.38, 0);
	topLine.Position = new UDim2(0, 48, 0.02, 0);
	topLine.BackgroundTransparency = 1;
	topLine.Text = "-- ACHIEVEMENT UNLOCKED --";
	topLine.TextColor3 = UI_THEME.textSection;
	topLine.TextTransparency = 1;
	topLine.Font = UI_THEME.fontBold;
	topLine.TextSize = 9;
	topLine.TextXAlignment = Enum.TextXAlignment.Left;
	topLine.ZIndex = 22;
	topLine.Parent = card;

	// Achievement name — large
	const nameLine = new Instance("TextLabel");
	nameLine.Size = new UDim2(1, -48, 0.36, 0);
	nameLine.Position = new UDim2(0, 48, 0.32, 0);
	nameLine.BackgroundTransparency = 1;
	nameLine.Text = achievementName;
	nameLine.TextColor3 = UI_THEME.textHeader;
	nameLine.TextTransparency = 1;
	nameLine.Font = UI_THEME.fontDisplay;
	nameLine.TextSize = 22;
	nameLine.TextXAlignment = Enum.TextXAlignment.Left;
	nameLine.ZIndex = 22;
	nameLine.Parent = card;

	// Description — smaller muted text
	const descLine = new Instance("TextLabel");
	descLine.Size = new UDim2(1, -48, 0.26, 0);
	descLine.Position = new UDim2(0, 48, 0.7, 0);
	descLine.BackgroundTransparency = 1;
	descLine.Text = description;
	descLine.TextColor3 = UI_THEME.textMuted;
	descLine.TextTransparency = 1;
	descLine.Font = UI_THEME.fontBody;
	descLine.TextSize = 11;
	descLine.TextXAlignment = Enum.TextXAlignment.Left;
	descLine.ZIndex = 22;
	descLine.Parent = card;

	// Animate: scale card in + fade all text
	TweenService.Create(card, new TweenInfo(0.32, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
		Size: new UDim2(0, 340, 0, 86),
	}).Play();
	TweenService.Create(iconLabel, new TweenInfo(0.35, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		TextTransparency: 0,
	}).Play();
	TweenService.Create(topLine, new TweenInfo(0.35, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		TextTransparency: 0,
	}).Play();
	TweenService.Create(nameLine, new TweenInfo(0.35, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		TextTransparency: 0,
	}).Play();
	TweenService.Create(descLine, new TweenInfo(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		TextTransparency: 0,
	}).Play();

	// Hold then fade out
	task.delay(3.0, () => {
		const fadeInfo = new TweenInfo(0.5, Enum.EasingStyle.Quad, Enum.EasingDirection.In);
		TweenService.Create(card, fadeInfo, { BackgroundTransparency: 1 }).Play();
		TweenService.Create(cardStroke, fadeInfo, { Transparency: 1 }).Play();
		TweenService.Create(iconLabel, fadeInfo, { TextTransparency: 1 }).Play();
		TweenService.Create(topLine, fadeInfo, { TextTransparency: 1 }).Play();
		TweenService.Create(nameLine, fadeInfo, { TextTransparency: 1 }).Play();
		const finish = TweenService.Create(descLine, fadeInfo, { TextTransparency: 1 });
		finish.Play();
		finish.Completed.Once(() => card.Destroy());
	});
}

// ── Init ──────────────────────────────────────────────────────────────────────

lifecycle.OnClientEvent.Connect((message: string) => {
	if (message !== "InitializePlayer") return;

	const playerGui = Players.LocalPlayer!.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

	ExpierenceUpdated.OnClientEvent.Connect((newTotal: number) => {
		if (prevXP >= 0) {
			const delta = newTotal - prevXP;
			if (delta > 0) showXPGain(delta, screenGui);
		}
		prevXP = newTotal;
	});

	LevelUpdated.OnClientEvent.Connect((newLevel: number) => {
		showLevelUp(newLevel, screenGui);
	});

	CoinsUpdated.OnClientEvent.Connect((newTotal: number) => {
		if (prevCoins >= 0) {
			const delta = newTotal - prevCoins;
			if (delta > 0) showCoinGain(delta, screenGui);
		}
		prevCoins = newTotal;
	});

	// Achievement unlocked notification
	const achievementRemote = getAchievementUnlockedRemote();
	achievementRemote.OnClientEvent.Connect((name: string, description: string, icon: string) => {
		showAchievement(name, description, icon, screenGui);
	});
});
