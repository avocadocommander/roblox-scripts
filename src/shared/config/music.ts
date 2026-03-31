/**
 * Music Playlist — data-only config.
 *
 * Songs play globally (not positional) and rotate in order.
 * To add a new song, just add an entry to `MUSIC_PLAYLIST`.
 */

export interface MusicTrackDef {
	/** Display name (for logging / future UI). */
	name: string;
	/** Roblox sound asset ID, e.g. "rbxassetid://123456789" */
	soundId: string;
	/** 0 to 1. Default 0.3 */
	volume?: number;
	/** Playback speed multiplier. Default 1 */
	playbackSpeed?: number;
}

export const MUSIC_PLAYLIST: MusicTrackDef[] = [
	// Add your tracks here, they will rotate in order:
	// { name: "Dark Tavern",    soundId: "rbxassetid://123456789", volume: 0.25 },
	// { name: "Eerie Overture", soundId: "rbxassetid://987654321", volume: 0.3 },
	{ name: "midevil romcom", soundId: "rbxassetid://137906766155111", playbackSpeed: 0.82, volume: 0.48 },
];

/** Whether to shuffle the playlist instead of playing in order. Default false. */
export const MUSIC_SHUFFLE = false;

/** Volume fade duration in seconds when transitioning between tracks. */
export const MUSIC_FADE_TIME = 2;
