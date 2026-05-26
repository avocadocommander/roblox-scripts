/**
 * Lighting configuration -- world-wide time of day and ambient tone.
 *
 * Single source of truth for the server's `Lighting` settings on boot.
 * Adjust these values to retune the global mood without touching server logic.
 */

export interface LightingConfig {
	/** ClockTime in 24h hours (0-24). 20.45 == ~8:27 PM (dusk). */
	readonly clockTime: number;
	/** Lighting.Brightness -- overall scene brightness multiplier. */
	readonly brightness: number;
	/** Lighting.Ambient -- indoor ambient colour. */
	readonly ambient: Color3;
	/** Lighting.OutdoorAmbient -- outdoor ambient colour. */
	readonly outdoorAmbient: Color3;
}

export const LIGHTING_CONFIG: LightingConfig = {
	clockTime: 20.45,
	brightness: 1,
	ambient: Color3.fromRGB(20, 20, 25),
	outdoorAmbient: Color3.fromRGB(30, 30, 40),
};
