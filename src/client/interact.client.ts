import { ReplicatedStorage } from "@rbxts/services";
import { playSound } from "shared/sounds";

const Players = game.GetService("Players");
const player = Players.LocalPlayer;
const [character] = player.Character ? [player.Character] : player.CharacterAdded.Wait();
const root = character.WaitForChild("HumanoidRootPart") as Part;

function initCharacter() {
	createTool("Axe");
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
