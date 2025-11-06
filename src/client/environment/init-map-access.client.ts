import { CollectionService, ReplicatedStorage, UserInputService } from "@rbxts/services";
import { log } from "shared/helpers";
const playerState = ReplicatedStorage.WaitForChild("PlayerState") as Folder;
const RequestAddExpierence = playerState.WaitForChild("RequestAddExpierence") as RemoteFunction;
const RequestAddLevel = playerState.WaitForChild("RequestAddLevel") as RemoteFunction;
const RequestAddCoins = playerState.WaitForChild("RequestAddCoins") as RemoteFunction;

const GetPlayerLevel = playerState.WaitForChild("GetLevel") as RemoteFunction;

const LevelUpdated = playerState.WaitForChild("LevelUpdated") as RemoteEvent;

async function modelChecks(accessModelInstance: Model) {
	const playerLevel: number = GetPlayerLevel.InvokeServer() as number;

	const accessModelRequiredLevel = accessModelInstance.GetAttribute("AccessLevel");
	const wall: Part = accessModelInstance.FindFirstChild("Wall") as Part;

	const requiredLevel = tonumber(accessModelRequiredLevel);
	if (accessModelRequiredLevel === undefined || requiredLevel === undefined) {
		error(`${accessModelInstance} does not have AccessLevel attribute or value`);
	}
	if (playerLevel >= requiredLevel) {
		const smoke: Smoke | undefined = accessModelInstance
			.FindFirstChild("Wall")
			?.FindFirstChild("Attachment")
			?.FindFirstChild("Smoke") as Smoke;
		if (smoke === undefined) {
			error("No Smoke Part inside of model being used");
		}
		for (let opacity = 1; opacity >= 0; opacity -= 0.02) {
			smoke.Opacity = opacity;
			wait(0.3);
		}
		task.delay(5, () => {
			accessModelInstance.Destroy();
		});
	} else {
		task.wait(0.1);
		const proximityPromptAttachment = new Instance("Attachment");
		proximityPromptAttachment.Name = "ProximityPromptAttachment";
		proximityPromptAttachment.Parent = wall;

		const proximityPrompt = new Instance("ProximityPrompt");
		proximityPrompt.Enabled = true;
		proximityPrompt.ActionText = `Must be level ${requiredLevel} to gain access`;
		proximityPrompt.Parent = proximityPromptAttachment;

		const smokeAttachment = new Instance("Attachment");
		smokeAttachment.Parent = wall;

		const smoke = new Instance("Smoke");
		smoke.Opacity = 1;
		smoke.RiseVelocity = 0.5;
		smoke.Size = 0.5;
		smoke.TimeScale = 0.5;
		smoke.Parent = smokeAttachment;
	}
}

UserInputService.InputBegan.Connect((io, gp) => {
	if (gp) return;
	if (io.KeyCode === Enum.KeyCode.Z) RequestAddLevel.InvokeServer(1);
	if (io.KeyCode === Enum.KeyCode.X) RequestAddExpierence.InvokeServer(100);
	if (io.KeyCode === Enum.KeyCode.C) RequestAddCoins.InvokeServer(20);
});

const TAG = "LevelAccessRequired";

LevelUpdated.OnClientEvent.Connect((newLevel: number) => {
	log("New level - checking tagged locked models");
	for (const inst of CollectionService.GetTagged(TAG)) modelChecks(inst as Model);
});
for (const inst of CollectionService.GetTagged(TAG)) modelChecks(inst as Model);
CollectionService.GetInstanceAddedSignal(TAG).Connect((inst) => modelChecks(inst as Model));
