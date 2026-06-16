import { AdminCommandResult, getAdminCommandRemote, ADMIN_USER_IDS } from "shared/remotes/admin-remote";
import {
	addCoins,
	addExperience,
	addFactionXP,
	resetFactionData,
	resetAchievementsAndTitles,
	savePlayerData,
} from "shared/player-state";
import { assignNewNPCBounty } from "./bounty-manager";
import { syncAchievementsToClient } from "./achievement-handler";
import { givePlayerItem } from "./inventory-handler";
import { clearPlayerCampfire } from "./campfire-handler";
import { POISONS } from "shared/config/poisons";
import { ELIXIRS } from "shared/config/elixirs";
import {
	startTravelingMerchantEvent,
	stopTravelingMerchantEvent,
	toggleTravelingMerchantEvent,
} from "./traveling-merchant-handler";
import { startDreamCloudEvent, stopDreamCloudEvent, toggleDreamCloudEvent } from "./cloud-event-handler";
import { initializeBoardEventBus, setBoardServerEvent } from "./board-event-bus";
import {
	excludePlayerFromPositionMetrics,
	showAllLivePositionTrails,
	showBottomDistanceHistoricalPositionTrails,
	showBottomDistanceLivePositionTrails,
	showLatestHistoricalPositionMetrics,
	showTodayHistoricalPositionMetrics,
	showTopDistanceHistoricalPositionTrails,
	showTopDistanceLivePositionTrails,
	showYesterdayHistoricalPositionMetrics,
	toggleHistoricalPositionMetricsVisuals,
	togglePositionMetricsVisuals,
} from "./position-metrics";

const adminRemote = getAdminCommandRemote();

function isAdmin(player: Player): boolean {
	// 0 in the list = allow everyone (dev/test mode)
	if (ADMIN_USER_IDS.includes(0)) return true;
	return ADMIN_USER_IDS.includes(player.UserId);
}

export function initializeAdminHandler(): void {
	// Eagerly create the broadcast remote so clients don't infinite-yield on WaitForChild
	initializeBoardEventBus();

	adminRemote.OnServerInvoke = (player: Player, ...args: unknown[]): string | AdminCommandResult => {
		if (!isAdmin(player)) return "Not authorized";

		const [commandArg, valueArg] = args;
		const command = commandArg as string;
		const value = typeOf(valueArg) === "number" ? (valueArg as number) : 0;
		const strValue = typeOf(valueArg) === "string" ? (valueArg as string) : "";

		if (command === "addCoins") {
			const amount = value > 0 ? value : 100;
			addCoins(player, amount);
			return "Added " + amount + " coins";
		}

		if (command === "addXP") {
			const amount = value > 0 ? value : 200;
			addExperience(player, amount);
			return "Added " + amount + " XP";
		}

		if (command === "levelUp") {
			addExperience(player, 1000);
			return "Added 1000 XP (level up)";
		}

		if (command === "resetProgress") {
			resetFactionData(player);
			return "Reset level, XP, and faction data to 0";
		}

		if (command === "randomBounty") {
			const bounty = assignNewNPCBounty(player);
			return "Assigned bounty: " + bounty.npcName;
		}

		if (command === "resetAchievements") {
			resetAchievementsAndTitles(player);
			syncAchievementsToClient(player);
			task.spawn(() => savePlayerData(player));
			return "Reset all achievements and titles";
		}

		if (command === "addCurrency5k") {
			addCoins(player, 5000);
			return "Added 5000 coins";
		}

		if (command === "randomXP") {
			const amount = math.random(20, 100);
			addExperience(player, amount);
			return "Added " + amount + " XP";
		}

		if (command === "addGuildXP") {
			if (strValue === "Night") {
				addFactionXP(player, "Night", 500);
				return "Added 500 Night guild XP";
			}
			if (strValue === "Dawn") {
				addFactionXP(player, "Dawn", 500);
				return "Added 500 Dawn guild XP";
			}
			return "Unknown faction: " + strValue;
		}

		if (command === "givePoison") {
			if (!POISONS[strValue]) return "Unknown poison: " + strValue;
			givePlayerItem(player, strValue, 1);
			return "Gave 1x " + POISONS[strValue].name;
		}

		if (command === "giveElixir") {
			if (!ELIXIRS[strValue]) return "Unknown elixir: " + strValue;
			givePlayerItem(player, strValue, 1);
			return "Gave 1x " + ELIXIRS[strValue].name;
		}

		if (command === "triggerSpecialEvent") {
			const text = strValue !== "" ? strValue : "A Special Event Has Begun";
			setBoardServerEvent("admin", text);
			return "Broadcast event: " + text;
		}

		if (command === "startTravelingMerchant") {
			startTravelingMerchantEvent();
			return "Traveling merchant event started";
		}

		if (command === "stopTravelingMerchant") {
			stopTravelingMerchantEvent();
			return "Traveling merchant event stopped";
		}

		if (command === "toggleTravelingMerchant") {
			return toggleTravelingMerchantEvent();
		}

		if (command === "toggleDreamClouds") {
			return toggleDreamCloudEvent();
		}

		if (command === "startDreamClouds") {
			return startDreamCloudEvent();
		}

		if (command === "stopDreamClouds") {
			return stopDreamCloudEvent();
		}

		if (command === "togglePositionTrails") {
			excludePlayerFromPositionMetrics(player);
			return togglePositionMetricsVisuals();
		}

		if (command === "showAllLivePositionTrails") {
			excludePlayerFromPositionMetrics(player);
			return showAllLivePositionTrails();
		}

		if (command === "showTopDistanceLivePositionTrails") {
			excludePlayerFromPositionMetrics(player);
			return showTopDistanceLivePositionTrails();
		}

		if (command === "showBottomDistanceLivePositionTrails") {
			excludePlayerFromPositionMetrics(player);
			return showBottomDistanceLivePositionTrails();
		}

		if (command === "showTopDistanceHistoricalPositionTrails") {
			excludePlayerFromPositionMetrics(player);
			return showTopDistanceHistoricalPositionTrails();
		}

		if (command === "showBottomDistanceHistoricalPositionTrails") {
			excludePlayerFromPositionMetrics(player);
			return showBottomDistanceHistoricalPositionTrails();
		}

		if (command === "toggleHistoricalPositionTrails") {
			excludePlayerFromPositionMetrics(player);
			return toggleHistoricalPositionMetricsVisuals();
		}

		if (command === "showLatestPositionTrails") {
			excludePlayerFromPositionMetrics(player);
			return showLatestHistoricalPositionMetrics();
		}

		if (command === "showTodayPositionTrails") {
			excludePlayerFromPositionMetrics(player);
			return showTodayHistoricalPositionMetrics();
		}

		if (command === "showYesterdayPositionTrails") {
			excludePlayerFromPositionMetrics(player);
			return showYesterdayHistoricalPositionMetrics();
		}

		if (command === "resetSpawn") {
			clearPlayerCampfire(player);
			return "Campfire cleared -- will spawn at default location";
		}

		if (command === "resetAll") {
			resetAchievementsAndTitles(player);
			resetFactionData(player);
			clearPlayerCampfire(player);
			syncAchievementsToClient(player);
			task.spawn(() => savePlayerData(player));
			return "Reset all: achievements, titles, faction data, and spawn";
		}

		return "Unknown command: " + command;
	};

	warn("[ADMIN] Admin handler initialized");
}
