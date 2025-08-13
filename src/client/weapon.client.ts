import { ReplicatedStorage } from "@rbxts/services";

function addToolToBackpack(toolNameFromReplicatedStorage: string) {
	const player = game.GetService("Players").LocalPlayer;
	const backpack = player.WaitForChild("Backpack") as Backpack;
	const tool = ReplicatedStorage.WaitForChild(toolNameFromReplicatedStorage) as Tool;
	if (!tool) {
		warn(`${toolNameFromReplicatedStorage} NOT FOUND IN ReplicatedStorage`);
		return;
	}
	const [character] = player.Character ? [player.Character] : player.CharacterAdded.Wait();
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (!humanoid) return;

	tool.Name = toolNameFromReplicatedStorage;
	const clonedTool = tool.Clone();

	if (!clonedTool || !backpack) {
		print(`NOT clonedSword or back`);
		return;
	}

	clonedTool.Parent = backpack;
	let stanceTrack: AnimationTrack | undefined;

	clonedTool.Equipped.Connect(() => {
		player.SetAttribute("state", "warmingUp");
		const actionAnimationId = tool.GetAttribute("ActionId");
		if (actionAnimationId === undefined) {
			warn("No action animation for this tool");
			return;
		}
		stanceTrack = playStance(humanoid, clonedTool, `${actionAnimationId}`);
	});

	clonedTool.Activated.Connect(() => {
		playStance(humanoid, clonedTool, "119925860378560");
	});

	clonedTool.Unequipped.Connect(() => {
		print("nim quit");
		player.SetAttribute("state", undefined);
		stopStance(stanceTrack);
	});

	clonedTool.AncestryChanged.Connect(() => {
		print("nim aefea");
		player.SetAttribute("state", undefined);
		if (!clonedTool.IsDescendantOf(game)) stopStance(stanceTrack);
	});
}

function playStance(humanoid: Humanoid, tool: Tool, actionAnimationId: string): AnimationTrack | undefined {
	const animator = humanoid.FindFirstChildOfClass("Animator") ?? (humanoid.WaitForChild("Animator") as Animator);

	const anim = new Instance("Animation");
	anim.AnimationId = `rbxassetid://${actionAnimationId}`;

	const track = animator.LoadAnimation(anim);
	track.Priority = Enum.AnimationPriority.Action;
	//track.Looped = true;

	track.Play();
	return track;
}

function stopStance(stanceTrack: AnimationTrack | undefined) {
	if (stanceTrack) {
		stanceTrack.Stop(0.15);
		stanceTrack.Destroy();
		stanceTrack = undefined;
	}
}

addToolToBackpack("Dagger");
addToolToBackpack("Hammer");
