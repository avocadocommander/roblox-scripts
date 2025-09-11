import { ReplicatedStorage } from "@rbxts/services";
import { NPC } from "./npc";
import { DEATH_TYPES } from "./death-types";
import { getBountyTarget } from "shared/player-state";

const bountyManagerFolder = ((): Folder => {
	const root = (ReplicatedStorage.FindFirstChild("BountyManager") as Folder) ?? new Instance("Folder");
	root.Name = "BountyManager";
	root.Parent = ReplicatedStorage;
	return root;
})();

// const assassinateTarget = ((): RemoteFunction => {
// 	const rf =
// 		(bountyManagerFolder.FindFirstChild("AssassinateTarget") as RemoteFunction) ?? new Instance("RemoteFunction");
// 	rf.Name = "AssassinateTarget";
// 	rf.Parent = bountyManagerFolder;
// 	return rf;
// })();

const targetUpdated = ((): RemoteEvent => {
	const re = (bountyManagerFolder.FindFirstChild("TargetsUpdated") as RemoteEvent) ?? new Instance("RemoteEvent");
	re.Name = "TargetsUpdated";
	re.Parent = bountyManagerFolder;
	return re;
})();

export function assassinateTarget(player: Player, npcTarget: NPC) {
	warn(`${player.Name} wanting to get that ${npcTarget.name}`);
	const currentPlayerbounty: string | undefined = getBountyTarget(player);

	if (npcTarget.name === currentPlayerbounty) {
		warn("Payday bois");
	} else {
		warn("Killing with no means i see");
	}
	setNpcDeath(npcTarget);

	// Get player
	// Get target
	// Run kill stuff
	// Check for bounty match
	// Notify npc manager
}

export function setNpcDeath(npc: NPC) {
	DEATH_TYPES["DEFAULT"](npc);
	warn(`💀 ${npc.name} was slain`);
}
