import { Players, ReplicatedStorage, UserInputService } from "@rbxts/services";

const playerStateFolder = ((): Folder => {
	const root = (ReplicatedStorage.FindFirstChild("PlayerState") as Folder) ?? new Instance("Folder");
	root.Name = "PlayerState";
	root.Parent = ReplicatedStorage;
	return root;
})();

const GetExpierence = ((): RemoteFunction => {
	const rf = (playerStateFolder.FindFirstChild("GetExpierence") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "GetExpierence";
	rf.Parent = playerStateFolder;
	return rf;
})();

const GetTitle = ((): RemoteFunction => {
	const rf = (playerStateFolder.FindFirstChild("GetTitle") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "GetTitle";
	rf.Parent = playerStateFolder;
	return rf;
})();

const GetName = ((): RemoteFunction => {
	const rf = (playerStateFolder.FindFirstChild("GetName") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "GetName";
	rf.Parent = playerStateFolder;
	return rf;
})();

const GetLevel = ((): RemoteFunction => {
	const rf = (playerStateFolder.FindFirstChild("GetLevel") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "GetLevel";
	rf.Parent = playerStateFolder;
	return rf;
})();

const GetCoins = ((): RemoteFunction => {
	const rf = (playerStateFolder.FindFirstChild("GetCoins") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "GetCoins";
	rf.Parent = playerStateFolder;
	return rf;
})();

const ExpierenceUpdated = ((): RemoteEvent => {
	const re = (playerStateFolder.FindFirstChild("ExpierenceUpdated") as RemoteEvent) ?? new Instance("RemoteEvent");
	re.Name = "ExpierenceUpdated";
	re.Parent = playerStateFolder;
	return re;
})();

const LevelUpdated = ((): RemoteEvent => {
	const re = (playerStateFolder.FindFirstChild("LevelUpdated") as RemoteEvent) ?? new Instance("RemoteEvent");
	re.Name = "LevelUpdated";
	re.Parent = playerStateFolder;
	return re;
})();

const CoinsUpdated = ((): RemoteEvent => {
	const re = (playerStateFolder.FindFirstChild("CoinsUpdated") as RemoteEvent) ?? new Instance("RemoteEvent");
	re.Name = "CoinsUpdated";
	re.Parent = playerStateFolder;
	return re;
})();

const RequestAddExpierence = ((): RemoteFunction => {
	const rf =
		(playerStateFolder.FindFirstChild("RequestAddExpierence") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "RequestAddExpierence";
	rf.Parent = playerStateFolder;
	return rf;
})();
const RequestAddLevel = ((): RemoteFunction => {
	const rf =
		(playerStateFolder.FindFirstChild("RequestAddLevel") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "RequestAddLevel";
	rf.Parent = playerStateFolder;
	return rf;
})();
const RequestAddCoins = ((): RemoteFunction => {
	const rf =
		(playerStateFolder.FindFirstChild("RequestAddCoins") as RemoteFunction) ?? new Instance("RemoteFunction");
	rf.Name = "RequestAddCoins";
	rf.Parent = playerStateFolder;
	return rf;
})();

export interface PlayerState {
	expierence: number;
	level: number;
	birth: number;
	coins: number;
	name: string;
	title: string;
}

const DEFAULT_STATE: PlayerState = {
	birth: 0,
	coins: 0,
	expierence: 0,
	level: 1,
	name: "Strider",
	title: "Ranger",
};

const PLAYER_STATES = new Map<Player, PlayerState>();

function getPlayerExpierence(player: Player): number {
	return PLAYER_STATES.get(player)?.expierence ?? DEFAULT_STATE.expierence;
}

function pushExpierenceUpdate(player: Player) {
	ExpierenceUpdated.FireClient(player, getPlayerExpierence(player));
}

function pushLevelUpdate(player: Player) {
	LevelUpdated.FireClient(player, PLAYER_STATES.get(player)?.level ?? DEFAULT_STATE.level);
}

Players.PlayerAdded.Connect(async (player) => {
	PLAYER_STATES.set(player, { ...DEFAULT_STATE, name: player.Name });
});
Players.PlayerRemoving.Connect((player) => {
	// TODO: PUSH UP DIRTY CHANGES FOR PERSISTANCE
	PLAYER_STATES.delete(player);
});

GetExpierence.OnServerInvoke = (player: Player) => {
	return getPlayerExpierence(player);
};

GetName.OnServerInvoke = (player: Player) => {
	return PLAYER_STATES.get(player)?.name ?? DEFAULT_STATE.name;
};
GetLevel.OnServerInvoke = (player: Player) => {
	return PLAYER_STATES.get(player)?.level ?? DEFAULT_STATE.level;
};
GetTitle.OnServerInvoke = (player: Player) => {
	return PLAYER_STATES.get(player)?.title ?? DEFAULT_STATE.title;
};
GetCoins.OnServerInvoke = (player: Player) => {
	return PLAYER_STATES.get(player)?.coins ?? DEFAULT_STATE.coins;
};

RequestAddLevel.OnServerInvoke = (player: Player, ...args: unknown[]) => {
	LevelUpdated.FireClient(player, PLAYER_STATES.get(player)?.level ?? DEFAULT_STATE.level);
};

RequestAddCoins.OnServerInvoke = (player: Player, ...args: unknown[]) => {
	const playerState = PLAYER_STATES.get(player);
	const [coinsToAddFromArgs] = args;
	if (typeOf(coinsToAddFromArgs) !== "number" || !playerState) {
		return false;
	}
	const coinsToAdd = coinsToAddFromArgs as number;
	const currentPlayerCoins: number = playerState?.coins ?? 0;
	const newCoinTotal: number = currentPlayerCoins + coinsToAdd;

	PLAYER_STATES.set(player, { ...playerState, coins: newCoinTotal });

	CoinsUpdated.FireClient(player, PLAYER_STATES.get(player)?.coins ?? DEFAULT_STATE.coins);
};

RequestAddExpierence.OnServerInvoke = (player, ...args: unknown[]) => {
	const playerState = PLAYER_STATES.get(player);
	const expierence = playerState?.expierence ?? DEFAULT_STATE.expierence;
	const [newExpierenceGainedFromArgs] = args;
	if (typeOf(newExpierenceGainedFromArgs) !== "number") {
		return false;
	}
	const newExpierenceGained = newExpierenceGainedFromArgs as number;
	if (playerState === undefined || expierence === undefined || newExpierenceGained === undefined) {
		return false;
	}
	const newExpierenceTotal = expierence + newExpierenceGained;
	PLAYER_STATES.set(player, { ...playerState, expierence: newExpierenceTotal });
	pushExpierenceUpdate(player);

	const playerLevelAccoringToCurrentXP = math.ceil(newExpierenceTotal / 1000);
	if (playerLevelAccoringToCurrentXP !== playerState.level) {
		PLAYER_STATES.set(player, { ...playerState, level: playerLevelAccoringToCurrentXP });
		pushLevelUpdate(player);
	}
	return true;
};
