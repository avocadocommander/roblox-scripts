import { Players, SoundService } from "@rbxts/services";
import { setReadyPlayerStatus } from "./player-state";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";
import { respawnPlayerAtCampfire, loadPlayerCampfireFromStorage } from "./modules/campfire-handler";

const lifecycle = getOrCreateLifecycleRemote();

const DEATH_SOUND_ID = "rbxassetid://136039216366006";
const DEATH_SOUND_VOLUME = 0.8;
const RESPAWN_DELAY = 5;

// Disable climbing, mute default oof, play custom death sound, and handle respawn
Players.PlayerAdded.Connect((player) => {
	let isFirstSpawn = true;

	player.CharacterAdded.Connect((character) => {
		const humanoid = character.WaitForChild("Humanoid") as Humanoid;
		humanoid.SetStateEnabled(Enum.HumanoidStateType.Climbing, false);

		// Remove the default Roblox "oof" / death sound
		const defaultDiedSound = humanoid.FindFirstChild("Died") as Sound | undefined;
		if (defaultDiedSound && defaultDiedSound.IsA("Sound")) {
			defaultDiedSound.Volume = 0;
			defaultDiedSound.Destroy();
		}

		humanoid.Died.Connect(() => {
			// Play custom death sound from the character's position
			const hrp = character.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			if (hrp) {
				const sound = new Instance("Sound");
				sound.SoundId = DEATH_SOUND_ID;
				sound.Volume = DEATH_SOUND_VOLUME;
				sound.RollOffMaxDistance = 100;
				sound.Parent = hrp;
				sound.Play();
				sound.Ended.Connect(() => sound.Destroy());
			}

			// Respawn at the game's default SpawnLocation (not campfire)
			task.delay(RESPAWN_DELAY, () => {
				if (player.Parent !== undefined) {
					player.LoadCharacter();
				}
			});
		});

		isFirstSpawn = false;
	});
});

lifecycle.OnServerEvent.Connect((player, message) => {
	if (message === "ClientReady") {
		// Load saved campfire first (async DataStore), then spawn character only after data is ready
		loadPlayerCampfireFromStorage(player, () => {
			player.LoadCharacter();

			// Give the character a moment to initialise before teleporting
			task.delay(0.5, () => {
				respawnPlayerAtCampfire(player);
			});

			setReadyPlayerStatus(player, true);
			print(`[PLAYER INIT] ${player.DisplayName} initialized / loaded / and ready`);
		});
	}
});

export function initializePlayerNetworkMessage(player: Player) {
	lifecycle.FireClient(player, "InitializePlayer");
}
