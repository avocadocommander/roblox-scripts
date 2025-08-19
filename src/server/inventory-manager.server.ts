import { Players, ReplicatedStorage } from "@rbxts/services";

export interface InventoryItem {
	id: number;
	name: string;
}

export interface InstanceItem extends InventoryItem {
	rarity: number;
	slot: number;
}

export type GameItem = Record<number, InventoryItem>;
export type InventoryList = InstanceItem[];

export const GAME_ITEMS: GameItem = {
	123: {
		id: 123,
		name: "Dagger",
	},
	1234: {
		id: 1234,
		name: "Scroll",
	},
};

export function getInstanceItems(): InstanceItem[] {
	return [
		{ ...GAME_ITEMS[123], rarity: 1, slot: 0 },
		{ ...GAME_ITEMS[1234], rarity: 1, slot: 1 },
		{ ...GAME_ITEMS[1234], rarity: 2, slot: 2 },
	];
}

const netFolder = ((): Folder => {
	const root = (ReplicatedStorage.FindFirstChild("Net") as Folder) ?? new Instance("Folder");
	root.Name = "Net";
	root.Parent = ReplicatedStorage;

	const inv = (root.FindFirstChild("Inventory") as Folder) ?? new Instance("Folder");
	inv.Name = "Inventory";
	inv.Parent = root;
	return inv;
})();

const GetInventory = ((): RemoteFunction => {
	const rf = (netFolder.FindFirstChild("GetInventory") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "GetInventory";
	rf.Parent = netFolder;
	return rf;
})();

const RequestAddItem = ((): RemoteFunction => {
	const rf = (netFolder.FindFirstChild("RequestAddItem") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "RequestAddItem";
	rf.Parent = netFolder;
	return rf;
})();

const InventoryUpdated = ((): RemoteEvent => {
	const re = (netFolder.FindFirstChild("InventoryUpdated") as RemoteEvent) ?? new Instance("RemoteEvent");
	re.Name = "InventoryUpdated";
	re.Parent = netFolder;
	return re;
})();

const invByPlayer = new Map<Player, InventoryList>();

function nextSlot(list: InventoryList): number {
	let max = 0;
	for (const it of list) if (it.slot > max) max = it.slot;
	return max + 1;
}

function sendUpdate(p: Player) {
	const list = invByPlayer.get(p) ?? [];
	InventoryUpdated.FireClient(p, list);
}

Players.PlayerAdded.Connect((p) => {
	const starter: InventoryList = [
		{ id: 123, name: "Dagger", rarity: 1, slot: 1 }, // Dagger
		{ id: 1234, name: "Rare Scroll", rarity: 2, slot: 2 }, // Scroll
	];
	invByPlayer.set(p, starter);
});
Players.PlayerRemoving.Connect((p) => invByPlayer.delete(p));

GetInventory.OnServerInvoke = (p: Player) => {
	return invByPlayer.get(p) ?? [];
};

RequestAddItem.OnServerInvoke = (player, ...args: unknown[]) => {
	const [rawDefId, rawRarity] = args as [unknown, unknown];

	if (typeOf(rawDefId) !== "number" || typeOf(rawRarity) !== "number") return false;

	const defId = rawDefId as number;
	const rarity = math.clamp(rawRarity as number, 1, 5);

	const defs = GAME_ITEMS as Record<number, { id: number; name: string }>;
	if (!defs[defId]) return false;

	const list = invByPlayer.get(player) ?? [];
	list.push({ id: defId, name: GAME_ITEMS[defId].name, rarity, slot: nextSlot(list) });
	invByPlayer.set(player, list);

	sendUpdate(player);
	return true;
};
