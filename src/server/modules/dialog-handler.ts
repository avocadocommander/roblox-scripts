/**
 * Dialog Handler — server module.
 *
 * Validates NPC dialog requests, builds payloads, processes purchases.
 * Purchase flow:
 *   1. Client fires PurchaseItem(npcName, itemId)
 *   2. Server checks: NPC has shop, item in shop, player has gold, item exists
 *   3. Deducts gold, gives item, syncs inventory, returns result
 */

import { Players, Workspace } from "@rbxts/services";
import { log } from "shared/helpers";
import { awardAchievement } from "./achievement-handler";
import { trackEvent, trackItemPurchased, trackMerchantVisited } from "./analytics-tracker";
import { playSoundEffect } from "./sound-effect-bus";
import { ANALYTICS_EVENTS } from "shared/config/analytics-events";
import { ITEMS } from "shared/inventory";
import { MEDIEVAL_NPCS } from "shared/module";
import { hasNPCDialog, getNPCInteraction, NPC_REGISTRY } from "shared/config/npcs";
import { pickRandom } from "shared/config/npc-shops";
import { getMerchantShop, getMerchantShopType } from "./merchant-handler";
import { factionForNPC, FACTIONS } from "shared/config/factions";
import { levelFromXP } from "shared/config/factions";
import {
	getOpenDialogRemote,
	getPurchaseItemRemote,
	getCloseDialogRemote,
	getDialogPayloadRemote,
	getPurchaseResultRemote,
	getFloatingNPCTextRemote,
	getTurnInBountiesDialogRemote,
	DialogPayload,
	ShopItemPayload,
} from "shared/remotes/dialog-remote";
import { addCoins, getPlayerStateSnapshot, addExperience, addScore, addFactionXP } from "shared/player-state";
import {
	givePlayerItem,
	getPlayerOwnedCount,
	getPlayerBountyScrollCount,
	turnInBountyScrolls,
} from "./inventory-handler";
import { getQuipForStatus } from "shared/config/npc-quips";
import { playerOwnsPass } from "./pass-handler";
import { getGamePassForItem } from "shared/config/game-passes";

// ── Remotes ───────────────────────────────────────────────────────────────────

const openDialogRemote = getOpenDialogRemote();
const purchaseItemRemote = getPurchaseItemRemote();
const closeDialogRemote = getCloseDialogRemote();
const dialogPayloadRemote = getDialogPayloadRemote();
const purchaseResultRemote = getPurchaseResultRemote();
const floatingTextRemote = getFloatingNPCTextRemote();
const turnInRemote = getTurnInBountiesDialogRemote();

// ── Per-player state: which NPC is the player currently talking to? ───────────

const activeDialog = new Map<Player, string>(); // player -> npcName

// Cooldown: prevent spamming floating quips per player (seconds)
const QUIP_COOLDOWN = 2.5;
const lastQuipTime = new Map<Player, number>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDialogPayload(npcName: string, player: Player): DialogPayload | undefined {
	const def = NPC_REGISTRY[npcName];
	// TurnIn NPCs (guild leaders) must never be treated as merchants, even if a
	// ShopSite in Studio accidentally has their name pinned via the NPCName attribute.
	const isTurnInNPC = def?.interaction === "TurnIn";
	// Dynamic merchant assignment takes precedence over static shop data,
	// but only for non-TurnIn NPCs.
	const merchantItems = isTurnInNPC ? undefined : getMerchantShop(npcName);
	const shop = merchantItems !== undefined ? { shopItems: merchantItems } : isTurnInNPC ? undefined : def?.shop;
	const dlg = def?.dialog;
	const hasShop = shop !== undefined;
	const isMerchant = merchantItems !== undefined;

	// Dialog lines — use NPC-specific dialog if available, else generic fallback
	let greeting: string;
	let chatLines: string[];
	let farewell: string;

	if (dlg) {
		greeting = pickRandom(dlg.greetings);
		chatLines = [...dlg.chatLines];
		farewell = pickRandom(dlg.farewells);
	} else {
		greeting = "Hail, traveler. What brings you here?";
		chatLines = [
			"The roads grow dangerous these days.",
			"Mind your own business, and I shall mind mine.",
			"Have you heard the rumours from the east?",
			"I have nothing to sell you, if that is what you seek.",
		];
		farewell = "Safe travels.";
	}

	// Shop items — only populated if the NPC actually has a shop
	const shopItems: ShopItemPayload[] = [];
	if (shop) {
		const state = getPlayerStateSnapshot(player);
		for (const si of shop.shopItems) {
			const itemDef = ITEMS[si.itemId];
			if (!itemDef) continue;
			const passId = getGamePassForItem(si.itemId);
			let requirementMet: boolean | undefined;
			if (itemDef.requirement && state) {
				const factionLvl = levelFromXP(state.factionXP[itemDef.requirement.factionId] ?? 0);
				requirementMet = factionLvl >= itemDef.requirement.level;
			} else if (itemDef.requirement) {
				requirementMet = false;
			}
			shopItems.push({
				itemId: si.itemId,
				name: itemDef.name,
				description: itemDef.description,
				effect: itemDef.effect,
				itemType: itemDef.itemType,
				icon: itemDef.icon,
				rarity: itemDef.rarity,
				price: si.price,
				owned: getPlayerOwnedCount(player, si.itemId),
				gamePassId: passId,
				ownsPass: passId !== undefined ? playerOwnsPass(player, passId) : undefined,
				durationSecs: itemDef.durationSecs,
				tier: itemDef.tier,
				baseEffect: itemDef.baseEffect,
				extraEffect: itemDef.extraEffect,
				baseDurationSecs: itemDef.baseDurationSecs,
				requirement: itemDef.requirement,
				requirementMet,
			});
		}
	}

	const interaction = isMerchant ? "Shop" : (def?.interaction ?? "Ambient");
	const pendingBounties = getPlayerBountyScrollCount(player);

	return {
		npcName,
		greeting,
		hasShop,
		interaction,
		chatLines,
		farewell,
		shopItems,
		pendingBounties,
	};
}

