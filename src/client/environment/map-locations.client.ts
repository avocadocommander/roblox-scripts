/**
 * Map Locations — spawns ambient sounds, lights, fires, smoke, and sparkles
 * from the MAP_LOCATIONS config.  Runs once on player init.
 *
 * Every entry in MAP_LOCATIONS becomes an anchored, invisible Part in Workspace
 * with the configured child instances attached.
 */

import { Workspace } from "@rbxts/services";
import { log } from "shared/helpers";
import { MAP_LOCATIONS, MapLocationDef, AmbientSoundDef } from "shared/config/map-locations";
import { onPlayerInitialized } from "../modules/client-init";

const TAG = "[MAP-LOCATIONS]";

// ── Spawn helpers ─────────────────────────────────────────────────────────────

function createAnchorPart(loc: MapLocationDef): Part {
	const part = new Instance("Part");
	part.Name = `MapLoc_${loc.name}`;
	part.Anchored = true;
	part.CanCollide = false;
	part.CanTouch = false;
	part.CanQuery = false;
	part.Transparency = 1;
	part.Size = new Vector3(1, 1, 1);
	part.Position = new Vector3(loc.position[0], loc.position[1], loc.position[2]);
	part.Parent = Workspace;
	return part;
}

function attachSound(parent: Part, def: AmbientSoundDef, index: number): void {
	const sound = new Instance("Sound");
	sound.Name = `AmbientSound_${index}`;
	sound.SoundId = def.soundId;
	sound.Volume = def.volume ?? 0.5;
	sound.Looped = def.looped ?? true;
	sound.RollOffMinDistance = def.rollOffMin ?? 10;
	sound.RollOffMaxDistance = def.rollOffMax ?? 80;
	sound.RollOffMode = Enum.RollOffMode.InverseTapered;
	sound.PlaybackSpeed = def.playbackSpeed ?? 1;
	sound.Parent = parent;
	sound.Play();
}

function attachLight(
	parent: Part,
	def: { color: [number, number, number]; brightness?: number; range?: number; shadows?: boolean },
): void {
	const light = new Instance("PointLight");
	light.Color = Color3.fromRGB(def.color[0], def.color[1], def.color[2]);
	light.Brightness = def.brightness ?? 1;
	light.Range = def.range ?? 20;
	light.Shadows = def.shadows ?? false;
	light.Parent = parent;
}

function attachFire(
	parent: Part,
	def: {
		heat?: number;
		color?: [number, number, number];
		size?: number;
		secondaryColor?: [number, number, number];
	},
): void {
	const fire = new Instance("Fire");
	fire.Heat = def.heat ?? 5;
	fire.Size = def.size ?? 5;
	if (def.color) fire.Color = Color3.fromRGB(def.color[0], def.color[1], def.color[2]);
	if (def.secondaryColor)
		fire.SecondaryColor = Color3.fromRGB(def.secondaryColor[0], def.secondaryColor[1], def.secondaryColor[2]);
	fire.Parent = parent;
}

function attachSmoke(
	parent: Part,
	def: { opacity?: number; color?: [number, number, number]; riseVelocity?: number; size?: number },
): void {
	const smoke = new Instance("Smoke");
	smoke.Opacity = def.opacity ?? 0.5;
	smoke.RiseVelocity = def.riseVelocity ?? 1;
	smoke.Size = def.size ?? 5;
	if (def.color) smoke.Color = Color3.fromRGB(def.color[0], def.color[1], def.color[2]);
	smoke.Parent = parent;
}

function attachSparkles(parent: Part, def: { sparkleColor?: [number, number, number] }): void {
	const sparkles = new Instance("Sparkles");
	if (def.sparkleColor)
		sparkles.SparkleColor = Color3.fromRGB(def.sparkleColor[0], def.sparkleColor[1], def.sparkleColor[2]);
	sparkles.Parent = parent;
}

// ── Main init ─────────────────────────────────────────────────────────────────

function spawnMapLocations(): void {
	if (MAP_LOCATIONS.size() === 0) {
		log(`${TAG} No map locations configured -- skipping`);
		return;
	}

	log(`${TAG} Spawning ${MAP_LOCATIONS.size()} map location(s)...`);

	for (const loc of MAP_LOCATIONS) {
		const anchor = createAnchorPart(loc);

		if (loc.sounds) {
			for (let i = 0; i < loc.sounds.size(); i++) {
				attachSound(anchor, loc.sounds[i], i);
			}
		}

		if (loc.lights) {
			for (const def of loc.lights) attachLight(anchor, def);
		}

		if (loc.fires) {
			for (const def of loc.fires) attachFire(anchor, def);
		}

		if (loc.smokes) {
			for (const def of loc.smokes) attachSmoke(anchor, def);
		}

		if (loc.sparkles) {
			for (const def of loc.sparkles) attachSparkles(anchor, def);
		}

		log(`${TAG} Spawned: ${loc.name}`);
	}

	log(`${TAG} All map locations spawned`);
}

onPlayerInitialized(() => {
	spawnMapLocations();
});
