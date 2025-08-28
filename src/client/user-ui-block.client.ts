import { Players, ReplicatedStorage } from "@rbxts/services";
const playerState = ReplicatedStorage.WaitForChild("PlayerState") as Folder;
const GetPlayerExpierence = playerState.WaitForChild("GetExpierence") as RemoteFunction;
const GetPlayerTitle = playerState.WaitForChild("GetTitle") as RemoteFunction;
const GetPlayerName = playerState.WaitForChild("GetName") as RemoteFunction;
const GetPlayerLevel = playerState.WaitForChild("GetLevel") as RemoteFunction;

const ExpierenceUpdated = playerState.WaitForChild("ExpierenceUpdated") as RemoteEvent;
const LevelUpdated = playerState.WaitForChild("LevelUpdated") as RemoteEvent;

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

function refreshLabels(playerName?: string, playerTitle?: string, playerLevel?: number, playerExpierence?: number) {
	if (playerName !== undefined) {
		playerNameLabel.Text = `${playerName}`;
	}
	if (playerTitle !== undefined) {
		playerTitleLabel.Text = `${playerTitle}`;
	}
	if (playerLevel !== undefined) {
		playerLevelLabel.Text = `Level ${playerLevel}`;
	}
}

function main() {
	const playerExpierence: number = GetPlayerExpierence.InvokeServer() as number;
	const playerTitle: string = GetPlayerTitle.InvokeServer() as string;
	const playerName: string = GetPlayerName.InvokeServer() as string;
	const playerLevel: number = GetPlayerLevel.InvokeServer() as number;
	refreshLabels(playerName, playerTitle, playerLevel, playerExpierence);

	ExpierenceUpdated.OnClientEvent.Connect((newTotalexpierence: number) => {
		refreshLabels(undefined, undefined, undefined, newTotalexpierence);
	});

	LevelUpdated.OnClientEvent.Connect((newLevel: number) => {
		refreshLabels(undefined, undefined, newLevel, undefined);
	});
}

main();
