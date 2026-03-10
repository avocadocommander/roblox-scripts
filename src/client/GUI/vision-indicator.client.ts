import { Players, ReplicatedStorage } from "@rbxts/services";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";

const npcState = ReplicatedStorage.WaitForChild("NPCState") as Folder;
const GetViewers = npcState.WaitForChild("GetViewers") as RemoteFunction;
const ViewsUpdated = npcState.WaitForChild("ViewsUpdated") as RemoteEvent;

const lifecycle = getOrCreateLifecycleRemote();

lifecycle.OnClientEvent.Connect((message: string) => {
	if (message === "InitializePlayer") {
		initializeVisionIndicator();
	}
});

function initializeVisionIndicator() {
	const playerGui = Players.LocalPlayer!.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

	const playerVisibilityFrame = screenGui.WaitForChild("VisionIndicator") as Frame;
	const playerVisibilityTextLabel = playerVisibilityFrame.WaitForChild("VisualText") as TextLabel;
	const playerVisibilityTextLabelBoarder = playerVisibilityFrame.WaitForChild("VisualTextborder") as TextLabel;

	main(playerVisibilityFrame, playerVisibilityTextLabel, playerVisibilityTextLabelBoarder);
}

function main(
	playerVisibilityFrame: Frame,
	playerVisibilityTextLabel: TextLabel,
	playerVisibilityTextLabelBoarder: TextLabel,
) {
	const playerViewers: string[] = GetViewers.InvokeServer() as string[];
	setGUIOnChanges(playerViewers, playerVisibilityFrame, playerVisibilityTextLabel, playerVisibilityTextLabelBoarder);

	ViewsUpdated.OnClientEvent.Connect((newTotalViewers: string[]) => {
		setGUIOnChanges(
			newTotalViewers,
			playerVisibilityFrame,
			playerVisibilityTextLabel,
			playerVisibilityTextLabelBoarder,
		);
	});
}

function setGUIOnChanges(
	viewers: string[],
	playerVisibilityFrame: Frame,
	playerVisibilityTextLabel: TextLabel,
	playerVisibilityTextLabelBoarder: TextLabel,
) {
	const viewerSize = viewers.size();

	playerVisibilityTextLabel.Text = `${viewerSize}x`;
	playerVisibilityTextLabelBoarder.Text = `${viewerSize}x`;

	playerVisibilityFrame.Visible = viewerSize !== 0;
}
