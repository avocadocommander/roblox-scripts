/**
 * AnalyticsTracker — centralized server-side analytics gateway.
 *
 * All gameplay systems route through this module. Direct calls to
 * `AnalyticsService` are forbidden — keep them in this file so the safe-wrapper
 * (pcall) and the per-event field schema stay consistent.
 *
 * What lives here:
 *  1. Tutorial funnel tracking via `AnalyticsService:LogOnboardingFunnelStepEvent`,
 *     deduped per player so each step fires at most once per session.
 *  2. Custom gameplay event tracking via `AnalyticsService:LogCustomEvent`.
 *     Fields are picked from a strict low-cardinality allowlist (see
 *     `shared/config/analytics-events.ts`).
 *  3. Safe wrappers — every analytics call is pcall'd. If analytics ever fails,
 *     gameplay continues unaffected.
 *  4. Per-player session tracker — captures join time, platform/device context,
 *     tutorial-completion state, and the highest tutorial step seen so far.
 *
 * Public API:
 *   initializeAnalyticsTracker()         — wire up player lifecycle hooks
 *   trackEvent(player, eventName, fields?) — fire a custom event
 *   trackTutorialStep(player, stepKey)    — fire a tutorial funnel step
 *   markTutorialCompleted(player)         — mark session as past-tutorial (no event)
 */

import { AnalyticsService, Players } from "@rbxts/services";
import { log } from "shared/helpers";
import { getPlayerStateSnapshot, hasAchievement, onPlayerStateLoaded } from "shared/player-state";
import { getOrCreateAnalyticsContextRemote } from "shared/remotes/analytics-remote";
import { getOrCreateUIEventRemote, UI_OPEN_EVENTS } from "shared/remotes/ui-event-remote";
import { getOnboardingAchievementIds } from "shared/config/onboarding-steps";
import { WEAPONS } from "shared/config/weapons";
import { POISONS } from "shared/config/poisons";
import { ELIXIRS } from "shared/config/elixirs";
import { ShopType } from "shared/config/shop-types";
import {
	ANALYTICS_EVENTS,
	AnalyticsEventName,
	AnalyticsField,
	EVENT_FIELD_SLOTS,
	ONBOARDING_ACHIEVEMENT_TO_TUTORIAL_STEP,
	TUTORIAL_FIELD_SLOTS,
	TUTORIAL_FINAL_STEP,
	TUTORIAL_STEPS,
	TutorialStepKey,
	levelBucket,
	remainingTimeBucket,
	sessionMinuteBucket,
} from "shared/config/analytics-events";

const TAG = "[ANALYTICS]";

// ── Session state ─────────────────────────────────────────────────────────────

interface SessionState {
	joinTime: number;
	platform: string;
	deviceType: string;
	tutorialCompleted: boolean;
	/** Highest tutorial step number already fired this session (dedupe). */
	lastTutorialStep: number;
	/** True once `TargetFound` has fired for the current bounty assignment. */
	targetFoundForCurrentBounty: boolean;
	/** Death reason to attach to the next PlayerDied event. Cleared on use. */
	pendingDeathReason: string | undefined;
}

const SESSIONS = new Map<Player, SessionState>();

const DEFAULT_PLATFORM = "Unknown";
const DEFAULT_DEVICE = "Unknown";

function getOrCreateSession(player: Player): SessionState {
	let session = SESSIONS.get(player);
	if (!session) {
		session = {
			joinTime: os.time(),
			platform: DEFAULT_PLATFORM,
			deviceType: DEFAULT_DEVICE,
			tutorialCompleted: false,
			lastTutorialStep: 0,
			targetFoundForCurrentBounty: false,
			pendingDeathReason: undefined,
		};
		SESSIONS.set(player, session);
	}
	return session;
}

// ── Safe wrappers ─────────────────────────────────────────────────────────────

/**
 * Run an analytics call inside pcall. Failures are logged once and swallowed —
 * analytics must never break gameplay.
 */
