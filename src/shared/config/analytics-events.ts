/**
 * Analytics event configuration — data-only constants for the AnalyticsTracker.
 *
 * This file is the SINGLE SOURCE OF TRUTH for:
 *  - Tutorial funnel name and ordered step list.
 *  - Custom event names fired through `AnalyticsService:LogCustomEvent`.
 *  - Per-event "slot schema" — which low-cardinality fields fill the three
 *    Roblox custom-field slots for that event.
 *  - Bucket boundaries for level and session-minute fields (kept low cardinality
 *    so dashboards don't explode into thousands of values).
 *
 * To add a new gameplay event:
 *   1. Add its name to `ANALYTICS_EVENTS`.
 *   2. Add its 1–3 field slot layout to `EVENT_FIELD_SLOTS`.
 *   3. Call `trackEvent(player, ANALYTICS_EVENTS.MyEvent, { ... })` from the
 *      gameplay system.
 *
 * Never send player names, NPC names, exact coordinates, unique bounty IDs, or
 * anything else high-cardinality. Slot fields must be drawn from `AnalyticsField`.
 */

// ── Tutorial funnel ───────────────────────────────────────────────────────────

/** Funnel name used by `AnalyticsService:LogOnboardingFunnelStepEvent` (display only). */
export const TUTORIAL_FUNNEL_NAME = "Tutorial";

/** Ordered tutorial funnel steps. Step numbers are 1-based and stable across releases. */
export const TUTORIAL_STEPS = {
	TutorialStarted: { step: 1, name: "TutorialStarted" },
	TutorialStep1Completed: { step: 2, name: "TutorialStep1Completed" },
	TutorialStep2Completed: { step: 3, name: "TutorialStep2Completed" },
	TutorialStep3Completed: { step: 4, name: "TutorialStep3Completed" },
	TutorialCompleted: { step: 5, name: "TutorialCompleted" },
} as const;

export type TutorialStepKey = keyof typeof TUTORIAL_STEPS;

export const DAWN_TUTORIAL_STEPS = {
	DawnTutorialStarted: { step: 1, name: "DawnTutorialStarted" },
	DawnGuildLeaderMet: { step: 2, name: "DawnGuildLeaderMet" },
	DawnTutorialCompleted: { step: 3, name: "DawnTutorialCompleted" },
} as const;

export type DawnTutorialStepKey = keyof typeof DAWN_TUTORIAL_STEPS;

/** Step number that marks the funnel as fully completed (last entry). */
export const TUTORIAL_FINAL_STEP = TUTORIAL_STEPS.TutorialCompleted.step;

/**
 * Maps an onboarding achievement ID → the tutorial funnel step that the
 * achievement unlock represents. Mirrors the order in
 * `shared/config/onboarding-steps.ts`. Keep this list in sync if onboarding
 * steps are added, reordered, or renamed.
 */
export const ONBOARDING_ACHIEVEMENT_TO_TUTORIAL_STEP: Record<string, TutorialStepKey> = {
	MET_GUILD_LEADER: "TutorialStep1Completed",
	EQUIPPED_DAGGER: "TutorialStep2Completed",
	FIRST_ASSASSINATION: "TutorialStep3Completed",
	FIRST_TURN_IN: "TutorialCompleted",
};

export const DAWN_ONBOARDING_ACHIEVEMENT_TO_TUTORIAL_STEP: Record<string, DawnTutorialStepKey> = {
	FIRST_PVP_SCROLL: "DawnTutorialStarted",
	MET_DAWN_GUILD_LEADER: "DawnGuildLeaderMet",
	FIRST_PVP_TURN_IN: "DawnTutorialCompleted",
};

// ── Custom event names ────────────────────────────────────────────────────────

