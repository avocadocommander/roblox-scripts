import { PlayerDataService } from "./common-data-service";
import { NPC } from "./npc";

export interface StoreData {
	level: number;
	xp: number;
	kills: number;
	gold: number;
	eliminations: Eliminations;
}
export type Eliminations = Record<string, EliminationData>;
export interface EliminationData {
	exclusiveMurders: number;
	exclusiveBountyKills: number;
}

export const defaultPlayerStoreData: StoreData = {
	gold: 0,
	kills: 0,
	level: 1,
	xp: 0,
	eliminations: {},
};

export const PLAYER_STORE_NAME = "PlayerStore";

export function captureBountyOnNpcByPlayer(player: Player, npc: Model) {
	const store = PlayerDataService.getInstance(PLAYER_STORE_NAME, defaultPlayerStoreData);
	store.updatePlayerData(player, (state: Partial<StoreData>) => {
		const currentTitles = state.eliminations ?? {};
		if (currentTitles[npc.Name] === undefined) {
			currentTitles[npc.Name] = {
				exclusiveMurders: 0,
				exclusiveBountyKills: 0,
			};
		}
		currentTitles[npc.Name].exclusiveBountyKills = currentTitles[npc.Name].exclusiveBountyKills + 1;
		return {
			eliminations: currentTitles,
		};
	});
}

export function murderNpcByPlayer(player: Player, npc: Model) {
	const store = PlayerDataService.getInstance(PLAYER_STORE_NAME, defaultPlayerStoreData);
	store.updatePlayerData(player, (state: Partial<StoreData>) => {
		const currentTitles = state.eliminations ?? {};
		if (currentTitles[npc.Name] === undefined) {
			currentTitles[npc.Name] = {
				exclusiveMurders: 0,
				exclusiveBountyKills: 0,
			};
		}
		currentTitles[npc.Name].exclusiveMurders = currentTitles[npc.Name].exclusiveMurders + 1;
		return {
			eliminations: currentTitles,
		};
	});
}
