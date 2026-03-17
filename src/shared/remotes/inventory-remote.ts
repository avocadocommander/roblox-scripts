import { getRemotesFolder, getRemoteEvent, getRemoteFunction } from "shared/remote-utils";

/** Client -> Server: activate / use an item (equip weapon, drink elixir, apply poison). */
export function getActivateItemRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "ActivateItem");
}

/** Server -> Client: full inventory sync (on join and after changes). */
export function getInventorySyncRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "InventorySync");
}

/** Client -> Server: request full inventory data. */
export function getRequestInventoryRemote(): RemoteFunction {
	return getRemoteFunction(getRemotesFolder(), "RequestInventory");
}

/** Client -> Server: mock bounty kill for testing (B key). */
export function getMockBountyKillRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "MockBountyKill");
}

/** Client -> Server: turn in one bounty scroll (N key). */
export function getTurnInBountyRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "TurnInBounty");
}
