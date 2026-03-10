import { Players, ReplicatedStorage, TweenService } from "@rbxts/services";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";

const playerState = ReplicatedStorage.WaitForChild("PlayerState") as Folder;
const ExpierenceUpdated = playerState.WaitForChild("ExpierenceUpdated") as RemoteEvent;
const LevelUpdated = playerState.WaitForChild("LevelUpdated") as RemoteEvent;
const CoinsUpdated = playerState.WaitForChild("CoinsUpdated") as RemoteEvent;

const lifecycle = getOrCreateLifecycleRemote();

lifecycle.OnClientEvent.Connect((message: string) => {
	if (message === "InitializePlayer") {
		initializeCurrencyUpdates();
	}
});

function initializeCurrencyUpdates() {
	const playerGui = Players.LocalPlayer!.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

	ExpierenceUpdated.OnClientEvent.Connect((newTotalexpierence: number) => {
		celebrateText(newTotalexpierence, "XPIcon", screenGui);
	});

	LevelUpdated.OnClientEvent.Connect((newLevel: number) => {});

	CoinsUpdated.OnClientEvent.Connect((newTotalCoinsAmount: number) => {
		celebrateCurrency(newTotalCoinsAmount, screenGui);
	});
}

function spawnCoinToLabel(targetLabel: TextLabel, screenGui: ScreenGui) {
	const coinTemplate = ReplicatedStorage.WaitForChild("Coin") as ImageLabel;

	const coin = coinTemplate.Clone();
	coin.Position = new UDim2(0.5, 0, 0.5, math.random(-20, 20));
	coin.Rotation = math.random(-45, 45);
	coin.Parent = screenGui;

	const tweenInfo = new TweenInfo(1, Enum.EasingStyle.Cubic, Enum.EasingDirection.Out);

	const tween = TweenService.Create(coin, tweenInfo, {
		Position: new UDim2(0, 100, 0, 100),
	});

	tween.Completed.Once(() => coin.Destroy());
	tween.Play();
}

function celebrateText(celebrateAmount: number, replicatedFrame: string, screenGui: ScreenGui) {
	const template = ReplicatedStorage.WaitForChild(replicatedFrame) as Frame;
	const clone = template.Clone();
	clone.Parent = screenGui;
	const textLabel = clone.WaitForChild("amountTextLabel") as TextLabel;
	textLabel.Text = `${celebrateAmount}`;
	const tweenInfo = new TweenInfo(1, Enum.EasingStyle.Cubic, Enum.EasingDirection.Out);

	const tween = TweenService.Create(clone, tweenInfo, {
		Position: new UDim2(0.5, 0, 0.6, 0),
	});

	tween.Completed.Once(() => clone.Destroy());
	tween.Play();
}

function celebrateCurrency(newTotal: number, screenGui: ScreenGui) {
	const burst = math.clamp(newTotal, 1, 15);
	const label = screenGui
		.WaitForChild("PlayerInfoImage")
		.WaitForChild("PlayerFrame")
		.WaitForChild("XPFrame")
		.WaitForChild("coinAmountLabel") as TextLabel;

	for (let i = 0; i < burst; i++) {
		task.delay(i * 0.05, () => spawnCoinToLabel(label, screenGui));
	}
}
