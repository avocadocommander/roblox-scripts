/**
 * board-state — single source of truth for the bounty-board panel.
 *
 * Mode is derived from the set of unlocked onboarding achievements:
 *   - if any onboarding achievement is missing -> guidance mode on
 *     the first missing step
 *   - if all are unlocked -> contract mode
 *   - tutorial-only recovery: if the player reached turn-in but has no
 *     bounty scroll, guide them back to the assassination step
 *
 * There is NO separate tutorial flag. Call setUnlockedAchievements()
 * (full sync), addUnlockedAchievement() (single unlock), or
 * setTutorialBountyScrollCount() (inventory sync) and the renderer
 * re-syncs automatically.
 *
 * This module holds state + exposes a clean API. It does NOT build UI.
 */

import { DAWN_ONBOARDING_STEPS, ONBOARDING_STEPS, OnboardingStep } from "shared/config/onboarding-steps";

export type BoardMode = "contract" | "guidance";

export type BoardMessageType = "info" | "warning" | "event" | "unlock";

export interface BoardMessage {
	messageType: BoardMessageType;
	text: string;
}

export interface ContractContent {
	mode: "contract";
}

export interface GuidanceContent {
	mode: "guidance";
	step: OnboardingStep;
	stepIndex: number;
	totalSteps: number;
}

export type BoardBodyContent = ContractContent | GuidanceContent;

export interface BoardRenderer {
	/** Invoked whenever body mode or current onboarding step changes. */
	renderBody: (content: BoardBodyContent) => void;
	/** Push a single new event message into the rising FIFO stack. */
	pushMessage: (message: BoardMessage) => void;
	/** Set or clear the persistent server-event banner (one at a time). */
	setServerEvent: (text: string | undefined) => void;
}

// ── Internal state ──────────────────────────────────────────────────────────

const unlocked = new Set<string>();
let renderer: BoardRenderer | undefined;
const stateChangeSubscribers = new Array<() => void>();
let tutorialBountyScrollCount: number | undefined;
let tutorialPlayerBountyScrollCount = 0;

// ── Public API ──────────────────────────────────────────────────────────────

export function registerBoardRenderer(r: BoardRenderer): void {
	renderer = r;
	pushBody();
}

/** Replace the unlocked-achievement set (used on full sync from server). */
export function setUnlockedAchievements(ids: ReadonlyArray<string>): void {
	unlocked.clear();
	for (const id of ids) unlocked.add(id);
	pushBody();
}

/** Mark a single achievement as unlocked. Safe to call repeatedly. */
export function addUnlockedAchievement(id: string): void {
	if (unlocked.has(id)) return;
	unlocked.add(id);
	pushBody();
}

export function hasUnlockedAchievement(id: string): boolean {
	return unlocked.has(id);
}

/**
 * Inventory-backed tutorial recovery.
 *
 * FIRST_ASSASSINATION is persistent, but bounty scrolls are not. If a player
 * dies/leaves after step 3 and loses the scroll before FIRST_TURN_IN, the
 * tutorial must point them back at the kill step so they can earn a new one.
 */
export function setTutorialBountyScrollCount(count: number, playerScrollCount = 0): void {
	tutorialBountyScrollCount = count;
	tutorialPlayerBountyScrollCount = playerScrollCount;
	pushBody();
}

/** The first onboarding step whose achievement is still locked, if any. */
export function getCurrentOnboardingStep(): OnboardingStep | undefined {
	const upcoming = getNextOnboardingStep();
	return upcoming ? upcoming.step : undefined;
}

/** Subscribe to onboarding / mode changes. Fires whenever the body is re-pushed. */
export function onBoardStateChanged(cb: () => void): void {
	stateChangeSubscribers.push(cb);
}

/** Derived mode — guidance while any onboarding step is missing. */
export function getBoardMode(): BoardMode {
	return getNextOnboardingStep() === undefined ? "contract" : "guidance";
}

/** Show a short event message in the rising FIFO stack above the board. */
export function showBoardMessage(messageType: BoardMessageType, text: string): void {
	if (!renderer) return;
	renderer.pushMessage({ messageType, text });
}

/**
 * Set or clear the persistent server-event banner.
 * Pass undefined or empty string to hide it.
 */
export function showServerEvent(text: string | undefined): void {
	if (!renderer) return;
	renderer.setServerEvent(text === "" ? undefined : text);
}

// ── Derivation ──────────────────────────────────────────────────────────────

function getNextOnboardingStep(): { step: OnboardingStep; index: number } | undefined {
	const nightStep = getNextNightOnboardingStep();
	if (nightStep !== undefined) return nightStep;

	if (tutorialPlayerBountyScrollCount > 0) {
		for (let i = 0; i < DAWN_ONBOARDING_STEPS.size(); i++) {
			const step = DAWN_ONBOARDING_STEPS[i];
			if (!unlocked.has(step.achievementId)) {
				return { step, index: i };
			}
		}
	}
	return undefined;
}

function getNextNightOnboardingStep(): { step: OnboardingStep; index: number } | undefined {
	if (
		unlocked.has("FIRST_ASSASSINATION") &&
		!unlocked.has("FIRST_TURN_IN") &&
		tutorialBountyScrollCount !== undefined &&
		tutorialBountyScrollCount <= 0
	) {
		for (let i = 0; i < ONBOARDING_STEPS.size(); i++) {
			const step = ONBOARDING_STEPS[i];
			if (step.achievementId === "FIRST_ASSASSINATION") return { step, index: i };
		}
	}

	for (let i = 0; i < ONBOARDING_STEPS.size(); i++) {
		const step = ONBOARDING_STEPS[i];
		if (!unlocked.has(step.achievementId)) {
			return { step, index: i };
		}
	}
	return undefined;
}

// ── Internal push ───────────────────────────────────────────────────────────

function pushBody(): void {
	if (renderer) {
		const upcoming = getNextOnboardingStep();
		if (upcoming) {
			const isDawn = DAWN_ONBOARDING_STEPS.indexOf(upcoming.step) >= 0;
			renderer.renderBody({
				mode: "guidance",
				step: upcoming.step,
				stepIndex: upcoming.index,
				totalSteps: isDawn ? DAWN_ONBOARDING_STEPS.size() : ONBOARDING_STEPS.size(),
			});
		} else {
			renderer.renderBody({ mode: "contract" });
		}
	}
	for (const cb of stateChangeSubscribers) {
		const [ok, err] = pcall(cb);
		if (!ok) warn("[BOARD-STATE] subscriber error: " + tostring(err));
	}
}
