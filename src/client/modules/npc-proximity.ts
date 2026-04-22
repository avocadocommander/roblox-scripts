import { Players, RunService, TweenService, Workspace, CollectionService, UserInputService } from "@rbxts/services";
import { log } from "shared/helpers";
import { getOrCreateAssassinationRemote } from "shared/remotes/assassination-remote";
import { UI_THEME, STATUS_RARITY, scaleUI } from "shared/ui-theme";
import { MEDIEVAL_NPCS } from "shared/module";
import { isNPCKillable, getNPCInteraction, hasNPCDialog } from "shared/config/npcs";
import { getInspectDef } from "shared/config/inspectables";
import { TITLES } from "shared/config/titles";
import { getTitleSyncRemote, getAllTitlesRemote } from "shared/remotes/title-remote";
import { requestOpenDialog, requestOpenInspect, requestOpenPremiumOffer, isDialogOpen } from "./npc-dialog";
import { getPremiumOffer } from "shared/config/premium-offers";
import { getPassOwnershipSyncRemote } from "shared/remotes/pass-remote";
import { pulseActionButton, pulseKillButton } from "./ui-toggles";
import {
	getPlayerAssassinationRemote,
	getPlayerWantedRemote,
	getPlayerWantedClearedRemote,
	getBountyListSyncRemote,
	PlayerWantedPayload,
} from "shared/remotes/bounty-remote";

// ── Status → rarity colour mapping ───────────────────────────────────────────
function getNPCStatusColor(npcName: string): Color3 {
	const data = MEDIEVAL_NPCS[npcName];
	if (!data) return UI_THEME.textPrimary;
	const rarity = STATUS_RARITY[data.status];
	return rarity ? rarity.color : UI_THEME.textPrimary;
}

function getNPCStatus(npcName: string): string {
	const data = MEDIEVAL_NPCS[npcName];
	if (!data) return "";
	return data.status;
}

const assassinationRemote = getOrCreateAssassinationRemote();
const IS_MOBILE = UserInputService.TouchEnabled && !UserInputService.KeyboardEnabled;
const PROXIMITY_RANGE = 5; // Only show when very close to NPC
const MERCHANT_PROXIMITY_RANGE = 10; // Merchants show talk prompt from further away
const WANTED_PLAYER_RANGE = 15; // Range for PvP assassination (matches server MAX_ASSASSINATION_DISTANCE)
const NAME_VISIBLE_RANGE = 15; // Distance at which NPC names become visible
const INSPECT_RANGE = 8; // Distance at which inspectable objects show prompt
const PREMIUM_OFFER_RANGE = 10; // Distance at which premium offer objects show prompt

// ── Cached world-object lists (rebuilt periodically, NOT every frame) ────────
let cachedInspectables: Model[] = [];
let cachedOfferModels: Model[] = [];
let lastWorldScanTick = 0;
const WORLD_SCAN_INTERVAL = 2; // seconds between full GetDescendants rescans

// Assassinate button color
const BTN_COLOR = Color3.fromRGB(190, 50, 50);

let closestNPCInRange: Model | undefined = undefined;
let closestInspectableInRange: Model | undefined = undefined;
let closestPremiumOfferInRange: Model | undefined = undefined;

// Distance to each closest interactable (used to pick the nearest one overall)
let closestNPCDist = math.huge;
let closestInspectableDist = math.huge;
let closestPremiumOfferDist = math.huge;

// ── Wanted Player Tracking ──────────────────────────────────────────────────────
const wantedPlayerInfo = new Map<string, { gold: number; displayName: string }>();
const wantedBillboards = new Map<string, BillboardGui>();
let closestWantedPlayerInRange: Model | undefined = undefined;

// ── Regular (non-wanted) Player Billboards ──────────────────────────────────────
const playerBillboards = new Map<string, BillboardGui>();
const playerTitles = new Map<string, string>(); // playerName -> equipped title ID

function createPlayerBillboard(character: Model, playerName: string, titleId?: string): void {
	removePlayerBillboard(playerName);
	const head = character.FindFirstChild("Head") as BasePart | undefined;
	if (!head) return;

	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (humanoid) {
		humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None;
	}

	const titleDef = titleId !== undefined ? TITLES[titleId] : undefined;
	const isWanted = wantedPlayerInfo.has(playerName);
	const borderColor = isWanted ? UI_THEME.danger : Color3.fromRGB(0, 0, 0);

	const billboard = new Instance("BillboardGui");
	billboard.Name = "PlayerBillboard";
	billboard.Size = new UDim2(5, 0, 1.1, 0);
	billboard.MaxDistance = 60;
	billboard.StudsOffset = new Vector3(0, 2, 0);
	billboard.AlwaysOnTop = false;
	billboard.Parent = head;

	const card = new Instance("Frame");
	card.Size = new UDim2(1, 0, 1, 0);
	card.BackgroundColor3 = UI_THEME.bg;
	card.BackgroundTransparency = 0.06;
	card.BorderSizePixel = 0;
	card.Parent = billboard;

	const cardCorner = new Instance("UICorner");
	cardCorner.CornerRadius = new UDim(0, 5);
	cardCorner.Parent = card;

	const cardStroke = new Instance("UIStroke");
	cardStroke.Color = borderColor;
	cardStroke.Thickness = 1.2;
	cardStroke.Parent = card;

	// Single-line: "Symbol TitleName PlayerName" or just "PlayerName"
	const displayText = titleDef !== undefined ? titleDef.symbol + " " + titleDef.name + " " + playerName : playerName;
	const textColor = titleDef !== undefined ? titleDef.color : Color3.fromRGB(235, 215, 160);

	const nameLabel = new Instance("TextLabel");
	nameLabel.Size = new UDim2(1, -10, 0.9, 0);
	nameLabel.Position = new UDim2(0, 5, 0.05, 0);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.TextColor3 = textColor;
	nameLabel.Font = UI_THEME.fontDisplay;
	nameLabel.TextSize = scaleUI(24);
	nameLabel.Text = displayText;
	nameLabel.TextTruncate = Enum.TextTruncate.AtEnd;
	nameLabel.TextStrokeColor3 = Color3.fromRGB(0, 0, 0);
	nameLabel.TextStrokeTransparency = 0.35;
	nameLabel.BorderSizePixel = 0;
	nameLabel.Parent = card;

	playerBillboards.set(playerName, billboard);
}

function removePlayerBillboard(playerName: string): void {
	const billboard = playerBillboards.get(playerName);
	if (billboard) {
		billboard.Destroy();
		playerBillboards.delete(playerName);
	}
}

