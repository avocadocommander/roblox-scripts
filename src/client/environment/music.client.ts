/**
 * Music Player — plays global background music from the MUSIC_PLAYLIST config.
 *
 * Tracks play in order (or shuffled) and crossfade between songs.
 * Sound is parented to SoundService so it is non-positional.
 */

import { Players, RunService, SoundService, TweenService } from "@rbxts/services";
import { log } from "shared/helpers";
import { MUSIC_PLAYLIST, MUSIC_SHUFFLE, MUSIC_FADE_TIME } from "shared/config/music";
import { MAP_LOCATIONS } from "shared/config/map-locations";
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
	let currentTargetVolume = 0.3;
	let ducked = false;

	// ── Ducking: lower music when near a map location with ambient sounds ──
	const DUCK_MULTIPLIER = 0.1; // 10% of normal volume when ducked
	const DUCK_TWEEN = new TweenInfo(1.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);

	// Pre-compute which map locations have sounds and their max rolloff
	const soundLocations = MAP_LOCATIONS.filter((loc) => loc.sounds !== undefined && loc.sounds.size() > 0).map(
		(loc) => {
			let maxRollOff = 0;
			for (const s of loc.sounds!) {
				const r = s.rollOffMax ?? 80;
				if (r > maxRollOff) maxRollOff = r;
			}
			return {
				position: new Vector3(loc.position[0], loc.position[1], loc.position[2]),
				range: maxRollOff,
			};
		},
	);

	let checkTimer = 0;
	if (soundLocations.size() > 0) {
		RunService.Heartbeat.Connect((dt) => {
			checkTimer += dt;
			if (checkTimer < 0.5) return; // check twice per second
			checkTimer = 0;

			const char = Players.LocalPlayer.Character;
			if (!char) return;
			const root = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
			if (!root) return;
			const pos = root.Position;

			let nearAmbient = false;
			for (const loc of soundLocations) {
				if (pos.sub(loc.position).Magnitude < loc.range) {
					nearAmbient = true;
					break;
				}
			}

			if (nearAmbient && !ducked) {
				ducked = true;
				if (currentSound && currentSound.IsPlaying) {
					TweenService.Create(currentSound, DUCK_TWEEN, {
						Volume: currentTargetVolume * DUCK_MULTIPLIER,
					}).Play();
				}
			} else if (!nearAmbient && ducked) {
				ducked = false;
				if (currentSound && currentSound.IsPlaying) {
					TweenService.Create(currentSound, DUCK_TWEEN, {
						Volume: currentTargetVolume,
					}).Play();
				}
			}
		});
	}

	const playNext = (): void => {
		const track = tracks[index % tracks.size()];
		index++;

		const targetVolume = track.volume ?? 0.3;
		currentTargetVolume = targetVolume;

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

		// If currently ducked, fade in at the reduced volume
		const startVolume = ducked ? targetVolume * DUCK_MULTIPLIER : targetVolume;
		fadeIn(sound, startVolume, MUSIC_FADE_TIME);
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
