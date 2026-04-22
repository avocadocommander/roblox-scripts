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
	 *  - "guildLeaders" — highlight every faction guild leader.
	 *  - "bountyTarget" — highlight the player's currently assigned bounty NPC.
	 * Undefined = no highlight.
	 */
	highlightType?: "guildLeaders" | "bountyTarget";
	/**
	 * UI pulse target while this step is the active guidance step.
	 *  - "equipDagger" — pulses the Inventory button and the dagger tile
	 *                    inside the inventory panel.
	 * Undefined = no UI pulse.
	 */
	uiPulseTarget?: "equipDagger";
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
		title: "FIRST CONTRACT",
		objective: "Speak to the Guild Leader",
		hint: "Reward: Dagger",
		highlightType: "guildLeaders",
	},
	{
		achievementId: "EQUIPPED_DAGGER",
		title: "FIRST CONTRACT",
		objective: "Equip your Dagger",
		hint: "Open your inventory and equip it.",
		uiPulseTarget: "equipDagger",
	},
	{
		achievementId: "FIRST_ASSASSINATION",
		title: "FIRST CONTRACT",
		objective: "Hunt Your First Mark",
		highlightType: "bountyTarget",
		showBountyCard: true,
	},
	{
		achievementId: "FIRST_TURN_IN",
		title: "FIRST CONTRACT",
		objective: "Return for Payment",
		hint: "Reward: 25 Gold",
		highlightType: "guildLeaders",
	},
];

export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.size();

export function getOnboardingAchievementIds(): string[] {
	const ids: string[] = [];
	for (const step of ONBOARDING_STEPS) ids.push(step.achievementId);
	return ids;
}