function setupRegularPlayerBillboards(): void {
	const localPlayer = Players.LocalPlayer;
	for (const player of Players.GetPlayers()) {
		if (player === localPlayer) continue;
		if (wantedPlayerInfo.has(player.Name)) continue; // wanted billboard takes over
		if (player.Character) {
			createPlayerBillboard(player.Character, player.Name, playerTitles.get(player.Name));
		}
		player.CharacterAdded.Connect((char) => {
			// Wait briefly for Head to exist
			task.wait(0.1);
			if (!wantedPlayerInfo.has(player.Name)) {
				createPlayerBillboard(char, player.Name, playerTitles.get(player.Name));
			}
		});
	}

	Players.PlayerAdded.Connect((player) => {
		if (player === localPlayer) return;
		player.CharacterAdded.Connect((char) => {
			task.wait(0.1);
			if (!wantedPlayerInfo.has(player.Name)) {
				createPlayerBillboard(char, player.Name, playerTitles.get(player.Name));
			}
		});
	});

	Players.PlayerRemoving.Connect((player) => {
		removePlayerBillboard(player.Name);
	});
}

interface NPCProximityUI {
	billboard: BillboardGui;
	nameLabel: TextLabel;
	assassinateButton?: TextButton;
	talkButton?: TextButton;
}

const npcUIMap = new Map<Model, NPCProximityUI>();

function createNPCBillboard(npc: Model): BillboardGui {
	const billboard = new Instance("BillboardGui");
	billboard.Size = new UDim2(5, 0, 2.0, 0);
	billboard.MaxDistance = math.huge;
	billboard.StudsOffset = new Vector3(0, 5.4, 0);
	billboard.AlwaysOnTop = false;
	billboard.Parent = npc;

	const statusColor = getNPCStatusColor(npc.Name);
	const statusText = getNPCStatus(npc.Name);

	// Outer card frame
	const card = new Instance("Frame");
	card.Name = "NPCCard";
	card.Size = new UDim2(1, 0, 0.56, 0);
	card.Position = new UDim2(0, 0, 0, 0);
	card.BackgroundColor3 = UI_THEME.bg;
	card.BackgroundTransparency = 0.06;
	card.BorderSizePixel = 0;
	card.Parent = billboard;

	const cardCorner = new Instance("UICorner");
	cardCorner.CornerRadius = new UDim(0, 5);
	cardCorner.Parent = card;

	const cardStroke = new Instance("UIStroke");
	cardStroke.Color = statusColor;
	cardStroke.Thickness = 1.2;
	cardStroke.Parent = card;

	// NPC name — bright warm white, rarity colour is shown via the card border
	const npcInteractionAttr = npc.GetAttribute("Interaction") as string | undefined;
	const hasShopInteraction = (npcInteractionAttr ?? getNPCInteraction(npc.Name)) === "Shop";
	const displayName = hasShopInteraction ? "(G) " + npc.Name : npc.Name;

	const nameLabel = new Instance("TextLabel");
	nameLabel.Name = "TextLabel";
	nameLabel.Size = new UDim2(1, -10, 0.9, 0);
	nameLabel.Position = new UDim2(0, 5, 0.05, 0);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.TextColor3 = Color3.fromRGB(245, 238, 220);
	nameLabel.Font = UI_THEME.fontDisplay;
	nameLabel.TextSize = scaleUI(24);
	nameLabel.Text = displayName;
	nameLabel.TextStrokeColor3 = Color3.fromRGB(0, 0, 0);
	nameLabel.TextStrokeTransparency = 0.35;
	nameLabel.BorderSizePixel = 0;
	nameLabel.Parent = card;

	return billboard;
}

// ── Button fade helpers ───────────────────────────────────────────────────────

function fadeInButton(button: TextButton): void {
	button.BackgroundTransparency = 1;
	button.TextTransparency = 1;
	const stroke = button.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
	if (stroke) stroke.Transparency = 1;
	TweenService.Create(button, new TweenInfo(0.25, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		BackgroundTransparency: 0.1,
		TextTransparency: 0.15,
	}).Play();
	if (stroke) {
		TweenService.Create(stroke, new TweenInfo(0.25, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			Transparency: 0,
		}).Play();
	}
}

function fadeOutAndDestroy(button: TextButton): void {
	TweenService.Create(button, new TweenInfo(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		BackgroundTransparency: 1,
		TextTransparency: 1,
	}).Play();
	const stroke = button.FindFirstChildOfClass("UIStroke") as UIStroke | undefined;
	if (stroke) {
		TweenService.Create(stroke, new TweenInfo(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			Transparency: 1,
		}).Play();
	}
	task.delay(0.21, () => {
		if (button.Parent) button.Destroy();
	});
}

function createAssassinateButton(billboard: BillboardGui, npc: Model): TextButton {
	const button = new Instance("TextButton");
	button.Size = new UDim2(0.48, 0, 0.17, 0);
	button.Position = new UDim2(0.52, 0, 0.6, 0);
	button.BackgroundColor3 = Color3.fromRGB(28, 8, 8);
	button.BackgroundTransparency = 1;
	button.TextColor3 = BTN_COLOR;
	button.TextTransparency = 1;
	button.Font = UI_THEME.fontBold;
	button.TextSize = scaleUI(16);
	button.Text = IS_MOBILE ? "Kill" : "Kill [Q]";
	button.TextXAlignment = Enum.TextXAlignment.Right;
	button.TextStrokeColor3 = Color3.fromRGB(0, 0, 0);
	button.TextStrokeTransparency = 0.5;
	button.BorderSizePixel = 0;
	button.Parent = billboard;

	const btnCorner = new Instance("UICorner");
	btnCorner.CornerRadius = new UDim(0, 4);
	btnCorner.Parent = button;

	const btnStroke = new Instance("UIStroke");
	btnStroke.Color = BTN_COLOR;
	btnStroke.Thickness = 0.8;
	btnStroke.Parent = button;

	button.MouseButton1Click.Connect(() => {
		assassinationRemote.FireServer(npc);
	});

	if (IS_MOBILE) pulseKillButton();
	fadeInButton(button);
	return button;
}

function createTalkButton(billboard: BillboardGui, npc: Model): TextButton {
	const button = new Instance("TextButton");
	button.Size = new UDim2(0.48, 0, 0.17, 0);
	button.Position = new UDim2(0, 0, 0.6, 0);
	button.BackgroundColor3 = UI_THEME.bgInset;
	button.BackgroundTransparency = 1;
	button.TextColor3 = UI_THEME.textPrimary;
	button.TextTransparency = 1;
	button.Font = UI_THEME.fontBold;
	button.TextSize = scaleUI(16);
	button.Text = IS_MOBILE ? "Talk" : "Talk [E]";
	button.TextXAlignment = Enum.TextXAlignment.Left;
	button.TextStrokeColor3 = Color3.fromRGB(0, 0, 0);
	button.TextStrokeTransparency = 0.55;
	button.BorderSizePixel = 0;
	button.Parent = billboard;

	const btnCorner = new Instance("UICorner");
	btnCorner.CornerRadius = new UDim(0, 4);
	btnCorner.Parent = button;

	const btnStroke = new Instance("UIStroke");
	btnStroke.Color = UI_THEME.border;
	btnStroke.Thickness = 0.8;
	btnStroke.Parent = button;

	button.MouseButton1Click.Connect(() => {
		requestOpenDialog(npc);
	});

	if (IS_MOBILE) pulseActionButton();
	fadeInButton(button);
	return button;
}