/** Stable event names for `AnalyticsService:LogCustomEvent`. */
export const ANALYTICS_EVENTS = {
	PlayerJoined: "PlayerJoined",
	PlayerLeft: "PlayerLeft",
	BountyAssigned: "BountyAssigned",
	TargetFound: "TargetFound",
	KillAttempted: "KillAttempted",
	KillSucceeded: "KillSucceeded",
	ScrollCollected: "ScrollCollected",
	ScrollTurnedIn: "ScrollTurnedIn",
	OpenedBountyBoard: "OpenedBountyBoard",
	OpenedInventory: "OpenedInventory",
	StealthToggledOn: "StealthToggledOn",
	StealthToggledOff: "StealthToggledOff",
	WrongKill: "WrongKill",
	BecameWanted: "BecameWanted",
	PlayerDied: "PlayerDied",
	MerchantVisited: "MerchantVisited",
	ItemPurchased: "ItemPurchased",
	/** Roblox marketplace prompt was opened (gamepass or dev product). */
	PurchasePromptShown: "PurchasePromptShown",
	/** Roblox marketplace purchase completed successfully. */
	PurchaseMade: "PurchaseMade",
	/** Player equipped a weapon (excludes toggling back to fists). */
	EquippedWeapon: "EquippedWeapon",
	/** Player consumed an elixir (the buff was applied). */
	ConsumedElixir: "ConsumedElixir",
	/** Player coated their weapon with a poison. */
	ConsumedPoison: "ConsumedPoison",
	/**
	 * Player applied a new elixir/poison while one was still active, wiping
	 * the existing buff. Fires in addition to the matching Consumed* event.
	 */
	ActiveConsumableReplaced: "ActiveConsumableReplaced",
	/** Player placed their personal campfire. */
	PlacedCamp: "PlacedCamp",
	/** Player opened the Codex / kill book panel. */
	OpenedKillBook: "OpenedKillBook",
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

// ── Field schema ──────────────────────────────────────────────────────────────

/**
 * The complete set of low-cardinality field names allowed on analytics events.
 * Anything not in this union is rejected at compile time.
 */
export type AnalyticsField =
	| "platform"
	| "deviceType"
	| "tutorialCompleted"
	| "currentLevelBucket"
	| "sessionMinuteBucket"
	| "weaponType"
	| "shopType"
	| "deathReason"
	/** "gamepass" or "developerProduct" — used by the prompt funnel. */
	| "offerType"
	/** Item rarity tier (common / uncommon / rare / epic / legendary). */
	| "itemRarity"
	/** "elixir" or "poison" — used by consumable wipe events. */
	| "consumableType"
	/** Bucketed remaining time on a wiped consumable. */
	| "remainingTimeBucket";

/** Map of event name → ordered field slots (max 3 — Roblox limit). */
export const EVENT_FIELD_SLOTS: Record<AnalyticsEventName, readonly AnalyticsField[]> = {
	PlayerJoined: ["platform", "deviceType", "tutorialCompleted"],
	PlayerLeft: ["platform", "sessionMinuteBucket", "tutorialCompleted"],
	BountyAssigned: ["currentLevelBucket", "tutorialCompleted", "sessionMinuteBucket"],
	TargetFound: ["currentLevelBucket", "tutorialCompleted", "sessionMinuteBucket"],
	KillAttempted: ["weaponType", "currentLevelBucket", "tutorialCompleted"],
	KillSucceeded: ["weaponType", "currentLevelBucket", "tutorialCompleted"],
	ScrollCollected: ["currentLevelBucket", "tutorialCompleted", "sessionMinuteBucket"],
	ScrollTurnedIn: ["currentLevelBucket", "tutorialCompleted", "sessionMinuteBucket"],
	OpenedBountyBoard: ["tutorialCompleted", "currentLevelBucket", "sessionMinuteBucket"],
	OpenedInventory: ["tutorialCompleted", "currentLevelBucket", "sessionMinuteBucket"],
	StealthToggledOn: ["currentLevelBucket", "tutorialCompleted", "sessionMinuteBucket"],
	StealthToggledOff: ["currentLevelBucket", "tutorialCompleted", "sessionMinuteBucket"],
	WrongKill: ["weaponType", "currentLevelBucket", "tutorialCompleted"],
	BecameWanted: ["currentLevelBucket", "tutorialCompleted", "sessionMinuteBucket"],
	PlayerDied: ["deathReason", "currentLevelBucket", "tutorialCompleted"],
	MerchantVisited: ["shopType", "currentLevelBucket", "tutorialCompleted"],
	ItemPurchased: ["shopType", "currentLevelBucket", "tutorialCompleted"],
	PurchasePromptShown: ["offerType", "currentLevelBucket", "tutorialCompleted"],
	PurchaseMade: ["offerType", "currentLevelBucket", "tutorialCompleted"],
	EquippedWeapon: ["weaponType", "currentLevelBucket", "tutorialCompleted"],
	ConsumedElixir: ["itemRarity", "currentLevelBucket", "tutorialCompleted"],
	ConsumedPoison: ["itemRarity", "currentLevelBucket", "tutorialCompleted"],
	ActiveConsumableReplaced: ["consumableType", "remainingTimeBucket", "itemRarity"],
	PlacedCamp: ["currentLevelBucket", "tutorialCompleted", "sessionMinuteBucket"],
	OpenedKillBook: ["tutorialCompleted", "currentLevelBucket", "sessionMinuteBucket"],
} as const;

/** Field slots applied to every tutorial funnel step. */
export const TUTORIAL_FIELD_SLOTS: readonly AnalyticsField[] = ["platform", "deviceType", "currentLevelBucket"];

// ── Buckets (low cardinality on purpose) ──────────────────────────────────────

/** Level → bucket label. Five buckets keeps the dimension small for dashboards. */
export interface LevelBucket {
	readonly max: number;
	readonly label: string;
}

export const LEVEL_BUCKETS: readonly LevelBucket[] = [
	{ max: 5, label: "1-5" },
	{ max: 10, label: "6-10" },
	{ max: 25, label: "11-25" },
	{ max: 50, label: "26-50" },
	{ max: math.huge, label: "51+" },
];

/** Session minute → bucket label. */
export interface SessionBucket {
	readonly max: number;
	readonly label: string;
}

export const SESSION_MINUTE_BUCKETS: readonly SessionBucket[] = [
	{ max: 5, label: "0-5" },
	{ max: 15, label: "5-15" },
	{ max: 30, label: "15-30" },
	{ max: 60, label: "30-60" },
	{ max: math.huge, label: "60+" },
];

/** Resolve a numeric level into its low-cardinality bucket label. */
export function levelBucket(level: number): string {
	for (const b of LEVEL_BUCKETS) if (level <= b.max) return b.label;
	return LEVEL_BUCKETS[LEVEL_BUCKETS.size() - 1].label;
}

/** Resolve a session duration in minutes into its low-cardinality bucket label. */
export function sessionMinuteBucket(minutes: number): string {
	for (const b of SESSION_MINUTE_BUCKETS) if (minutes < b.max) return b.label;
	return SESSION_MINUTE_BUCKETS[SESSION_MINUTE_BUCKETS.size() - 1].label;
}

/**
 * Buckets for "how much time was left on the wiped consumable when it was
 * replaced". Kept very coarse so we can answer "how often do players burn
 * meaningful duration" without exploding cardinality.
 */
export interface RemainingTimeBucket {
	readonly max: number;
	readonly label: string;
}

export const REMAINING_TIME_BUCKETS: readonly RemainingTimeBucket[] = [
	{ max: 30, label: "0-30s" },
	{ max: 120, label: "30s-2m" },
	{ max: 600, label: "2m-10m" },
	{ max: math.huge, label: "10m+" },
];

/** Resolve seconds-remaining into a coarse bucket label for the wipe event. */
export function remainingTimeBucket(secondsRemaining: number): string {
	const clamped = secondsRemaining < 0 ? 0 : secondsRemaining;
	for (const b of REMAINING_TIME_BUCKETS) if (clamped < b.max) return b.label;
	return REMAINING_TIME_BUCKETS[REMAINING_TIME_BUCKETS.size() - 1].label;
}
