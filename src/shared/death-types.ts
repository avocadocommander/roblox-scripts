import { NPC } from "./npc";

type DEATH_TYPE = {
	[key: string]: (npcTarget: NPC) => void;
};

export const DEATH_TYPES: DEATH_TYPE = {
	DEFAULT: (npcTarget: NPC) => {
		npcTarget.model.GetDescendants().forEach((descendant) => {
			if (descendant.IsA("JointInstance")) {
				descendant.Destroy();
			}
		});
		task.wait(5);
		npcTarget.model.Destroy();
	},
};