function setupNPCProximity(npc: Model) {
	if (npcUIMap.has(npc)) return; // Already setup

	const billboard = createNPCBillboard(npc);
	const nameLabel = billboard.FindFirstChild("TextLabel") as TextLabel;

	const ui: NPCProximityUI = {
		billboard,
		nameLabel,
	};

	npcUIMap.set(npc, ui);
}

// ── Inspectable Object Billboards ───────────────────────────────────────────────

interface InspectableUI {
	billboard: BillboardGui;
	nameLabel: TextLabel;
	inspectPrompt: TextButton | undefined;
}

const inspectableUIMap = new Map<Model, InspectableUI>();

function createInspectBillboard(model: Model): BillboardGui {
	const inspectId = model.GetAttribute("inspectId") as string;
	const def = getInspectDef(inspectId);
	const displayName = def ? def.displayName : model.Name;

	const billboard = new Instance("BillboardGui");
	billboard.Size = new UDim2(5, 0, 1.4, 0);
	billboard.MaxDistance = math.huge;
	billboard.StudsOffset = new Vector3(0, 3.2, 0);
	billboard.AlwaysOnTop = false;
	billboard.Parent = model;

	const card = new Instance("Frame");
	card.Name = "InspectCard";
	card.Size = new UDim2(1, 0, 0.65, 0);
	card.Position = new UDim2(0, 0, 0, 0);
	card.BackgroundColor3 = UI_THEME.bg;
	card.BackgroundTransparency = 0.06;
	card.BorderSizePixel = 0;
	card.Visible = false;
	card.Parent = billboard;

	const cardCorner = new Instance("UICorner");
	cardCorner.CornerRadius = new UDim(0, 5);
	cardCorner.Parent = card;

	const cardStroke = new Instance("UIStroke");
	cardStroke.Color = UI_THEME.textHeader;
	cardStroke.Thickness = 1.2;
	cardStroke.Parent = card;

	const nameLabel = new Instance("TextLabel");
	nameLabel.Name = "TextLabel";
	nameLabel.Size = new UDim2(1, -10, 0.9, 0);
	nameLabel.Position = new UDim2(0, 5, 0.05, 0);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.TextColor3 = Color3.fromRGB(230, 200, 120);
	nameLabel.Font = UI_THEME.fontDisplay;
	nameLabel.TextSize = scaleUI(24);
	nameLabel.Text = displayName;
	nameLabel.TextStrokeColor3 = Color3.fromRGB(0, 0, 0);
	nameLabel.TextStrokeTransparency = 0.35;
	nameLabel.BorderSizePixel = 0;
	nameLabel.Parent = card;

	return billboard;
}

function createInspectPrompt(billboard: BillboardGui, model: Model): TextButton {
	const button = new Instance("TextButton");
	button.Size = new UDim2(1, 0, 0.42, 0);
	button.Position = new UDim2(0, 0, 0.68, 0);
	button.BackgroundColor3 = UI_THEME.bgInset;
	button.BackgroundTransparency = 0.1;
	button.TextColor3 = UI_THEME.textHeader;
	button.TextTransparency = 0.15;
	button.Font = UI_THEME.fontBold;
	button.TextSize = scaleUI(14);
	button.Text = IS_MOBILE ? "INSPECT" : "INSPECT  [E]";
	button.TextStrokeColor3 = Color3.fromRGB(0, 0, 0);
	button.TextStrokeTransparency = 0.55;
	button.BorderSizePixel = 0;
	button.Parent = billboard;

	const btnCorner = new Instance("UICorner");
	btnCorner.CornerRadius = new UDim(0, 4);
	btnCorner.Parent = button;

	const btnStroke = new Instance("UIStroke");
	btnStroke.Color = UI_THEME.textHeader;
	btnStroke.Thickness = 0.8;
	btnStroke.Parent = button;

	button.MouseButton1Click.Connect(() => {
		requestOpenInspect(model);
	});

	if (IS_MOBILE) pulseActionButton();
	return button;
}

function setupInspectableProximity(model: Model): void {
	if (inspectableUIMap.has(model)) return;

	const billboard = createInspectBillboard(model);
	const nameLabel = billboard.FindFirstChild("TextLabel") as TextLabel;

	inspectableUIMap.set(model, {
		billboard,
		nameLabel,
		inspectPrompt: undefined,
	});
}

// ── Premium Offer Object Billboards ─────────────────────────────────────────────

interface PremiumOfferUI {
	billboard: BillboardGui;
	nameLabel: TextLabel;
	interactPrompt: TextButton | undefined;
}

const premiumOfferUIMap = new Map<Model, PremiumOfferUI>();

// ── Client-side owned Game Pass tracking ────────────────────────────────────────
const ownedPassIds = new Set<number>();

// Visual palettes per offer state
const GOLD_FILL = Color3.fromRGB(210, 180, 70); // unowned gamepass
const GOLD_ACCENT = Color3.fromRGB(200, 170, 60);
const OWNED_FILL = Color3.fromRGB(80, 78, 72); // owned gamepass — grey/stone
const OWNED_ACCENT = Color3.fromRGB(108, 105, 98);
const DEVPROD_FILL = Color3.fromRGB(60, 120, 170); // dev product — cool blue
const DEVPROD_ACCENT = Color3.fromRGB(88, 155, 200);

/** Resolve the visual colour pair for a premium offer based on type + ownership. */
function getOfferColors(offerId: string): { fill: Color3; accent: Color3 } {
	const offer = getPremiumOffer(offerId);
	if (!offer) return { fill: GOLD_FILL, accent: GOLD_ACCENT };
	if (offer.offerType === "developerProduct") return { fill: DEVPROD_FILL, accent: DEVPROD_ACCENT };
	// Gamepass: owned → grey, unowned → gold
	if (ownedPassIds.has(offer.productId)) return { fill: OWNED_FILL, accent: OWNED_ACCENT };
	return { fill: GOLD_FILL, accent: GOLD_ACCENT };
}