function safe(label: string, fn: () => void): void {
	const [ok, err] = pcall(fn);
	if (!ok) {
		warn(`${TAG} ${label} failed: ${err}`);
	}
}

// ── Field resolution ──────────────────────────────────────────────────────────

/**
 * Resolve a single allowlisted field name into its current string value for
 * `player`. Caller-provided overrides win. Undefined means "skip this slot".
 */
function resolveField(
	player: Player,
	field: AnalyticsField,
	overrides: Partial<Record<AnalyticsField, string | boolean | number>> | undefined,
	session: SessionState,
): string | undefined {
	const overrideValue = overrides ? overrides[field] : undefined;
	if (overrideValue !== undefined) {
		if (typeIs(overrideValue, "boolean")) return overrideValue ? "true" : "false";
		return tostring(overrideValue);
	}

	switch (field) {
		case "platform":
			return session.platform;
		case "deviceType":
			return session.deviceType;
		case "tutorialCompleted":
			return session.tutorialCompleted ? "true" : "false";
		case "currentLevelBucket": {
			const state = getPlayerStateSnapshot(player);
			const level = state ? state.level : 1;
			return levelBucket(level);
		}
		case "sessionMinuteBucket": {
			const minutes = (os.time() - session.joinTime) / 60;
			return sessionMinuteBucket(minutes);
		}
		default:
			// weaponType / shopType / deathReason — only meaningful when the caller
			// supplies them. If not provided, omit the slot.
			return undefined;
	}
}

/**
 * Build the `{ [Enum.AnalyticsCustomFieldKeys.CustomFieldNN]: string }` table
 * that AnalyticsService consumes. Up to three slots, in the order declared by
 * the per-event schema. Slots with no value are omitted entirely.
 */
function buildCustomFields(
	player: Player,
	slots: readonly AnalyticsField[],
	overrides: Partial<Record<AnalyticsField, string | boolean | number>> | undefined,
	session: SessionState,
): object {
	const out = new Map<unknown, string>();
	const slotKeys = [
		Enum.AnalyticsCustomFieldKeys.CustomField01,
		Enum.AnalyticsCustomFieldKeys.CustomField02,
		Enum.AnalyticsCustomFieldKeys.CustomField03,
	];
	const limit = math.min(slots.size(), slotKeys.size());
	for (let i = 0; i < limit; i++) {
		const field = slots[i];
		const value = resolveField(player, field, overrides, session);
		if (value === undefined) continue;
		// Embed the field name in the value so dashboards stay self-describing
		// even if the slot meaning changes later. Keeps cardinality low because
		// the prefix is constant per event.
		out.set(slotKeys[i], `${field}:${value}`);
	}
	return out as unknown as object;
}

// ── Public API: custom events ─────────────────────────────────────────────────

/**
 * Fire a custom analytics event for `player`. Pulls auto-fields (platform,
 * level bucket, etc.) from session state; caller-supplied `fields` override
 * any auto-field by the same name. Unknown field names are rejected at compile
 * time by `AnalyticsField`.
 */
export function trackEvent(
	player: Player,
	eventName: AnalyticsEventName,
	fields?: Partial<Record<AnalyticsField, string | boolean | number>>,
): void {
	if (!player.IsDescendantOf(Players)) return;
	const session = getOrCreateSession(player);
	const slots = EVENT_FIELD_SLOTS[eventName];
	safe(`LogCustomEvent(${eventName})`, () => {
		const customFields = buildCustomFields(player, slots, fields, session);
		AnalyticsService.LogCustomEvent(player, eventName, 1, customFields);
	});
}

// ── Public API: tutorial funnel ───────────────────────────────────────────────

/**
 * Fire a tutorial onboarding-funnel step for `player`. Each step fires at most
 * once per session — repeated calls are silently ignored. Reaching the final
 * step also flips `tutorialCompleted` for all subsequent custom events.
 */
