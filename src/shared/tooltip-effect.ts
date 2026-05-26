/**
 * Tooltip Effect Highlighting
 *
 * For tiered items (poisons / elixirs) the tooltip's effect line is rendered
 * with the differences from the family's tier-1 base highlighted in colour:
 *
 *   Tier 1 (base):  no highlighting -- displayed plainly.
 *   Tier 2 ( + ):   differences from base highlighted GREEN.
 *   Tier 3 ( ++):   differences from base highlighted YELLOW.
 *
 * An optional `extraEffect` string is rendered on its own line below the main
 * effect text in the tier's highlight colour. Use it for additional abilities
 * a higher tier gains beyond the base (e.g. "Also grants 3s invisibility.").
 *
 * The diff is automatic: a word-level Longest Common Subsequence is computed
 * between the upgrade's effect and the base effect, and any tokens in the
 * upgrade that are NOT part of the LCS are wrapped in a coloured RichText
 * `<font>` span. Authors do not have to mark anything by hand -- write each
 * tier's `effect` field naturally and the highlights appear on their own.
 *
 * Data-only module: no Roblox runtime dependencies beyond Color3.
 */

export type TooltipTier = 1 | 2 | 3;

/** Hex colour codes used inside RichText `<font color="...">` tags. */
export const TIER_HIGHLIGHT_HEX: Record<TooltipTier, string | undefined> = {
	1: undefined,
	2: "#78c86e", // good highlight green
	3: "#e6c850", // warm yellow
};

/** Color3 equivalents for non-RichText UI elements (extra-effect label, etc.). */
export const TIER_HIGHLIGHT_COLOR: Record<TooltipTier, Color3 | undefined> = {
	1: undefined,
	2: Color3.fromRGB(120, 200, 110),
	3: Color3.fromRGB(230, 200, 80),
};

// ── Internal: tokenize + diff ────────────────────────────────────────────────

/**
 * Split a string into tokens for diffing.
 *
 * Whitespace runs are preserved as their own tokens so spacing survives the
 * round-trip when tokens are concatenated. Within a non-whitespace run we
 * further split at the digit / non-digit boundary so numeric changes diff
 * independently of the letters and punctuation around them. Example:
 *
 *   "target collapses in 8s."
 *      -> ["target", " ", "collapses", " ", "in", " ", "8", "s."]
 *   "target collapses in 12s."
 *      -> ["target", " ", "collapses", " ", "in", " ", "12", "s."]
 *
 * So the LCS matches everything except "8" vs "12" and only the number gets
 * highlighted -- not the trailing unit ("s.").
 */
function tokenize(s: string): string[] {
	const out: string[] = [];
	let buf = "";
	let bufIsDigit = false;

	const flush = () => {
		if (buf !== "") {
			out.push(buf);
			buf = "";
		}
	};

	for (let i = 1; i <= s.size(); i++) {
		const ch = s.sub(i, i);
		if (ch === " " || ch === "\t" || ch === "\n") {
			flush();
			out.push(ch);
			continue;
		}
		const isDigit = ch >= "0" && ch <= "9";
		if (buf !== "" && isDigit !== bufIsDigit) {
			flush();
		}
		buf += ch;
		bufIsDigit = isDigit;
	}
	flush();
	return out;
}

/**
 * Returns a mask of `target.size()` booleans: true at index i means
 * `target[i]` is NOT part of the longest common subsequence with `base`,
 * i.e. that token should be highlighted as a difference.
 */
function diffMask(base: string[], target: string[]): boolean[] {
	const m = base.size();
	const n = target.size();

	// dp[i][j] = LCS length of base[0..i) and target[0..j)
	const dp: number[][] = [];
	for (let i = 0; i <= m; i++) {
		const row: number[] = [];
		for (let j = 0; j <= n; j++) row.push(0);
		dp.push(row);
	}
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (base[i - 1] === target[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1] + 1;
			} else {
				dp[i][j] = math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
	}

	const inLCS: boolean[] = [];
	for (let k = 0; k < n; k++) inLCS.push(false);
	let i = m;
	let j = n;
	while (i > 0 && j > 0) {
		if (base[i - 1] === target[j - 1]) {
			inLCS[j - 1] = true;
			i--;
			j--;
		} else if (dp[i - 1][j] >= dp[i][j - 1]) {
			i--;
		} else {
			j--;
		}
	}

	const mask: boolean[] = [];
	for (let k = 0; k < n; k++) mask.push(inLCS[k] === false);
	return mask;
}

/** Escape RichText control characters (`<`, `>`, `&`) in plain user text. */
function escapeRichText(s: string): string {
	let [a] = s.gsub("&", "&amp;");
	[a] = a.gsub("<", "&lt;");
	[a] = a.gsub(">", "&gt;");
	return a;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a RichText-formatted string for `target` with tokens differing from
 * `base` wrapped in a coloured `<font>` span based on `tier`.
 *
 * Returns `target` (escaped) unchanged when tier is 1 or either string is
 * empty -- callers can always set TextLabel.RichText = true and feed the
 * result in without checking.
 */
export function buildEffectRichText(target: string, base: string, tier: TooltipTier): string {
	const hex = TIER_HIGHLIGHT_HEX[tier];
	if (hex === undefined || base === "" || target === "") return escapeRichText(target);

	const baseTok = tokenize(base);
	const targetTok = tokenize(target);
	const mask = diffMask(baseTok, targetTok);

	// Walk targetTok and merge consecutive highlighted tokens into one span.
	let out = "";
	let i = 0;
	while (i < targetTok.size()) {
		if (mask[i] === true) {
			let span = "";
			while (i < targetTok.size() && mask[i] === true) {
				span += targetTok[i];
				i++;
			}
			out += '<font color="' + hex + '"><b>' + escapeRichText(span) + "</b></font>";
		} else {
			out += escapeRichText(targetTok[i]);
			i++;
		}
	}
	return out;
}
