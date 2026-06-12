/**
 * One-shot sound effects.
 *
 * Runtime code references these by SoundEffectId so asset IDs stay in one
 * config-first home. Effects are client-played and never looped.
 */

export type SoundEffectId =
	| "killDagger"
	| "killWarhammer"
	| "consumeElixir"
	| "consumePoison"
	| "switchWeapon"
	| "bountyTurnIn"
	| "shopPurchase"
	| "developerProductPurchase"
	| "gamePassPurchase"
	| "inspect"
	| "dropRune";

export interface SoundEffectDef {
	soundId: string;
	/** 0 to 1. Default 0.6 */
	volume?: number;
	/** Playback speed multiplier. Default 1 */
	playbackSpeed?: number;
}

export const SOUND_EFFECTS: Record<SoundEffectId, SoundEffectDef> = {
	killDagger: { soundId: "rbxassetid://126189313055322", volume: 0.75 },
	killWarhammer: { soundId: "rbxassetid://137964779511233", volume: 0.8 },
	consumeElixir: { soundId: "rbxassetid://134472706551177", volume: 0.7 },
	consumePoison: { soundId: "rbxassetid://72012232491138", volume: 0.7 },
	switchWeapon: { soundId: "rbxassetid://133331985238497", volume: 0.55 },
	bountyTurnIn: { soundId: "rbxassetid://139603854451378", volume: 0.75 },
	shopPurchase: { soundId: "rbxassetid://133570405319995", volume: 0.65 },
	developerProductPurchase: { soundId: "rbxassetid://136993031050456", volume: 0.7 },
	gamePassPurchase: { soundId: "rbxassetid://115778296381875", volume: 0.7 },
	inspect: { soundId: "rbxassetid://9126264576", volume: 0.55 },
	dropRune: { soundId: "rbxassetid://9120941984", volume: 0.7 },
};

export const WEAPON_KILL_SOUND_EFFECTS: Record<string, SoundEffectId> = {
	dagger: "killDagger",
	warhammer: "killWarhammer",
};
