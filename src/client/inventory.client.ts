export interface InventoryItem {
	id: number;
	name: string;
}

export interface InstanceItem extends InventoryItem {
	rarity: number;
	slot: number;
}
export type InventoryList = InstanceItem[];

import { ReplicatedStorage } from "@rbxts/services";

const invNet = ReplicatedStorage.WaitForChild("Net").WaitForChild("Inventory") as Folder;
const GetInventory = invNet.WaitForChild("GetInventory") as RemoteFunction;
const RequestAddItem = invNet.WaitForChild("RequestAddItem") as RemoteFunction;
const InventoryUpdated = invNet.WaitForChild("InventoryUpdated") as RemoteEvent;

let inventory: InventoryList = [];

function applyFull(list: InventoryList) {
	inventory = list;
	print(`[Inventory] Updated. Count=${inventory.size()}`);
	list.forEach((item) => {
		warn(item.name);
	});
}

task.defer(() => {
	const snap = GetInventory.InvokeServer() as InventoryList;
	applyFull(snap);
	print("[Inventory] Snapshot received.");

	InventoryUpdated.OnClientEvent.Connect((list: InventoryList) => applyFull(list));
});

export function requestAdd(defId: number, rarity = 1) {
	const ok = RequestAddItem.InvokeServer(defId, rarity) as boolean;
	if (!ok) warn(`[Inventory] Add denied for defId=${defId}`);
}

game.GetService("UserInputService").InputBegan.Connect((io, gp) => {
	if (gp) return;
	if (io.KeyCode === Enum.KeyCode.A) requestAdd(1234, 2);
});
