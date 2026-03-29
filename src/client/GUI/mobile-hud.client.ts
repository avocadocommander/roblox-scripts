import { Players, RunService, StarterGui, TweenService } from "@rbxts/services";
import { onPlayerInitialized } from "../modules/client-init";
import { UI_THEME, getUIScale } from "shared/ui-theme";
import { getActionContext, fireCurrentAction, ActionContext, setStealthing } from "../modules/npc-proximity";
import { toggleInventory, toggleKillBook } from "../modules/ui-toggles";
import { getPlaceCampfireRemote } from "shared/remotes/campfire-remote";

// -- Scaling ------------------------------------------------------------------

function sc(base: number): number {
	return math.floor(base * getUIScale());
}

// -- State --------------------------------------------------------------------

let assassinMode = false;
let campfireOnCooldown = false;
const CAMPFIRE_COOLDOWN = 2;

// -- Refs ---------------------------------------------------------------------

let actionButton: TextButton | undefined;
let actionIconLabel: TextLabel | undefined;
let actionTextLabel: TextLabel | undefined;
let actionStroke: UIStroke | undefined;
let actionGlow: Frame | undefined;
let assassinBtn: TextButton | undefined;
let assassinIcon: TextLabel | undefined;
let assassinStroke: UIStroke | undefined;
let lastContext: ActionContext = "none"; // will update to "jump" on first frame
let dangerPulseTween: Tween | undefined;

// -- Action style definitions -------------------------------------------------

interface ActionStyle {
	icon: string;
	label: string;
	iconColor: Color3;
	labelColor: Color3;
	borderColor: Color3;
	bgColor: Color3;
	glowColor: Color3;
	glowTransparency: number;
}

const ACTION_STYLES: Record<ActionContext, ActionStyle> = {
	jump: {
		icon: "^",
		label: "JUMP",
		iconColor: UI_THEME.textPrimary,
		labelColor: UI_THEME.textMuted,
		borderColor: UI_THEME.border,
		bgColor: UI_THEME.bgInset,
		glowColor: Color3.fromRGB(0, 0, 0),
		glowTransparency: 1,
	},
	none: {
		icon: "",
		label: "",
		iconColor: UI_THEME.textPrimary,
		labelColor: UI_THEME.textMuted,
		borderColor: UI_THEME.border,
		bgColor: UI_THEME.bgInset,
		glowColor: Color3.fromRGB(0, 0, 0),
		glowTransparency: 1,
	},
	talk: {
		icon: "...",
		label: "TALK",
		iconColor: UI_THEME.gold,
		labelColor: UI_THEME.textHeader,
		borderColor: UI_THEME.gold,
		bgColor: Color3.fromRGB(22, 20, 16),
		glowColor: UI_THEME.gold,
		glowTransparency: 0.7,
	},
	assassinate_npc: {
		icon: "/",
		label: "KILL",
		iconColor: UI_THEME.danger,
		labelColor: UI_THEME.danger,
		borderColor: UI_THEME.danger,
		bgColor: Color3.fromRGB(28, 10, 10),
		glowColor: UI_THEME.danger,
		glowTransparency: 0.5,
	},
	assassinate_player: {
		icon: "X",
		label: "SLAY",
		iconColor: Color3.fromRGB(210, 50, 35),
		labelColor: Color3.fromRGB(210, 50, 35),
		borderColor: Color3.fromRGB(180, 40, 30),
		bgColor: Color3.fromRGB(36, 10, 10),
		glowColor: Color3.fromRGB(180, 40, 30),
		glowTransparency: 0.4,
	},
};

// -- Circular button factory --------------------------------------------------

function makeButton(
	parent: Instance,
	name: string,
	diameter: number,
	pos: UDim2,
): { button: TextButton; icon: TextLabel; stroke: UIStroke } {
	const button = new Instance("TextButton");
	button.Name = name;
	button.Size = new UDim2(0, diameter, 0, diameter);
	button.Position = pos;
	button.AnchorPoint = new Vector2(0.5, 0.5);
	button.BackgroundColor3 = UI_THEME.bgInset;
	button.BackgroundTransparency = 0.08;
	button.BorderSizePixel = 0;
	button.Text = "";
	button.AutoButtonColor = false;
	button.Parent = parent;

	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(0.5, 0);
	corner.Parent = button;

	const stroke = new Instance("UIStroke");
	stroke.Color = UI_THEME.border;
	stroke.Thickness = sc(1.4);
	stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border;
	stroke.Parent = button;

	const icon = new Instance("TextLabel");
	icon.Name = "Icon";
	icon.Size = new UDim2(1, 0, 1, 0);
	icon.BackgroundTransparency = 1;
	icon.TextColor3 = UI_THEME.textPrimary;
	icon.Font = UI_THEME.fontDisplay;
	icon.TextSize = math.floor(diameter * 0.4);
	icon.Text = "";
	icon.Parent = button;

	return { button, icon, stroke };
}

