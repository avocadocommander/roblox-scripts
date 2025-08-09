import { Players, Workspace } from "@rbxts/services";
import { Bounty } from "shared/bounty";
import { clientBountyService } from "shared/bounty-client-service";

function createMugshotInViewPortFrame(bounty: Bounty, frame: ViewportFrame) {
	const npcName = activeTab.WaitForChild("npcName") as TextLabel;
	npcName.Text = `${bounty.npc.name}`;
	const goldReward = activeTab.WaitForChild("goldReward") as TextLabel;
	goldReward.Text = `${bounty.goldReward}`;
	const xpReward = activeTab.WaitForChild("xpReward") as TextLabel;
	xpReward.Text = `${bounty.xpReward}`;
	const description = activeTab.WaitForChild("description") as TextLabel;
	description.Text = `${bounty.offence}`;

	const stagingArea = Workspace.WaitForChild("Staging Area") as Folder;
	const existingNPC = stagingArea.FindFirstChild("NPC") as Model | undefined;
	if (existingNPC) {
		existingNPC.Destroy();
	}

	const stage = stagingArea.WaitForChild("Stage") as Part;
	const cameraPosition = stagingArea.WaitForChild("Camera Position") as Part;
	const npcLookPosition = stagingArea.WaitForChild("NPCLookPosition") as Part;

	const npcClone = bounty.npc.model.Clone();
	npcClone.Name = "NPC";
	const npcPostion = CFrame.lookAt(stage.Position, npcLookPosition.Position);

	const lookPosition = new Vector3(stage.Position.X, stage.Position.Y + 3, stage.Position.Z);
	const stageCamera = new Instance("Camera");
	stageCamera.Name = "StageCamera";
	stageCamera.CFrame = CFrame.lookAt(cameraPosition.Position, lookPosition);
	stageCamera.Parent = stagingArea;

	npcClone.PivotTo(npcPostion);

	npcClone.Parent = stagingArea;
	const set = stagingArea.Clone();
	set.Parent = frame;
	frame.CurrentCamera = stageCamera;
}

const playerGui = Players.LocalPlayer!.WaitForChild("PlayerGui") as PlayerGui;
const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

const openKillBookBtn = screenGui.WaitForChild("OpenKillBookBtn") as ImageButton;
const killBook = screenGui.WaitForChild("Kill Book") as Frame;
const activeTab = killBook.WaitForChild("Active") as Frame;

const portrait = activeTab.WaitForChild("Portrait") as ViewportFrame;

const killBookHeader = killBook.WaitForChild("Header") as Frame;
const activeTabButton = killBookHeader.WaitForChild("ActiveTab") as TextButton;
const historyTabButton = killBookHeader.WaitForChild("HistoryTab") as TextButton;

const historyTab = killBook.WaitForChild("History") as ScrollingFrame;

const closeKillBookBtn = killBookHeader.WaitForChild("CloseKillBookBtn") as TextButton;

killBook.Visible = false;

openKillBookBtn.MouseButton1Click.Connect(() => {
	killBook.Visible = !killBook.Visible;
});
closeKillBookBtn.MouseButton1Click.Connect(() => {
	killBook.Visible = false;
});

activeTabButton.MouseButton1Click.Connect(() => {
	historyTab.Visible = false;
	activeTab.Visible = true;
});
historyTabButton.MouseButton1Click.Connect(() => {
	historyTab.Visible = true;
	activeTab.Visible = false;
});

const bounty: Bounty | undefined = clientBountyService.getBounty();
if (bounty) {
	createMugshotInViewPortFrame(bounty, portrait);
}

clientBountyService.onBountyChanged((bounty: Bounty | undefined) => {
	if (!bounty) {
		return;
	}
	createMugshotInViewPortFrame(bounty, portrait);
});
