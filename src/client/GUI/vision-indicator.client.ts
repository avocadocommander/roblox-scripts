// import { Players, ReplicatedStorage } from "@rbxts/services";

// const npcState = ReplicatedStorage.WaitForChild("NPCState") as Folder;
// const GetViewers = npcState.WaitForChild("GetViewers") as RemoteFunction;
// const ViewsUpdated = npcState.WaitForChild("ViewsUpdated") as RemoteEvent;

// const playerGui = Players.LocalPlayer!.WaitForChild("PlayerGui") as PlayerGui;
// const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

// const playerVisibilityFrame = screenGui.WaitForChild("VisionIndicator") as Frame;
// const playerVisibilityTextLabel = playerVisibilityFrame.WaitForChild("VisualText") as TextLabel;
// const playerVisibilityTextLabelBoarder = playerVisibilityFrame.WaitForChild("VisualTextborder") as TextLabel;

// function main() {
// 	const playerViewers: string[] = GetViewers.InvokeServer() as string[];
// 	setGUIOnChanges(playerViewers);

// 	ViewsUpdated.OnClientEvent.Connect((newTotalViewers: string[]) => {
// 		setGUIOnChanges(newTotalViewers);
// 	});
// }

// function setGUIOnChanges(viewers: string[]) {
// 	const viewerSize = viewers.size();

// 	playerVisibilityTextLabel.Text = `${viewerSize}x`;
// 	playerVisibilityTextLabelBoarder.Text = `${viewerSize}x`;

// 	playerVisibilityFrame.Visible = viewerSize !== 0;
// }

// main();
