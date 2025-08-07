import { Players } from "@rbxts/services";
import { clientBountyService } from "shared/bounty-client-service";
import { NPC } from "shared/npc";

export function init(torchModel: TextLabel) {
	const playerGui = Players.LocalPlayer?.FindFirstChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;
	const mugShotFront = screenGui.WaitForChild("BountyPoster").WaitForChild("MugShotFront") as ViewportFrame;
	const mugShotSide = screenGui.WaitForChild("BountyPoster").WaitForChild("MugShotSide") as ViewportFrame;

	clientBountyService.onBountyChanged((npc: NPC | undefined) => {
		if (!npc) {
			return;
		}
		torchModel.Text = npc.name;
		createMugshotInViewPortFrame(npc, mugShotFront, "FRONT");
		createMugshotInViewPortFrame(npc, mugShotSide, "SIDE");
	});
}

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
