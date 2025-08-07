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
	//createWantedPoster();
	//createTool("Axe");
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

	clonedWantedPoster.Grip = new CFrame(0, -2, 0);

	const handle = clonedWantedPoster.WaitForChild("Handle") as BasePart;
	const surfaceGui = handle.WaitForChild("SurfaceGui") as SurfaceGui;
	handle.Size = new Vector3(5, 5, 1);
	surfaceGui.Face = Enum.NormalId.Front;
	surfaceGui.AlwaysOnTop = true;

	let npc: NPC | undefined = undefined;

	/**
	 * When creating the poster init set to undefined (who cares)
	 * When showing the poster do a GET
	 * When ever the poster is equipted we only care about a sub
	 *
	 */

	let onBountyChangedConnection: RBXScriptConnection | undefined = undefined;

	clonedWantedPoster.Equipped.Connect(() => {
		npc = clientBountyService.getBounty();
		onBountyChangedConnection = clientBountyService.onBountyChanged((npcFromEvent: NPC | undefined) => {
			if (!npcFromEvent) {
				return;
			}
			warn(`GOT npc from EVENT ${npcFromEvent.name}`);
			npc = npcFromEvent;
			createMugshotInViewPortFrame(npc.model, surfaceGui);
		});
		if (!npc) {
			warn("NPC NOT GOTTED");
		}
		warn(`GOT npc ${npc!.name}`);
		print("Equipped a wanted poster!");
		if (!npc) {
			return;
		}
		createMugshotInViewPortFrame(npc.model, surfaceGui);
	});

	clonedWantedPoster.Unequipped.Connect(() => {
		onBountyChangedConnection?.Disconnect();
	});

	clonedWantedPoster.Activated.Connect(() => {
		print("Peer at the wanted poster!");
	});

	clonedWantedPoster.Parent = backpack;
}

function createMugshotInViewPortFrame(npcModel: Model, surfaceGui: SurfaceGui) {
	const viewportFrame = surfaceGui.WaitForChild("ViewportFrame") as ViewportFrame;

	viewportFrame.BackgroundTransparency = 0;
	viewportFrame.BackgroundColor3 = Color3.fromRGB(0, 0, 0);
	viewportFrame.Parent = surfaceGui;

	// Clone NPC model
	const npcClone = npcModel.Clone();
	// npcClone.Parent = surfaceGui;

	// Optional: Add title label back
	const label = new Instance("TextLabel");
	label.Text = `WANTED: ${npcModel.Name}`;
	label.Size = UDim2.fromScale(1, 0.2);
	label.Position = UDim2.fromScale(0, 0);
	label.TextScaled = true;
	label.BackgroundColor3 = Color3.fromRGB(204, 140, 107);
	label.Parent = surfaceGui;

	const ViewportCamera = new Instance("Camera");
	ViewportCamera.Parent = viewportFrame;
	ViewportCamera.Name = "ViewportCamera";
	ViewportCamera.CameraType = Enum.CameraType.Scriptable;

	ViewportCamera.CFrame = new CFrame(new Vector3(0, 0, 5), npcClone.PrimaryPart!.Position);
	viewportFrame.CurrentCamera = ViewportCamera;

	const ViewportLight = new Instance("PointLight");
	ViewportLight.Brightness = 1;
	ViewportLight.Color = new Color3(1, 1, 1);
	ViewportLight.Range = 10;
	ViewportLight.Parent = viewportFrame;
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
