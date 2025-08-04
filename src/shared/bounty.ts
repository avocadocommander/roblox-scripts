import Signal from "@rbxts/signal";
import { NPC } from "./npc";

export class BountyService {
	private activeBounty: NPC | undefined = undefined;
	private readonly bountyCrier = new Signal<(npc: NPC | undefined) => void>();

	constructor() {
		this.activeBounty = undefined;
	}

	public getBounty(): NPC | undefined {
		return this.activeBounty;
	}

	public setBountyOnNPC(npc: NPC) {
		if (!this.activeBounty && this.activeBounty !== npc) {
			this.activeBounty = npc;
			this.bountyCrier.Fire(npc);
			warn(`BOUNTY SET ON: ${npc.name}`);
		}
	}

	public onBountyChanged(callback: (npc: NPC | undefined) => void) {
		return this.bountyCrier.Connect(callback);
	}
}

export const bountyService = new BountyService();
