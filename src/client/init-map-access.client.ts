import { CollectionService, ReplicatedStorage, UserInputService } from "@rbxts/services";
const playerState = ReplicatedStorage.WaitForChild("PlayerState") as Folder;
const RequestAddExpierence = playerState.WaitForChild("RequestAddExpierence") as RemoteFunction;
const RequestAddLevel = playerState.WaitForChild("RequestAddLevel") as RemoteFunction;
const RequestAddCoins = playerState.WaitForChild("RequestAddCoins") as RemoteFunction;

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
			const wall: Part = accessModelInstance.FindFirstChild("Wall") as Part;

			sparkles.forEach((sparkle) => {
				sparkle.SparkleColor = new Color3(0.54, 0.78, 0.46);
				wall.CanCollide = false;
				wall.CanTouch = false;
				wall.CanQuery = false;
			});
			for (let i = 0; i <= 50; i++) {
				wall.Transparency += i * 0.01;
				wait(0.1);
			}
			task.delay(5, () => {
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

UserInputService.InputBegan.Connect((io, gp) => {
	if (gp) return;
	if (io.KeyCode === Enum.KeyCode.Z) RequestAddLevel.InvokeServer(1);
	if (io.KeyCode === Enum.KeyCode.X) RequestAddExpierence.InvokeServer(100);
	if (io.KeyCode === Enum.KeyCode.C) RequestAddCoins.InvokeServer(20);
});

main();
