/**
 * Music Player — plays global background music from the MUSIC_PLAYLIST config.
 *
 * Tracks play in order (or shuffled) and crossfade between songs.
 * Sound is parented to SoundService so it is non-positional.
 */

import { SoundService, TweenService } from "@rbxts/services";
import { log } from "shared/helpers";
import { MUSIC_PLAYLIST, MUSIC_SHUFFLE, MUSIC_FADE_TIME } from "shared/config/music";
import { onPlayerInitialized } from "../modules/client-init";

const TAG = "[MUSIC]";

function shuffleArray<T>(arr: T[]): T[] {
	const out = [...arr];
	for (let i = out.size() - 1; i > 0; i--) {
		const j = math.random(0, i);
		const tmp = out[i];
		out[i] = out[j];
		out[j] = tmp;
	}
	return out;
}

function fadeIn(sound: Sound, targetVolume: number, duration: number): void {
	sound.Volume = 0;
	sound.Play();
	TweenService.Create(sound, new TweenInfo(duration, Enum.EasingStyle.Linear), { Volume: targetVolume }).Play();
}

function fadeOut(sound: Sound, duration: number): void {
	const tween = TweenService.Create(sound, new TweenInfo(duration, Enum.EasingStyle.Linear), { Volume: 0 });
	tween.Play();
	tween.Completed.Once(() => {
		sound.Stop();
		sound.Destroy();
	});
}

function startMusicLoop(): void {
	if (MUSIC_PLAYLIST.size() === 0) {
		log(`${TAG} No tracks configured -- skipping`);
		return;
	}

	const tracks = MUSIC_SHUFFLE ? shuffleArray(MUSIC_PLAYLIST) : MUSIC_PLAYLIST;
	let index = 0;
	let currentSound: Sound | undefined;

	const playNext = (): void => {
		const track = tracks[index % tracks.size()];
		index++;

		const targetVolume = track.volume ?? 0.3;

		log(`${TAG} Now playing: ${track.name}`);

		const sound = new Instance("Sound");
		sound.Name = `Music_${track.name}`;
		sound.SoundId = track.soundId;
		sound.Looped = false;
		sound.PlaybackSpeed = track.playbackSpeed ?? 1;
		sound.Parent = SoundService;

		// Fade out the previous track if one is playing
		if (currentSound) {
			fadeOut(currentSound, MUSIC_FADE_TIME);
		}

		fadeIn(sound, targetVolume, MUSIC_FADE_TIME);
		currentSound = sound;

		// When the track ends, play the next one
		sound.Ended.Once(() => {
			playNext();
		});
	};

	playNext();
}

onPlayerInitialized(() => {
	startMusicLoop();
});
