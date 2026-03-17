/**
 * Title definitions — add new titles here without changing core logic.
 * Titles change the player nameplate border colour, symbol, and label.
 * "sellsword" is the default starter title granted to all new players.
 *
 * To add a new title:
 *   1. Add an entry to TITLES below.
 *   2. Optionally link it to an achievement via achievementId.
 *   3. Add it to TITLE_LIST for UI ordering.
 */

export type TitlePosition = "prepend" | "append";

export interface TitleDef {
	id: string;
	name: string;
	/** Short ASCII symbol (1-2 chars) displayed on the nameplate alongside the title name. */
	symbol: string;
	/** Card border and title text colour on other players' nameplates. */
	color: Color3;
	/** "prepend" = title row above player name, "append" = title row below player name. */
	position: TitlePosition;
	/** Achievement ID that grants this title on unlock. Absent means a starter/given title. */
	achievementId?: string;
}

export const TITLES: Record<string, TitleDef> = {
	sellsword: {
		id: "sellsword",
		name: "Sellsword",
		symbol: "-",
		color: Color3.fromRGB(155, 150, 140),
		position: "prepend",
	},
	first_blood: {
		id: "first_blood",
		name: "First Blood",
		symbol: "+",
		color: Color3.fromRGB(200, 55, 55),
		position: "prepend",
		achievementId: "FIRST_ASSASSINATION",
	},
	bounty_hunter: {
		id: "bounty_hunter",
		name: "Bounty Hunter",
		symbol: "#",
		color: Color3.fromRGB(195, 155, 50),
		position: "append",
		achievementId: "BOUNTY_HUNTER",
	},
	slayer: {
		id: "slayer",
		name: "Slayer",
		symbol: "X",
		color: Color3.fromRGB(140, 65, 160),
		position: "append",
		achievementId: "PLAYER_SLAYER",
	},
	night_owl: {
		id: "night_owl",
		name: "Night Owl",
		symbol: "*",
		color: Color3.fromRGB(55, 135, 160),
		position: "prepend",
		achievementId: "MOCK_TEST",
	},
};

/** Ordered list for UI display (kill book title selector). */
export const TITLE_LIST: TitleDef[] = [
	TITLES.sellsword,
	TITLES.first_blood,
	TITLES.bounty_hunter,
	TITLES.slayer,
	TITLES.night_owl,
];
