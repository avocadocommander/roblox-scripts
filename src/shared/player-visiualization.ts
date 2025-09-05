import { ReplicatedStorage } from "@rbxts/services";

const npcStateFolder = ((): Folder => {
	const root = (ReplicatedStorage.FindFirstChild("NPCState") as Folder) ?? new Instance("Folder");
	root.Name = "NPCState";
	root.Parent = ReplicatedStorage;
	return root;
})();

const GetViewers = ((): RemoteFunction => {
	const rf = (npcStateFolder.FindFirstChild("GetViewers") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "GetViewers";
	rf.Parent = npcStateFolder;
	return rf;
})();

const ViewsUpdated = ((): RemoteEvent => {
	const re = (npcStateFolder.FindFirstChild("ViewsUpdated") as RemoteEvent) ?? new Instance("RemoteEvent");
	re.Name = "ViewsUpdated";
	re.Parent = npcStateFolder;
	return re;
})();
// const RequestAddView = ((): RemoteFunction => {
// 	const rf = (npcStateFolder.FindFirstChild("RequestAddView") as RemoteFunction) ?? new Instance("RemoteFunction");
// 	rf.Name = "RequestAddView";
// 	rf.Parent = npcStateFolder;
// 	return rf;
// })();
// const RequestRemoveView = ((): RemoteFunction => {
// 	const rf = (npcStateFolder.FindFirstChild("RequestRemoveView") as RemoteFunction) ?? new Instance("RemoteFunction");
// 	rf.Name = "RequestRemoveView";
// 	rf.Parent = npcStateFolder;
// 	return rf;
// })();

const NPC_VIEW_STATES = new Map<Player, string[]>();

GetViewers.OnServerInvoke = (player: Player) => {
	return NPC_VIEW_STATES.get(player) ?? [];
};

export function requestAddView(player: Player, npcName: string) {
	const viewStates = NPC_VIEW_STATES.get(player);
	const nameToAdd = npcName as string;
	const currentNames: string[] = viewStates ?? [];

	if (currentNames.includes(nameToAdd)) {
		return; //Skip, names already there
	}
	const newNamesList: string[] = [...currentNames, nameToAdd];

	NPC_VIEW_STATES.set(player, newNamesList);

	ViewsUpdated.FireClient(player, NPC_VIEW_STATES.get(player));
	warn(`Added npc ${npcName}`);
}
export function requestRemoveView(player: Player, npcName: string) {
	const viewStates = NPC_VIEW_STATES.get(player);
	const nameToRemove = npcName as string;
	const currentNames: string[] = viewStates ?? [];

	if (!currentNames.includes(nameToRemove)) {
		return; //Skip, names not even there
	}
	const newNamesList: string[] = currentNames.filter((name) => name !== nameToRemove);

	NPC_VIEW_STATES.set(player, newNamesList);

	ViewsUpdated.FireClient(player, NPC_VIEW_STATES.get(player));
	warn(`Removed npc ${npcName}`);
}
