export interface StoreData {
	level: number;
	xp: number;
	kills: number;
	gold: number;
	eliminations: Record<string, number>;
}

export const defaultPlayerStoreData: StoreData = {
	gold: 0,
	kills: 0,
	level: 1,
	xp: 0,
	eliminations: {},
};

export const PLAYER_STORE_NAME = "PlayerStore";
