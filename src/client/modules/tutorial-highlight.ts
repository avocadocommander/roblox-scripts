/**
 * tutorial-highlight — yellow show-through Highlights on tutorial targets.
 *
 * Watches the active onboarding step (via board-state) plus the local
 * player's current NPC bounty, and paints a Highlight on every matching
 * Model in the workspace so the player can see their objective through
 * walls. When the step advances or its target set changes the highlights
 * are cleaned up automatically.
 *
 * Target resolution is data-driven through the `highlightType` field
 * on OnboardingStep:
 *   - "guildLeaders" -> every faction guild leader (both leaders).
 *   - "bountyTarget" -> the currently assigned NPC bounty (if any).
 *   - undefined      -> no highlight this step.
 */

import { Players, Workspace } from "@rbxts/services";
import { getCurrentOnboardingStep, onBoardStateChanged } from "./board-state";
import { getGuildLeaderNames } from "shared/config/factions";
import {
	getBountyAssignedRemote,
	getBountyCompletedRemote,
	getBountyListSyncRemote,
	getMyNPCBountyRemote,
	NPCBountyPayload,
} from "shared/remotes/bounty-remote";
import { log } from "shared/helpers";

const HIGHLIGHT_NAME = "TutorialHighlight";
interface HighlightPalette {
	fill: Color3;
	outline: Color3;
}

const GUILD_LEADER_PALETTE: HighlightPalette = {
	fill: Color3.fromRGB(245, 210, 80),
	outline: Color3.fromRGB(255, 235, 140),
};
const KILL_TARGET_PALETTE: HighlightPalette = {
	fill: Color3.fromRGB(255, 0, 0),
	outline: Color3.fromRGB(255, 235, 235),
};
const FILL_TRANSPARENCY = 0.6;
const OUTLINE_TRANSPARENCY = 0;

// ── State ───────────────────────────────────────────────────────────────────

const activeHighlights = new Map<Model, Highlight>();
let currentBountyName: string | undefined;
let pendingBountyFetch = false;

// ── Target resolution ───────────────────────────────────────────────────────

function fetchBountyFromServer(): void {
	if (pendingBountyFetch) return;
	pendingBountyFetch = true;
	task.spawn(() => {
		const [ok, result] = pcall(() => getMyNPCBountyRemote().InvokeServer());
		pendingBountyFetch = false;
		if (!ok) {
			log("[TUTORIAL-HIGHLIGHT] GetMyNPCBounty invoke failed: " + tostring(result));
			return;
		}
		const payload = result as NPCBountyPayload | undefined;
		if (payload && payload.npcName !== undefined && payload.npcName !== "") {
			currentBountyName = payload.npcName;
			log("[TUTORIAL-HIGHLIGHT] fetched bounty target from server: " + currentBountyName);
			refreshHighlights();
		}
	});
}

function getTargetNames(): Set<string> {
	const set = new Set<string>();
	const step = getCurrentOnboardingStep();
	if (!step || step.highlightType === undefined) return set;

	if (step.highlightType === "guildLeaders") {
		for (const name of getGuildLeaderNames()) set.add(name);
	} else if (step.highlightType === "bountyTarget") {
		if (currentBountyName !== undefined && currentBountyName !== "") {
			set.add(currentBountyName);
		} else {
			// No cached bounty -- ask the server. When it returns, refreshHighlights
			// is called again and the highlight will land on the next pass.
			fetchBountyFromServer();
		}
	}
	return set;
}

function getHighlightPalette(): HighlightPalette {
	const step = getCurrentOnboardingStep();
	return step?.highlightType === "bountyTarget" ? KILL_TARGET_PALETTE : GUILD_LEADER_PALETTE;
}

// ── Highlight application ───────────────────────────────────────────────────

function styleHighlight(highlight: Highlight, palette: HighlightPalette): void {
	highlight.FillColor = palette.fill;
	highlight.OutlineColor = palette.outline;
	highlight.FillTransparency = FILL_TRANSPARENCY;
	highlight.OutlineTransparency = OUTLINE_TRANSPARENCY;
}

function applyHighlight(model: Model, palette: HighlightPalette): void {
	const existing = activeHighlights.get(model);
	if (existing) {
		styleHighlight(existing, palette);
		return;
	}
	const highlight = new Instance("Highlight");
	highlight.Name = HIGHLIGHT_NAME;
	styleHighlight(highlight, palette);
	highlight.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop;
	highlight.Adornee = model;
	highlight.Parent = model;
	activeHighlights.set(model, highlight);
}

