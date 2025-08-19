// StarterPlayer/StarterPlayerScripts/InventoryGridTest.client.ts
import { Players, ReplicatedStorage } from "@rbxts/services";
import { InstanceItem, InventoryList } from "./inventory.client";

export const GAME_ITEMS = {
	123: {
		id: 123,
		name: "Dagger",
	},
	1234: {
		id: 1234,
		name: "Scroll",
	},
};

const player = Players.LocalPlayer;

const invNet = ReplicatedStorage.WaitForChild("Net").WaitForChild("Inventory") as Folder;
const GetInventory = invNet.WaitForChild("GetInventory") as RemoteFunction;
const InventoryUpdated = invNet.WaitForChild("InventoryUpdated") as RemoteEvent;

const playerGui = Players.LocalPlayer!.WaitForChild("PlayerGui") as PlayerGui;
const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

const openKillBookBtn = screenGui.WaitForChild("OpenKillBookBtn") as ImageButton;
const killBook = screenGui.WaitForChild("Kill Book") as Frame;
const book = killBook.WaitForChild("Book") as ImageLabel;
const rightPageFrame = book.WaitForChild("Right Page") as ImageLabel;

const title = new Instance("TextLabel");
title.Name = "Title";
title.BackgroundTransparency = 1;
title.Size = UDim2.fromScale(1, 0.08);
title.Text = "Inventory";
title.TextScaled = true;
title.Font = Enum.Font.Garamond;
title.TextColor3 = new Color3(1, 0.9, 0.7);
title.Parent = rightPageFrame;

const scroller = new Instance("ScrollingFrame");
scroller.Name = "Grid";
scroller.BackgroundTransparency = 1;
scroller.BorderSizePixel = 0;
scroller.TopImage = "";
scroller.MidImage = "";
scroller.BottomImage = "";
scroller.ScrollBarThickness = 6;
scroller.Size = UDim2.fromScale(1, 0.92);
scroller.Position = UDim2.fromScale(0, 0.08);
scroller.Parent = rightPageFrame;

const padding = new Instance("UIPadding");
padding.PaddingTop = new UDim(0, 8);
padding.PaddingBottom = new UDim(0, 8);
padding.PaddingLeft = new UDim(0, 8);
padding.PaddingRight = new UDim(0, 8);
padding.Parent = scroller;

const grid = new Instance("UIGridLayout");
grid.CellPadding = UDim2.fromOffset(8, 8);
grid.CellSize = UDim2.fromOffset(96, 96);
grid.SortOrder = Enum.SortOrder.LayoutOrder;
grid.Parent = scroller;

const updateCanvas = () => {
	const s = grid.AbsoluteContentSize;
	scroller.CanvasSize = new UDim2(0, s.X + 16, 0, s.Y + 16);
};
grid.GetPropertyChangedSignal("AbsoluteContentSize").Connect(updateCanvas);

function makeTile(it: InstanceItem): Frame {
	const def = (GAME_ITEMS as unknown as Record<number, { id: number; name: string }>)[it.id];
	const tile = new Instance("Frame");
	tile.Name = "Tile";
	tile.BackgroundColor3 = new Color3(0.13, 0.13, 0.13);
	tile.BorderSizePixel = 0;
	tile.LayoutOrder = it.slot;

	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(0, 8);
	corner.Parent = tile;

	// Rarity border (thin bar at top)
	const rarityBar = new Instance("Frame");
	rarityBar.Name = "Rarity";
	rarityBar.Size = UDim2.fromScale(1, 0.06);
	rarityBar.BorderSizePixel = 0;
	rarityBar.Parent = tile;

	const name = new Instance("TextLabel");
	name.Name = "Name";
	name.BackgroundTransparency = 1;
	name.Size = UDim2.fromScale(1, 0.3);
	name.Position = UDim2.fromScale(0, 0.7);
	name.Text = def ? def.name : `Item ${it.id}`;
	name.TextScaled = true;
	name.Font = Enum.Font.GothamSemibold;
	name.TextColor3 = new Color3(0.9, 0.9, 0.9);
	name.TextTruncate = Enum.TextTruncate.AtEnd;
	name.Parent = tile;

	// Optional: slot badge
	const slotBadge = new Instance("TextLabel");
	slotBadge.Name = "Slot";
	slotBadge.BackgroundTransparency = 1;
	slotBadge.AnchorPoint = new Vector2(1, 0);
	slotBadge.Position = UDim2.fromScale(1, 0);
	slotBadge.Size = UDim2.fromScale(0.35, 0.25);
	slotBadge.Text = `#${it.slot}`;
	slotBadge.TextScaled = true;
	slotBadge.Font = Enum.Font.GothamBold;
	slotBadge.TextColor3 = new Color3(1, 1, 1);
	slotBadge.Parent = tile;

	return tile;
}

