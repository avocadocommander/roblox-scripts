/**
 * ONBOARDING_STEPS — ordered achievement-driven tutorial sequence.
 *
 * The bounty board renders Guidance Mode for any achievement in this list
 * that the local player has NOT yet unlocked. When all entries are unlocked,
 * the board reverts to Contract Mode. There is no separate tutorial flag.
 *
 * Add / reorder steps here without touching UI or state logic.
 * Each step references an achievement ID defined in shared/achievements.ts.
 */

export interface OnboardingStep {
	/** Achievement ID that marks this step complete. */
	achievementId: string;
	/** Board header while this step is active. */
	title: string;
	/** Main objective text. */
	objective: string;
	/** Optional footer hint (reward, location, etc.). */
	hint?: string;
	/**
	 * World-space highlight target while this step is the active guidance step.
	 *  - "nightGuildLeader" — highlight the Night guild leader.
	 *  - "dawnGuildLeader" — highlight the Dawn guild leader.
	 *  - "bountyTarget" — highlight the player's currently assigned bounty NPC.
	 * Undefined = no highlight.
	 */
	highlightType?: "nightGuildLeader" | "dawnGuildLeader" | "bountyTarget";
	/**
	 * UI pulse target while this step is the active guidance step.
	 *  - "equipDagger"  — pulses the Inventory button and the dagger tile
	 *                     inside the inventory panel.
	 *  - "assassinate" — pulses the Assassinate button (mobile + PC hotkey row)
	 *                     only while a killable NPC is in range.
	 * Undefined = no UI pulse.
	 */
	uiPulseTarget?: "equipDagger" | "assassinate";
	/**
	 * When true, the bounty board also renders the active bounty card
	 * (name, gold, class, offence) above the step footer. Useful for
	 * steps where the player needs to see their actual target.
	 */
	showBountyCard?: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
	{
		achievementId: "MET_GUILD_LEADER",
		title: "NIGHT CONTRACT",
		objective: "Speak to Thorne",
		hint: "Reward: Dagger",
		highlightType: "nightGuildLeader",
	},
	{
		achievementId: "EQUIPPED_DAGGER",
		title: "NIGHT CONTRACT",
		objective: "Equip your Dagger",
		hint: "Open your inventory and equip it.",
		uiPulseTarget: "equipDagger",
	},
	{
		achievementId: "FIRST_ASSASSINATION",
		title: "NIGHT CONTRACT",
		objective: "Hunt Your First Mark",
		highlightType: "bountyTarget",
		uiPulseTarget: "assassinate",
		showBountyCard: true,
	},
	{
		achievementId: "FIRST_TURN_IN",
		title: "NIGHT CONTRACT",
		objective: "Return to Thorne",
		hint: "Reward: 25 Gold",
		highlightType: "nightGuildLeader",
	},
];

export const DAWN_ONBOARDING_STEPS: OnboardingStep[] = [
	{
		achievementId: "MET_DAWN_GUILD_LEADER",
		title: "DAWN WARRANT",
		objective: "Report to Bertram",
		hint: "PvP scrolls belong to the Dawn Order.",
		highlightType: "dawnGuildLeader",
	},
	{
		achievementId: "FIRST_PVP_TURN_IN",
		title: "DAWN WARRANT",
		objective: "Turn In the PvP Scroll",
		hint: "Reward: Dawn XP",
		highlightType: "dawnGuildLeader",
	},
];

export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.size();
export const DAWN_ONBOARDING_STEP_COUNT = DAWN_ONBOARDING_STEPS.size();

export function getOnboardingAchievementIds(): string[] {
	const ids: string[] = [];
	for (const step of ONBOARDING_STEPS) ids.push(step.achievementId);
	return ids;
}

export function getDawnOnboardingAchievementIds(): string[] {
	const ids: string[] = [];
	for (const step of DAWN_ONBOARDING_STEPS) ids.push(step.achievementId);
	return ids;
}
