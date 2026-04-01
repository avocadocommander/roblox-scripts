/**
 * Map Locations — data-only config.
 *
 * Defines named areas of the map with ambient sounds, lights, and particles.
 * To add a new location, just add an entry to `MAP_LOCATIONS`.
 * The client environment script reads this and creates all instances at runtime.
 *
 * Sounds use RollOffMode.InverseTapered so they fade naturally with distance.
 * Each location can have multiple sounds layered together.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AmbientSoundDef {
	/** Roblox sound asset ID, e.g. "rbxassetid://123456789" */
	soundId: string;
	/** 0 to 1. Default 0.5 */
	volume?: number;
	/** Default true */
	looped?: boolean;
	/** Min distance (studs) before rolloff starts. Default 10 */
	rollOffMin?: number;
	/** Max distance (studs) where sound is silent. Default 80 */
	rollOffMax?: number;
	/** Playback speed multiplier. Default 1 */
	playbackSpeed?: number;
}

export interface PointLightDef {
	/** RGB 0-255 */
	color: [number, number, number];
	/** Default 1 */
	brightness?: number;
	/** Range in studs. Default 20 */
	range?: number;
	/** Enable shadows. Default false */
	shadows?: boolean;
}

export interface FireDef {
	/** Default 5 */
	heat?: number;
	/** Default new Color3(1, 0.6, 0) */
	color?: [number, number, number];
	/** Default 5 */
	size?: number;
	/** Secondary (top) colour RGB 0-255 */
	secondaryColor?: [number, number, number];
}

export interface SmokeDef {
	/** Default 0.5 */
	opacity?: number;
	/** Default Color3(0.4, 0.4, 0.4) */
	color?: [number, number, number];
	/** Default 1 */
	riseVelocity?: number;
	/** Default 5 */
	size?: number;
}

export interface SparklesDef {
	/** RGB 0-255. Default (255, 255, 200) */
	sparkleColor?: [number, number, number];
}

export interface MapLocationDef {
	/** Human-readable name for this location/zone. */
	name: string;
	/** World position [x, y, z]. */
	position: [number, number, number];
	/** Ambient sounds placed at this position. */
	sounds?: AmbientSoundDef[];
	/** Point lights placed at this position. */
	lights?: PointLightDef[];
	/** Fire effects placed at this position. */
	fires?: FireDef[];
	/** Smoke effects placed at this position. */
	smokes?: SmokeDef[];
	/** Sparkle effects placed at this position. */
	sparkles?: SparklesDef[];
}

// ── The Registry ──────────────────────────────────────────────────────────────

export const MAP_LOCATIONS: MapLocationDef[] = [
	{
		name: "Ominous Tower",
		position: [-81, 48.543, 97],
		sounds: [{ soundId: "rbxassetid://132265189523208", volume: 0.3, rollOffMax: 60 }],
		lights: [{ color: [255, 180, 80], brightness: 0.1, range: 30 }],
	},
	{
		name: "Tavern talking",
		position: [-77.791, 9.858, -20.077],
		sounds: [{ soundId: "rbxassetid://926658585", volume: 0.6, rollOffMax: 100 }],
		lights: [{ color: [255, 180, 80], brightness: 0.1, range: 30 }],
	},
	{
		name: "Tavern Jig",
		position: [-77.791, 9.858, -20.077],
		sounds: [{ soundId: "rbxassetid://88538249467439", volume: 0.3, rollOffMax: 80 }],
		lights: [{ color: [255, 180, 80], brightness: 0.1, range: 30 }],
	},

	{
		name: "Church",
		position: [60.983, 10.697, -199.166],
		sounds: [{ soundId: "rbxassetid://1835519286", volume: 0.5, rollOffMax: 80 }],
		lights: [{ color: [255, 180, 80], brightness: 0.5, range: 30 }],
	},
	// ── Example: Town Square ──────────────────────────────────────────────
	// {
	//     name: "Town Square",
	//     position: [0, 5, 0],
	//     sounds: [
	//         { soundId: "rbxassetid://123456789", volume: 0.3, rollOffMax: 120 },
	//     ],
	//     lights: [
	//         { color: [255, 180, 80], brightness: 0.8, range: 30 },
	//     ],
	// },
	// ── Example: Tavern ───────────────────────────────────────────────────
	// {
	//     name: "Tavern",
	//     position: [50, 3, -20],
	//     sounds: [
	//         { soundId: "rbxassetid://111111111", volume: 0.4, rollOffMin: 5, rollOffMax: 60 },
	//         { soundId: "rbxassetid://222222222", volume: 0.2, rollOffMax: 40 },
	//     ],
	//     fires: [
	//         { heat: 8, size: 4, color: [255, 120, 0] },
	//     ],
	//     lights: [
	//         { color: [255, 160, 60], brightness: 1.2, range: 25 },
	//     ],
	// },
	// ── Example: Dark Alley ───────────────────────────────────────────────
	// {
	//     name: "Dark Alley",
	//     position: [-30, 2, 15],
	//     sounds: [
	//         { soundId: "rbxassetid://333333333", volume: 0.15, rollOffMax: 50 },
	//     ],
	//     smokes: [
	//         { opacity: 0.3, riseVelocity: 0.5, size: 8, color: [60, 60, 70] },
	//     ],
	// },
	// ── Example: Fae Grove ────────────────────────────────────────────────
	// {
	//     name: "Fae Grove",
	//     position: [100, 5, 80],
	//     sounds: [
	//         { soundId: "rbxassetid://444444444", volume: 0.25, rollOffMax: 100 },
	//     ],
	//     sparkles: [
	//         { sparkleColor: [200, 255, 180] },
	//     ],
	//     lights: [
	//         { color: [150, 255, 180], brightness: 0.5, range: 40, shadows: false },
	//     ],
	// },
];
