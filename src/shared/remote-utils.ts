import { ReplicatedStorage, RunService } from "@rbxts/services";

const IS_CLIENT = RunService.IsClient();

/**
 * Get (or create, on server) the top-level Remotes folder.
 * Client: WaitForChild to guarantee we get the server-created folder.
 * Server: FindFirstChild + create if missing.
 */
export function getRemotesFolder(): Folder {
	if (IS_CLIENT) {
		return ReplicatedStorage.WaitForChild("Remotes") as Folder;
	}
	let folder = ReplicatedStorage.FindFirstChild("Remotes") as Folder | undefined;
	if (!folder) {
		folder = new Instance("Folder");
		folder.Name = "Remotes";
		folder.Parent = ReplicatedStorage;
	}
	return folder;
}

/**
 * Get (or create, on server) a sub-folder inside Remotes.
 * Client: WaitForChild to guarantee we get the server-created folder.
 * Server: FindFirstChild + create if missing.
 */
export function getRemoteSubFolder(name: string): Folder {
	const remotes = getRemotesFolder();
	if (IS_CLIENT) {
		return remotes.WaitForChild(name) as Folder;
	}
	let sub = remotes.FindFirstChild(name) as Folder | undefined;
	if (!sub) {
		sub = new Instance("Folder");
		sub.Name = name;
		sub.Parent = remotes;
	}
	return sub;
}

/**
 * Get (or create, on server) a RemoteEvent inside the given folder.
 * Client: WaitForChild to guarantee we get the server-created event.
 * Server: FindFirstChild + create if missing.
 */
export function getRemoteEvent(folder: Folder, name: string): RemoteEvent {
	if (IS_CLIENT) {
		return folder.WaitForChild(name) as RemoteEvent;
	}
	let remote = folder.FindFirstChild(name) as RemoteEvent | undefined;
	if (!remote) {
		remote = new Instance("RemoteEvent");
		remote.Name = name;
		remote.Parent = folder;
	}
	return remote;
}

/**
 * Get (or create, on server) a RemoteFunction inside the given folder.
 * Client: WaitForChild to guarantee we get the server-created function.
 * Server: FindFirstChild + create if missing.
 */
export function getRemoteFunction(folder: Folder, name: string): RemoteFunction {
	if (IS_CLIENT) {
		return folder.WaitForChild(name) as RemoteFunction;
	}
	let remote = folder.FindFirstChild(name) as RemoteFunction | undefined;
	if (!remote) {
		remote = new Instance("RemoteFunction");
		remote.Name = name;
		remote.Parent = folder;
	}
	return remote;
}