function handlePurchase(player: Player, npcName: string, itemId: string): [boolean, string] {
	// Validate the player is actually in dialog with this NPC
	const currentNPC = activeDialog.get(player);
	if (currentNPC !== npcName) {
		return [false, "You are not talking to this vendor."];
	}

	// Validate the NPC has a shop and the item is in it (dynamic merchant takes precedence)
	const merchantItems = getMerchantShop(npcName);
	const shop = merchantItems !== undefined ? { shopItems: merchantItems } : NPC_REGISTRY[npcName]?.shop;
	if (!shop) {
		return [false, "This NPC has nothing to sell."];
	}

	const shopItem = shop.shopItems.find((si) => si.itemId === itemId);
	if (!shopItem) {
		return [false, "That item is not available here."];
	}

	// Validate the item exists in the master catalogue
	const itemDef = ITEMS[itemId];
	if (!itemDef) {
		return [false, "Unknown item."];
	}

	// Check max owned limit
	if (shopItem.maxOwned !== undefined && shopItem.maxOwned > 0) {
		const owned = getPlayerOwnedCount(player, itemId);
		if (owned >= shopItem.maxOwned) {
			return [false, "You already own the maximum of this item."];
		}
	}

	// Premium item — requires Game Pass ownership to purchase, but costs gold like normal
	const requiredPassId = getGamePassForItem(itemId);
	if (requiredPassId !== undefined && !playerOwnsPass(player, requiredPassId)) {
		return [false, "You must own the Game Pass to purchase this item."];
	}

	// Faction-rep gate (e.g. legendary guild elixirs)
	if (itemDef.requirement) {
		const state0 = getPlayerStateSnapshot(player);
		const factionLvl = state0 ? levelFromXP(state0.factionXP[itemDef.requirement.factionId] ?? 0) : 0;
		if (factionLvl < itemDef.requirement.level) {
			return [
				false,
				"Requires level " + itemDef.requirement.level + " with " + itemDef.requirement.factionId + " Guild.",
			];
		}
	}

	// Check player has enough gold
	const state = getPlayerStateSnapshot(player);
	if (!state) {
		return [false, "Player data not found."];
	}
	if (state.coins < shopItem.price) {
		return [false, "Not enough gold. You need " + shopItem.price + " gold."];
	}

	// Deduct gold (negative amount)
	addCoins(player, -shopItem.price);

	// Give item
	givePlayerItem(player, itemId, 1);

	awardAchievement(player, "FIRST_PURCHASE");

	// Analytics: ItemPurchased — label with the merchant's shop type
	// (dynamic) or "fixed" for hand-authored static-shop NPCs.
	const purchaseDynamicShopType = getMerchantShopType(npcName);
	trackItemPurchased(player, purchaseDynamicShopType !== undefined ? purchaseDynamicShopType : "fixed");

	log("[DIALOG] " + player.Name + " purchased " + itemDef.name + " from " + npcName + " for " + shopItem.price + "g");
	playSoundEffect(player, "shopPurchase");

	return [true, "Purchased " + itemDef.name + " for " + shopItem.price + " gold."];
}

// ── Public init ───────────────────────────────────────────────────────────────

