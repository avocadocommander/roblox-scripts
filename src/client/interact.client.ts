import { Players, ReplicatedStorage, Workspace } from "@rbxts/services";

const player = Players.LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

const cameraTarget: Model = Workspace.WaitForChild("Usage Log") as Model;
const cameraPivot: Part = Workspace.WaitForChild("Camera Pivot") as Part;


const gui = playerGui.WaitForChild("ScreenGui") as ScreenGui;
const panel = gui.WaitForChild("Frame") as Frame;
const character = player.Character || player.WaitForChild("Character") as Model;
const root = character.WaitForChild("HumanoidRootPart") as Part;
const camera = game.Workspace.CurrentCamera!;

let chopping = false;


for (const descendant of game.GetDescendants()) {
	if (descendant.IsA("ProximityPrompt")) {
		descendant.Triggered.Connect((triggeringPlayer) => {
			if (triggeringPlayer === player) {
				(chopping)
				if (chopping) {
					chopping = false;
					onPlayerChoppingStop();
				}
				else {
					chopping = true;
					onPlayerChoppingStart();
				}	
			}
		});
	}
}

function onPlayerChoppingStart() {
	const swingAxe = ReplicatedStorage.WaitForChild("SwingAxe") as Animation;

	const baseAxe = ReplicatedStorage.WaitForChild("Axe") as Tool;

	print("🔥 Prompt triggered at start");
	panel.Visible = true;
	root.Anchored = true;
	camera.CameraType = Enum.CameraType.Scriptable;
	camera.CFrame = new CFrame(
		cameraPivot.Position, // Camera position
		new Vector3(cameraTarget.GetPivot().Position.X, cameraTarget.GetPivot().Position.Y + 4, cameraTarget.GetPivot().Position.Z)    // Look-at target
	);

	const backpack = player.FindFirstChild("Backpack") as Backpack;
	if (!backpack) return;

	baseAxe.Name = "Starter Axe";
	baseAxe.RequiresHandle = true;
	baseAxe.CanBeDropped = true;
	const cFrame = CFrame.Angles(math.rad(90), 0, math.rad(-90)).add(new Vector3(-0.7,0,0));
	baseAxe.Grip = cFrame
	
	

	const clonedSword = baseAxe.Clone();
	clonedSword.Parent = backpack;


clonedSword.Equipped.Connect(() => {
	print("Equipped by the noble hand!");
});

clonedSword.Activated.Connect(() => {
	print("Swing thy weapon, brave one!");

	const character = clonedSword.Parent;
	if (!character || !character.IsA("Model")) {
		warn("No character found!");
		return;
	}

	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (!humanoid) {
		warn("No humanoid found!");
		return;
	}

	print("Rig type:", humanoid.RigType.Name); // ← Must be R15

	let animator = humanoid.FindFirstChildOfClass("Animator");
	if (!animator) {
		print("No animator found. Creating one...");
		animator = new Instance("Animator");
		animator.Parent = humanoid;
	}

	const anim = new Instance("Animation");
	anim.AnimationId = "rbxassetid://128505303444071";

	const track = animator.LoadAnimation(anim);
	print("Loaded track:", track);
	track.Play();
	print("🔥 Tried to play animation.");
});

}

function onPlayerChoppingStop() {
	print("🔥 Chopping done");
	panel.Visible = false;
	root.Anchored = false;
	camera.CameraType = Enum.CameraType.Custom;
}