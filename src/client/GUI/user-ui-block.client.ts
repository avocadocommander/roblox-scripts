import { Players, ReplicatedStorage } from "@rbxts/services";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";

const playerState = ReplicatedStorage.WaitForChild("PlayerState") as Folder;
const GetPlayerExpierence = playerState.WaitForChild("GetExpierence") as RemoteFunction;
const GetPlayerTitle = playerState.WaitForChild("GetTitle") as RemoteFunction;
const GetPlayerName = playerState.WaitForChild("GetName") as RemoteFunction;
const GetPlayerLevel = playerState.WaitForChild("GetLevel") as RemoteFunction;

const GetCoins = playerState.WaitForChild("GetCoins") as RemoteFunction;
const CoinsUpdated = playerState.WaitForChild("CoinsUpdated") as RemoteEvent;

const ExpierenceUpdated = playerState.WaitForChild("ExpierenceUpdated") as RemoteEvent;
const LevelUpdated = playerState.WaitForChild("LevelUpdated") as RemoteEvent;

const lifecycle = getOrCreateLifecycleRemote();

lifecycle.OnClientEvent.Connect((message: string) => {
	if (message === "InitializePlayer") {
		initializeUserUI();
	}
});

function initializeUserUI() {
	const playerGui = Players.LocalPlayer!.WaitForChild("PlayerGui") as PlayerGui;
	const screenGui = playerGui.WaitForChild("ScreenGui") as ScreenGui;

	const playerLevelLabel = screenGui
		.WaitForChild("PlayerInfoImage")
		.WaitForChild("PlayerFrame")
		.WaitForChild("XPFrame")
		.WaitForChild("playerLevelLabel") as TextLabel;

	const playerTitleLabel = screenGui
		.WaitForChild("PlayerInfoImage")
		.WaitForChild("PlayerFrame")
		.WaitForChild("NameFrame")
		.WaitForChild("playerTitleLabel") as TextLabel;

	const playerNameLabel = screenGui
		.WaitForChild("PlayerInfoImage")
		.WaitForChild("PlayerFrame")
		.WaitForChild("NameFrame")
		.WaitForChild("playerNameLabel") as TextLabel;

	const playerCoinsLabel = screenGui
		.WaitForChild("PlayerInfoImage")
		.WaitForChild("PlayerFrame")
		.WaitForChild("XPFrame")
		.WaitForChild("coinAmountLabel") as TextLabel;

	main(playerNameLabel, playerTitleLabel, playerLevelLabel, playerCoinsLabel);
}

function refreshLabels(
	playerNameLabel: TextLabel,
	playerTitleLabel: TextLabel,
	playerLevelLabel: TextLabel,
	playerCoinsLabel: TextLabel,
	playerName?: string,
	playerTitle?: string,
	playerLevel?: number,
	playerExpierence?: number,
	playerCoins?: number,
) {
	if (playerName !== undefined) {
		playerNameLabel.Text = `${playerName}`;
	}
	if (playerTitle !== undefined) {
		playerTitleLabel.Text = `${playerTitle}`;
	}
	if (playerLevel !== undefined) {
		playerLevelLabel.Text = `Level ${playerLevel}`;
	}
	if (playerCoins !== undefined) {
		playerCoinsLabel.Text = `${playerCoins}`;
	}
}

function main(
	playerNameLabel: TextLabel,
	playerTitleLabel: TextLabel,
	playerLevelLabel: TextLabel,
	playerCoinsLabel: TextLabel,
) {
	const playerExpierence: number = GetPlayerExpierence.InvokeServer() as number;
	const playerTitle: string = GetPlayerTitle.InvokeServer() as string;
	const playerName: string = GetPlayerName.InvokeServer() as string;
	const playerLevel: number = GetPlayerLevel.InvokeServer() as number;
	const playerCoins: number = GetCoins.InvokeServer() as number;
	refreshLabels(
		playerNameLabel,
		playerTitleLabel,
		playerLevelLabel,
		playerCoinsLabel,
		playerName,
		playerTitle,
		playerLevel,
		playerExpierence,
		playerCoins,
	);

	ExpierenceUpdated.OnClientEvent.Connect((newTotalexpierence: number) => {
		refreshLabels(
			playerNameLabel,
			playerTitleLabel,
			playerLevelLabel,
			playerCoinsLabel,
			undefined,
			undefined,
			undefined,
			newTotalexpierence,
			undefined,
		);
	});

	LevelUpdated.OnClientEvent.Connect((newLevel: number) => {
		refreshLabels(
			playerNameLabel,
			playerTitleLabel,
			playerLevelLabel,
			playerCoinsLabel,
			undefined,
			undefined,
			newLevel,
			undefined,
			undefined,
		);
	});

	CoinsUpdated.OnClientEvent.Connect((newTotalCoinsAmount: number) => {
		refreshLabels(
			playerNameLabel,
			playerTitleLabel,
			playerLevelLabel,
			playerCoinsLabel,
			undefined,
			undefined,
			undefined,
			undefined,
			newTotalCoinsAmount,
		);
	});
}