/** Returns true if the local player owns the pass for this offer. Only applies to gamepasses. */
function isOfferOwned(offerId: string): boolean {
	const offer = getPremiumOffer(offerId);
	if (!offer || offer.offerType !== "gamepass") return false;
	return ownedPassIds.has(offer.productId);
}

/** Recolour an already-setup premium offer model when ownership changes. */
function recolourOffer(model: Model, ui: PremiumOfferUI, fill: Color3, accent: Color3): void {
	const highlight = model.FindFirstChildWhichIsA("Highlight") as Highlight | undefined;
	if (highlight) {
		highlight.FillColor = fill;
		highlight.OutlineColor = accent;
	}
	const glow = model.FindFirstChild("PremiumGlow", true) as PointLight | undefined;
	if (glow) glow.Color = accent;
	const emitter = model.FindFirstChildWhichIsA("ParticleEmitter", true) as ParticleEmitter | undefined;
	if (emitter) emitter.Color = new ColorSequence(accent);
	const card = ui.billboard.FindFirstChild("OfferCard") as Frame | undefined;
	if (card) {
		const stroke = card.FindFirstChildWhichIsA("UIStroke") as UIStroke | undefined;
		if (stroke) stroke.Color = accent;
	}
	ui.nameLabel.TextColor3 = accent;
}

// Listen for pass ownership syncs from server
getPassOwnershipSyncRemote().OnClientEvent.Connect((passId: unknown, owns: unknown) => {
	const pid = passId as number;
	const owned = owns as boolean;
	if (owned) {
		ownedPassIds.add(pid);
	} else {
		ownedPassIds.delete(pid);
	}
	// Recolour any already-setup premium offer models whose pass just changed
	for (const [model, ui] of premiumOfferUIMap) {
		const offerId = model.GetAttribute("offerId") as string | undefined;
		if (!offerId) continue;
		const offer = getPremiumOffer(offerId);
		if (offer && offer.offerType === "gamepass" && offer.productId === pid) {
			const colors = getOfferColors(offerId);
			recolourOffer(model, ui, colors.fill, colors.accent);
			// Destroy the current prompt so it gets recreated with updated text
			if (ui.interactPrompt) {
				ui.interactPrompt.Destroy();
				ui.interactPrompt = undefined;
			}
		}
	}
});

function createPremiumOfferBillboard(model: Model): BillboardGui {
	const offerId = model.GetAttribute("offerId") as string;
	const offer = getPremiumOffer(offerId);
	const displayName = offer ? offer.title : model.Name;
	const colors = getOfferColors(offerId);
	const accentColor = colors.accent;

	const billboard = new Instance("BillboardGui");
	billboard.Size = new UDim2(5, 0, 1.4, 0);
	billboard.MaxDistance = math.huge;
	billboard.StudsOffset = new Vector3(0, 3.2, 0);
	billboard.AlwaysOnTop = false;
	billboard.Parent = model;

	const card = new Instance("Frame");
	card.Name = "OfferCard";
	card.Size = new UDim2(1, 0, 0.65, 0);
	card.Position = new UDim2(0, 0, 0, 0);
	card.BackgroundColor3 = UI_THEME.bg;
	card.BackgroundTransparency = 0.06;
	card.BorderSizePixel = 0;
	card.Visible = false;
	card.Parent = billboard;

	const cardCorner = new Instance("UICorner");
	cardCorner.CornerRadius = new UDim(0, 5);
	cardCorner.Parent = card;

	const cardStroke = new Instance("UIStroke");
	cardStroke.Color = accentColor;
	cardStroke.Thickness = 1.2;
	cardStroke.Parent = card;

	const nameLabel = new Instance("TextLabel");
	nameLabel.Name = "TextLabel";
	nameLabel.Size = new UDim2(1, -10, 0.9, 0);
	nameLabel.Position = new UDim2(0, 5, 0.05, 0);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.TextColor3 = accentColor;
	nameLabel.Font = UI_THEME.fontDisplay;
	nameLabel.TextSize = scaleUI(24);
	nameLabel.Text = displayName;
	nameLabel.TextStrokeColor3 = Color3.fromRGB(0, 0, 0);
	nameLabel.TextStrokeTransparency = 0.35;
	nameLabel.BorderSizePixel = 0;
	nameLabel.Parent = card;

	return billboard;
}

function createPremiumOfferPrompt(billboard: BillboardGui, model: Model): TextButton {
	const offerId = model.GetAttribute("offerId") as string;
	const owned = isOfferOwned(offerId);
	const colors = getOfferColors(offerId);
	const accentColor = colors.accent;
	let labelText: string;
	if (owned) {
		labelText = IS_MOBILE ? "INSPECT" : "INSPECT  [E]";
	} else {
		labelText = IS_MOBILE ? "VIEW OFFER" : "VIEW OFFER  [E]";
	}

	const button = new Instance("TextButton");
	button.Size = new UDim2(1, 0, 0.42, 0);
	button.Position = new UDim2(0, 0, 0.68, 0);
	button.BackgroundColor3 = UI_THEME.bgInset;
	button.BackgroundTransparency = 0.1;
	button.TextColor3 = accentColor;
	button.TextTransparency = 0.15;
	button.Font = UI_THEME.fontBold;
	button.TextSize = scaleUI(14);
	button.Text = labelText;
	button.TextStrokeColor3 = Color3.fromRGB(0, 0, 0);
	button.TextStrokeTransparency = 0.55;
	button.BorderSizePixel = 0;
	button.Parent = billboard;

	const btnCorner = new Instance("UICorner");
	btnCorner.CornerRadius = new UDim(0, 4);
	btnCorner.Parent = button;

	const btnStroke = new Instance("UIStroke");
	btnStroke.Color = accentColor;
	btnStroke.Thickness = 0.8;
	btnStroke.Parent = button;

	button.MouseButton1Click.Connect(() => {
		requestOpenPremiumOffer(model);
	});

	if (IS_MOBILE) pulseActionButton();
	return button;
}