export function trackTutorialStep(player: Player, stepKey: TutorialStepKey): void {
	if (!player.IsDescendantOf(Players)) return;
	const session = getOrCreateSession(player);
	const def = TUTORIAL_STEPS[stepKey];
	if (def.step <= session.lastTutorialStep) return;
	session.lastTutorialStep = def.step;
	if (def.step >= TUTORIAL_FINAL_STEP) {
		session.tutorialCompleted = true;
	}
	safe(`LogOnboardingFunnelStepEvent(${def.name})`, () => {
		const customFields = buildCustomFields(player, TUTORIAL_FIELD_SLOTS, undefined, session);
		AnalyticsService.LogOnboardingFunnelStepEvent(player, def.step, def.name, customFields);
	});
}

/**
 * Mark the session as past-tutorial without firing a funnel event. Useful when
 * the server detects on join that the player has already completed onboarding
 * (e.g. via persisted achievement state) and we just need the field set to
 * `true` on subsequent custom events.
 */
export function markTutorialCompleted(player: Player): void {
	const session = getOrCreateSession(player);
	session.tutorialCompleted = true;
	if (session.lastTutorialStep < TUTORIAL_FINAL_STEP) {
		session.lastTutorialStep = TUTORIAL_FINAL_STEP;
	}
}

/**
 * Bridge from achievement unlock → tutorial funnel step. Called by
 * `awardAchievement` for every unlock; no-op if the achievement isn't an
 * onboarding step. Keeps gameplay code free of funnel-step plumbing.
 */
export function trackTutorialStepForAchievement(player: Player, achievementId: string): void {
	const stepKey = ONBOARDING_ACHIEVEMENT_TO_TUTORIAL_STEP[achievementId];
	if (stepKey === undefined) return;
	trackTutorialStep(player, stepKey);
}

// ── Public API: gameplay helpers ──────────────────────────────────────────────

/**
 * Resolve a weapon ID into its low-cardinality display weaponType
 * (e.g. "Blade", "Blunt", "Unarmed"). Falls back to "Unknown" so analytics
 * never crashes on an unrecognised id.
 */
export function weaponTypeFromId(weaponId: string | undefined): string {
	if (weaponId === undefined) return "Unknown";
	const def = WEAPONS[weaponId];
	return def !== undefined ? def.weaponType : "Unknown";
}

/**
 * Fire `BountyAssigned` and reset the per-bounty `TargetFound` dedupe so the
 * next encounter with the new target can register exactly once.
 */
export function trackBountyAssigned(player: Player): void {
	const session = getOrCreateSession(player);
	session.targetFoundForCurrentBounty = false;
	trackEvent(player, ANALYTICS_EVENTS.BountyAssigned);
}

/**
 * Fire `TargetFound` at most once per active bounty assignment. Subsequent
 * calls within the same assignment are silently ignored.
 */
export function trackTargetFound(player: Player): void {
	const session = getOrCreateSession(player);
	if (session.targetFoundForCurrentBounty) return;
	session.targetFoundForCurrentBounty = true;
	trackEvent(player, ANALYTICS_EVENTS.TargetFound);
}

/**
 * Record the cause of `player`'s upcoming death. The next `PlayerDied` event
 * fired by the global Humanoid.Died listener will use this reason, then clear
 * it. If no reason is set, the listener falls back to "Unknown".
 */
export function setPendingDeathReason(player: Player, reason: string): void {
	const session = getOrCreateSession(player);
	session.pendingDeathReason = reason;
}

/**
 * Fire the global `PlayerDied` event. Pulls the death reason from
 * `setPendingDeathReason` (and clears it) — defaults to "Unknown" so every
 * death is counted, even those from environment / fall damage / unknown causes.
 */
export function trackPlayerDied(player: Player): void {
	const session = getOrCreateSession(player);
	const reason = session.pendingDeathReason ?? "Unknown";
	session.pendingDeathReason = undefined;
	trackEvent(player, ANALYTICS_EVENTS.PlayerDied, { deathReason: reason });
}

// ── Public API: shops & purchases ─────────────────────────────────────────────

/**
 * Two-value union for the `offerType` field on `PurchasePromptShown` and
 * `PurchaseMade`. Keep this enum closed — broadening it inflates dimension
 * cardinality on the dashboard.
 */
