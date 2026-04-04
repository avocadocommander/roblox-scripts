import { Players, ReplicatedStorage, TweenService } from "@rbxts/services";
import { onPlayerInitialized } from "../modules/client-init";
import { getAchievementUnlockedRemote } from "shared/remotes/achievement-remote";
import { ACHIEVEMENTS } from "shared/achievements";
import { UI_THEME } from "shared/ui-theme";

const playerState = ReplicatedStorage.WaitForChild("PlayerState") as Folder;
const ExpierenceUpdated = playerState.WaitForChild("ExpierenceUpdated") as RemoteEvent;
const LevelUpdated = playerState.WaitForChild("LevelUpdated") as RemoteEvent;
const CoinsUpdated = playerState.WaitForChild("CoinsUpdated") as RemoteEvent;

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

// ── Notification stack ────────────────────────────────────────────────────────
// Cards slide in from the right at the top-right corner.
// Max 3 visible; oldest is dismissed when a 4th arrives.

const CARD_WIDTH = 320;
const CARD_HEIGHT = 80;
const CARD_GAP = 10;
// 20% from the top of the screen is the anchor for the first card
const CARD_TOP_SCALE = 0.2;
const MAX_STACK = 3;
const HOLD_SECS = 8;
const FADE_SECS = 0.4;

interface StackEntry {
	frame: Frame;
	dismissFn: () => void;
}

const notifyStack: StackEntry[] = [];

// Returns the UDim2 position for stack slot i (0 = topmost / newest)
function stackPos(i: number): UDim2 {
	return new UDim2(0.5, -CARD_WIDTH / 2, CARD_TOP_SCALE, i * (CARD_HEIGHT + CARD_GAP));
}

// Off-screen-above start / exit position for a given slot
function stackPosAbove(i: number): UDim2 {
	return new UDim2(0.5, -CARD_WIDTH / 2, CARD_TOP_SCALE, -(CARD_HEIGHT + 20) + i * (CARD_HEIGHT + CARD_GAP));
}