function render(list: InventoryList) {
	for (const child of scroller.GetChildren()) {
		if (child.IsA("Frame") && child.Name === "Tile") child.Destroy();
	}
	for (const it of list) {
		makeTile(it).Parent = scroller;
	}
	updateCanvas();
	print(`[InvGrid] Rendered ${list.size()} tiles.`);
}

task.spawn(() => {
	const snap = GetInventory.InvokeServer() as InventoryList;
	render(snap);

	InventoryUpdated.OnClientEvent.Connect((list: InventoryList) => render(list));
});

// // function createMugshotInViewPortFrame(bounty: Bounty, frame: ViewportFrame) {
// // 	const npcName = activeTab.WaitForChild("npcName") as TextLabel;
// // 	npcName.Text = `${bounty.npc.name}`;
// // 	const goldReward = activeTab.WaitForChild("goldReward") as TextLabel;
// // 	goldReward.Text = `${bounty.goldReward}`;
// // 	const xpReward = activeTab.WaitForChild("xpReward") as TextLabel;
// // 	xpReward.Text = `${bounty.xpReward}`;
// // 	const description = activeTab.WaitForChild("description") as TextLabel;
// // 	description.Text = `${bounty.offence}`;

// // 	const stagingArea = Workspace.WaitForChild("Staging Area") as Folder;
// // 	const existingNPC = stagingArea.FindFirstChild("NPC") as Model | undefined;
// // 	if (existingNPC) {
// // 		existingNPC.Destroy();
// // 	}

// // 	const stage = stagingArea.WaitForChild("Stage") as Part;
// // 	const cameraPosition = stagingArea.WaitForChild("Camera Position") as Part;
// // 	const npcLookPosition = stagingArea.WaitForChild("NPCLookPosition") as Part;

// // 	const npcClone = bounty.npc.model.Clone();
// // 	npcClone.Name = "NPC";
// // 	const npcPostion = CFrame.lookAt(stage.Position, npcLookPosition.Position);

// // 	const lookPosition = new Vector3(stage.Position.X, stage.Position.Y + 3, stage.Position.Z);
// // 	const stageCamera = new Instance("Camera");
// // 	stageCamera.Name = "StageCamera";
// // 	stageCamera.CFrame = CFrame.lookAt(cameraPosition.Position, lookPosition);
// // 	stageCamera.Parent = stagingArea;

// // 	npcClone.PivotTo(npcPostion);

// // 	npcClone.Parent = stagingArea;
// // 	const set = stagingArea.Clone();
// // 	set.Parent = frame;
// // 	frame.CurrentCamera = stageCamera;
// // }

killBook.Visible = false;

openKillBookBtn.MouseButton1Click.Connect(() => {
	killBook.Visible = !killBook.Visible;
});
// // closeKillBookBtn.MouseButton1Click.Connect(() => {
// // 	killBook.Visible = false;
// // });

// // activeTabButton.MouseButton1Click.Connect(() => {
// // 	historyTab.Visible = false;
// // 	activeTab.Visible = true;
// // });
// // historyTabButton.MouseButton1Click.Connect(() => {
// // 	historyTab.Visible = true;
// // 	activeTab.Visible = false;
// // });

// // const bounty: Bounty | undefined = clientBountyService.getBounty();
// // if (bounty) {
// // 	createMugshotInViewPortFrame(bounty, portrait);
// // }

// // clientBountyService.onBountyChanged((bounty: Bounty | undefined) => {
// // 	if (!bounty) {
// // 		return;
// // 	}
// // 	createMugshotInViewPortFrame(bounty, portrait);
// // });

// const invNet = ReplicatedStorage.WaitForChild("Net").WaitForChild("Inventory") as Folder;
// const GetInventory = invNet.WaitForChild("GetInventory") as RemoteFunction;
// const InventoryUpdated = invNet.WaitForChild("InventoryUpdated") as RemoteEvent;

// let inventory: InventoryList = [];

// function applyFull(list: InventoryList) {
// 	inventory = list;
// 	print(`[Inventory] Updated. Count=${inventory.size()}`);
// 	list.forEach((item) => {
// 		warn(item.name);
// 	});
// }

// task.defer(() => {
// 	const snap = GetInventory.InvokeServer() as InventoryList;
// 	applyFull(snap);
// 	print("[Inventory] Snapshot received.");

// 	InventoryUpdated.OnClientEvent.Connect((list: InventoryList) => applyFull(list));
// });
