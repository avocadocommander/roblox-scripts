/**
 * Lighting configuration -- world-wide time of day and ambient tone.
 *
 * Single source of truth for the server's `Lighting` settings on boot.
 * Adjust these values to retune the global mood without touching server logic.
 *
 * NOTE: `Lighting.Technology` is read-only at runtime in Roblox. It is
 * pinned to `Future` via `default.project.json` so the place file always
 * has the correct rendering tech on a live server.
 */

export interface LightingConfig {
	/** Master shadow toggle. Required for PointLight / SpotLight shadows. */
	readonly globalShadows: boolean;
	/** ClockTime in 24h hours (0-24). 20.45 == ~8:27 PM (dusk). */
	readonly clockTime: number;
	/** Lighting.Brightness -- overall scene brightness multiplier. */
	readonly brightness: number;
	/** Lighting.Ambient -- indoor ambient colour. */
	readonly ambient: Color3;
	/** Lighting.OutdoorAmbient -- outdoor ambient colour. */
	readonly outdoorAmbient: Color3;
	/** EnvironmentDiffuseScale (0-1). Lower = dynamic lights pop more. */
	readonly environmentDiffuseScale: number;
	/** EnvironmentSpecularScale (0-1). Lower = dynamic lights pop more. */
	readonly environmentSpecularScale: number;
}

export const LIGHTING_CONFIG: LightingConfig = {
	globalShadows: true,
	clockTime: 20.45,
	brightness: 1,
	ambient: Color3.fromRGB(20, 20, 25),
	outdoorAmbient: Color3.fromRGB(30, 30, 40),
	environmentDiffuseScale: 0.25,
	environmentSpecularScale: 0.25,
};
