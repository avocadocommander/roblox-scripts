import { ReplicatedStorage, UserInputService } from "@rbxts/services";
import { clientBountyService } from "shared/bounty-client-service";
import { applySpeed, SPEED, SPEEDS } from "shared/helpers";
import { NPC } from "shared/npc";
import { playSound } from "shared/sounds";

const Players = game.GetService("Players");
const player = Players.LocalPlayer;
const [character] = player.Character ? [player.Character] : player.CharacterAdded.Wait();
const root = character.WaitForChild("HumanoidRootPart") as Part;

function initCharacter() {
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (!humanoid) return;
	applySpeed(SPEEDS.WALK, humanoid);
	createWantedPoster();
	createTool("Axe");
}

function createWantedPoster() {
	const backpack = player.WaitForChild("Backpack") as Backpack;
	const wantedPoster = ReplicatedStorage.WaitForChild("WantedPoster") as Tool;
	const npc = ReplicatedStorage.WaitForChild("NPC") as Model;

	if (!wantedPoster) {
		print(`WantedPoster NOT FOUND IN ReplicatedStorage`);
		return;
	}
	wantedPoster.Name = "WantedPoster";
	wantedPoster.RequiresHandle = true;
	wantedPoster.CanBeDropped = false;

	const cFrame = CFrame.Angles(math.rad(90), 0, math.rad(-90)).add(new Vector3(-0.7, 0, 0));
	wantedPoster.Grip = cFrame;
	const clonedWantedPoster = wantedPoster.Clone();

	if (!clonedWantedPoster || !backpack) {
		print(`NOT clonedSword or back`);
		return;
	}

	const handle = clonedWantedPoster.WaitForChild("Handle") as BasePart;
	const surfaceGui = handle.WaitForChild("SurfaceGui") as SurfaceGui;
	const viewportFrame = surfaceGui.WaitForChild("ViewportFrame") as ViewportFrame;

	const label = new Instance("TextLabel");
	label.Text = "HELLO POSTER";
	label.Size = UDim2.fromScale(1, 1);
	label.TextScaled = true;
	label.BackgroundColor3 = Color3.fromRGB(255, 0, 0);
	label.Parent = surfaceGui;

	surfaceGui.Adornee = handle;
	print("Adornee:", surfaceGui.Adornee);
	print("Face:", surfaceGui.Face);
	print("CurrentCamera:", viewportFrame.CurrentCamera);

	createMugshotInViewPortFrame(npc, viewportFrame, "FRONT");

	clonedWantedPoster.Parent = backpack;

	warn("ViewportFrame CurrentCamera:", viewportFrame.CurrentCamera);
	warn("NPC clone children:", npc.GetChildren());

	clientBountyService.onBountyChanged((npc: NPC | undefined) => {
		if (!npc) {
			return;
		}
		createMugshotInViewPortFrame(npc.model, viewportFrame, "FRONT");
	});

	clonedWantedPoster.Equipped.Connect(() => {
		print("Equipped a wanted poster!");
	});

	clonedWantedPoster.Activated.Connect(() => {
		print("Peer at the wanted poster!");
	});
}

function createMugshotInViewPortFrame(npcModel: Model, frame: ViewportFrame, position: "FRONT" | "SIDE" = "FRONT") {
	// Clear old children
	frame.ClearAllChildren();

	const npcClone = npcModel.Clone();
	npcClone.Parent = frame;

	// Ensure PrimaryPart is set
	if (!npcClone.PrimaryPart) {
		const rootPart = npcClone.FindFirstChild("HumanoidRootPart") as BasePart;
		if (rootPart) {
			npcClone.PrimaryPart = rootPart;
		} else {
			warn("No HumanoidRootPart found in npcClone!");
			return;
		}
	}

	// Reset NPC position to origin for consistency
	npcClone.SetPrimaryPartCFrame(new CFrame(0, 0, 0));

	// Camera position
	const distance = 5;
	const offset = position === "FRONT" ? new Vector3(0, 0, distance) : new Vector3(distance, 0, 0);

	const camera = new Instance("Camera");
	camera.CFrame = CFrame.lookAt(offset, Vector3.zero);
	camera.Parent = frame;
	frame.CurrentCamera = camera;

	// Add light for visibility
	const light = new Instance("PointLight");
	light.Brightness = 2;
	light.Range = 10;
	light.Parent = npcClone.PrimaryPart;
}

function createTool(toolReplicatedStorageName: string) {
	const backpack = player.WaitForChild("Backpack") as Backpack;
	const baseAxe = ReplicatedStorage.WaitForChild(toolReplicatedStorageName) as Tool;

	if (!baseAxe) {
		print(`${toolReplicatedStorageName} NOT FOUND IN ReplicatedStorage`);
		return;
	}

	baseAxe.Name = "Starter Axe";
	baseAxe.RequiresHandle = true;
	baseAxe.CanBeDropped = true;
	const cFrame = CFrame.Angles(math.rad(90), 0, math.rad(-90)).add(new Vector3(-0.7, 0, 0));
	baseAxe.Grip = cFrame;
	const clonedSword = baseAxe.Clone();

	if (!clonedSword || !backpack) {
		print(`NOT clonedSword or back`);
		return;
	}

	clonedSword.Parent = backpack;

	clonedSword.Equipped.Connect(() => {
		print("Equipped by the noble hand!");
	});

	clonedSword.Activated.Connect(() => {
		const swingAxe = ReplicatedStorage.WaitForChild("SwingAxe") as Animation;

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

		const track = animator.LoadAnimation(swingAxe);
		track.Priority = Enum.AnimationPriority.Action;

		track.Play();

		playSound(root, "8278630896", 0.5);
	});
}

initCharacter();

// Input handlers
UserInputService.InputBegan.Connect((input, gameProcessed) => {
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (gameProcessed || !humanoid) return;
	if (input.KeyCode === Enum.KeyCode.LeftShift) {
		applySpeed(SPEEDS.RUN, humanoid);
	}
});

UserInputService.InputEnded.Connect((input, gameProcessed) => {
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (gameProcessed || !humanoid) return;
	if (input.KeyCode === Enum.KeyCode.LeftShift) {
		applySpeed(SPEEDS.WALK, humanoid);
	}
});
