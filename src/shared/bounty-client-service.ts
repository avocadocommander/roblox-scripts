import { ReplicatedStorage, Workspace } from "@rbxts/services";
import Signal from "@rbxts/signal";
import { Bounty } from "./bounty";

export class ClientBountyService {
	private activeBounty: Bounty | undefined = undefined;
	private readonly bountyChanged = new Signal<(npc: Bounty | undefined) => void>();

	constructor() {
		const event = ReplicatedStorage.WaitForChild("BountyChanged") as RemoteEvent;
		event.OnClientEvent.Connect((bounty: Bounty) => {
			this.activeBounty = bounty;
			this.bountyChanged.Fire(bounty);
		});
		this.activeBounty = undefined;
	}

	public getBounty(): Bounty | undefined {
		return this.activeBounty;
	}

	public onBountyChanged(callback: (npc: Bounty | undefined) => void) {
		return this.bountyChanged.Connect(callback);
	}
}

export const clientBountyService = new ClientBountyService();
