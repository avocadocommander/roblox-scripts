import { Players } from "@rbxts/services";
import { PlayerDataService } from "../shared/common-data-service";
import { defaultPlayerStoreData, PLAYER_STORE_NAME, StoreData } from "./player-store";

Players.PlayerAdded.Connect(async (player) => {
	const store = PlayerDataService.getInstance(PLAYER_STORE_NAME, defaultPlayerStoreData);

	print(`${player.Name} connected`);

	const storeData = (await store.fetchPlayerData(player)) as StoreData;
	print("(STORE) Recived store data");

	player.AncestryChanged.Connect((_, parent) => {
		if (parent === undefined) {
			store.updatePlayerData(player, { gold: 400 });
			print("(STORE) Updated with player information");
		}
	});
});