function setupPremiumOfferProximity(model: Model): void {
	if (premiumOfferUIMap.has(model)) return;

	const billboard = createPremiumOfferBillboard(model);
	const nameLabel = billboard.FindFirstChild("TextLabel") as TextLabel;

	premiumOfferUIMap.set(model, {
		billboard,
		nameLabel,
		interactPrompt: undefined,
	});

	// ── Ambient visual effects: bob, rotate, glow ───────────────────────
	const pivot = model.GetPivot();

	// Anchor every part so physics doesn't interfere
	const allParts = model.GetDescendants().filter((d): d is BasePart => d.IsA("BasePart"));
	for (const part of allParts) {
		part.Anchored = true;
	}

	// Determine colour based on offer type + ownership
	const offerId = model.GetAttribute("offerId") as string;
	const colors = getOfferColors(offerId);
	const fillColor = colors.fill;
	const accentColor = colors.accent;

	// Highlight — subtle fill + outline over the entire model
	const highlight = new Instance("Highlight");
	highlight.FillColor = fillColor;
	highlight.FillTransparency = 0.75;
	highlight.OutlineColor = accentColor;
	highlight.OutlineTransparency = 0.4;
	highlight.DepthMode = Enum.HighlightDepthMode.Occluded;
	highlight.Parent = model;

	// Point light on first part
	const firstPart = allParts[0];
	if (firstPart) {
		const glow = new Instance("PointLight");
		glow.Name = "PremiumGlow";
		glow.Color = accentColor;
		glow.Brightness = 0.8;
		glow.Range = 8;
		glow.Parent = firstPart;

		// Sparkle particles
		const emitter = new Instance("ParticleEmitter");
		emitter.Texture = "rbxasset://textures/particles/sparkles_main.dds";
		emitter.Color = new ColorSequence(accentColor);
		emitter.Size = new NumberSequence(0.2, 0);
		emitter.Lifetime = new NumberRange(0.4, 0.9);
		emitter.Rate = 10;
		emitter.Speed = new NumberRange(0.5, 1.5);
		emitter.SpreadAngle = new Vector2(180, 180);
		emitter.Transparency = new NumberSequence([
			new NumberSequenceKeypoint(0, 0.5),
			new NumberSequenceKeypoint(1, 1),
		]);
		emitter.LightEmission = 0.6;
		emitter.Parent = firstPart;
	}

	// Continuous bob + rotate via Heartbeat
	let elapsed = 0;
	RunService.Heartbeat.Connect((dt) => {
		if (!model.Parent) return;
		elapsed += dt;

		// Bob: 0.5 stud amplitude, 1.5s period
		const bobOffset = math.sin((elapsed * math.pi * 2) / 1.5) * 0.5;

		// Rotate: one full revolution every 8 seconds
		const angle = (elapsed / 8) * math.pi * 2;

		const newCF = pivot.mul(CFrame.Angles(0, angle, 0)).add(new Vector3(0, bobOffset, 0));
		model.PivotTo(newCF);
	});
}

function isNPCInCameraFrame(camera: Instance, npcPosition: Vector3): boolean {
	// Simplified: just check if NPC is close enough (proximity-based button show)
	// Camera frame checks were causing issues, so we rely on proximity range instead
	return true;
}

// ── Wanted Player Billboards ────────────────────────────────────────────────────

function createWantedBillboard(character: Model, playerName: string, gold: number): void {
	removeWantedBillboard(playerName);
	const head = character.FindFirstChild("Head") as BasePart;
	if (!head) return;

	// Hide default Roblox name display
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (humanoid) {
		humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None;
	}

	const billboard = new Instance("BillboardGui");
	billboard.Name = "WantedBillboard";
	billboard.Size = new UDim2(5, 0, 2.0, 0);
	billboard.MaxDistance = 100;
	billboard.StudsOffset = new Vector3(0, 2.5, 0);
	billboard.AlwaysOnTop = false;
	billboard.Parent = head;

	// Info frame — dark themed
	const info = new Instance("Frame");
	info.Name = "Info";
	info.Size = new UDim2(1, 0, 0.75, 0);
	info.Position = new UDim2(0, 0, 0.25, 0);
	info.BackgroundColor3 = UI_THEME.bg;
	info.BackgroundTransparency = 0.06;
	info.BorderSizePixel = 0;
	info.Parent = billboard;

	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(0, 4);
	corner.Parent = info;

	const stroke = new Instance("UIStroke");
	stroke.Color = UI_THEME.danger;
	stroke.Thickness = UI_THEME.strokeThickness;
	stroke.Parent = info;

	// "WANTED" header
	const wantedTag = new Instance("TextLabel");
	wantedTag.Name = "WantedTag";
	wantedTag.Size = new UDim2(1, 0, 0.28, 0);
	wantedTag.Position = new UDim2(0, 0, 0.02, 0);
	wantedTag.BackgroundTransparency = 1;
	wantedTag.TextColor3 = Color3.fromRGB(190, 50, 40);
	wantedTag.Font = UI_THEME.fontBold;
	wantedTag.TextSize = scaleUI(12);
	wantedTag.Text = "WANTED";
	wantedTag.TextStrokeColor3 = Color3.fromRGB(0, 0, 0);
	wantedTag.TextStrokeTransparency = 0.4;
	wantedTag.Parent = info;

	// Player name — bright red
	const nameLabel = new Instance("TextLabel");
	nameLabel.Name = "NameLabel";
	nameLabel.Size = new UDim2(1, -8, 0.38, 0);
	nameLabel.Position = new UDim2(0, 4, 0.28, 0);
	nameLabel.BackgroundTransparency = 1;
	nameLabel.TextColor3 = Color3.fromRGB(210, 55, 45);
	nameLabel.Font = UI_THEME.fontDisplay;
	nameLabel.TextSize = scaleUI(24);
	nameLabel.Text = playerName;
	nameLabel.TextStrokeColor3 = Color3.fromRGB(0, 0, 0);
	nameLabel.TextStrokeTransparency = 0.3;
	nameLabel.Parent = info;

	// Gold reward
	const goldLabel = new Instance("TextLabel");
	goldLabel.Name = "GoldLabel";
	goldLabel.Size = new UDim2(1, 0, 0.28, 0);
	goldLabel.Position = new UDim2(0, 0, 0.68, 0);
	goldLabel.BackgroundTransparency = 1;
	goldLabel.TextColor3 = Color3.fromRGB(215, 175, 60);
	goldLabel.Font = UI_THEME.fontBold;
	goldLabel.TextSize = scaleUI(14);
	goldLabel.Text = gold + " Gold";
	goldLabel.TextStrokeColor3 = Color3.fromRGB(0, 0, 0);
	goldLabel.TextStrokeTransparency = 0.45;
	goldLabel.Parent = info;

	wantedBillboards.set(playerName, billboard);
}

function updateWantedGold(playerName: string, gold: number): void {
	const billboard = wantedBillboards.get(playerName);
	if (!billboard) return;
	const info = billboard.FindFirstChild("Info") as Frame;
	if (!info) return;
	const goldLabel = info.FindFirstChild("GoldLabel") as TextLabel;
	if (goldLabel) goldLabel.Text = gold + " Gold";
}

function removeWantedBillboard(playerName: string): void {
	const billboard = wantedBillboards.get(playerName);
	if (billboard) {
		billboard.Destroy();
		wantedBillboards.delete(playerName);
	}
}

