import Signal from "@rbxts/signal";
import { NPC } from "./npc/main";
import { ReplicatedStorage } from "@rbxts/services";
import { SATIRICAL_BOUNTY_OFFENSES } from "./module";

export interface Bounty {
	npc: NPC;
	goldReward: number;
	xpReward: number;
	offence: string;
}

export class BountyService {
	private activeBounty: Bounty | undefined = undefined;
	private readonly bountyCrier = new Signal<(npc: Bounty | undefined) => void>();
	private event = ReplicatedStorage.WaitForChild("BountyChanged") as RemoteEvent;

	constructor() {
		this.activeBounty = undefined;
	}

	public getBounty(): Bounty | undefined {
		return this.activeBounty;
	}

	public setBountyOnNPC(npc: NPC): void {
		if (!this.activeBounty) {
			const newBounty = {
				npc,
				goldReward: 400,
				xpReward: 2000,
				offence: SATIRICAL_BOUNTY_OFFENSES[math.random(0, SATIRICAL_BOUNTY_OFFENSES.size() - 1)],
			};
			this.activeBounty = newBounty;
			this.bountyCrier.Fire(newBounty);
			this.event.FireAllClients(newBounty);
		}
	}

	public clearBounty(npc: NPC): void {
		if (this.activeBounty && this.activeBounty.npc === npc) {
			this.activeBounty = undefined;
			this.bountyCrier.Fire(undefined);
			this.event.FireAllClients(undefined);
		}
	}

	public onBountyChanged(callback: (bounty: Bounty | undefined) => void) {
		return this.bountyCrier.Connect(callback);
	}
}

export const bountyService = new BountyService();
