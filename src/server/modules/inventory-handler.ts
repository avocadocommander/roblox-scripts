import { Players } from "@rbxts/services";
import { log } from "shared/helpers";
import {
	ITEMS,
	SLOT_LAYOUT,
	EquippedSlots,
	InventoryPayload,
	BountyScroll,
	BountyScrollPayload,
	MAX_BOUNTY_SLOTS,
	STATUS_TO_SCROLL_RARITY,
} from "shared/inventory";
import {
	getEquipItemRemote,
	getUnequipSlotRemote,
	getInventorySyncRemote,
	getRequestInventoryRemote,
	getMockBountyKillRemote,
	getTurnInBountyRemote,
} from "shared/remotes/inventory-remote";
import { MEDIEVAL_NPC_NAMES, MEDIEVAL_NPCS, SATIRICAL_BOUNTY_OFFENSES, Status } from "shared/module";

// ── Per-player inventory state ────────────────────────────────────────────────

interface PlayerInventory {
	/** Item ID -> quantity owned. */
	owned: Map<string, number>;
	/** Slot ID -> equipped item ID. */
	equipped: Map<string, string>;
	/** Collected bounty scrolls (up to MAX_BOUNTY_SLOTS). */
	bountyScrolls: BountyScroll[];
}

const PLAYER_INVENTORIES = new Map<Player, PlayerInventory>();

// ── Remotes ───────────────────────────────────────────────────────────────────

const equipRemote = getEquipItemRemote();
const unequipRemote = getUnequipSlotRemote();
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
	const equipped: EquippedSlots = {};
	for (const slot of SLOT_LAYOUT) {
		equipped[slot.id] = inv.equipped.get(slot.id);
	}
	return { ownedItems, equipped, bountyScrolls: inv.bountyScrolls };
}

function pushSync(player: Player): void {
	const inv = PLAYER_INVENTORIES.get(player);
	if (!inv) return;
	syncRemote.FireClient(player, buildPayload(inv));
}

/** Give a player starter items and default equips. */
function initPlayerInventory(player: Player): PlayerInventory {
	const owned = new Map<string, number>();
	// Everyone starts with fists, one minor heal, and one swiftness
	owned.set("fists", 1);
	owned.set("rusty_dagger", 1);
	owned.set("shadow_blade", 1);
	owned.set("nightshade", 1);
	owned.set("serpent_venom", 1);
	owned.set("minor_heal", 3);
	owned.set("swiftness", 2);
	owned.set("invisibility", 1);
	owned.set("fortify", 2);

	const equipped = new Map<string, string>();
	equipped.set("weapon", "fists"); // Default weapon

	const inv: PlayerInventory = { owned, equipped, bountyScrolls: [] };
	PLAYER_INVENTORIES.set(player, inv);
	return inv;
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
	// Find the lowest unused slot index (0-3)
	const used = new Set<number>();
	for (const scroll of inv.bountyScrolls) {
		used.add(scroll.slotIndex);
	}
	for (let i = 0; i < MAX_BOUNTY_SLOTS; i++) {
		if (!used.has(i)) return i;
	}
	return 0; // fallback (should not happen)
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
 * Returns the number of scrolls transferred.
 */
export function transferBountyScrolls(victim: Player, killer: Player): number {
	const victimInv = PLAYER_INVENTORIES.get(victim);
	const killerInv = PLAYER_INVENTORIES.get(killer);
	if (!victimInv || !killerInv) return 0;

	if (victimInv.bountyScrolls.size() === 0) return 0;

	// Sort victim's scrolls by rarity descending (highest first)
	const sorted = [...victimInv.bountyScrolls];
	sorted.sort((a, b) => {
		const ra = RARITY_PRIORITY[a.rarity] ?? 0;
		const rb = RARITY_PRIORITY[b.rarity] ?? 0;
		return ra > rb;
	});

	let transferred = 0;
	for (const scroll of sorted) {
		if (!canAcceptBountyScroll(killerInv)) break;

		// Re-assign slot index for the killer's inventory
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

	// Erase all scrolls from victim regardless
	victimInv.bountyScrolls = [];

	// Sync both inventories
	pushSync(victim);
	pushSync(killer);

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
 * Uses the victim's name as the target and the bounty gold/xp as the reward.
 * Returns true if the scroll was added (killer had room).
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
	log("[BOUNTY-SCROLL] " + player.Name + " collected scroll: " + npcName + " (" + scroll.rarity + ")");
	return true;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initializeInventorySystem(): void {
	// Handle equip requests
	equipRemote.OnServerEvent.Connect((player: Player, ...args: unknown[]) => {
		const slotId = args[0] as string | undefined;
		const itemId = args[1] as string | undefined;
		if (slotId === undefined || itemId === undefined) return;

		const inv = PLAYER_INVENTORIES.get(player);
		if (!inv) return;

		// Validate item exists
		const itemDef = ITEMS[itemId];
		if (!itemDef) return;

		// Validate slot exists
		const slotDef = SLOT_LAYOUT.find((s) => s.id === slotId);
		if (!slotDef) return;

		// Validate item fits in this slot type
		if (itemDef.slotType !== slotDef.slotType) return;

		// Validate player owns the item
		const ownedCount = inv.owned.get(itemId) ?? 0;
		if (ownedCount <= 0) return;

		// Equip it
		inv.equipped.set(slotId, itemId);
		log(`[INVENTORY] ${player.Name} equipped ${itemDef.name} in slot ${slotId}`);
		pushSync(player);
	});

	// Handle unequip requests
	unequipRemote.OnServerEvent.Connect((player: Player, ...args: unknown[]) => {
		const slotId = args[0] as string | undefined;
		if (slotId === undefined) return;

		const inv = PLAYER_INVENTORIES.get(player);
		if (!inv) return;

		inv.equipped.delete(slotId);
		log(`[INVENTORY] ${player.Name} unequipped slot ${slotId}`);
		pushSync(player);
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

		// Turn in the first scroll (FIFO)
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
	});

	log("[INVENTORY] Inventory system initialised");
}
