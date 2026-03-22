/**
 * NPC ambient quips — short one-liners that guards, commoners, and other
 * non-vendor NPCs say when a player tries to interact with them.
 *
 * These appear as floating 3D text near the NPC's head, not in a dialog box.
 * Data-only config — add new lines freely.
 */

/** Generic quips for guards / commoners — gruff, short, dismissive. */
export const GUARD_QUIPS: string[] = [
	"Hmm.",
	"Move along.",
	"Nothing to see here.",
	"I have my orders.",
	"Stay out of trouble.",
	"Do not test me.",
	"Keep walking.",
	"The road is not safe.",
	"You look suspicious.",
	"Hmph.",
	"Watch yourself.",
	"What do you want?",
	"I am on duty.",
	"No loitering.",
	"...",
	"State your business.",
	"Eyes forward.",
];

/** Quips for commoner/serf NPCs — mundane, tired, world-weary. */
export const COMMONER_QUIPS: string[] = [
	"Hm?",
	"Another day...",
	"Leave me be.",
	"I have nothing for you.",
	"The rain never stops.",
	"I am busy.",
	"What now?",
	"Go away.",
	"Bah.",
	"Do I know you?",
	"I have work to do.",
	"Times are hard.",
	"Not now.",
	"The tax collector comes tomorrow.",
	"Can you not see I am busy?",
];

/** Quips for nobility — haughty, dismissive. */
export const NOBILITY_QUIPS: string[] = [
	"You dare address me?",
	"Beneath my station.",
	"Hmph. Peasant.",
	"I haven't the time.",
	"Know your place.",
	"Do not waste my breath.",
	"How tiresome.",
	"Be gone.",
	"I shall pretend I did not hear that.",
	"You are dismissed.",
];

/** Quips for royalty — regal, bored. */
export const ROYALTY_QUIPS: string[] = [
	"Speak, and be brief.",
	"We are not amused.",
	"The crown weighs heavy today.",
	"Another petitioner...",
	"You may leave.",
	"Kneel, or be gone.",
];

/** Map NPC status to its quip pool. */
const STATUS_QUIPS: Record<string, string[]> = {
	Serf: COMMONER_QUIPS,
	Commoner: GUARD_QUIPS,
	Merchant: COMMONER_QUIPS, // fallback — merchants normally have shops
	Nobility: NOBILITY_QUIPS,
	Royalty: ROYALTY_QUIPS,
};

/** Pick a random quip for a given NPC status. */
export function getQuipForStatus(status: string): string {
	const pool = STATUS_QUIPS[status] ?? COMMONER_QUIPS;
	return pool[math.random(0, pool.size() - 1)];
}