function handlePlayerWanted(payload: PlayerWantedPayload): void {
	if (payload.playerName === Players.LocalPlayer.Name) return;
	wantedPlayerInfo.set(payload.playerName, { gold: payload.gold, displayName: payload.displayName });
	// Remove the regular gold billboard — wanted one takes over
	removePlayerBillboard(payload.playerName);
	const targetPlayer = Players.FindFirstChild(payload.playerName) as Player | undefined;
	if (targetPlayer && targetPlayer.IsA("Player") && targetPlayer.Character) {
		if (wantedBillboards.has(payload.playerName)) {
			updateWantedGold(payload.playerName, payload.gold);
		} else {
			createWantedBillboard(targetPlayer.Character, payload.playerName, payload.gold);
		}
	}
}

function handlePlayerWantedCleared(playerName: string): void {
	wantedPlayerInfo.delete(playerName);
	removeWantedBillboard(playerName);
	// Restore regular gold billboard
	const targetPlayer = Players.FindFirstChild(playerName) as Player | undefined;
	if (targetPlayer && targetPlayer.IsA("Player") && targetPlayer.Character) {
		const humanoid = targetPlayer.Character.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None;
		}
		createPlayerBillboard(targetPlayer.Character, playerName, playerTitles.get(playerName));
	}
}

/** Re-create billboards for wanted players after respawn or late join. */
function ensureWantedBillboards(): void {
	for (const [playerName, info] of wantedPlayerInfo) {
		if (playerName === Players.LocalPlayer.Name) continue;
		const targetPlayer = Players.FindFirstChild(playerName) as Player | undefined;
		if (!targetPlayer || !targetPlayer.IsA("Player") || !targetPlayer.Character) {
			if (wantedBillboards.has(playerName)) removeWantedBillboard(playerName);
			continue;
		}
		const existing = wantedBillboards.get(playerName);
		if (!existing || !existing.Parent) {
			createWantedBillboard(targetPlayer.Character, playerName, info.gold);
		}
	}
}