// -- Build the HUD ------------------------------------------------------------

function buildMobileHUD(screenGui: ScreenGui): void {
	// Disable Roblox's built-in jump button — we replace it entirely
	task.spawn(() => {
		const coreGui = StarterGui as unknown as { SetCore: (key: string, value: boolean) => void };
		for (let attempt = 0; attempt < 20; attempt++) {
			const [ok] = pcall(() => coreGui.SetCore("SetJumpEnabled", false));
			if (ok) break;
			task.wait(0.5);
		}
	});

	// Also hide the TouchGui jump button if it was already created
	task.spawn(() => {
		const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
		for (let attempt = 0; attempt < 30; attempt++) {
			const touchGui = playerGui.FindFirstChild("TouchGui") as ScreenGui | undefined;
			if (touchGui) {
				const frame = touchGui.FindFirstChild("TouchControlFrame") as Frame | undefined;
				if (frame) {
					const jumpBtn = frame.FindFirstChild("JumpButton") as GuiButton | undefined;
					if (jumpBtn) {
						jumpBtn.Visible = false;
						break;
					}
				}
			}
			task.wait(0.5);
		}
	});

	const pad = sc(36);
	const primaryDiameter = sc(126);
	const secondaryDiameter = sc(52);
	const gap = sc(14);

	// =========================================================================
	// PRIMARY ACTION BUTTON — occupies the default jump button's position
	// Bottom-right corner, centered in the area Roblox uses for its jump btn
	// =========================================================================
	const primaryCenterX = -pad - primaryDiameter / 2;
	const primaryCenterY = -pad - primaryDiameter / 2;
	const primaryPos = new UDim2(1, primaryCenterX, 1, primaryCenterY);

	// Outer glow ring (sits behind the button, animates per context)
	actionGlow = new Instance("Frame");
	actionGlow.Name = "ActionGlow";
	actionGlow.Size = new UDim2(0, primaryDiameter + sc(16), 0, primaryDiameter + sc(16));
	actionGlow.Position = primaryPos;
	actionGlow.AnchorPoint = new Vector2(0.5, 0.5);
	actionGlow.BackgroundColor3 = Color3.fromRGB(0, 0, 0);
	actionGlow.BackgroundTransparency = 1;
	actionGlow.BorderSizePixel = 0;
	actionGlow.Visible = false;
	actionGlow.Parent = screenGui;

	const glowCorner = new Instance("UICorner");
	glowCorner.CornerRadius = new UDim(0.5, 0);
	glowCorner.Parent = actionGlow;

	// The primary button itself
	const primaryParts = makeButton(screenGui, "ActionButton", primaryDiameter, primaryPos);
	actionButton = primaryParts.button;
	actionStroke = primaryParts.stroke;
	actionStroke.Thickness = sc(2);

	// Icon — upper portion of button
	actionIconLabel = primaryParts.icon;
	actionIconLabel.Size = new UDim2(1, 0, 0.56, 0);
	actionIconLabel.Position = new UDim2(0, 0, 0.02, 0);
	actionIconLabel.TextSize = math.floor(primaryDiameter * 0.36);
	actionIconLabel.Font = UI_THEME.fontDisplay;

	// Label — lower portion
	actionTextLabel = new Instance("TextLabel");
	actionTextLabel.Name = "ActionLabel";
	actionTextLabel.Size = new UDim2(1, 0, 0.26, 0);
	actionTextLabel.Position = new UDim2(0, 0, 0.64, 0);
	actionTextLabel.BackgroundTransparency = 1;
	actionTextLabel.Font = UI_THEME.fontBold;
	actionTextLabel.TextSize = math.floor(primaryDiameter * 0.15);
	actionTextLabel.TextColor3 = UI_THEME.textMuted;
	actionTextLabel.Text = "";
	actionTextLabel.Parent = actionButton;

	// Start visible — default shows jump
	actionButton.Visible = true;

	actionButton.Activated.Connect(() => {
		const ctx = getActionContext();
		fireCurrentAction();
		pulseButton(actionButton!);
	});

	// =========================================================================
	// SECONDARY BUTTONS — NW quadrant arc around the primary button
	// North = Assassin Toggle, then Codex, Campfire, West = Inventory
	// =========================================================================
	const arcRadius = primaryDiameter / 2 + gap + secondaryDiameter / 2;
	const SEC_COUNT = 4;

	// Returns a position on the NW arc. index 0 = north, index 3 = west.
	// Angle sweeps from 0 (straight up) to 105 degrees (7*PI/12).
	function arcPosition(idx: number): UDim2 {
		const angle = (idx / (SEC_COUNT - 1)) * ((7 * math.pi) / 12);
		const dx = -arcRadius * math.sin(angle);
		const dy = -arcRadius * math.cos(angle);
		return new UDim2(1, primaryCenterX + dx, 1, primaryCenterY + dy);
	}

	// -- 0: Assassin Mode toggle (north) --------------------------------------
	const assParts = makeButton(screenGui, "AssassinToggle", secondaryDiameter, arcPosition(0));
	assassinBtn = assParts.button;
	assassinIcon = assParts.icon;
	assassinStroke = assParts.stroke;
	assParts.icon.Text = "/";
	assParts.icon.TextColor3 = UI_THEME.textMuted;
	assParts.icon.TextSize = math.floor(secondaryDiameter * 0.44);

	assassinBtn.Activated.Connect(() => {
		toggleAssassinMode();
	});

	// -- 1: Campfire ----------------------------------------------------------
	const campParts = makeButton(screenGui, "CampfireButton", secondaryDiameter, arcPosition(1));
	campParts.icon.Text = "*";
	campParts.icon.TextColor3 = UI_THEME.gold;
	campParts.icon.TextSize = math.floor(secondaryDiameter * 0.48);

	campParts.button.Activated.Connect(() => {
		placeCampfire(campParts.button, campParts.stroke);
	});

	// -- 2: Codex (Kill Book) -------------------------------------------------
	const codexParts = makeButton(screenGui, "CodexButton", secondaryDiameter, arcPosition(2));
	codexParts.icon.Text = "=";
	codexParts.icon.TextColor3 = UI_THEME.textMuted;
	codexParts.icon.TextSize = math.floor(secondaryDiameter * 0.44);

	codexParts.button.Activated.Connect(() => {
		toggleKillBook();
		pulseButton(codexParts.button);
	});

	// -- 3: Inventory (west) --------------------------------------------------
	const invParts = makeButton(screenGui, "InventoryButton", secondaryDiameter, arcPosition(3));
	invParts.icon.Text = "#";
	invParts.icon.TextColor3 = UI_THEME.textMuted;
	invParts.icon.TextSize = math.floor(secondaryDiameter * 0.44);

	invParts.button.Activated.Connect(() => {
		toggleInventory();
		pulseButton(invParts.button);
	});

	// =========================================================================
	// PER-FRAME CONTEXT UPDATE
	// =========================================================================
	RunService.RenderStepped.Connect(() => {
		const ctx = getActionContext();
		if (ctx !== lastContext) {
			applyActionStyle(ctx);
			lastContext = ctx;
		}
	});
}