export function initializeDialogHandler(): void {
	// Player opens dialog with an NPC
	openDialogRemote.OnServerEvent.Connect((player: Player, ...args: unknown[]) => {
		const npcModel = args[0] as Model | undefined;
		if (!npcModel || !npcModel.IsA("Model")) return;

		const npcName = npcModel.Name;

		// Verify NPC exists in world and is close enough (anti-cheat)
		const char = player.Character;
		if (!char) return;
		const hrp = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (!hrp) return;
		const npcPart = npcModel.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (!npcPart) return;
		const dist = hrp.Position.sub(npcPart.Position).Magnitude;
		if (dist > 15) return; // Too far away

		// Dynamic merchants always get the full dialog panel even if registry says Ambient.
		const npcData = MEDIEVAL_NPCS[npcName];
		if (!hasNPCDialog(npcName) && getMerchantShop(npcName) === undefined) {
			const now = tick();
			const lastTime = lastQuipTime.get(player) ?? 0;
			if (now - lastTime < QUIP_COOLDOWN) return; // rate-limit
			lastQuipTime.set(player, now);

			const status = npcData !== undefined ? npcData.status : "Commoner";
			const quip = getQuipForStatus(status);
			floatingTextRemote.FireClient(player, npcName, quip);
			log("[DIALOG] " + player.Name + " -> floating quip from " + npcName + ": " + quip);
			return;
		}

		// Build and send payload
		const payload = buildDialogPayload(npcName, player);
		if (!payload) return;

		activeDialog.set(player, npcName);
		dialogPayloadRemote.FireClient(player, payload);
		log("[DIALOG] " + player.Name + " opened dialog with " + npcName);

		// Analytics: MerchantVisited fires once per dialog-open whenever the
		// payload actually contains a shop. Dynamic merchants supply the
		// ShopType directly; static-shop NPCs (Zabud, etc.) get labelled "fixed".
		if (payload.hasShop) {
			const dynamicShopType = getMerchantShopType(npcName);
			const shopType = dynamicShopType !== undefined ? dynamicShopType : "fixed";
			trackMerchantVisited(player, shopType);
		}

		// Tutorial: first conversation with any Guildmaster unlocks MET_GUILD_LEADER
		// and grants the Dagger (step 2 reward) so the inventory pulse fires.
		const registryDef = NPC_REGISTRY[npcName];
		if (registryDef !== undefined && registryDef.occupation === "Guildmaster") {
			const justUnlocked = awardAchievement(player, "MET_GUILD_LEADER");
			if (justUnlocked) {
				givePlayerItem(player, "dagger", 1);
				log("[DIALOG] Granted Dagger to " + player.Name + " for meeting Guild Leader");
			}
		}
	});

	// Player requests a purchase
	purchaseItemRemote.OnServerInvoke = (player: Player, ...args: unknown[]) => {
		const npcName = args[0] as string | undefined;
		const itemId = args[1] as string | undefined;
		if (npcName === undefined || itemId === undefined) return { success: false, message: "Invalid request." };

		const [success, message] = handlePurchase(player, npcName, itemId);

		// Fire result event (for UI feedback)
		purchaseResultRemote.FireClient(player, success, message);

		return { success, message, newOwned: getPlayerOwnedCount(player, itemId) };
	};

	// Player wants to turn in bounties at a guild leader NPC
	turnInRemote.OnServerInvoke = (player: Player): unknown => {
		const currentNPC = activeDialog.get(player);
		if (currentNPC === undefined) {
			return { success: false, totalGold: 0, totalXP: 0, count: 0, factionId: undefined, guildName: undefined };
		}
		// Verify the NPC is actually a TurnIn type
		const npcInteraction = getNPCInteraction(currentNPC);
		if (npcInteraction !== "TurnIn") {
			log("[DIALOG] " + player.Name + " tried to turn in at non-TurnIn NPC " + currentNPC, "WARN");
			return { success: false, totalGold: 0, totalXP: 0, count: 0, factionId: undefined, guildName: undefined };
		}

		// Determine which faction this NPC belongs to (Bertram = Dawn, Thorne = Night)
		const faction = factionForNPC(currentNPC);
		const guildName = faction !== undefined ? FACTIONS[faction].name : undefined;

		const result = turnInBountyScrolls(player);
		if (result.count > 0) {
			// Award gold and score
			addCoins(player, result.totalGold);
			addScore(player, result.totalGold);

			// Award guild XP (this also derives and updates overall experience).
			// If the NPC somehow has no faction, fall back to general XP.
			if (faction !== undefined) {
				addFactionXP(player, faction, result.totalXP);
			} else {
				addExperience(player, result.totalXP);
			}

			// One ScrollTurnedIn event per turn-in batch (not per scroll) keeps
			// the event count proportional to player intent, not inventory size.
			trackEvent(player, ANALYTICS_EVENTS.ScrollTurnedIn);

			const factionTag = faction !== undefined ? " (" + faction + ")" : "";
			log(
				"[DIALOG] " +
					player.Name +
					" turned in " +
					result.count +
					" bounties at " +
					currentNPC +
					factionTag +
					" for " +
					result.totalGold +
					"g + " +
					result.totalXP +
					" guild xp",
			);
		}

		return { success: true, ...result, factionId: faction, guildName };
	};

	// Player closes dialog
	closeDialogRemote.OnServerEvent.Connect((player: Player) => {
		const npcName = activeDialog.get(player);
		if (npcName !== undefined) {
			log("[DIALOG] " + player.Name + " closed dialog with " + npcName);
		}
		activeDialog.delete(player);
	});

	// Cleanup on leave
	Players.PlayerRemoving.Connect((player) => {
		activeDialog.delete(player);
		lastQuipTime.delete(player);
	});

	log("[DIALOG] Dialog handler initialised");
}
