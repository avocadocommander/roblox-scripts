import { CollectionService, ReplicatedStorage, UserInputService } from "@rbxts/services";
const playerState = ReplicatedStorage.WaitForChild("PlayerState") as Folder;
const RequestAddExpierence = playerState.WaitForChild("RequestAddExpierence") as RemoteFunction;
const GetPlayerLevel = playerState.WaitForChild("GetLevel") as RemoteFunction;

const LevelUpdated = playerState.WaitForChild("LevelUpdated") as RemoteEvent;

export function getModelsWithAccessChecks(): Instance[] {
	const accessModels = CollectionService.GetTagged("LevelAccessRequired");
	return accessModels;
}

function modelChecks(level: number) {
	const modelsWithAccessChecks: Instance[] = getModelsWithAccessChecks();
	warn(`modelsWithAccessChecks: ${modelsWithAccessChecks.size()}`);
	if (!modelsWithAccessChecks) {
		warn("No models with access checks");
	}
	modelsWithAccessChecks.forEach((accessModelInstance) => {
		const accessModelRequiredLevel = accessModelInstance.GetAttribute("AccessLevel");
		const requiredLevel = tonumber(accessModelRequiredLevel);
		if (accessModelRequiredLevel === undefined || requiredLevel === undefined) {
			return;
		}
		warn(`level ${level} | required ${requiredLevel}`);
		if (level >= requiredLevel) {
			const sparkles = getAllSparkles(accessModelInstance);
			sparkles.forEach((sparkle) => {
				sparkle.SparkleColor = new Color3(0.54, 0.78, 0.46);
				const wall: Part = accessModelInstance.FindFirstChild("Wall") as Part;
				wall.Anchored = false;
				wall.CanCollide = false;
				wall.CanTouch = false;
				wall.CanQuery = false;
			});
			task.delay(10, () => {
				accessModelInstance.Destroy();
			});
		} else {
			if (accessModelInstance.FindFirstChild("ProximityPromptAttachment")) {
				return;
			}
			const proximityPromptAttachment = new Instance("Attachment");
			proximityPromptAttachment.Name = "ProximityPromptAttachment";
			proximityPromptAttachment.Parent = accessModelInstance;

			const proximityPrompt = new Instance("ProximityPrompt");
			proximityPrompt.Enabled = true;
			proximityPrompt.ActionText = `Must be level ${requiredLevel} to gain access`;
			proximityPrompt.Parent = proximityPromptAttachment;
		}
	});
}

function getAllSparkles(model: Instance): Sparkles[] {
	return model.GetDescendants().filter((inst) => inst.IsA("Sparkles")) as Sparkles[];
}

function main() {
	const playerExpierence: number = GetPlayerLevel.InvokeServer() as number;
	modelChecks(playerExpierence);

	LevelUpdated.OnClientEvent.Connect((newTotalexpierence: number) => {
		modelChecks(newTotalexpierence);
	});
}

// TESTS

export function requestAdd(xp: number) {
	const addResponse = RequestAddExpierence.InvokeServer(xp) as boolean;
	if (!addResponse) warn(`[FAILED] to add xp ${xp}`);
}
UserInputService.InputBegan.Connect((io, gp) => {
	if (gp) return;
	if (io.KeyCode === Enum.KeyCode.R) requestAdd(1);
});

main();
