import { Players, ReplicatedStorage, Workspace, DataStoreService } from "@rbxts/services";
import { log } from "shared/helpers";
import { getPlaceCampfireRemote, getCampfireRemovedRemote } from "shared/remotes/campfire-remote";

// Track each player's campfire location
const playerCampfires = new Map<Player, { campfire: Model; position: Vector3 }>();

const placeCampfireRemote = getPlaceCampfireRemote();
const campfireRemovedRemote = getCampfireRemovedRemote();

// DataStore for persistence
const dataStore = DataStoreService.GetDataStore("PlayerCampfires");

export function initializeCampfireSystem() {
	placeCampfireRemote.OnServerEvent.Connect((player: Player, ...args: unknown[]) => {
		const position = args[0] as Vector3;
		placePlayerCampfire(player, position);
	});

	// Clean up campfire when player leaves
	Players.PlayerRemoving.Connect((player: Player) => {
		const campfireData = playerCampfires.get(player);
		if (campfireData) {
			campfireData.campfire.Destroy();
			playerCampfires.delete(player);
		}
	});
}

function placePlayerCampfire(player: Player, position: Vector3): void {
	spawnCampfireModel(player, position);

	// Persist to DataStore
	task.spawn(() => {
		const [success] = pcall(() => {
			dataStore.SetAsync(tostring(player.UserId), {
				x: position.X,
				y: position.Y,
				z: position.Z,
				timestamp: os.time(),
			});
		});
		if (!success) {
			log(`[CAMPFIRE] Failed to save campfire for ${player.Name} to DataStore`, "ERROR");
		}
	});
}

/**
 * Get the respawn position for a player.
 * Returns their campfire location if set, otherwise undefined.
 */
export function getPlayerCampfirePosition(player: Player): Vector3 | undefined {
	const data = playerCampfires.get(player);
	return data?.position;
}

/**
 * Called when player respawns to move them to their campfire location.
 */
export function respawnPlayerAtCampfire(player: Player): boolean {
	const campfirePos = getPlayerCampfirePosition(player);
	if (!campfirePos || !player.Character) return false;

	const humanoidRootPart = player.Character.PrimaryPart || player.Character.FindFirstChild("HumanoidRootPart");
	if (!humanoidRootPart) return false;

	(humanoidRootPart as BasePart).CFrame = new CFrame(campfirePos).add(new Vector3(0, 3, 0)); // Spawn above campfire
	return true;
}

/**
 * Load a player's saved campfire from DataStore and create it in the world.
 * Runs asynchronously via task.spawn. onLoaded is called (on the same thread)
 * when the DataStore request completes — whether or not data was found.
 */
export function loadPlayerCampfireFromStorage(player: Player, onLoaded?: () => void): void {
	task.spawn(() => {
		const [success, raw] = pcall(() => {
			const [value] = dataStore.GetAsync(tostring(player.UserId));
			return value as { x: number; y: number; z: number; timestamp: number } | undefined;
		});
		const data = success ? (raw as { x: number; y: number; z: number; timestamp: number } | undefined) : undefined;

		if (!success) {
			log(`[CAMPFIRE] Failed to load campfire for ${player.Name} from DataStore`, "ERROR");
		} else if (data) {
			const position = new Vector3(data.x, data.y, data.z);
			log(`[CAMPFIRE] Loading saved campfire for ${player.Name} at ${position.X}, ${position.Y}, ${position.Z}`);
			spawnCampfireModel(player, position);
		}

		// Always signal ready so the caller can proceed (load character, etc.)
		if (onLoaded) onLoaded();
	});
}

function spawnCampfireModel(player: Player, position: Vector3): void {
	// Remove any existing campfire for this player
	const oldData = playerCampfires.get(player);
	if (oldData) {
		oldData.campfire.Destroy();
	}

	const campfireTemplate = ReplicatedStorage.FindFirstChild("Campfire") as Model | undefined;
	if (!campfireTemplate) {
		log(`[CAMPFIRE] Campfire template not found in ReplicatedStorage for ${player.Name}`, "ERROR");
		return;
	}

	const campfire = campfireTemplate.Clone();
	campfire.Name = `Campfire_${player.Name}`;
	campfire.Parent = Workspace;

	if (campfire.PrimaryPart) {
		campfire.PivotTo(new CFrame(position));
	} else {
		const firstPart = campfire.GetDescendants().find((d): d is BasePart => d.IsA("BasePart"));
		if (firstPart) {
			firstPart.Position = position;
		}
	}

	playerCampfires.set(player, { campfire, position });

	// Broadcast to all currently connected clients so they see the campfire label/effect
	for (const otherPlayer of Players.GetPlayers()) {
		placeCampfireRemote.FireClient(otherPlayer, player.Name, position);
	}
}
