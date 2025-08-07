import { Players } from "@rbxts/services";
import { clientBountyService } from "shared/bounty-client-service";
import { NPC } from "shared/npc";

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

const npc = clientBountyService.getBounty();
if (npc) {
	createMugshotInViewPortFrame(npc, portrait, "FRONT");
}

clientBountyService.onBountyChanged((npc: NPC | undefined) => {
	if (!npc) {
		return;
	}
	createMugshotInViewPortFrame(npc, portrait, "FRONT");
});

function createMugshotInViewPortFrame(npc: NPC, frame: ViewportFrame, position: "FRONT" | "SIDE" = "FRONT") {
	npc.state = "IDLE";
	const npcClone = npc.model.Clone();
	npcClone.Parent = frame;

	const npcRoot = npcClone.PrimaryPart!;
	const npcPosition = npcRoot.Position;
	const npcLookDirection = position === "FRONT" ? npcRoot.CFrame.LookVector : npcRoot.CFrame.RightVector;

	const distance = 5;
	const offset = npcLookDirection.mul(distance);

	const cameraPosition = npcPosition.add(offset);

	const camera = new Instance("Camera");
	camera.CFrame = CFrame.lookAt(cameraPosition, npcPosition);
	camera.Parent = frame;

	frame.CurrentCamera = camera;
}
