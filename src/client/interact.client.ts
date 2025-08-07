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

	if (!wantedPoster) {
		print(`WantedPoster NOT FOUND IN ReplicatedStorage`);
		return;
	}

	const clonedWantedPoster = wantedPoster.Clone();
	if (!clonedWantedPoster || !backpack) {
		print(`NOT clonedSword or back`);
		return;
	}

	clonedWantedPoster.Grip = new CFrame(0, 2, -3);

	const handle = clonedWantedPoster.WaitForChild("Handle") as BasePart;
	const surfaceGui = handle.WaitForChild("SurfaceGui") as SurfaceGui;
	handle.Size = new Vector3(10, 10, 1);
	surfaceGui.Face = Enum.NormalId.Front;
	surfaceGui.AlwaysOnTop = true;

	clonedWantedPoster.Equipped.Connect(() => {
		print("Equipped a wanted poster!");
		// Clear SurfaceGui contents at the start
		surfaceGui.ClearAllChildren();
		// Set Adornee each time
		surfaceGui.Adornee = handle;
		// Add debug red cube for visibility reference in the viewport frame and mugshot
		const npc = clientBountyService.getBounty();
		if (npc) {
			createMugshotInViewPortFrame(npc.model, surfaceGui);
		}
		clientBountyService.onBountyChanged((npc: NPC | undefined) => {
			if (!npc) {
				return;
			}
			createMugshotInViewPortFrame(npc.model, surfaceGui);
		});
	});

	clonedWantedPoster.Activated.Connect(() => {
		print("Peer at the wanted poster!");
	});

	clonedWantedPoster.Parent = backpack;
}

function createMugshotInViewPortFrame(npcModel: Model, surfaceGui: SurfaceGui) {
	// Clear all previous GUI content
	surfaceGui.ClearAllChildren();
	surfaceGui.Adornee = surfaceGui.Parent as BasePart; // Ensure Adornee is set AFTER ViewportFrame
	// Create ViewportFrame fresh
	const frame = new Instance("ViewportFrame");
	frame.Size = UDim2.fromScale(1, 1);
	frame.BackgroundTransparency = 0;
	frame.BackgroundColor3 = Color3.fromRGB(0, 0, 0);
	frame.Parent = surfaceGui;

	// Clone NPC model
	const npcClone = npcModel.Clone();
	npcClone.Parent = frame;

	// Set PrimaryPart if missing
	if (!npcClone.PrimaryPart) {
		const root = npcClone.FindFirstChild("HumanoidRootPart") as BasePart;
		if (root) {
			npcClone.PrimaryPart = root;
		} else {
			warn("NPC has no HumanoidRootPart!");
			return;
		}
	}

	// Scale down the NPC model uniformly
	const scaleFactor = 0.4;
	for (const part of npcClone.GetDescendants()) {
		if (part.IsA("BasePart")) {
			part.Size = part.Size.mul(scaleFactor);
		}
	}

	// Move NPC forward along Z-axis to ensure it's in front of the camera
	npcClone.PivotTo(new CFrame(0, 0, -1)); // Offset NPC forward for better camera view
	// Force transparency 0 for all parts in npcClone
	for (const part of npcClone.GetDescendants()) {
		if (part.IsA("BasePart")) {
			part.Transparency = 0;
			part.Color = Color3.fromRGB(0, 0, 255); // Blue
		}
	}

	// Create camera
	const camera = new Instance("Camera");
	camera.CFrame = CFrame.lookAt(new Vector3(0, 0, 2), new Vector3(0, 0, -1)); // Move camera closer and target NPC
	camera.FieldOfView = 70;
	camera.Parent = frame;
	frame.CurrentCamera = camera;
	frame.BackgroundTransparency = 0;
	frame.BackgroundColor3 = Color3.fromRGB(0, 0, 0);
	// Add lighting
	const pointLight = new Instance("PointLight");
	pointLight.Brightness = 2;
	pointLight.Range = 15;
	pointLight.Parent = npcClone.PrimaryPart;

	const dirLight = new Instance("SpotLight");
	dirLight.Brightness = 1;
	dirLight.Parent = camera;

	// Add debug red cube for visibility reference
	const debugCube = new Instance("Part");
	debugCube.Size = new Vector3(4, 4, 4); // Increased size for better visibility
	debugCube.Color = Color3.fromRGB(255, 0, 0);
	debugCube.Anchored = true;
	debugCube.Position = new Vector3(0, 0, -2);
	debugCube.Transparency = 0;
	debugCube.Parent = frame;

	// Optional: Add title label back
	const label = new Instance("TextLabel");
	label.Text = `WANTED: ${npcModel.Name}`;
	label.Size = UDim2.fromScale(1, 0.2);
	label.Position = UDim2.fromScale(0, 0);
	label.TextScaled = true;
	label.BackgroundColor3 = Color3.fromRGB(204, 140, 107);
	label.Parent = surfaceGui;

	print("Added NPC model to viewport frame with transparency set to 0.");
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
