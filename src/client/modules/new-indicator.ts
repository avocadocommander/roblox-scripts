/**
 * new-indicator — tracks "new since last viewed" state for items
 * grouped by section (inventory, killbook tabs, etc.) and paints a
 * small yellow dot onto any GuiObject you hand it.
 *
 * Flow:
 *  - Systems call `trackPresent(section, ids)` every time they
 *    know the full set of ids for that section (e.g. on inventory
 *    sync, or on killbook fetch). Any id not previously known
 *    becomes "unseen" and will render a dot.
 *  - Systems call `markSeen(section)` when the user has finished
 *    looking at the section (panel closed, tab switched away).
 *  - UI builders call `setDotVisible(element, visible)` when
 *    building tiles / cards / buttons. A child Frame named
 *    "NewIndicatorDot" is added/removed automatically.
 *  - Buttons that represent a collection (mobile-hud InventoryButton,
 *    CodexButton, killbook tab buttons) subscribe via `onChange(cb)`
 *    and call `hasAnyNew(sectionOrPrefix)` to toggle their own dot.
 *
 * Persistence is in-memory only — a fresh join registers every
 * currently-owned id as new, which is the intended behaviour so the
 * player notices unreviewed items after a long break.
 */

const DOT_NAME = "NewIndicatorDot";
const DOT_COLOR = Color3.fromRGB(245, 210, 80);
const DOT_OUTLINE = Color3.fromRGB(40, 30, 10);
const DOT_SIZE = 10;

// ── State ───────────────────────────────────────────────────────────────────

/** Every id the section has ever seen. Used to detect "new" on sync. */
const knownIds = new Map<string, Set<string>>();
/** Subset of knownIds that the user has NOT yet viewed. */
const unseenIds = new Map<string, Set<string>>();
const changeSubscribers = new Array<() => void>();

function ensureSection(section: string): void {
	if (!knownIds.has(section)) knownIds.set(section, new Set<string>());
	if (!unseenIds.has(section)) unseenIds.set(section, new Set<string>());
}

function notifyChange(): void {
	for (const cb of changeSubscribers) {
		const [ok, err] = pcall(cb);
		if (!ok) warn("[NEW-INDICATOR] subscriber error: " + tostring(err));
	}
}

// ── Public state API ────────────────────────────────────────────────────────

/**
 * Sync the full set of ids currently present in a section. Any id that
 * wasn't previously known is marked as new (unseen). Ids that disappear
 * (e.g. consumed consumable) are pruned from both sets.
 */
export function trackPresent(section: string, ids: ReadonlyArray<string>): void {
	ensureSection(section);
	const known = knownIds.get(section)!;
	const unseen = unseenIds.get(section)!;
	const incoming = new Set<string>();
	for (const id of ids) incoming.add(id);

	let changed = false;

	// New ids become unseen.
	for (const id of ids) {
		if (!known.has(id)) {
			known.add(id);
			unseen.add(id);
			changed = true;
		}
	}

	// Ids that no longer exist should leave both sets.
	for (const id of known) {
		if (!incoming.has(id)) {
			known.delete(id);
			if (unseen.delete(id)) changed = true;
		}
	}

	if (changed) notifyChange();
}

/** Clear the unseen set for a section (called on panel close / tab switch). */
export function markSeen(section: string): void {
	const unseen = unseenIds.get(section);
	if (!unseen || unseen.size() === 0) return;
	unseen.clear();
	notifyChange();
}

/**
 * Additively mark an id as new in a section without pruning existing ids.
 * Useful for live events (e.g. achievement just unlocked) that fire before
 * the owning section renders.
 */
export function markNew(section: string, id: string): void {
	ensureSection(section);
	const known = knownIds.get(section)!;
	const unseen = unseenIds.get(section)!;
	let changed = false;
	if (!known.has(id)) {
		known.add(id);
		changed = true;
	}
	if (!unseen.has(id)) {
		unseen.add(id);
		changed = true;
	}
	if (changed) notifyChange();
}

export function isNew(section: string, id: string): boolean {
	const unseen = unseenIds.get(section);
	return unseen !== undefined && unseen.has(id);
}

/** True if the exact section has any unseen ids. */
export function hasAnyNew(section: string): boolean {
	const unseen = unseenIds.get(section);
	return unseen !== undefined && unseen.size() > 0;
}

/** True if any section whose key starts with the given prefix has unseen ids. */
export function hasAnyNewWithPrefix(prefix: string): boolean {
	for (const [section, unseen] of unseenIds) {
		if (unseen.size() > 0 && string.sub(section, 1, prefix.size()) === prefix) return true;
	}
	return false;
}

export function onChange(cb: () => void): void {
	changeSubscribers.push(cb);
}

// ── Rendering ───────────────────────────────────────────────────────────────

function createDot(parent: GuiObject): Frame {
	const dot = new Instance("Frame");
	dot.Name = DOT_NAME;
	dot.Size = new UDim2(0, DOT_SIZE, 0, DOT_SIZE);
	dot.Position = new UDim2(0, 2, 0, 2);
	dot.AnchorPoint = new Vector2(0, 0);
	dot.BackgroundColor3 = DOT_COLOR;
	dot.BorderSizePixel = 0;
	dot.ZIndex = math.max(parent.ZIndex + 5, 100);
	dot.Parent = parent;

	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(0.5, 0);
	corner.Parent = dot;

	const stroke = new Instance("UIStroke");
	stroke.Color = DOT_OUTLINE;
	stroke.Thickness = 1;
	stroke.Parent = dot;

	return dot;
}

/**
 * Ensure a GuiObject has (or does not have) a yellow "new" dot child.
 * Safe to call repeatedly. Re-parents the dot so it always sits on top.
 */
export function setDotVisible(parent: GuiObject, visible: boolean): void {
	const existing = parent.FindFirstChild(DOT_NAME) as Frame | undefined;
	if (visible) {
		if (!existing) createDot(parent);
	} else if (existing) {
		existing.Destroy();
	}
}