export type OfferType = "gamepass" | "developerProduct";

/**
 * Shop-type label sent on `MerchantVisited` / `ItemPurchased`.
 * Either a real `ShopType` (dynamic merchants) or the literal `"fixed"` for
 * hand-authored static-shop NPCs. Adding a new `ShopType` to the config
 * expands this union automatically — no analytics code change required.
 */
export type ShopTypeLabel = ShopType | "fixed";

/** Fire `MerchantVisited` with the merchant's shop type. */
export function trackMerchantVisited(player: Player, shopType: ShopTypeLabel): void {
	trackEvent(player, ANALYTICS_EVENTS.MerchantVisited, { shopType });
}

/** Fire `ItemPurchased` after a successful in-shop gold purchase. */
export function trackItemPurchased(player: Player, shopType: ShopTypeLabel): void {
	trackEvent(player, ANALYTICS_EVENTS.ItemPurchased, { shopType });
}

/**
 * Fire `PurchasePromptShown` immediately before invoking
 * `MarketplaceService.PromptGamePassPurchase` or
 * `MarketplaceService.PromptProductPurchase`. Pair with `trackPurchaseMade`
 * to compute prompt→purchase conversion in the dashboard.
 */
export function trackPurchasePromptShown(player: Player, offerType: OfferType): void {
	trackEvent(player, ANALYTICS_EVENTS.PurchasePromptShown, { offerType });
}

/**
 * Fire `PurchaseMade` after Roblox confirms a successful Robux purchase
 * (`PromptGamePassPurchaseFinished(purchased=true)` or `ProcessReceipt` granted).
 */
export function trackPurchaseMade(player: Player, offerType: OfferType): void {
	trackEvent(player, ANALYTICS_EVENTS.PurchaseMade, { offerType });
}

// ── Equip / consume / wipe ───────────────────────────────────────────

export type ConsumableType = "elixir" | "poison";

function poisonRarity(poisonId: string | undefined): string {
	if (poisonId === undefined) return "unknown";
	const def = POISONS[poisonId];
	return def !== undefined ? def.rarity : "unknown";
}

function elixirRarity(elixirId: string | undefined): string {
	if (elixirId === undefined) return "unknown";
	const def = ELIXIRS[elixirId];
	return def !== undefined ? def.rarity : "unknown";
}

/** Fire `EquippedWeapon` (only on new equip — callers must filter out unequip-to-fists). */
export function trackEquippedWeapon(player: Player, weaponId: string): void {
	trackEvent(player, ANALYTICS_EVENTS.EquippedWeapon, { weaponType: weaponTypeFromId(weaponId) });
}

/** Fire `ConsumedElixir` when a player drinks an elixir. */
export function trackConsumedElixir(player: Player, elixirId: string): void {
	trackEvent(player, ANALYTICS_EVENTS.ConsumedElixir, { itemRarity: elixirRarity(elixirId) });
}

/** Fire `ConsumedPoison` when a player coats their weapon with poison. */
export function trackConsumedPoison(player: Player, poisonId: string): void {
	trackEvent(player, ANALYTICS_EVENTS.ConsumedPoison, { itemRarity: poisonRarity(poisonId) });
}

/**
 * Fire `ActiveConsumableReplaced` when a player applies a new elixir/poison
 * while one is still active, wiping the previous buff. Caller passes the
 * **previous** consumable's rarity + remaining seconds at the moment of wipe.
 */
export function trackActiveConsumableReplaced(
	player: Player,
	consumableType: ConsumableType,
	previousId: string,
	secondsRemaining: number,
): void {
	const rarity = consumableType === "poison" ? poisonRarity(previousId) : elixirRarity(previousId);
	trackEvent(player, ANALYTICS_EVENTS.ActiveConsumableReplaced, {
		consumableType,
		remainingTimeBucket: remainingTimeBucket(secondsRemaining),
		itemRarity: rarity,
	});
}

/** Fire `PlacedCamp` when a player places their personal campfire. */
export function trackPlacedCamp(player: Player): void {
	trackEvent(player, ANALYTICS_EVENTS.PlacedCamp);
}

