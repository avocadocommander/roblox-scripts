import { DataStoreService } from "@rbxts/services";
import { deepEqual, isArray, log } from "./helpers";

const serviceInstances = new Map<string, any>();

export class PlayerDataService<T extends object> {
	private dataStore;

	constructor(
		private storeName: string,
		private defaultData: T,
	) {
		this.dataStore = DataStoreService.GetDataStore(this.storeName);
	}

	static getInstance<T extends object>(storeName: string, defaultData: T): PlayerDataService<T> {
		if (serviceInstances.has(storeName)) {
			return serviceInstances.get(storeName) as PlayerDataService<T>;
		}
		const instance = new PlayerDataService<T>(storeName, defaultData);
		serviceInstances.set(storeName, instance);
		return instance;
	}

	async fetchPlayerData(player: Player): Promise<T> {
		try {
			const data = this.dataStore.GetAsync(`${player.UserId}`) as T;
			if (typeIs(data, "table")) {
				return { ...this.defaultData, ...data } as T;
			}
			await this.dataStore.SetAsync(`${player.UserId}`, {});

			return this.defaultData;
		} catch (err) {
			log(`Failed to fetch data for ${player.Name}:` + err, "ERROR");
			return this.defaultData;
		}
	}

	async updatePlayerData(player: Player, patch: Partial<T> | ((existing: T) => Partial<T>)): Promise<void> {
		try {
			const existing = (await this.fetchPlayerData(player)) as object;
			const partial: Partial<T> =
				typeOf(patch) === "function"
					? (patch as (existing: T) => Partial<T>)(existing as T)
					: (patch as Partial<T>);
			const updated: T = { ...existing, ...partial } as T;
			if (typeOf(updated) !== "table" || isArray(updated)) {
				throw `Attempted to store invalid data: must be an object, not an array`;
			}
			if (!deepEqual(existing, updated)) {
				await this.dataStore.SetAsync(`${player.UserId}`, updated);
				log(`Updated data for ${player.Name}`);
			} else {
				log("State has not changed, store update called but skip persistance protocol engaged");
			}
		} catch (err) {
			log(`Failed to save data for ${player.Name}:` + err, "ERROR");
		}
	}
}
