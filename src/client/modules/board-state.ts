/**
 * board-state — single source of truth for the bounty-board panel.
 *
 * Mode is derived from the set of unlocked onboarding achievements:
 *   - if any onboarding achievement is missing -> guidance mode on
 *     the first missing step
 *   - if all are unlocked -> contract mode
 *
 * There is NO separate tutorial flag. Call setUnlockedAchievements()
 * (full sync) or addUnlockedAchievement() (single unlock) and the
 * renderer re-syncs automatically.
 *
 * This module holds state + exposes a clean API. It does NOT build UI.
 */

import { ONBOARDING_STEPS, OnboardingStep } from "shared/config/onboarding-steps";

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
}

// ── Internal state ──────────────────────────────────────────────────────────

const unlocked = new Set<string>();
let renderer: BoardRenderer | undefined;
const stateChangeSubscribers = new Array<() => void>();

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

// ── Derivation ──────────────────────────────────────────────────────────────

function getNextOnboardingStep(): { step: OnboardingStep; index: number } | undefined {
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
			renderer.renderBody({
				mode: "guidance",
				step: upcoming.step,
				stepIndex: upcoming.index,
				totalSteps: ONBOARDING_STEPS.size(),
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
