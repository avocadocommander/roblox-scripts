import { Players, ReplicatedStorage } from "@rbxts/services";

const netFolder = ((): Folder => {
	const root = (ReplicatedStorage.FindFirstChild("Net") as Folder) ?? new Instance("Folder");
	root.Name = "Net";
	root.Parent = ReplicatedStorage;

	const inv = (root.FindFirstChild("Level") as Folder) ?? new Instance("Folder");
	inv.Name = "Level";
	inv.Parent = root;
	return inv;
})();

const GetLevel = ((): RemoteFunction => {
	const rf = (netFolder.FindFirstChild("GetLevel") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "GetLevel";
	rf.Parent = netFolder;
	return rf;
})();

const invByPlayer = new Map<Player, number>();

Players.PlayerAdded.Connect((p) => {
	invByPlayer.set(p, 1);
});
Players.PlayerRemoving.Connect((p) => invByPlayer.delete(p));

GetLevel.OnServerInvoke = (p: Player): number => {
	return invByPlayer.get(p) ?? 1;
};
