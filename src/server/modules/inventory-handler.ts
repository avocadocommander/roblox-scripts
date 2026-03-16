import { Players } from "@rbxts/services";
import { log } from "shared/helpers";
import {
	ITEMS,
	InventoryPayload,
	BountyScroll,
	BountyScrollPayload,
	MAX_BOUNTY_SLOTS,
	STATUS_TO_SCROLL_RARITY,
} from "shared/inventory";
import {
	getActivateItemRemote,
	getInventorySyncRemote,
	getRequestInventoryRemote,
	getMockBountyKillRemote,
	getTurnInBountyRemote,
} from "shared/remotes/inventory-remote";
import { MEDIEVAL_NPC_NAMES, MEDIEVAL_NPCS, Status } from "shared/module";

// Lazy import to avoid circular dependency with bounty-manager
let _broadcastWantedScrollUpdate: ((player: Player) => void) | undefined;
function notifyWantedScrollChange(player: Player): void {
	if (!_broadcastWantedScrollUpdate) {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const bm = require(script.Parent!.FindFirstChild("bounty-manager") as ModuleScript) as {
			broadcastWantedScrollUpdate: (player: Player) => void;
		};
		_broadcastWantedScrollUpdate = bm.broadcastWantedScrollUpdate;
	}
	_broadcastWantedScrollUpdate(player);
}

// ── Per-player inventory state ────────────────────────────────────────────────

interface PlayerInventory {
	/** Item ID -> quantity owned. */
	owned: Map<string, number>;
	/** Currently equipped weapon ID. */
	equippedWeapon: string;
	/** Currently active poison ID (or undefined). */
	activePoison: string | undefined;
	/** Currently active elixir IDs. */
	activeElixirs: string[];
	/** Collected bounty scrolls (up to MAX_BOUNTY_SLOTS). */
	bountyScrolls: BountyScroll[];
}

const PLAYER_INVENTORIES = new Map<Player, PlayerInventory>();

// ── Remotes ───────────────────────────────────────────────────────────────────

const activateRemote = getActivateItemRemote();
const syncRemote = getInventorySyncRemote();
const requestRemote = getRequestInventoryRemote();
const mockBountyKillRemote = getMockBountyKillRemote();
const turnInBountyRemote = getTurnInBountyRemote();

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPayload(inv: PlayerInventory): InventoryPayload {
	const ownedItems: Record<string, number> = {};
	for (const [id, count] of inv.owned) {
		ownedItems[id] = count;
	}
	return {
		ownedItems,
		equippedWeapon: inv.equippedWeapon,
		activePoison: inv.activePoison,
		activeElixirs: [...inv.activeElixirs],
		bountyScrolls: inv.bountyScrolls,
	};
}

function pushSync(player: Player): void {
	const inv = PLAYER_INVENTORIES.get(player);
	if (!inv) return;
	syncRemote.FireClient(player, buildPayload(inv));
}

/** Give a player starter items and default equips. */
function initPlayerInventory(player: Player): PlayerInventory {
	const owned = new Map<string, number>();

	// Default: just fists. For testing, add all items with max stacks.
	owned.set("fists", 1);
	owned.set("dagger", 1);
	// Poisons (5 each for testing)
	owned.set("floating_death", 5);
	owned.set("slow_decay", 5);
	owned.set("paralysis_toxin", 5);
	owned.set("dragons_breath", 5);
	owned.set("phantom_venom", 5);
	// Elixirs (5 each for testing)
	owned.set("swiftness_elixir", 5);
	owned.set("sky_step", 5);
	owned.set("shadow_cloak", 5);
	owned.set("eagle_eye", 5);
	owned.set("vitality_draught", 5);
	owned.set("ghost_oil", 5);

	const inv: PlayerInventory = {
		owned,
		equippedWeapon: "fists",
		activePoison: undefined,
		activeElixirs: [],
		bountyScrolls: [],
	};
	PLAYER_INVENTORIES.set(player, inv);
	return inv;
}

// ── Activation logic ──────────────────────────────────────────────────────────

function handleActivateItem(player: Player, itemId: string): void {
	const inv = PLAYER_INVENTORIES.get(player);
	if (!inv) return;

	const itemDef = ITEMS[itemId];
	if (!itemDef) return;

	const ownedCount = inv.owned.get(itemId) ?? 0;
	if (ownedCount <= 0) return;

	if (itemDef.category === "weapon") {
		// Equip weapon (toggle — if already equipped, switch back to fists)
		if (inv.equippedWeapon === itemId) {
			inv.equippedWeapon = "fists";
			log(`[INVENTORY] ${player.Name} unequipped ${itemDef.name}, back to Fists`);
		} else {
			inv.equippedWeapon = itemId;
			log(`[INVENTORY] ${player.Name} equipped weapon: ${itemDef.name}`);
		}
	} else if (itemDef.category === "poison") {
		// Activate poison (replaces current active poison, consumes 1)
		inv.activePoison = itemId;
		inv.owned.set(itemId, ownedCount - 1);
		if (ownedCount - 1 <= 0) inv.owned.delete(itemId);
		log(`[INVENTORY] ${player.Name} activated poison: ${itemDef.name}`);
	} else if (itemDef.category === "elixir") {
		// Activate elixir (add to active list if not already active, consumes 1)
		if (inv.activeElixirs.includes(itemId)) {
			log(`[INVENTORY] ${player.Name} already has ${itemDef.name} active`);
			return; // Don't consume if already active
		}
		inv.activeElixirs.push(itemId);
		inv.owned.set(itemId, ownedCount - 1);
		if (ownedCount - 1 <= 0) inv.owned.delete(itemId);
		log(`[INVENTORY] ${player.Name} activated elixir: ${itemDef.name}`);
	}

	pushSync(player);
}

