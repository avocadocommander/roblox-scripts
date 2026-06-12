import { SoundService } from "@rbxts/services";
import { SOUND_EFFECTS, SoundEffectId } from "shared/config/sound-effects";
import { log } from "shared/helpers";
import { getSoundEffectRemote } from "shared/remotes/sound-effect-remote";

function isSoundEffectId(value: unknown): value is SoundEffectId {
	return typeOf(value) === "string" && SOUND_EFFECTS[value as SoundEffectId] !== undefined;
}

function playOneShot(effectId: SoundEffectId): void {
	const def = SOUND_EFFECTS[effectId];
	const sound = new Instance("Sound");
	sound.Name = "SFX_" + effectId;
	sound.SoundId = def.soundId;
	sound.Volume = def.volume ?? 0.6;
	sound.PlaybackSpeed = def.playbackSpeed ?? 1;
	sound.Looped = false;
	sound.Parent = SoundService;
	sound.Play();
	sound.Ended.Once(() => sound.Destroy());
	task.delay(10, () => {
		if (sound.Parent) sound.Destroy();
	});
}

let initialized = false;

export function initializeSoundEffects(): void {
	if (initialized) return;
	initialized = true;

	getSoundEffectRemote().OnClientEvent.Connect((effectId: unknown) => {
		if (!isSoundEffectId(effectId)) {
			log("[SFX] Unknown sound effect id: " + tostring(effectId), "WARN");
			return;
		}
		playOneShot(effectId);
	});
}