function reorderStack(screenGui: ScreenGui): void {
	for (let i = 0; i < notifyStack.size(); i++) {
		const entry = notifyStack[i];
		TweenService.Create(
			entry.frame,
			new TweenInfo(0.22, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
			{ Position: stackPos(i) },
		).Play();
	}
}

function pushNotification(frame: Frame, screenGui: ScreenGui): () => void {
	// If we're already at max, forcibly dismiss the oldest
	if (notifyStack.size() >= MAX_STACK) {
		const oldest = notifyStack[notifyStack.size() - 1];
		oldest.dismissFn();
	}

	// Drop in from just above the anchor
	frame.Position = stackPosAbove(0);
	frame.Parent = screenGui;
	TweenService.Create(frame, new TweenInfo(0.3, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
		Position: stackPos(0),
	}).Play();

	let dismissed = false;
	const dismiss = () => {
		if (dismissed) return;
		dismissed = true;
		const idx = notifyStack.indexOf(entry);
		if (idx >= 0) notifyStack.remove(idx);
		// Slide up and fade out
		TweenService.Create(frame, new TweenInfo(FADE_SECS, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
			Position: new UDim2(frame.Position.X.Scale, frame.Position.X.Offset, frame.Position.Y.Scale, frame.Position.Y.Offset - CARD_HEIGHT),
			BackgroundTransparency: 1,
		}).Play();
		for (const child of frame.GetDescendants()) {
			if (child.IsA("TextLabel")) {
				TweenService.Create(child, new TweenInfo(FADE_SECS, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
					TextTransparency: 1,
				}).Play();
			} else if (child.IsA("UIStroke")) {
				TweenService.Create(child, new TweenInfo(FADE_SECS, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
					Transparency: 1,
				}).Play();
			}
		}
		task.delay(FADE_SECS + 0.05, () => frame.Destroy());
		reorderStack(screenGui);
	};

	const entry: StackEntry = { frame, dismissFn: dismiss };
	notifyStack.insert(0, entry);
	reorderStack(screenGui);

	// Auto-dismiss after hold time
	task.delay(HOLD_SECS, dismiss);

	return dismiss;
}

function makeBaseCard(): Frame {
	const card = new Instance("Frame");
	card.Size = new UDim2(0, CARD_WIDTH, 0, CARD_HEIGHT);
	card.AnchorPoint = new Vector2(0, 0);
	card.BackgroundColor3 = UI_THEME.headerBg;
	card.BackgroundTransparency = 0.04;
	card.BorderSizePixel = 0;
	card.ZIndex = 30;

	const corner = new Instance("UICorner");
	corner.CornerRadius = UI_THEME.cornerRadius;
	corner.Parent = card;

	return card;
}

// ── Level up ─────────────────────────────────────────────────────────────────

function showLevelUp(level: number, screenGui: ScreenGui): void {
	const card = makeBaseCard();

	const cardStroke = new Instance("UIStroke");
	cardStroke.Color = UI_THEME.border;
	cardStroke.Thickness = 1.5;
	cardStroke.Parent = card;

	// Icon / badge area
	const iconLabel = new Instance("TextLabel");
	iconLabel.Size = new UDim2(0, 60, 1, 0);
	iconLabel.BackgroundTransparency = 1;
	iconLabel.Text = "^";
	iconLabel.TextColor3 = UI_THEME.textHeader;
	iconLabel.Font = UI_THEME.fontDisplay;
	iconLabel.TextSize = 36;
	iconLabel.ZIndex = 31;
	iconLabel.Parent = card;

	const topLine = new Instance("TextLabel");
	topLine.Size = new UDim2(1, -64, 0.38, 0);
	topLine.Position = new UDim2(0, 60, 0.04, 0);
	topLine.BackgroundTransparency = 1;
	topLine.Text = "-- LEVEL UP --";
	topLine.TextColor3 = UI_THEME.textSection;
	topLine.Font = UI_THEME.fontBold;
	topLine.TextSize = 9;
	topLine.TextXAlignment = Enum.TextXAlignment.Left;
	topLine.ZIndex = 31;
	topLine.Parent = card;

	const levelLine = new Instance("TextLabel");
	levelLine.Size = new UDim2(1, -64, 0.52, 0);
	levelLine.Position = new UDim2(0, 60, 0.38, 0);
	levelLine.BackgroundTransparency = 1;
	levelLine.Text = "Level " + level;
	levelLine.TextColor3 = UI_THEME.textHeader;
	levelLine.Font = UI_THEME.fontDisplay;
	levelLine.TextSize = 28;
	levelLine.TextXAlignment = Enum.TextXAlignment.Left;
	levelLine.ZIndex = 31;
	levelLine.Parent = card;

	pushNotification(card, screenGui);
}

// ── Achievement unlocked ──────────────────────────────────────────────────────

function showAchievement(achievementName: string, description: string, icon: string, screenGui: ScreenGui): void {
	const card = makeBaseCard();

	const cardStroke = new Instance("UIStroke");
	cardStroke.Color = UI_THEME.gold;
	cardStroke.Thickness = 1.5;
	cardStroke.Parent = card;

	const iconLabel = new Instance("TextLabel");
	iconLabel.Size = new UDim2(0, 56, 1, 0);
	iconLabel.BackgroundTransparency = 1;
	iconLabel.Text = icon;
	iconLabel.TextColor3 = UI_THEME.gold;
	iconLabel.Font = UI_THEME.fontDisplay;
	iconLabel.TextSize = 32;
	iconLabel.ZIndex = 31;
	iconLabel.Parent = card;

	const topLine = new Instance("TextLabel");
	topLine.Size = new UDim2(1, -60, 0.32, 0);
	topLine.Position = new UDim2(0, 58, 0.04, 0);
	topLine.BackgroundTransparency = 1;
	topLine.Text = "-- ACHIEVEMENT UNLOCKED --";
	topLine.TextColor3 = UI_THEME.textSection;
	topLine.Font = UI_THEME.fontBold;
	topLine.TextSize = 9;
	topLine.TextXAlignment = Enum.TextXAlignment.Left;
	topLine.ZIndex = 31;
	topLine.Parent = card;

	const nameLine = new Instance("TextLabel");
	nameLine.Size = new UDim2(1, -60, 0.36, 0);
	nameLine.Position = new UDim2(0, 58, 0.32, 0);
	nameLine.BackgroundTransparency = 1;
	nameLine.Text = achievementName;
	nameLine.TextColor3 = UI_THEME.textHeader;
	nameLine.Font = UI_THEME.fontDisplay;
	nameLine.TextSize = 20;
	nameLine.TextTruncate = Enum.TextTruncate.AtEnd;
	nameLine.TextXAlignment = Enum.TextXAlignment.Left;
	nameLine.ZIndex = 31;
	nameLine.Parent = card;

	const descLine = new Instance("TextLabel");
	descLine.Size = new UDim2(1, -60, 0.26, 0);
	descLine.Position = new UDim2(0, 58, 0.7, 0);
	descLine.BackgroundTransparency = 1;
	descLine.Text = description;
	descLine.TextColor3 = UI_THEME.textMuted;
	descLine.Font = UI_THEME.fontBody;
	descLine.TextSize = 10;
	descLine.TextTruncate = Enum.TextTruncate.AtEnd;
	descLine.TextXAlignment = Enum.TextXAlignment.Left;
	descLine.ZIndex = 31;
	descLine.Parent = card;

	pushNotification(card, screenGui);
}

// ── Init ──────────────────────────────────────────────────────────────────────

onPlayerInitialized(() => {
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
	achievementRemote.OnClientEvent.Connect((achievementId: unknown) => {
		const id = achievementId as string;
		const def = ACHIEVEMENTS[id];
		if (!def) return;
		showAchievement(def.title, def.description, def.icon, screenGui);
	});
});