/** Fire `OpenedKillBook` when the player opens the Codex / kill book. */
export function trackOpenedKillBook(player: Player): void {
	trackEvent(player, ANALYTICS_EVENTS.OpenedKillBook);
}

/** Fire `OpenedInventory` when the player opens the backpack panel. */
export function trackOpenedInventory(player: Player): void {
	trackEvent(player, ANALYTICS_EVENTS.OpenedInventory);
}

/**
 * Inspect persisted achievement state for `player` and either:
 *  - mark the session as past-tutorial (all onboarding achievements already
 *    unlocked from a prior session), or
 *  - fire `TutorialStarted` as the first funnel step of this session.
 */
function syncTutorialStateFromPersistence(player: Player): void {
	const onboardingIds = getOnboardingAchievementIds();
	let allDone = onboardingIds.size() > 0;
	for (const id of onboardingIds) {
		if (!hasAchievement(player, id)) {
			allDone = false;
			break;
		}
	}
	if (allDone) {
		markTutorialCompleted(player);
		return;
	}
	trackTutorialStep(player, "TutorialStarted");
}

// ── Lifecycle wiring ──────────────────────────────────────────────────────────

let initialized = false;

export function initializeAnalyticsTracker(): void {
	if (initialized) return;
	initialized = true;

	const contextRemote = getOrCreateAnalyticsContextRemote();
	contextRemote.OnServerEvent.Connect((player, platformRaw, deviceTypeRaw) => {
		const session = getOrCreateSession(player);
		if (typeIs(platformRaw, "string") && (platformRaw as string).size() > 0) {
			session.platform = platformRaw as string;
		}
		if (typeIs(deviceTypeRaw, "string") && (deviceTypeRaw as string).size() > 0) {
			session.deviceType = deviceTypeRaw as string;
		}
	});

	// UIEvent remote — client tells us when a panel opens. Validated against
	// the closed UI_OPEN_EVENTS set so a hostile client can't spam arbitrary
	// event names into our analytics. Adding a new panel only requires:
	//   1. an entry in UI_OPEN_EVENTS (shared/remotes/ui-event-remote.ts)
	//   2. an entry in UI_OPEN_DISPATCH below pointing it at a tracker helper.
	const uiEventRemote = getOrCreateUIEventRemote();
	const UI_OPEN_DISPATCH: Record<string, (p: Player) => void> = {
		[UI_OPEN_EVENTS.Inventory]: trackOpenedInventory,
		[UI_OPEN_EVENTS.KillBook]: trackOpenedKillBook,
	};
	uiEventRemote.OnServerEvent.Connect((player, eventTagRaw) => {
		if (!typeIs(eventTagRaw, "string")) return;
		const handler = UI_OPEN_DISPATCH[eventTagRaw as string];
		if (handler !== undefined) handler(player);
		// Unknown tags are silently dropped — do not log to avoid noise from spam.
	});

	Players.PlayerAdded.Connect((player) => {
		getOrCreateSession(player);
		trackEvent(player, ANALYTICS_EVENTS.PlayerJoined);
		// Wait for DataStore before deciding whether to fire TutorialStarted or
		// mark the session as already-completed.
		onPlayerStateLoaded(player, () => {
			if (player.Parent === undefined) return;
			syncTutorialStateFromPersistence(player);
		});
	});

	Players.PlayerRemoving.Connect((player) => {
		trackEvent(player, ANALYTICS_EVENTS.PlayerLeft);
		SESSIONS.delete(player);
	});

	// Catch any players already in-game when this initializes (Studio reload).
	for (const player of Players.GetPlayers()) {
		if (!SESSIONS.has(player)) {
			getOrCreateSession(player);
			trackEvent(player, ANALYTICS_EVENTS.PlayerJoined);
			onPlayerStateLoaded(player, () => {
				if (player.Parent === undefined) return;
				syncTutorialStateFromPersistence(player);
			});
		}
	}

	log(`${TAG} initialized`);
}
