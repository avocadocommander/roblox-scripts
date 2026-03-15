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
		const lookDir = (args[1] as Vector3 | undefined) ?? new Vector3(0, 0, -1);
		placePlayerCampfire(player, position, lookDir);
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

function placePlayerCampfire(player: Player, position: Vector3, lookDir: Vector3): void {
	spawnCampfireModel(player, position, lookDir);

	// Persist the ground-level position that spawnCampfireModel resolved
	const placed = playerCampfires.get(player);
	const savePos = placed ? placed.position : position;

	task.spawn(() => {
		const [success] = pcall(() => {
			dataStore.SetAsync(tostring(player.UserId), {
				x: savePos.X,
				y: savePos.Y,
				z: savePos.Z,
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

function raycastToGround(origin: Vector3): Vector3 {
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	params.FilterDescendantsInstances = [];

	const result = Workspace.Raycast(origin, new Vector3(0, -500, 0), params);
	if (result) {
		return result.Position;
	}
	// No ground found — just drop it 3 studs below the origin as a fallback
	return origin.sub(new Vector3(0, 3, 0));
}

function spawnCampfireModel(player: Player, position: Vector3, lookDir?: Vector3): void {
	const shouldToss = lookDir !== undefined;
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

	// Ensure PrimaryPart is set so PivotTo anchors correctly.
	if (!campfire.PrimaryPart) {
		const fallback = campfire.GetDescendants().find((d): d is BasePart => d.IsA("BasePart"));
		if (fallback) {
			campfire.PrimaryPart = fallback;
		}
	}

	// Collect all BaseParts in the model
	const allParts: BasePart[] = [];
	for (const desc of campfire.GetDescendants()) {
		if (desc.IsA("BasePart")) {
			allParts.push(desc as BasePart);
		}
	}

	// Weld every part to the PrimaryPart so logs + fire stay together as
	// one rigid body during the toss. WeldConstraints respect physics.
	const root = campfire.PrimaryPart!;
	for (const part of allParts) {
		if (part === root) continue;
		const weld = new Instance("WeldConstraint");
		weld.Part0 = root;
		weld.Part1 = part;
		weld.Parent = root;
	}

	// Orient the model upright, preserving template rotation
	const templatePivot = campfire.GetPivot();
	const uprightRot = templatePivot.sub(templatePivot.Position);

	if (shouldToss) {
		// Spawn at chest height for a natural-looking toss origin
		const spawnPos = position.add(new Vector3(0, 1, 0));
		campfire.PivotTo(new CFrame(spawnPos).mul(uprightRot));

		// Unanchor all parts so physics works during the toss
		for (const part of allParts) {
			part.Anchored = false;
			part.CanCollide = true;
		}

		campfire.Parent = Workspace;

		// Flatten the look vector to the XZ plane so the toss is horizontal
		const flatDir = new Vector3(lookDir!.X, 0, lookDir!.Z).Unit;
		const TOSS_SPEED = 22;
		const TOSS_UP = 18;
		const tossVelocity = flatDir.mul(TOSS_SPEED).add(new Vector3(0, TOSS_UP, 0));

		// Apply velocity to the root part -- welds carry the rest
		root.AssemblyLinearVelocity = tossVelocity;
		// Slight tumble spin for flavour
		root.AssemblyAngularVelocity = new Vector3(
			math.random(-2, 2),
			math.random(-1, 1),
			math.random(-2, 2),
		);

		// Store with initial position -- will be updated when it lands
		playerCampfires.set(player, { campfire, position });

		// Settle: wait for the campfire to land then freeze it
		task.delay(2, () => {
			if (!campfire.Parent) return;

			const landedPos = root.Position;

			for (const part of allParts) {
				if (part.Parent) {
					part.Anchored = true;
					part.AssemblyLinearVelocity = Vector3.zero;
					part.AssemblyAngularVelocity = Vector3.zero;
				}
			}

			playerCampfires.set(player, { campfire, position: landedPos });

			// Re-persist with the final landed position
			task.spawn(() => {
				const [ok] = pcall(() => {
					dataStore.SetAsync(tostring(player.UserId), {
						x: landedPos.X,
						y: landedPos.Y,
						z: landedPos.Z,
						timestamp: os.time(),
					});
				});
				if (!ok) {
					log(`[CAMPFIRE] Failed to persist landed position for ${player.Name}`, "ERROR");
				}
			});

			// Broadcast final position to all clients
			for (const otherPlayer of Players.GetPlayers()) {
				placeCampfireRemote.FireClient(otherPlayer, player.Name, landedPos);
			}
		});
	} else {
		// Loaded from DataStore -- place directly, anchored, no toss
		campfire.PivotTo(new CFrame(position).mul(uprightRot));

		for (const part of allParts) {
			part.Anchored = true;
			part.CanCollide = true;
		}

		campfire.Parent = Workspace;
		playerCampfires.set(player, { campfire, position });

		for (const otherPlayer of Players.GetPlayers()) {
			placeCampfireRemote.FireClient(otherPlayer, player.Name, position);
		}
	}
}
