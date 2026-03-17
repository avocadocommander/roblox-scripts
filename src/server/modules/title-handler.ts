import { Players } from "@rbxts/services";
import { log } from "shared/helpers";
import { TITLES } from "shared/config/titles";
import { getEquipTitleRemote, getTitleSyncRemote, getAllTitlesRemote } from "shared/remotes/title-remote";
import { equipTitle, getEquippedTitleId, getOwnedTitles } from "shared/player-state";

export function initializeTitleHandler(): void {
	const equipRemote = getEquipTitleRemote();
	const syncRemote = getTitleSyncRemote();
	const getAllRemote = getAllTitlesRemote();

	// Client -> Server: equip a title the player already owns
	equipRemote.OnServerEvent.Connect((player: Player, titleIdRaw: unknown) => {
		if (typeOf(titleIdRaw) !== "string") return;
		const titleId = titleIdRaw as string;
		if (!TITLES[titleId]) return;
		if (getOwnedTitles(player).includes(titleId) === false) {
			log(`[TITLE] ${player.Name} tried to equip unowned title: ${titleId}`, "WARN");
			return;
		}
		const changed = equipTitle(player, titleId);
		if (changed === true) {
			log(`[TITLE] ${player.Name} equipped title: ${titleId}`);
			syncRemote.FireAllClients(player.Name, titleId);
		}
	});

	// Client -> Server: get a snapshot of all players' current titles
	getAllRemote.OnServerInvoke = (_player: Player): Record<string, string> => {
		const result: Record<string, string> = {};
		for (const p of Players.GetPlayers()) {
			const titleId = getEquippedTitleId(p);
			result[p.Name] = titleId;
		}
		return result;
	};

	log("[TITLE] Title handler initialized");
}
