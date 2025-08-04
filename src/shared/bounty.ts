import Signal from "@rbxts/signal";
import { NPC } from "./npc";
import { ReplicatedStorage } from "@rbxts/services";

export class BountyService {
	private activeBounty: NPC | undefined = undefined;
	private readonly bountyCrier = new Signal<(npc: NPC | undefined) => void>();
	private event = ReplicatedStorage.WaitForChild("BountyChanged") as RemoteEvent;

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
			this.event.FireAllClients(npc);
		}
	}

	public clearBounty(npc: NPC) {
		if (this.activeBounty && this.activeBounty === npc) {
			this.activeBounty = undefined;
			this.bountyCrier.Fire(undefined);
			this.event.FireAllClients(undefined);
		}
	}

	public onBountyChanged(callback: (npc: NPC | undefined) => void) {
		return this.bountyCrier.Connect(callback);
	}
}

export const bountyService = new BountyService();
