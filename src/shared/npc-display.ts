/**
 * NPC display helper -- single source of truth for "how should this NPC be
 * presented in player-facing UI".
 *
 * Gnomes deliberately have NO social status. They are treated as their own
 * people, separate from the human / goblin / pirate social ladder. The
 * underlying `socialClass` on the NPCDef is still used for internal systems
 * (clothing tier palettes, fallback reward maths), but it is never shown
 * to the player.
 *
 * All UI that wants to render an NPC's status / rarity tier MUST go through
 * this helper. Do not read `STATUS_RARITY[npcData.status]` directly in UI
 * code -- that pattern bypasses the gnome rule.
 */

import { MEDIEVAL_NPCS } from "./module";
import { STATUS_RARITY, UI_THEME } from "./ui-theme";

export interface NPCDisplay {
	/** Whether the NPC has a social status worth showing the player. */
	showStatus: boolean;
	/** The status word ("Serf" / "Commoner" / ...). Empty when showStatus is false. */
	statusText: string;
	/** The rarity-tier label ("Common" / "Uncommon" / ...). Empty when showStatus is false. */
	rarityLabel: string;
	/** The colour to render the NPC's accent strokes / name / status line in. */
	color: Color3;
	/** The rarity-tier card background colour. `undefined` when no tier applies. */
	bgColor: Color3 | undefined;
	/** The rarity-tier order index (0..4 = Serf..Royalty). `undefined` for gnomes. */
	rarityOrder: number | undefined;
}

// Warm bone white -- the neutral text colour from the medieval palette.
// Used for gnomes and any NPC missing a rarity tier.
const NEUTRAL_COLOR: Color3 = UI_THEME.textPrimary;

const NO_STATUS: NPCDisplay = {
	showStatus: false,
	statusText: "",
	rarityLabel: "",
	color: NEUTRAL_COLOR,
	bgColor: undefined,
	rarityOrder: undefined,
};

/**
 * Returns how `npcName` should be presented in the UI. Safe for unknown
 * names (returns a neutral fallback) and for gnomes (returns no-status).
 */
export function getNPCDisplay(npcName: string): NPCDisplay {
	const data = MEDIEVAL_NPCS[npcName];
	if (!data) return NO_STATUS;
	if (data.race === "Gnome") return NO_STATUS;

	const rarity = STATUS_RARITY[data.status];
	if (!rarity) {
		return {
			showStatus: true,
			statusText: data.status,
			rarityLabel: "",
			color: NEUTRAL_COLOR,
			bgColor: undefined,
			rarityOrder: undefined,
		};
	}
	return {
		showStatus: true,
		statusText: data.status,
		rarityLabel: rarity.label,
		color: rarity.color,
		bgColor: rarity.bgColor,
		rarityOrder: rarity.order,
	};
}
