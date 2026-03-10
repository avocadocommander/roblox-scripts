import { CollectionService, ReplicatedStorage, TweenService, UserInputService } from "@rbxts/services";
import { log } from "shared/helpers";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";

const playerState = ReplicatedStorage.WaitForChild("PlayerState") as Folder;
const RequestAddExpierence = playerState.WaitForChild("RequestAddExpierence") as RemoteFunction;
const RequestAddLevel = playerState.WaitForChild("RequestAddLevel") as RemoteFunction;
const RequestAddCoins = playerState.WaitForChild("RequestAddCoins") as RemoteFunction;
const GetPlayerLevel = playerState.WaitForChild("GetLevel") as RemoteFunction;
const LevelUpdated = playerState.WaitForChild("LevelUpdated") as RemoteEvent;
const TAG = "LevelAccessRequired";

const lifecycle = getOrCreateLifecycleRemote();

UserInputService.InputBegan.Connect((io, gp) => {
	if (gp) return;
	if (io.KeyCode === Enum.KeyCode.Z) RequestAddLevel.InvokeServer(1);
	if (io.KeyCode === Enum.KeyCode.X) RequestAddExpierence.InvokeServer(100);
	if (io.KeyCode === Enum.KeyCode.C) RequestAddCoins.InvokeServer(20);
});

lifecycle.OnClientEvent.Connect((message: string) => {
	if (message === "InitializePlayer") {
		initializeMapAccess();
	}
});

function initializeMapAccess() {
	// Initial check: setup all existing barriers based on current level
	for (const inst of CollectionService.GetTagged(TAG)) {
		setupBarrier(inst as Model);
	}

	// When new models are tagged, setup barriers for them
	CollectionService.GetInstanceAddedSignal(TAG).Connect((inst) => {
		setupBarrier(inst as Model);
	});

	// When level updates, check if any barriers should be destroyed
	LevelUpdated.OnClientEvent.Connect((newLevel: number) => {
		log("[MAP ACCESS] Level updated - checking barriers for removal");
		for (const inst of CollectionService.GetTagged(TAG)) {
			checkBarrierRemoval(inst as Model);
		}
	});
}

function setupBarrier(accessModelInstance: Model) {
	const playerLevel: number = GetPlayerLevel.InvokeServer() as number;

	const accessModelRequiredLevel = accessModelInstance.GetAttribute("AccessLevel");

	// Wait briefly for model to replicate fully
	task.wait(1);

	// Try to find Wall child, otherwise use the model itself or first Part child
	let wall: Part | undefined = accessModelInstance.FindFirstChild("Wall") as Part | undefined;
	if (!wall && accessModelInstance.IsA("Part")) {
		wall = accessModelInstance as Part;
	}
	if (!wall) {
		wall = accessModelInstance.FindFirstChildOfClass("Part") as Part | undefined;
	}

	if (!wall) {
		warn(
			`[MAP ACCESS] ${accessModelInstance.Name} does not have a Wall child. Children:`,
			accessModelInstance
				.GetChildren()
				.map((c) => c.Name)
				.join(", "),
		);
		return;
	}

	const requiredLevel = tonumber(accessModelRequiredLevel);
	if (accessModelRequiredLevel === undefined || requiredLevel === undefined) {
		log(`[MAP ACCESS] ${accessModelInstance.Name} does not have AccessLevel attribute or value`);
		return;
	}

	// Ensure smoke exists for this barrier
	let smoke: Smoke | undefined = wall.FindFirstChild("Attachment")?.FindFirstChild("Smoke") as Smoke;
	if (!smoke) {
		const smokeAttachment = new Instance("Attachment");
		smokeAttachment.Name = "Attachment";
		smokeAttachment.Parent = wall;

		smoke = new Instance("Smoke");
		smoke.Opacity = 1;
		smoke.RiseVelocity = 0.5;
		smoke.Size = 0.5;
		smoke.TimeScale = 0.5;
		smoke.Parent = smokeAttachment;
	}

	if (smoke === undefined) {
		log("[MAP ACCESS] Failed to create or find smoke for barrier");
		return;
	}

	// If player level is too low, create proximity prompt
	if (playerLevel < requiredLevel) {
		task.wait(0.1);

		// Check if proximity prompt already exists
		let proximityPromptAttachment: Attachment | undefined = wall.FindFirstChild(
			"ProximityPromptAttachment",
		) as Attachment;
		if (!proximityPromptAttachment) {
			proximityPromptAttachment = new Instance("Attachment");
			proximityPromptAttachment.Name = "ProximityPromptAttachment";
			proximityPromptAttachment.Parent = wall;

			const proximityPrompt = new Instance("ProximityPrompt");
			proximityPrompt.Enabled = true;
			proximityPrompt.ActionText = `Must be level ${requiredLevel} to gain access`;
			proximityPrompt.Parent = proximityPromptAttachment;

			log(`[MAP ACCESS] Barrier created for ${accessModelInstance.Name} (level ${requiredLevel})`);
		}
	}
}

function checkBarrierRemoval(accessModelInstance: Model) {
	const playerLevel: number = GetPlayerLevel.InvokeServer() as number;
	const accessModelRequiredLevel = accessModelInstance.GetAttribute("AccessLevel");

	// Try to find Wall child, otherwise use the model itself or first Part child
	let wall: Part | undefined = accessModelInstance.FindFirstChild("Wall") as Part | undefined;
	if (!wall && accessModelInstance.IsA("Part")) {
		wall = accessModelInstance as Part;
	}
	if (!wall) {
		wall = accessModelInstance.FindFirstChildOfClass("Part") as Part | undefined;
	}

	if (!wall) return;

	const requiredLevel = tonumber(accessModelRequiredLevel);
	if (requiredLevel === undefined) return;

	// If player level is now high enough, destroy the barrier
	if (playerLevel >= requiredLevel) {
		const smoke: Smoke | undefined = wall.FindFirstChild("Attachment")?.FindFirstChild("Smoke") as Smoke;
		if (smoke) {
			poofBarrier(wall, smoke, accessModelInstance);
		}
	}
}

function poofBarrier(wall: Part, smoke: Smoke, accessModelInstance: Model) {
	// Fade out smoke opacity
	const tweenInfo = new TweenInfo(0.8, Enum.EasingStyle.Quad, Enum.EasingDirection.In);
	const smokeTween = TweenService.Create(smoke, tweenInfo, { Opacity: 0 });
	smokeTween.Play();

	// Scale the wall down while rotating
	const wallTween = TweenService.Create(wall, tweenInfo, {
		Size: new Vector3(wall.Size.X * 0.1, wall.Size.Y * 0.1, wall.Size.Z * 0.1),
		Transparency: 1,
	});
	wallTween.Play();

	// Rotate the wall for dramatic effect
	const rotationTween = TweenService.Create(wall, tweenInfo, {
		CFrame: wall.CFrame.mul(CFrame.Angles(math.rad(45), math.rad(45), math.rad(45))),
	});
	rotationTween.Play();

	// Destroy after animation completes
	task.delay(0.9, () => {
		accessModelInstance.Destroy();
		log(`💨 Barrier destroyed with poof!`);
	});
}
