import { getAdminCommandRemote, ADMIN_USER_IDS } from "shared/remotes/admin-remote";
import { addCoins, addExperience, resetFactionData } from "shared/player-state";
import { assignNewNPCBounty } from "./bounty-manager";

const adminRemote = getAdminCommandRemote();

function isAdmin(player: Player): boolean {
	// 0 in the list = allow everyone (dev/test mode)
	if (ADMIN_USER_IDS.includes(0)) return true;
	return ADMIN_USER_IDS.includes(player.UserId);
}

export function initializeAdminHandler(): void {
	adminRemote.OnServerInvoke = (player: Player, ...args: unknown[]): string => {
		if (!isAdmin(player)) return "Not authorized";

		const [commandArg, valueArg] = args;
		const command = commandArg as string;
		const value = typeOf(valueArg) === "number" ? (valueArg as number) : 0;

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

		return "Unknown command: " + command;
	};

	warn("[ADMIN] Admin handler initialized");
}