// ── Bounty scroll helpers ─────────────────────────────────────────────────────

/** Gold reward per NPC status for bounty scrolls. */
const SCROLL_GOLD: Record<string, number> = {
	Serf: 100,
	Commoner: 200,
	Merchant: 350,
	Nobility: 600,
	Royalty: 1200,
};

/** XP reward per NPC status for bounty scrolls. */
const SCROLL_XP: Record<string, number> = {
	Serf: 500,
	Commoner: 750,
	Merchant: 1000,
	Nobility: 1500,
	Royalty: 2500,
};

function canAcceptBountyScroll(inv: PlayerInventory): boolean {
	return inv.bountyScrolls.size() < MAX_BOUNTY_SLOTS;
}

function nextScrollSlotIndex(inv: PlayerInventory): number {
	const used = new Set<number>();
	for (const scroll of inv.bountyScrolls) {
		used.add(scroll.slotIndex);
	}
	for (let i = 0; i < MAX_BOUNTY_SLOTS; i++) {
		if (!used.has(i)) return i;
	}
	return 0;
}

/** Generate a mock bounty kill: pick a random NPC, create a scroll. */
function generateMockBountyScroll(inv: PlayerInventory): BountyScroll | undefined {
	if (!canAcceptBountyScroll(inv)) return undefined;

	const names = [...MEDIEVAL_NPC_NAMES];
	const npcName = names[math.random(0, names.size() - 1)];
	const npcData = MEDIEVAL_NPCS[npcName];
	const status = (npcData?.status ?? "Commoner") as string;

	const scroll: BountyScroll = {
		slotIndex: nextScrollSlotIndex(inv),
		targetName: npcName,
		rarity: STATUS_TO_SCROLL_RARITY[status] ?? "common",
		gold: SCROLL_GOLD[status] ?? 200,
		xp: SCROLL_XP[status] ?? 500,
	};

	inv.bountyScrolls.push(scroll);
	return scroll;
}

/** Check if a player has room for more bounty scrolls. */
export function playerCanAcceptBounty(player: Player): boolean {
	const inv = PLAYER_INVENTORIES.get(player);
	if (!inv) return false;
	return canAcceptBountyScroll(inv);
}

/** Return the rarity strings for each bounty scroll this player holds. */
export function getPlayerScrollRarities(player: Player): string[] {
	const inv = PLAYER_INVENTORIES.get(player);
	if (!inv) return [];
	return inv.bountyScrolls.map((s) => s.rarity);
}

/** Rarity ordering for transfer priority (highest first). */
const RARITY_PRIORITY: Record<string, number> = {
	player: 5,
	legendary: 4,
	epic: 3,
	rare: 2,
	uncommon: 1,
	common: 0,
};

/**
 * Transfer bounty scrolls from victim to killer on PvP kill.
 * Highest rarity scrolls transfer first. Killer only receives
 * as many as they have room for. Remaining scrolls are erased.
 */
export function transferBountyScrolls(victim: Player, killer: Player): number {
	const victimInv = PLAYER_INVENTORIES.get(victim);
	const killerInv = PLAYER_INVENTORIES.get(killer);
	if (!victimInv || !killerInv) return 0;

	if (victimInv.bountyScrolls.size() === 0) return 0;

	const sorted = [...victimInv.bountyScrolls];
	sorted.sort((a, b) => {
		const ra = RARITY_PRIORITY[a.rarity] ?? 0;
		const rb = RARITY_PRIORITY[b.rarity] ?? 0;
		return ra > rb;
	});

	let transferred = 0;
	for (const scroll of sorted) {
		if (!canAcceptBountyScroll(killerInv)) break;

		const newScroll: BountyScroll = {
			slotIndex: nextScrollSlotIndex(killerInv),
			targetName: scroll.targetName,
			rarity: scroll.rarity,
			gold: scroll.gold,
			xp: scroll.xp,
		};
		killerInv.bountyScrolls.push(newScroll);
		transferred++;
	}

	victimInv.bountyScrolls = [];

	pushSync(victim);
	pushSync(killer);
	notifyWantedScrollChange(victim);
	notifyWantedScrollChange(killer);

	log(
		"[BOUNTY-SCROLL] Transferred " +
			transferred +
			" scroll(s) from " +
			victim.Name +
			" to " +
			killer.Name +
			" (" +
			(sorted.size() - transferred) +
			" erased)",
	);

	return transferred;
}