function removeHighlight(model: Model): void {
	const existing = activeHighlights.get(model);
	if (!existing) return;
	existing.Destroy();
	activeHighlights.delete(model);
}

function clearAllHighlights(): void {
	for (const [model] of activeHighlights) removeHighlight(model);
}

function isPlayerCharacter(model: Model): boolean {
	for (const player of Players.GetPlayers()) {
		if (player.Character === model) return true;
	}
	return false;
}

function refreshHighlights(): void {
	const targets = getTargetNames();
	if (targets.size() === 0) {
		clearAllHighlights();
		return;
	}
	const palette = getHighlightPalette();

	// Remove highlights on models that no longer match (e.g. step advanced,
	// bounty changed, model despawned, etc.).
	for (const [model] of activeHighlights) {
		if (!model.IsDescendantOf(Workspace) || !targets.has(model.Name)) {
			removeHighlight(model);
		} else {
			applyHighlight(model, palette);
		}
	}

	// Scan workspace for current matches. We do NOT require a Humanoid here
	// because NPC rigs race: the Model is parented to Workspace before its
	// Humanoid is parented, and our DescendantAdded handler only re-fires for
	// new Models, not for Humanoids added into existing ones. As long as the
	// name matches a guild-leader / bounty target we apply the highlight.
	let matched = 0;
	for (const descendant of Workspace.GetDescendants()) {
		if (!descendant.IsA("Model")) continue;
		if (!targets.has(descendant.Name)) continue;
		if (isPlayerCharacter(descendant)) continue;
		applyHighlight(descendant, palette);
		matched += 1;
	}

	if (matched === 0) {
		const names: string[] = [];
		for (const n of targets) names.push(n);
		log("[TUTORIAL-HIGHLIGHT] no models matched targets: " + names.join(", "));
	}
}

// ── Bounty wiring ───────────────────────────────────────────────────────────

function setCurrentBounty(payload: NPCBountyPayload | undefined): void {
	currentBountyName = payload?.npcName;
	log("[TUTORIAL-HIGHLIGHT] bounty target = " + (currentBountyName ?? "<none>"));
	refreshHighlights();
}

// ── Init ────────────────────────────────────────────────────────────────────

let initialized = false;

export function initializeTutorialHighlight(): void {
	if (initialized) return;
	initialized = true;

	// React to onboarding step / achievement changes.
	onBoardStateChanged(refreshHighlights);

	// Bounty assignment / completion drive bountyTarget highlight.
	getBountyAssignedRemote().OnClientEvent.Connect((payload: unknown) => {
		setCurrentBounty(payload as NPCBountyPayload);
	});
	getBountyCompletedRemote().OnClientEvent.Connect(() => {
		setCurrentBounty(undefined);
	});
	getBountyListSyncRemote().OnClientEvent.Connect((npcBounty: unknown) => {
		setCurrentBounty(npcBounty as NPCBountyPayload | undefined);
	});

	// Track new NPCs that spawn after init, and clean up on removal.
	// NPC rigs can be parented as empty Models first and have their parts /
	// Humanoid added later, or be renamed after parenting, so we also
	// listen for name changes on existing Models we may have missed.
	Workspace.DescendantAdded.Connect((inst) => {
		if (inst.IsA("Model")) {
			inst.GetPropertyChangedSignal("Name").Connect(() => refreshHighlights());
			refreshHighlights();
		}
	});
	Workspace.DescendantRemoving.Connect((inst) => {
		if (!inst.IsA("Model")) return;
		const existing = activeHighlights.get(inst);
		if (existing) {
			existing.Destroy();
			activeHighlights.delete(inst);
		}
	});

	// Hook name changes on already-existing Models too, so if server renames
	// an NPC after parenting (common pattern) we catch it.
	for (const inst of Workspace.GetDescendants()) {
		if (inst.IsA("Model")) {
			inst.GetPropertyChangedSignal("Name").Connect(() => refreshHighlights());
		}
	}

	refreshHighlights();
	// Seed currentBountyName from the server in case BountyAssigned /
	// BountyListSync already fired before this listener attached.
	fetchBountyFromServer();
	log("[TUTORIAL-HIGHLIGHT] initialized");
}