// -- Action style switching ---------------------------------------------------

function applyActionStyle(ctx: ActionContext): void {
	if (!actionButton || !actionIconLabel || !actionTextLabel || !actionStroke || !actionGlow) return;

	const s = ACTION_STYLES[ctx];
	const isAssassinate = ctx === "assassinate_npc" || ctx === "assassinate_player";
	const hasAction = ctx !== "none";

	// Show / hide entire primary button (visible for jump too)
	actionButton.Visible = hasAction;
	actionGlow.Visible = isAssassinate || ctx === "talk";

	if (!hasAction) {
		stopDangerPulse();
		return;
	}

	// Background + text
	actionButton.BackgroundColor3 = s.bgColor;
	actionButton.BackgroundTransparency = 0.06;
	actionIconLabel.Text = s.icon;
	actionIconLabel.TextColor3 = s.iconColor;
	actionTextLabel.Text = s.label;
	actionTextLabel.TextColor3 = s.labelColor;
	actionStroke.Color = s.borderColor;
	actionStroke.Thickness = isAssassinate ? sc(2.5) : sc(2);

	// Glow ring
	actionGlow.BackgroundColor3 = s.glowColor;
	actionGlow.BackgroundTransparency = s.glowTransparency;

	// Danger pulse for assassination contexts
	if (isAssassinate) {
		startDangerPulse();
	} else {
		stopDangerPulse();
	}
}

