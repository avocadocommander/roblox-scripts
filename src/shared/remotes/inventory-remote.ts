import { ReplicatedStorage } from "@rbxts/services";

function getRemotesFolder(): Folder {
	let folder = ReplicatedStorage.FindFirstChild("Remotes") as Folder | undefined;
	if (!folder) {
		folder = new Instance("Folder");
		folder.Name = "Remotes";
		folder.Parent = ReplicatedStorage;
	}
	return folder;
}

/** Client -> Server: activate / use an item (equip weapon, drink elixir, apply poison). */
export function getActivateItemRemote(): RemoteEvent {
	const folder = getRemotesFolder();
	let remote = folder.FindFirstChild("ActivateItem") as RemoteEvent | undefined;
	if (!remote) {
		remote = new Instance("RemoteEvent");
		remote.Name = "ActivateItem";
		remote.Parent = folder;
	}
	return remote;
}

/** Server -> Client: full inventory sync (on join and after changes). */
export function getInventorySyncRemote(): RemoteEvent {
	const folder = getRemotesFolder();
	let remote = folder.FindFirstChild("InventorySync") as RemoteEvent | undefined;
	if (!remote) {
		remote = new Instance("RemoteEvent");
		remote.Name = "InventorySync";
		remote.Parent = folder;
	}
	return remote;
}

/** Client -> Server: request full inventory data. */
export function getRequestInventoryRemote(): RemoteFunction {
	const folder = getRemotesFolder();
	let remote = folder.FindFirstChild("RequestInventory") as RemoteFunction | undefined;
	if (!remote) {
		remote = new Instance("RemoteFunction");
		remote.Name = "RequestInventory";
		remote.Parent = folder;
	}
	return remote;
}

/** Client -> Server: mock bounty kill for testing (B key). */
export function getMockBountyKillRemote(): RemoteEvent {
	const folder = getRemotesFolder();
	let remote = folder.FindFirstChild("MockBountyKill") as RemoteEvent | undefined;
	if (!remote) {
		remote = new Instance("RemoteEvent");
		remote.Name = "MockBountyKill";
		remote.Parent = folder;
	}
	return remote;
}

/** Client -> Server: turn in one bounty scroll (N key). */
export function getTurnInBountyRemote(): RemoteEvent {
	const folder = getRemotesFolder();
	let remote = folder.FindFirstChild("TurnInBounty") as RemoteEvent | undefined;
	if (!remote) {
		remote = new Instance("RemoteEvent");
		remote.Name = "TurnInBounty";
		remote.Parent = folder;
	}
	return remote;
}
