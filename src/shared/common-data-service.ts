import { DataStoreService } from "@rbxts/services";
import { log } from "./helpers";

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
				// Merge with defaults so any new fields added to the schema
				// are always present even for returning players.
				return { ...this.defaultData, ...data } as T;
			}
			// First-time player — write an empty record so the key exists
			this.dataStore.SetAsync(`${player.UserId}`, this.defaultData);
			return this.defaultData;
		} catch (err) {
			log(`[DataStore] Failed to fetch data for ${player.Name}: ` + err, "ERROR");
			return this.defaultData;
		}
	}

	/**
	 * Write `data` directly to DataStore for `player`.
	 * This is a single SetAsync call — no prior GET is needed because the
	 * caller already holds the authoritative in-memory state.
	 */
	async save(player: Player, data: T): Promise<void> {
		try {
			this.dataStore.SetAsync(`${player.UserId}`, data);
			warn(`[DataStore] ✅ Saved "${this.storeName}" for ${player.Name} (UserId: ${player.UserId})`);
		} catch (err) {
			warn(`[DataStore] ❌ FAILED to save "${this.storeName}" for ${player.Name}: ` + err);
		}
	}

	/**
	 * Fetch the current stored data, apply `patch` on top of it, then write.
	 * Use this when you need to do a remote-read-modify-write.
	 * For normal in-game saves prefer `save()` which is a single operation.
	 */
	async updatePlayerData(player: Player, patch: Partial<T> | ((existing: T) => Partial<T>)): Promise<void> {
		try {
			const existing = (await this.fetchPlayerData(player)) as object;
			const partial: Partial<T> =
				typeOf(patch) === "function"
					? (patch as (existing: T) => Partial<T>)(existing as T)
					: (patch as Partial<T>);
			const updated: T = { ...existing, ...partial } as T;
			this.dataStore.SetAsync(`${player.UserId}`, updated);
			log(`[DataStore] Updated data for ${player.Name}`);
		} catch (err) {
			log(`[DataStore] Failed to update data for ${player.Name}: ` + err, "ERROR");
		}
	}
}