/**
 * Award a "player" rarity bounty scroll to the killer after a PvP wanted kill.
 */
export function addPlayerBountyScroll(killer: Player, victimName: string, gold: number, xp: number): boolean {
	const inv = PLAYER_INVENTORIES.get(killer);
	if (!inv || !canAcceptBountyScroll(inv)) return false;

	const scroll: BountyScroll = {
		slotIndex: nextScrollSlotIndex(inv),
		targetName: victimName,
		rarity: "player",
		gold,
		xp,
	};
	inv.bountyScrolls.push(scroll);
	pushSync(killer);
	notifyWantedScrollChange(killer);
	log("[BOUNTY-SCROLL] " + killer.Name + " earned PLAYER scroll: " + victimName + " (" + gold + "g)");
	return true;
}

/** Add a bounty scroll from an actual NPC kill (called by assassination-handler). */
export function addBountyScrollFromKill(
	player: Player,
	npcName: string,
	npcStatus: string,
	gold: number,
	xp: number,
): boolean {
	const inv = PLAYER_INVENTORIES.get(player);
	if (!inv || !canAcceptBountyScroll(inv)) return false;

	const scroll: BountyScroll = {
		slotIndex: nextScrollSlotIndex(inv),
		targetName: npcName,
		rarity: STATUS_TO_SCROLL_RARITY[npcStatus] ?? "common",
		gold,
		xp,
	};
	inv.bountyScrolls.push(scroll);
	pushSync(player);
	notifyWantedScrollChange(player);
	log("[BOUNTY-SCROLL] " + player.Name + " collected scroll: " + npcName + " (" + scroll.rarity + ")");
	return true;
}

/** Get the player's currently active poison ID (for assassination-handler to query). */
export function getPlayerActivePoison(player: Player): string | undefined {
	const inv = PLAYER_INVENTORIES.get(player);
	if (!inv) return undefined;
	return inv.activePoison;
}

/** Get the player's currently equipped weapon ID. */
export function getPlayerEquippedWeapon(player: Player): string {
	const inv = PLAYER_INVENTORIES.get(player);
	if (!inv) return "fists";
	return inv.equippedWeapon;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initializeInventorySystem(): void {
	// Handle item activation (equip weapon / use poison / drink elixir)
	activateRemote.OnServerEvent.Connect((player: Player, ...args: unknown[]) => {
		const itemId = args[0] as string | undefined;
		if (itemId === undefined) return;
		handleActivateItem(player, itemId);
	});

	// Handle full inventory request
	requestRemote.OnServerInvoke = (player: Player) => {
		const inv = PLAYER_INVENTORIES.get(player);
		if (!inv) return undefined;
		return buildPayload(inv);
	};

	// Init inventory on player join
	Players.PlayerAdded.Connect((player) => {
		initPlayerInventory(player);
	});

	// Also init for players already in-game (in case bootstrap ran late)
	for (const player of Players.GetPlayers()) {
		if (!PLAYER_INVENTORIES.has(player)) {
			initPlayerInventory(player);
		}
	}

	// Cleanup on leave
	Players.PlayerRemoving.Connect((player) => {
		PLAYER_INVENTORIES.delete(player);
	});

	// ── Mock bounty kill (B key) ──────────────────────────────────────────────
	mockBountyKillRemote.OnServerEvent.Connect((player: Player) => {
		const inv = PLAYER_INVENTORIES.get(player);
		if (!inv) return;

		if (!canAcceptBountyScroll(inv)) {
			log("[BOUNTY-SCROLL] " + player.Name + " scrolls full (" + MAX_BOUNTY_SLOTS + "/" + MAX_BOUNTY_SLOTS + ")");
			return;
		}

		const scroll = generateMockBountyScroll(inv);
		if (scroll) {
			log(
				"[BOUNTY-SCROLL] " +
					player.Name +
					" mock-killed " +
					scroll.targetName +
					" -> scroll (" +
					scroll.rarity +
					")",
			);
			pushSync(player);
			notifyWantedScrollChange(player);
		}
	});

	// ── Turn in bounty scroll (N key) ─────────────────────────────────────────
	turnInBountyRemote.OnServerEvent.Connect((player: Player) => {
		const inv = PLAYER_INVENTORIES.get(player);
		if (!inv) return;

		if (inv.bountyScrolls.size() === 0) {
			log("[BOUNTY-SCROLL] " + player.Name + " has no scrolls to turn in");
			return;
		}

		const scroll = inv.bountyScrolls[0];
		inv.bountyScrolls = inv.bountyScrolls.filter((_, i) => i !== 0);

		log(
			"[BOUNTY-SCROLL] " +
				player.Name +
				" turned in scroll: " +
				scroll.targetName +
				" (+" +
				scroll.gold +
				"g, +" +
				scroll.xp +
				"xp)",
		);
		pushSync(player);
		notifyWantedScrollChange(player);
	});

	log("[INVENTORY] Inventory system initialised");
}
