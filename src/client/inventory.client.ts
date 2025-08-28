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
	const inventory = GetInventory.InvokeServer() as InventoryList;
	applyFull(inventory);
	print("[Inventory] Snapshot received.");

	InventoryUpdated.OnClientEvent.Connect((inventory: InventoryList) => applyFull(inventory));
});

export function requestAdd(defId: number, rarity = 1) {
	const addResponse = RequestAddItem.InvokeServer(defId, rarity) as boolean;
	if (!addResponse) warn(`[Inventory] Add denied for defId=${defId}`);
}

// game.GetService("UserInputService").InputBegan.Connect((io, gp) => {
// 	if (gp) return;
// 	if (io.KeyCode === Enum.KeyCode.A) requestAdd(1234, 2);
// });