function updateNPCProximityUI() {
	const player = Players.LocalPlayer;
	if (!player || !player.Character) return;

	const playerPosition = (player.Character.FindFirstChild("HumanoidRootPart") as BasePart)?.Position;
	if (!playerPosition) return;

	const camera = Workspace.CurrentCamera;
	if (!camera) return;
	let closestNPC: Model | undefined;
	let closestDistance = MERCHANT_PROXIMITY_RANGE + 1;
	let npcCount = 0;
	let inRangeCount = 0;

	// First pass: find closest NPC in range and in camera frame
	for (const [npc, ui] of npcUIMap) {
		npcCount = npcCount + 1;
		if (!npc.Parent) {
			npcUIMap.delete(npc);
			ui.billboard.Destroy();
			continue;
		}

		// Get NPC position
		let npcPosition: Vector3 | undefined;
		if (npc.PrimaryPart) {
			npcPosition = npc.PrimaryPart.Position;
		} else {
			const hrp = npc.FindFirstChild("HumanoidRootPart") as BasePart;
			if (hrp) {
				npcPosition = hrp.Position;
			} else {
				const bp = npc.FindFirstChildOfClass("BasePart") as BasePart;
				if (bp) {
					npcPosition = bp.Position;
				}
			}
		}

		if (!npcPosition) continue;

		const distance = playerPosition.sub(npcPosition).Magnitude;

		// Update card visibility based on distance
		const nameVisible = distance <= NAME_VISIBLE_RANGE;
		const npcCard = ui.billboard.FindFirstChild("NPCCard") as Frame | undefined;
		if (npcCard) {
			npcCard.Visible = nameVisible;
		}

		// Track closest NPC in range (camera frame check optional for tracking)
		const npcMaxRange =
			hasNPCDialog(npc.Name) || npc.GetAttribute("Interaction") !== undefined
				? MERCHANT_PROXIMITY_RANGE
				: PROXIMITY_RANGE;
		if (distance <= npcMaxRange) {
			inRangeCount = inRangeCount + 1;
			const inCameraFrame = isNPCInCameraFrame(camera, npcPosition);
			if (inCameraFrame && distance < closestDistance) {
				closestDistance = distance;
				closestNPC = npc;
			}
		}
	}

	// ── Refresh cached world-object lists periodically ─────────────────────────────
	const now = os.clock();
	if (now - lastWorldScanTick >= WORLD_SCAN_INTERVAL) {
		lastWorldScanTick = now;
		cachedInspectables = Workspace.GetDescendants().filter(
			(inst): inst is Model => inst.IsA("Model") && inst.GetAttribute("inspectId") !== undefined,
		);
		cachedOfferModels = Workspace.GetDescendants().filter(
			(inst): inst is Model => inst.IsA("Model") && inst.GetAttribute("offerId") !== undefined,
		);
	}

	// ── Inspectable object proximity ────────────────────────────────────────────────
	closestInspectableInRange = undefined;
	closestInspectableDist = math.huge;
	{
		let closestInspDist = INSPECT_RANGE + 1;
		for (const model of cachedInspectables) {
			if (!model.Parent) continue;
			setupInspectableProximity(model);
			const part = model.PrimaryPart ?? (model.FindFirstChildWhichIsA("BasePart") as BasePart | undefined);
			if (!part) continue;
			const dist = playerPosition.sub(part.Position).Magnitude;

			// Show/hide the name card based on a wider visible range
			const ui = inspectableUIMap.get(model);
			if (ui) {
				const card = ui.billboard.FindFirstChild("InspectCard") as Frame | undefined;
				if (card) card.Visible = dist <= INSPECT_RANGE;
			}

			if (dist < closestInspDist) {
				closestInspDist = dist;
				closestInspectableInRange = model;
				closestInspectableDist = dist;
			}
		}

		// Clean up billboards for inspectables that no longer exist
		for (const [model, ui] of inspectableUIMap) {
			if (!model.Parent) {
				ui.billboard.Destroy();
				inspectableUIMap.delete(model);
			}
		}
	}

	// ── Premium offer object proximity ──────────────────────────────────────────────
	closestPremiumOfferInRange = undefined;
	closestPremiumOfferDist = math.huge;
	{
		let closestOfferDist = PREMIUM_OFFER_RANGE + 1;
		for (const model of cachedOfferModels) {
			if (!model.Parent) continue;
			setupPremiumOfferProximity(model);
			const part = model.PrimaryPart ?? (model.FindFirstChildWhichIsA("BasePart") as BasePart | undefined);
			if (!part) continue;
			const dist = playerPosition.sub(part.Position).Magnitude;

			// Show/hide the name card
			const ui = premiumOfferUIMap.get(model);
			if (ui) {
				const card = ui.billboard.FindFirstChild("OfferCard") as Frame | undefined;
				if (card) card.Visible = dist <= PREMIUM_OFFER_RANGE;
			}

			if (dist < closestOfferDist) {
				closestOfferDist = dist;
				closestPremiumOfferInRange = model;
				closestPremiumOfferDist = dist;
			}
		}

		// Clean up billboards for offer models that no longer exist
		for (const [model, ui] of premiumOfferUIMap) {
			if (!model.Parent) {
				ui.billboard.Destroy();
				premiumOfferUIMap.delete(model);
			}
		}
	}

	// ── Wanted player proximity ─────────────────────────────────────────────────────
	closestWantedPlayerInRange = undefined;
	ensureWantedBillboards();

	let closestWantedDist = WANTED_PLAYER_RANGE + 1;
	for (const [wantedName] of wantedPlayerInfo) {
		if (wantedName === player.Name) continue;
		const wantedPlayer = Players.FindFirstChild(wantedName) as Player | undefined;
		if (!wantedPlayer || !wantedPlayer.IsA("Player") || !wantedPlayer.Character) continue;
		const hrp = wantedPlayer.Character.FindFirstChild("HumanoidRootPart") as BasePart;
		if (!hrp) continue;
		const dist = playerPosition.sub(hrp.Position).Magnitude;
		if (dist <= WANTED_PLAYER_RANGE && dist < closestWantedDist) {
			closestWantedDist = dist;
			closestWantedPlayerInRange = wantedPlayer.Character;
		}
	}

	// Wanted player takes priority over NPC if both are in range
	if (closestWantedPlayerInRange) {
		closestNPC = undefined;
	}

	// Update global closest NPC for E key handling
	closestNPCInRange = closestNPC;
	closestNPCDist = closestNPC ? closestDistance : math.huge;

	// Determine which interactable type is nearest overall (NPC talk vs inspect vs offer)
	const npcIsNearest =
		closestNPCInRange !== undefined &&
		closestNPCDist <= closestInspectableDist &&
		closestNPCDist <= closestPremiumOfferDist;
	const inspectIsNearest =
		closestInspectableInRange !== undefined &&
		closestInspectableDist < closestNPCDist &&
		closestInspectableDist <= closestPremiumOfferDist;
	const offerIsNearest =
		closestPremiumOfferInRange !== undefined &&
		closestPremiumOfferDist < closestNPCDist &&
		closestPremiumOfferDist < closestInspectableDist;

	// Second pass: update assassinate buttons and talk buttons (only on closest NPC)
	for (const [npc, ui] of npcUIMap) {
		const npcIsKillable = isNPCKillable(npc.Name);
		const npcHasDialog = hasNPCDialog(npc.Name) || npc.GetAttribute("Interaction") !== undefined;
		const talkRange = npcHasDialog ? MERCHANT_PROXIMITY_RANGE : PROXIMITY_RANGE;
		const inTalkRange = npc === closestNPC && closestDistance <= talkRange;
		const shouldShowAssassinate = npc === closestNPC && npcIsKillable && closestDistance <= PROXIMITY_RANGE;
		const shouldShowTalk = inTalkRange && npcIsNearest && !isDialogOpen();

		if (shouldShowAssassinate) {
			if (!ui.assassinateButton) {
				ui.assassinateButton = createAssassinateButton(ui.billboard, npc);
			}
		} else {
			if (ui.assassinateButton) {
				fadeOutAndDestroy(ui.assassinateButton);
				ui.assassinateButton = undefined;
			}
		}

		if (shouldShowTalk) {
			if (!ui.talkButton) {
				ui.talkButton = createTalkButton(ui.billboard, npc);
			}
		} else {
			if (ui.talkButton) {
				fadeOutAndDestroy(ui.talkButton);
				ui.talkButton = undefined;
			}
		}
	}

	// Inspectable pass: show/hide inspect prompt on closest inspectable (only if nearest overall)
	for (const [model, ui] of inspectableUIMap) {
		const shouldShow = model === closestInspectableInRange && inspectIsNearest && !isDialogOpen();
		if (shouldShow) {
			if (!ui.inspectPrompt) {
				ui.inspectPrompt = createInspectPrompt(ui.billboard, model);
			}
		} else {
			if (ui.inspectPrompt) {
				ui.inspectPrompt.Destroy();
				ui.inspectPrompt = undefined;
			}
		}
	}

	// Premium offer pass: show/hide interact prompt on closest offer model (only if nearest overall)
	for (const [model, ui] of premiumOfferUIMap) {
		const shouldShow = model === closestPremiumOfferInRange && offerIsNearest && !isDialogOpen();
		if (shouldShow) {
			if (!ui.interactPrompt) {
				ui.interactPrompt = createPremiumOfferPrompt(ui.billboard, model);
			}
		} else {
			if (ui.interactPrompt) {
				ui.interactPrompt.Destroy();
				ui.interactPrompt = undefined;
			}
		}
	}

	// Third pass: show/hide assassination prompt on wanted players
	for (const [wantedName] of wantedPlayerInfo) {
		const billboard = wantedBillboards.get(wantedName);
		if (!billboard) continue;

		const wantedPlayer = Players.FindFirstChild(wantedName) as Player | undefined;
		const shouldShow =
			wantedPlayer !== undefined &&
			wantedPlayer.IsA("Player") &&
			wantedPlayer.Character === closestWantedPlayerInRange;

		const existingBtn = billboard.FindFirstChild("AssassinateBtn") as TextButton | undefined;

		if (shouldShow && !existingBtn) {
			const btn = new Instance("TextButton");
			btn.Name = "AssassinateBtn";
			btn.Size = new UDim2(1, 0, 0.17, 0);
			btn.Position = new UDim2(0, 0, 0.78, 0);
			btn.BackgroundColor3 = Color3.fromRGB(28, 8, 8);
			btn.BackgroundTransparency = 1;
			btn.TextColor3 = BTN_COLOR;
			btn.TextTransparency = 1;
			btn.Font = UI_THEME.fontBold;
			btn.TextSize = scaleUI(14);
			btn.Text = IS_MOBILE ? "Kill" : "Kill [Q]";
			btn.BorderSizePixel = 0;
			btn.Parent = billboard;

			const btnCorner = new Instance("UICorner");
			btnCorner.CornerRadius = new UDim(0, 4);
			btnCorner.Parent = btn;

			const btnStroke = new Instance("UIStroke");
			btnStroke.Color = BTN_COLOR;
			btnStroke.Thickness = 0.8;
			btnStroke.Parent = btn;

			btn.MouseButton1Click.Connect(() => {
				if (wantedPlayer && wantedPlayer.IsA("Player") && wantedPlayer.Character) {
					playerAssassinationRemote.FireServer(wantedPlayer.Character);
				}
			});
			if (IS_MOBILE) pulseKillButton();
			fadeInButton(btn);
		} else if (!shouldShow && existingBtn) {
			fadeOutAndDestroy(existingBtn);
		}
	}
}