// -- Danger pulse animation (assassination glow throb) ------------------------

function startDangerPulse(): void {
	if (dangerPulseTween) return; // already running
	if (!actionGlow) return;

	const baseTransparency = ACTION_STYLES[lastContext === "none" ? "assassinate_npc" : lastContext].glowTransparency;
	const pulseTarget = math.clamp(baseTransparency - 0.2, 0, 1);

	dangerPulseTween = TweenService.Create(
		actionGlow,
		new TweenInfo(0.5, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true),
		{ BackgroundTransparency: pulseTarget },
	);
	dangerPulseTween.Play();
}

function stopDangerPulse(): void {
	if (dangerPulseTween) {
		dangerPulseTween.Cancel();
		dangerPulseTween = undefined;
	}
	if (actionGlow) {
		actionGlow.BackgroundTransparency = 1;
	}
}

// -- Assassin mode toggle -----------------------------------------------------

function toggleAssassinMode(): void {
	assassinMode = !assassinMode;
	print("[MOBILE-HUD] Assassin mode: " + (assassinMode ? "ON" : "OFF"));

	// Update npc-proximity's internal stealth flag so getActionContext() returns assassinate
	setStealthing(assassinMode);
	Players.LocalPlayer.SetAttribute("IsStealthing", assassinMode);

	updateAssassinButtonVisuals();
	pulseButton(assassinBtn!);
}

function updateAssassinButtonVisuals(): void {
	if (!assassinBtn || !assassinIcon || !assassinStroke) return;
	assassinStroke.Color = assassinMode ? UI_THEME.danger : UI_THEME.border;
	assassinIcon.TextColor3 = assassinMode ? UI_THEME.danger : UI_THEME.textMuted;
	assassinBtn.BackgroundColor3 = assassinMode ? Color3.fromRGB(28, 10, 10) : UI_THEME.bgInset;
	assassinBtn.BackgroundTransparency = assassinMode ? 0.04 : 0.08;
}

function syncAssassinModeFromAttribute(): void {
	const val = Players.LocalPlayer.GetAttribute("IsStealthing") as boolean | undefined;
	const stealthing = val === true;
	if (stealthing !== assassinMode) {
		assassinMode = stealthing;
		setStealthing(assassinMode);
		updateAssassinButtonVisuals();
	}
}

// -- Campfire placement -------------------------------------------------------

function placeCampfire(btn: TextButton, stroke: UIStroke): void {
	if (campfireOnCooldown) return;

	const character = Players.LocalPlayer.Character;
	if (!character || !character.PrimaryPart) return;

	const hrp = character.PrimaryPart;
	getPlaceCampfireRemote().FireServer(hrp.Position, hrp.CFrame.LookVector);

	campfireOnCooldown = true;
	stroke.Color = UI_THEME.textMuted;
	btn.BackgroundTransparency = 0.5;

	task.delay(CAMPFIRE_COOLDOWN, () => {
		campfireOnCooldown = false;
		stroke.Color = UI_THEME.gold;
		btn.BackgroundTransparency = 0.08;
	});

	pulseButton(btn);
}

// -- Tap feedback (scale pulse) -----------------------------------------------

function pulseButton(btn: TextButton): void {
	const orig = btn.Size;
	const shrunk = new UDim2(
		orig.X.Scale * 0.88,
		math.floor(orig.X.Offset * 0.88),
		orig.Y.Scale * 0.88,
		math.floor(orig.Y.Offset * 0.88),
	);

	TweenService.Create(btn, new TweenInfo(0.05, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Size: shrunk,
	}).Play();

	task.delay(0.05, () => {
		TweenService.Create(btn, new TweenInfo(0.12, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
			Size: orig,
		}).Play();
	});
}

// -- Init ---------------------------------------------------------------------

onPlayerInitialized(() => {
	const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

	buildMobileHUD(screenGui);

	Players.LocalPlayer.GetAttributeChangedSignal("IsStealthing").Connect(() => {
		syncAssassinModeFromAttribute();
	});
});
