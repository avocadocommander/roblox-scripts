import { ReplicatedStorage } from "@rbxts/services";
import Signal from "@rbxts/signal";
import { NPC } from "shared/npc";

export class ClientBountyService {
	private activeBounty: NPC | undefined = undefined;
	private readonly bountyChanged = new Signal<(npc: NPC | undefined) => void>();

	constructor() {
		const event = ReplicatedStorage.WaitForChild("BountyChanged") as RemoteEvent;
		event.OnClientEvent.Connect((npc: NPC) => {
			this.activeBounty = npc;
			this.bountyChanged.Fire(npc);
		});
		this.activeBounty = undefined;
	}

	public getBounty(): NPC | undefined {
		return this.activeBounty;
	}

	public onBountyChanged(callback: (npc: NPC | undefined) => void) {
		return this.bountyChanged.Connect(callback);
	}
}

export const clientBountyService = new ClientBountyService();
