/**
 * UI_THEME — shared palette for all code-built HUD elements.
 *
 * Aesthetic: night-guild assassin meets salt-worn pirate.
 * Everything is deliberately muted and desaturated — no bright whites,
 * no vivid primaries. Tarnished brass, deep charcoal, dried blood.
 */
export const UI_THEME = {
	// ── Backgrounds ────────────────────────────────────────────────────────
	/** Main panel fill — near-black with a very faint navy tint */
	bg: Color3.fromRGB(10, 11, 15),
	bgTransparency: 0.08,

	/** Slightly lighter inset / section background */
	bgInset: Color3.fromRGB(17, 17, 24),

	/** Header bar — dark cracked-leather brown */
	headerBg: Color3.fromRGB(28, 16, 10),

	// ── Borders & strokes ──────────────────────────────────────────────────
	/** Tarnished brass outline */
	border: Color3.fromRGB(108, 82, 38),

	/** Dimmer divider line */
	divider: Color3.fromRGB(70, 56, 30),

	// ── Text ───────────────────────────────────────────────────────────────
	/** Primary readable text — weathered bone */
	textPrimary: Color3.fromRGB(195, 182, 158),

	/** Header label text — dull amber */
	textHeader: Color3.fromRGB(185, 155, 85),

	/** Section label (e.g. "YOUR MARK", "WANTED") — muted bronze */
	textSection: Color3.fromRGB(115, 90, 48),

	/** Muted caption / flavour text */
	textMuted: Color3.fromRGB(88, 82, 68),

	/** Player name in wanted list — weathered parchment */
	textWanted: Color3.fromRGB(195, 162, 92),

	// ── Accent colours ─────────────────────────────────────────────────────
	/** Tarnished gold — coin amounts, rewards */
	gold: Color3.fromRGB(178, 138, 42),

	/** Dried-blood red — wanted header, danger indicators */
	danger: Color3.fromRGB(130, 32, 22),

	/** Poison / status green-grey */
	poison: Color3.fromRGB(72, 98, 52),

	// ── Typography ─────────────────────────────────────────────────────────
	fontDisplay: Enum.Font.Antique,
	fontBold: Enum.Font.GothamBold,
	fontBody: Enum.Font.Gotham,

	// ── Geometry ───────────────────────────────────────────────────────────
	cornerRadius: new UDim(0, 5),
	strokeThickness: 1.2,
};

/**
 * STATUS_RARITY — WoW-style rarity tiers keyed by NPC social Status.
 * Each status maps to a display colour, background tint, rarity label,
 * and sort order so the UI can colour-code NPCs consistently.
 *
 * Colours are deliberately muted to match the assassin / pirate palette.
 */
export const STATUS_RARITY: Record<
	string,
	{
		/** Text / accent colour for this tier. */
		color: Color3;
		/** Faint background tint for rows, cards, etc. */
		bgColor: Color3;
		/** Human-readable rarity label (WoW-style). */
		label: string;
		/** Sort / display order — higher = rarer. */
		order: number;
	}
> = {
	Serf: {
		color: Color3.fromRGB(108, 100, 90),
		bgColor: Color3.fromRGB(30, 28, 26),
		label: "Common",
		order: 0,
	},
	Commoner: {
		color: Color3.fromRGB(155, 148, 130),
		bgColor: Color3.fromRGB(34, 32, 28),
		label: "Uncommon",
		order: 1,
	},
	Merchant: {
		color: Color3.fromRGB(68, 138, 82),
		bgColor: Color3.fromRGB(18, 32, 22),
		label: "Rare",
		order: 2,
	},
	Nobility: {
		color: Color3.fromRGB(128, 68, 148),
		bgColor: Color3.fromRGB(28, 16, 34),
		label: "Epic",
		order: 3,
	},
	Royalty: {
		color: Color3.fromRGB(195, 155, 50),
		bgColor: Color3.fromRGB(36, 30, 14),
		label: "Legendary",
		order: 4,
	},
};
