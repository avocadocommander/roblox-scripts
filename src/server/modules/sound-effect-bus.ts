import { SoundEffectId } from "shared/config/sound-effects";
import { getSoundEffectRemote } from "shared/remotes/sound-effect-remote";

const soundEffectRemote = getSoundEffectRemote();

export function playSoundEffect(player: Player, effectId: SoundEffectId): void {
	soundEffectRemote.FireClient(player, effectId);
}

export function initializeSoundEffectBus(): void {
	getSoundEffectRemote();
}