// Resolved lazily inside initializeNPCProximity once the server is ready
let playerAssassinationRemote: RemoteEvent;

function initializeNPCProximity() {
	const player = Players.LocalPlayer;
	if (!player) return;

	// Resolve now — server has created all bounty remotes by this point
	playerAssassinationRemote = getPlayerAssassinationRemote();

	// Gold billboards for all non-wanted players
	setupRegularPlayerBillboards();

	// Fetch all players' current titles, then rebuild billboards
	task.spawn(() => {
		const allTitles = getAllTitlesRemote().InvokeServer() as Record<string, string>;
		for (const [pName, tId] of pairs(allTitles)) {
			playerTitles.set(pName as string, tId as string);
		}
		for (const p of Players.GetPlayers()) {
			if (p === player) continue;
			if (p.Character && !wantedPlayerInfo.has(p.Name)) {
				createPlayerBillboard(p.Character, p.Name, playerTitles.get(p.Name));
			}
		}
	});

	// Listen for title changes broadcast from the server (spawned so WaitForChild doesn't block init)
	task.spawn(() => {
		getTitleSyncRemote().OnClientEvent.Connect((pNameRaw: unknown, tIdRaw: unknown) => {
			const pName = pNameRaw as string;
			const tId = tIdRaw as string;
			playerTitles.set(pName, tId);
			if (!wantedPlayerInfo.has(pName)) {
				const targetPlayer = Players.FindFirstChild(pName) as Player | undefined;
				if (targetPlayer && targetPlayer.IsA("Player") && targetPlayer.Character) {
					createPlayerBillboard(targetPlayer.Character, pName, tId);
				}
			}
		});
	});

	// Find existing NPCs in workspace (exclude player characters)
	const existingNPCs = Workspace.GetDescendants().filter((inst): inst is Model => {
		if (!inst.IsA("Model") || inst.FindFirstChild("Humanoid") === undefined) return false;
		// Exclude player characters by checking if they're in Players
		const playerObj = Players.FindFirstChild(inst.Name);
		if (playerObj && playerObj.IsA("Player")) {
			const playerChar = (playerObj as Player).Character;
			if (playerChar === inst) return false;
		}
		return true;
	});
	existingNPCs.forEach((npc) => {
		setupNPCProximity(npc as Model);
	});

	// Listen for new NPCs being added (excluding player characters)
	Workspace.DescendantAdded.Connect((descendant) => {
		if (descendant.IsA("Model") && descendant.FindFirstChild("Humanoid")) {
			// Exclude player characters
			const playerObj = Players.FindFirstChild(descendant.Name);
			if (playerObj && playerObj.IsA("Player")) {
				const playerChar = (playerObj as Player).Character;
				if (playerChar === descendant) return;
			}
			task.wait(0.1);
			setupNPCProximity(descendant as Model);
		}
	});

	// ── Wanted player remote listeners ──────────────────────────────────────────
	getPlayerWantedRemote().OnClientEvent.Connect((data: unknown) => {
		handlePlayerWanted(data as PlayerWantedPayload);
	});

	getPlayerWantedClearedRemote().OnClientEvent.Connect((playerName: unknown) => {
		handlePlayerWantedCleared(playerName as string);
	});

	getBountyListSyncRemote().OnClientEvent.Connect((_npcBounty: unknown, wanted: unknown) => {
		for (const entry of (wanted ?? []) as PlayerWantedPayload[]) {
			handlePlayerWanted(entry);
		}
	});

	Players.PlayerRemoving.Connect((leavingPlayer) => {
		handlePlayerWantedCleared(leavingPlayer.Name);
	});

	// Update proximity UI ~10 times per second (not every frame)
	let proximityAccum = 0;
	const PROXIMITY_TICK = 0.1;
	RunService.RenderStepped.Connect((dt) => {
		proximityAccum += dt;
		if (proximityAccum >= PROXIMITY_TICK) {
			proximityAccum -= PROXIMITY_TICK;
			updateNPCProximityUI();
		}
	});
}

/**
 * Returns the current action context for the mobile HUD primary button.
 * Priority: assassinate (wanted player) > assassinate (NPC) > talk > none.
 * "none" means no valid action — the button should be hidden.
 */
export type ActionContext =
	| "assassinate_player"
	| "assassinate_npc"
	| "talk"
	| "inspect"
	| "premium_offer"
	| "jump"
	| "none";

export function getActionContext(): ActionContext {
	if (isDialogOpen()) return "jump";

	// Pick whichever interactable is closest to the player
	type Candidate = { ctx: ActionContext; dist: number };
	const candidates: Candidate[] = [];
	if (closestNPCInRange) candidates.push({ ctx: "talk", dist: closestNPCDist });
	if (closestInspectableInRange) candidates.push({ ctx: "inspect", dist: closestInspectableDist });
	if (closestPremiumOfferInRange) candidates.push({ ctx: "premium_offer", dist: closestPremiumOfferDist });

	if (candidates.size() === 0) return "jump";
	candidates.sort((a, b) => a.dist < b.dist);
	return candidates[0].ctx;
}

/** Returns whether an assassination target is currently in range. */
export function getAssassinateContext(): "assassinate_player" | "assassinate_npc" | "none" {
	if (closestWantedPlayerInRange) return "assassinate_player";
	if (closestNPCInRange && isNPCKillable(closestNPCInRange.Name)) return "assassinate_npc";
	return "none";
}

/** Fire the assassination action (called by dedicated kill button). */
export function fireAssassinateAction(): void {
	const ctx = getAssassinateContext();
	if (ctx === "assassinate_player" && closestWantedPlayerInRange) {
		playerAssassinationRemote.FireServer(closestWantedPlayerInRange);
	} else if (ctx === "assassinate_npc" && closestNPCInRange) {
		assassinationRemote.FireServer(closestNPCInRange);
	}
}

/** Fire the current action (called by mobile HUD primary button). */
export function fireCurrentAction(): void {
	const ctx = getActionContext();
	if (ctx === "talk" && closestNPCInRange) {
		requestOpenDialog(closestNPCInRange);
	} else if (ctx === "inspect" && closestInspectableInRange) {
		requestOpenInspect(closestInspectableInRange);
	} else if (ctx === "premium_offer" && closestPremiumOfferInRange) {
		requestOpenPremiumOffer(closestPremiumOfferInRange);
	} else if (ctx === "jump") {
		const humanoid = Players.LocalPlayer.Character?.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			humanoid.Jump = true;
			humanoid.ChangeState(Enum.HumanoidStateType.Jumping);
		}
	}
}

export { initializeNPCProximity };
