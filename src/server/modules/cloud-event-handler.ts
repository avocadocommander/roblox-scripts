import { CollectionService, TweenService, Workspace } from "@rbxts/services";
import { log } from "shared/helpers";
import { clearBoardServerEvent, setBoardServerEvent } from "./board-event-bus";
import { getOrCreateLifecycleRemote } from "shared/remotes/lifecycle-remote";
import { getDreamCloudEventRemote } from "shared/remotes/dream-cloud-remote";

interface BeamDefaults {
	enabled: boolean;
	textureSpeed: number;
	textureLength: number;
	width0: number;
	width1: number;
	lightEmission: number;
	lightInfluence: number;
}

interface LightDefaults {
	enabled: boolean;
	color: Color3;
	brightness: number;
	range: number;
}

interface ParticleEmitterDefaults {
	enabled: boolean;
	color: ColorSequence;
	brightness: number;
	rate: number;
	lightEmission: number;
	lightInfluence: number;
}

interface FireDefaults {
	enabled: boolean;
	color: Color3;
	secondaryColor: Color3;
	heat: number;
	size: number;
}

const CLOUD_NAME_TOKENS = ["cloud", "clouds", "dreamcloud", "sky cloud", "skycloud"];
const CLOUD_MARKER_NAMES = ["CloudBeam", "Clouds", "DreamCloud", "DreamCloudBeam"];
const WALL_TORCH_NAME = "Wall Torch";
const FIREFLY_MODEL_NAME = "FireFlys";
const DAWNS_GUIDE_VISUAL_NAME = "ActiveEnchantmentVisual";
const DAWNS_GUIDE_LIGHT_NAME = "DawnsGuideLight";
const SCHEDULE_INTERVAL_SECS = 30 * 60;
const SCHEDULED_EVENT_DURATION_SECS = 4 * 60;
const BOARD_EVENT_KEY = "dream_clouds";
const EFFECT_FADE_SECS = 2;
const EFFECT_FADE_INFO = new TweenInfo(EFFECT_FADE_SECS, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut);
const NORMAL_COLOR = new ColorSequence([
	new ColorSequenceKeypoint(0, Color3.fromRGB(232, 237, 240)),
	new ColorSequenceKeypoint(0.55, Color3.fromRGB(214, 226, 235)),
	new ColorSequenceKeypoint(1, Color3.fromRGB(238, 242, 244)),
]);
const DREAM_COLOR = new ColorSequence([
	new ColorSequenceKeypoint(0, Color3.fromRGB(42, 92, 205)),
	new ColorSequenceKeypoint(0.28, Color3.fromRGB(70, 155, 235)),
	new ColorSequenceKeypoint(0.58, Color3.fromRGB(118, 80, 218)),
	new ColorSequenceKeypoint(0.82, Color3.fromRGB(58, 198, 225)),
	new ColorSequenceKeypoint(1, Color3.fromRGB(94, 112, 226)),
]);
const NORMAL_TRANSPARENCY = new NumberSequence([
	new NumberSequenceKeypoint(0, 0.78),
	new NumberSequenceKeypoint(0.5, 0.62),
	new NumberSequenceKeypoint(1, 0.82),
]);
const DREAM_TRANSPARENCY = new NumberSequence([
	new NumberSequenceKeypoint(0, 0.32),
	new NumberSequenceKeypoint(0.48, 0.16),
	new NumberSequenceKeypoint(1, 0.38),
]);
const MOON_FLAME_COLOR = new ColorSequence([
	new ColorSequenceKeypoint(0, Color3.fromRGB(21, 48, 135)),
	new ColorSequenceKeypoint(0.45, Color3.fromRGB(45, 102, 210)),
	new ColorSequenceKeypoint(1, Color3.fromRGB(120, 164, 255)),
]);
const FIREFLY_DREAM_COLOR = new ColorSequence([
	new ColorSequenceKeypoint(0, Color3.fromRGB(76, 180, 255)),
	new ColorSequenceKeypoint(0.5, Color3.fromRGB(152, 120, 255)),
	new ColorSequenceKeypoint(1, Color3.fromRGB(205, 238, 255)),
]);
const MOON_BLUE_LIGHT = Color3.fromRGB(92, 158, 255);

const beamDefaults = new Map<Beam, BeamDefaults>();
const lightDefaults = new Map<Light, LightDefaults>();
const emitterDefaults = new Map<ParticleEmitter, ParticleEmitterDefaults>();
const fireDefaults = new Map<Fire, FireDefaults>();

let dreamCloudsActive = false;
let initialized = false;
let scheduledEventToken = 0;

function nameLooksCloudy(instance: Instance): boolean {
	const lowerName = instance.Name.lower();
	for (const token of CLOUD_NAME_TOKENS) {
		if (lowerName.find(token, 1, true)[0] !== undefined) return true;
	}
	return false;
}

function hasCloudMarker(instance: Instance): boolean {
	for (const markerName of CLOUD_MARKER_NAMES) {
		if (instance.GetAttribute(markerName) === true || CollectionService.HasTag(instance, markerName)) return true;
	}
	return false;
}

function isCloudBeam(beam: Beam): boolean {
	if (nameLooksCloudy(beam) || hasCloudMarker(beam)) return true;

	let ancestor = beam.Parent;
	while (ancestor !== undefined && ancestor !== Workspace) {
		if (nameLooksCloudy(ancestor) || hasCloudMarker(ancestor)) return true;
		ancestor = ancestor.Parent;
	}

	return false;
}

function rememberBeamDefaults(beam: Beam): BeamDefaults {
	const existing = beamDefaults.get(beam);
	if (existing) return existing;

	const defaults = {
		enabled: beam.Enabled,
		textureSpeed: beam.TextureSpeed,
		textureLength: beam.TextureLength,
		width0: beam.Width0,
		width1: beam.Width1,
		lightEmission: beam.LightEmission,
		lightInfluence: beam.LightInfluence,
	};
	beamDefaults.set(beam, defaults);
	return defaults;
}

function getCloudBeams(): Beam[] {
	const beams = new Array<Beam>();

	for (const descendant of Workspace.GetDescendants()) {
		if (!descendant.IsA("Beam") || !isCloudBeam(descendant)) continue;
		rememberBeamDefaults(descendant);
		beams.push(descendant);
	}

	return beams;
}

function signedSpeed(value: number, fallback: number): number {
	if (math.abs(value) > 0.01) return value;
	return fallback;
}

function isInsideNamedAncestor(instance: Instance, name: string): boolean {
	let current: Instance | undefined = instance;
	while (current !== undefined && current !== Workspace) {
		if (current.Name === name) return true;
		current = current.Parent;
	}
	return false;
}

function rememberLightDefaults(light: Light): LightDefaults {
	const existing = lightDefaults.get(light);
	if (existing) return existing;

	const defaults = {
		enabled: light.Enabled,
		color: light.Color,
		brightness: light.Brightness,
		range: light.IsA("PointLight") || light.IsA("SpotLight") || light.IsA("SurfaceLight") ? light.Range : 0,
	};
	lightDefaults.set(light, defaults);
	return defaults;
}

function rememberEmitterDefaults(emitter: ParticleEmitter): ParticleEmitterDefaults {
	const existing = emitterDefaults.get(emitter);
	if (existing) return existing;

	const defaults = {
		enabled: emitter.Enabled,
		color: emitter.Color,
		brightness: emitter.Brightness,
		rate: emitter.Rate,
		lightEmission: emitter.LightEmission,
		lightInfluence: emitter.LightInfluence,
	};
	emitterDefaults.set(emitter, defaults);
	return defaults;
}

function rememberFireDefaults(fire: Fire): FireDefaults {
	const existing = fireDefaults.get(fire);
	if (existing) return existing;

	const defaults = {
		enabled: fire.Enabled,
		color: fire.Color,
		secondaryColor: fire.SecondaryColor,
		heat: fire.Heat,
		size: fire.Size,
	};
	fireDefaults.set(fire, defaults);
	return defaults;
}

function applyNormalBeam(beam: Beam, defaults: BeamDefaults): void {
	const baseSpeed = signedSpeed(defaults.textureSpeed, 0.18);
	beam.Enabled = true;
	beam.Color = NORMAL_COLOR;
	beam.Transparency = NORMAL_TRANSPARENCY;
	beam.LightEmission = 0.04;
	beam.LightInfluence = math.max(defaults.lightInfluence, 0.75);
	beam.TextureSpeed = baseSpeed * 0.045;
	beam.TextureLength = defaults.textureLength;
	beam.Width0 = defaults.width0 * 0.72;
	beam.Width1 = defaults.width1 * 0.72;
}

function applyDreamBeam(beam: Beam, defaults: BeamDefaults): void {
	const speedSign = signedSpeed(defaults.textureSpeed, 1) < 0 ? -1 : 1;
	const eventSpeed = math.max(math.abs(defaults.textureSpeed) * 0.35, 0.42) * speedSign;
	beam.Enabled = true;
	beam.Color = DREAM_COLOR;
	beam.Transparency = DREAM_TRANSPARENCY;
	beam.LightEmission = 0.24;
	beam.LightInfluence = 0.03;
	beam.TextureSpeed = eventSpeed;
	beam.TextureLength = defaults.textureLength;
	beam.Width0 = defaults.width0 * 1.18;
	beam.Width1 = defaults.width1 * 1.18;
}

function applyDreamTorchLight(light: Light, defaults: LightDefaults): void {
	light.Enabled = true;
	light.Color = MOON_BLUE_LIGHT;
	light.Brightness = math.max(defaults.brightness, 0.8);
	if (light.IsA("PointLight") || light.IsA("SpotLight") || light.IsA("SurfaceLight")) {
		light.Range = math.max(defaults.range, 14);
	}
}

function restoreLight(light: Light, defaults: LightDefaults): void {
	light.Enabled = defaults.enabled;
	light.Color = defaults.color;
	light.Brightness = defaults.brightness;
	if (light.IsA("PointLight") || light.IsA("SpotLight") || light.IsA("SurfaceLight")) {
		light.Range = defaults.range;
	}
}

function applyDreamTorchEmitter(emitter: ParticleEmitter, defaults: ParticleEmitterDefaults): void {
	emitter.Enabled = false;
	emitter.Color = defaults.color;
	emitter.Brightness = 0;
	emitter.Rate = 0;
	emitter.LightEmission = 0;
	emitter.LightInfluence = defaults.lightInfluence;
}

function applyDreamFireflyLight(light: Light, defaults: LightDefaults): void {
	light.Enabled = true;
	light.Color = Color3.fromRGB(92, 180, 255);
	light.Brightness = math.max(defaults.brightness * 2.35, 1.45);
	if (light.IsA("PointLight") || light.IsA("SpotLight") || light.IsA("SurfaceLight")) {
		light.Range = math.max(defaults.range * 1.35, 12);
	}
}

function applyDreamFireflyEmitter(emitter: ParticleEmitter, defaults: ParticleEmitterDefaults): void {
	emitter.Enabled = true;
	emitter.Color = FIREFLY_DREAM_COLOR;
	emitter.Brightness = math.max(defaults.brightness * 2.1, 1.45);
	emitter.Rate = math.max(defaults.rate * 2.5, 18);
	emitter.LightEmission = 0.72;
	emitter.LightInfluence = 0.02;
}

function restoreEmitter(emitter: ParticleEmitter, defaults: ParticleEmitterDefaults): void {
	emitter.Enabled = defaults.enabled;
	emitter.Color = defaults.color;
	emitter.Brightness = defaults.brightness;
	emitter.Rate = defaults.rate;
	emitter.LightEmission = defaults.lightEmission;
	emitter.LightInfluence = defaults.lightInfluence;
}

function applyDreamTorchFire(fire: Fire, defaults: FireDefaults): void {
	fire.Enabled = false;
	fire.Color = defaults.color;
	fire.SecondaryColor = defaults.secondaryColor;
	fire.Heat = 0;
	fire.Size = 0;
}

function restoreFire(fire: Fire, defaults: FireDefaults): void {
	fire.Enabled = defaults.enabled;
	fire.Color = defaults.color;
	fire.SecondaryColor = defaults.secondaryColor;
	fire.Heat = defaults.heat;
	fire.Size = defaults.size;
}

function tweenLight(light: Light, color: Color3, brightness: number, range: number): void {
	TweenService.Create(light, EFFECT_FADE_INFO, {
		Color: color,
		Brightness: brightness,
	}).Play();
	if (light.IsA("PointLight") || light.IsA("SpotLight") || light.IsA("SurfaceLight")) {
		TweenService.Create(light, EFFECT_FADE_INFO, {
			Range: range,
		}).Play();
	}
}

function isDawnsGuideEffect(instance: Instance): boolean {
	return instance.Name === DAWNS_GUIDE_LIGHT_NAME || isInsideNamedAncestor(instance, DAWNS_GUIDE_VISUAL_NAME);
}

function tweenDreamTorchLight(light: Light, defaults: LightDefaults): void {
	light.Enabled = true;
	tweenLight(light, MOON_BLUE_LIGHT, math.max(defaults.brightness, 0.8), math.max(defaults.range, 14));
}

function tweenEmitterOff(emitter: ParticleEmitter, defaults: ParticleEmitterDefaults): void {
	emitter.Enabled = true;
	emitter.Color = defaults.color;
	TweenService.Create(emitter, EFFECT_FADE_INFO, {
		Brightness: 0,
		Rate: 0,
		LightEmission: 0,
		LightInfluence: defaults.lightInfluence,
	}).Play();
	task.delay(EFFECT_FADE_SECS, () => {
		if (emitter.Parent !== undefined) emitter.Enabled = false;
	});
}

function tweenFireOff(fire: Fire, defaults: FireDefaults): void {
	fire.Enabled = true;
	TweenService.Create(fire, EFFECT_FADE_INFO, {
		Color: defaults.color,
		SecondaryColor: defaults.secondaryColor,
		Heat: 0,
		Size: 0,
	}).Play();
	task.delay(EFFECT_FADE_SECS, () => {
		if (fire.Parent !== undefined) fire.Enabled = false;
	});
}

function applyCloudBeamState(isDreaming: boolean): number {
	const beams = getCloudBeams();
	if (beams.size() === 0) {
		warn("[CLOUDS] No Workspace Beam instances found under cloud-named models/folders.");
		return 0;
	}

	for (const beam of beams) {
		const defaults = rememberBeamDefaults(beam);
		if (isDreaming) applyDreamBeam(beam, defaults);
		else applyNormalBeam(beam, defaults);
	}

	return beams.size();
}

function transitionCloudBeamState(isDreaming: boolean): number {
	const beams = getCloudBeams();
	if (beams.size() === 0) {
		warn("[CLOUDS] No Workspace Beam instances found under cloud-named models/folders.");
		return 0;
	}

	for (const beam of beams) {
		const defaults = rememberBeamDefaults(beam);
		const baseSpeed = signedSpeed(defaults.textureSpeed, 0.18);
		const normalLightInfluence = math.max(defaults.lightInfluence, 0.75);
		const normalTargets = {
			LightEmission: 0.04,
			LightInfluence: normalLightInfluence,
			TextureSpeed: baseSpeed * 0.045,
			Width0: defaults.width0 * 0.72,
			Width1: defaults.width1 * 0.72,
		};

		if (isDreaming) {
			const speedSign = signedSpeed(defaults.textureSpeed, 1) < 0 ? -1 : 1;
			const eventSpeed = math.max(math.abs(defaults.textureSpeed) * 0.35, 0.42) * speedSign;
			beam.Enabled = true;
			beam.Color = DREAM_COLOR;
			beam.Transparency = DREAM_TRANSPARENCY;
			beam.LightEmission = normalTargets.LightEmission;
			beam.LightInfluence = normalTargets.LightInfluence;
			beam.TextureSpeed = normalTargets.TextureSpeed;
			beam.Width0 = normalTargets.Width0;
			beam.Width1 = normalTargets.Width1;
			TweenService.Create(beam, EFFECT_FADE_INFO, {
				LightEmission: 0.24,
				LightInfluence: 0.03,
				TextureSpeed: eventSpeed,
				Width0: defaults.width0 * 1.18,
				Width1: defaults.width1 * 1.18,
			}).Play();
		} else {
			TweenService.Create(beam, EFFECT_FADE_INFO, normalTargets).Play();
			task.delay(EFFECT_FADE_SECS, () => {
				if (beam.Parent !== undefined) applyNormalBeam(beam, defaults);
			});
		}
	}

	return beams.size();
}

function applyDreamEnvironmentState(isDreaming: boolean): { torches: number; fireflies: number; dawnsGuides: number } {
	let torches = 0;
	let fireflies = 0;
	let dawnsGuides = 0;

	for (const descendant of Workspace.GetDescendants()) {
		const inTorch = isInsideNamedAncestor(descendant, WALL_TORCH_NAME);
		const inFireflies = isInsideNamedAncestor(descendant, FIREFLY_MODEL_NAME);
		const inDawnsGuide = isDawnsGuideEffect(descendant);
		if (!inTorch && !inFireflies && !inDawnsGuide) continue;

		if (descendant.IsA("Light")) {
			const defaults = rememberLightDefaults(descendant);
			if (isDreaming) {
				if (inTorch || inDawnsGuide) applyDreamTorchLight(descendant, defaults);
				if (inFireflies) applyDreamFireflyLight(descendant, defaults);
			} else {
				restoreLight(descendant, defaults);
			}
			if (inTorch) torches++;
			if (inFireflies) fireflies++;
			if (inDawnsGuide) dawnsGuides++;
			continue;
		}

		if (descendant.IsA("ParticleEmitter")) {
			const defaults = rememberEmitterDefaults(descendant);
			if (isDreaming) {
				if (inTorch || inDawnsGuide) applyDreamTorchEmitter(descendant, defaults);
				if (inFireflies) applyDreamFireflyEmitter(descendant, defaults);
			} else {
				restoreEmitter(descendant, defaults);
			}
			if (inTorch) torches++;
			if (inFireflies) fireflies++;
			if (inDawnsGuide) dawnsGuides++;
			continue;
		}

		if (descendant.IsA("Fire") && inTorch) {
			const defaults = rememberFireDefaults(descendant);
			if (isDreaming) applyDreamTorchFire(descendant, defaults);
			else restoreFire(descendant, defaults);
			torches++;
		}
	}

	return { torches, fireflies, dawnsGuides };
}

function transitionDreamEnvironmentState(isDreaming: boolean): { torches: number; fireflies: number; dawnsGuides: number } {
	let torches = 0;
	let fireflies = 0;
	let dawnsGuides = 0;

	for (const descendant of Workspace.GetDescendants()) {
		const inTorch = isInsideNamedAncestor(descendant, WALL_TORCH_NAME);
		const inFireflies = isInsideNamedAncestor(descendant, FIREFLY_MODEL_NAME);
		const inDawnsGuide = isDawnsGuideEffect(descendant);
		if (!inTorch && !inFireflies && !inDawnsGuide) continue;

		if (descendant.IsA("Light")) {
			const defaults = rememberLightDefaults(descendant);
			descendant.Enabled = true;
			if (isDreaming) {
				if (inTorch) {
					tweenDreamTorchLight(descendant, defaults);
				}
				if (inDawnsGuide) {
					tweenDreamTorchLight(descendant, defaults);
				}
				if (inFireflies) {
					tweenLight(
						descendant,
						Color3.fromRGB(92, 180, 255),
						math.max(defaults.brightness * 2.35, 1.45),
						math.max(defaults.range * 1.35, 12),
					);
				}
			} else {
				tweenLight(descendant, defaults.color, defaults.brightness, defaults.range);
				task.delay(EFFECT_FADE_SECS, () => {
					if (descendant.Parent !== undefined) restoreLight(descendant, defaults);
				});
			}
			if (inTorch) torches++;
			if (inFireflies) fireflies++;
			if (inDawnsGuide) dawnsGuides++;
			continue;
		}

		if (descendant.IsA("ParticleEmitter")) {
			const defaults = rememberEmitterDefaults(descendant);
			descendant.Enabled = true;
			if (isDreaming) {
				if (inTorch) {
					tweenEmitterOff(descendant, defaults);
				}
				if (inDawnsGuide) {
					tweenEmitterOff(descendant, defaults);
				}
				if (inFireflies) {
					descendant.Color = FIREFLY_DREAM_COLOR;
					TweenService.Create(descendant, EFFECT_FADE_INFO, {
						Brightness: math.max(defaults.brightness * 2.1, 1.45),
						Rate: math.max(defaults.rate * 2.5, 18),
						LightEmission: 0.72,
						LightInfluence: 0.02,
					}).Play();
				}
			} else {
				descendant.Color = defaults.color;
				TweenService.Create(descendant, EFFECT_FADE_INFO, {
					Brightness: defaults.brightness,
					Rate: defaults.rate,
					LightEmission: defaults.lightEmission,
					LightInfluence: defaults.lightInfluence,
				}).Play();
				task.delay(EFFECT_FADE_SECS, () => {
					if (descendant.Parent !== undefined) restoreEmitter(descendant, defaults);
				});
			}
			if (inTorch) torches++;
			if (inFireflies) fireflies++;
			if (inDawnsGuide) dawnsGuides++;
			continue;
		}

		if (descendant.IsA("Fire") && inTorch) {
			const defaults = rememberFireDefaults(descendant);
			descendant.Enabled = true;
			if (isDreaming) {
				tweenFireOff(descendant, defaults);
			} else {
				TweenService.Create(descendant, EFFECT_FADE_INFO, {
					Color: defaults.color,
					SecondaryColor: defaults.secondaryColor,
					Heat: defaults.heat,
					Size: defaults.size,
				}).Play();
				task.delay(EFFECT_FADE_SECS, () => {
					if (descendant.Parent !== undefined) restoreFire(descendant, defaults);
				});
			}
			torches++;
		}
	}

	return { torches, fireflies, dawnsGuides };
}

export function startDreamCloudEvent(): string {
	if (dreamCloudsActive) return "Dream cloud event already active";
	dreamCloudsActive = true;
	const beamCount = transitionCloudBeamState(true);
	const envCount = transitionDreamEnvironmentState(true);
	setBoardServerEvent(BOARD_EVENT_KEY, "Dream clouds are racing overhead.");
	getDreamCloudEventRemote().FireAllClients(true);
	return `Dream cloud event started (${beamCount} beams, ${envCount.torches} torch effects, ${envCount.fireflies} firefly effects, ${envCount.dawnsGuides} Dawn's Guide effects)`;
}

export function stopDreamCloudEvent(): string {
	if (!dreamCloudsActive) return "Dream cloud event is not active";
	scheduledEventToken++;
	dreamCloudsActive = false;
	const beamCount = transitionCloudBeamState(false);
	const envCount = transitionDreamEnvironmentState(false);
	clearBoardServerEvent(BOARD_EVENT_KEY);
	getDreamCloudEventRemote().FireAllClients(false);
	return `Dream cloud event stopped (${beamCount} beams, ${envCount.torches} torch effects, ${envCount.fireflies} firefly effects, ${envCount.dawnsGuides} Dawn's Guide effects)`;
}

export function toggleDreamCloudEvent(): string {
	return dreamCloudsActive ? stopDreamCloudEvent() : startDreamCloudEvent();
}

function secondsIntoScheduleWindow(): number {
	return os.time() % SCHEDULE_INTERVAL_SECS;
}

function secondsUntilNextScheduledStart(): number {
	const elapsed = secondsIntoScheduleWindow();
	return elapsed === 0 ? 0 : SCHEDULE_INTERVAL_SECS - elapsed;
}

function runScheduledDreamCloudEvent(durationSecs: number): void {
	if (dreamCloudsActive) {
		log("[CLOUDS] Scheduled dream cloud event skipped because one is already active");
		return;
	}

	scheduledEventToken++;
	const token = scheduledEventToken;
	const result = startDreamCloudEvent();
	log(`[CLOUDS] Scheduled dream cloud event: ${result}`);

	task.delay(durationSecs, () => {
		if (scheduledEventToken !== token || !dreamCloudsActive) return;
		const stopResult = stopDreamCloudEvent();
		log(`[CLOUDS] Scheduled dream cloud event ended: ${stopResult}`);
	});
}

function startDreamCloudScheduler(): void {
	task.spawn(() => {
		const initialElapsed = secondsIntoScheduleWindow();
		if (initialElapsed < SCHEDULED_EVENT_DURATION_SECS) {
			runScheduledDreamCloudEvent(SCHEDULED_EVENT_DURATION_SECS - initialElapsed);
			task.wait(SCHEDULED_EVENT_DURATION_SECS - initialElapsed + 1);
		}

		while (true) {
			const waitSecs = secondsUntilNextScheduledStart();
			if (waitSecs > 0) task.wait(waitSecs);
			runScheduledDreamCloudEvent(SCHEDULED_EVENT_DURATION_SECS);
			task.wait(SCHEDULED_EVENT_DURATION_SECS + 1);
		}
	});
}

export function initializeCloudEventSystem(): void {
	if (initialized) return;
	initialized = true;
	getDreamCloudEventRemote();

	const beamCount = applyCloudBeamState(false);

	getOrCreateLifecycleRemote().OnServerEvent.Connect((player, message: unknown) => {
		if (message === "ClientReady") {
			getDreamCloudEventRemote().FireClient(player, dreamCloudsActive);
			task.delay(1, () => {
				if (player.Parent !== undefined) {
					getDreamCloudEventRemote().FireClient(player, dreamCloudsActive);
				}
			});
		}
	});

	Workspace.DescendantAdded.Connect((instance) => {
		task.defer(() => {
			if (instance.IsA("Beam") && isCloudBeam(instance)) {
				rememberBeamDefaults(instance);
				if (dreamCloudsActive) applyDreamBeam(instance, rememberBeamDefaults(instance));
				else applyNormalBeam(instance, rememberBeamDefaults(instance));
			}

			if (!dreamCloudsActive) return;
			const inTorch = isInsideNamedAncestor(instance, WALL_TORCH_NAME);
			const inFireflies = isInsideNamedAncestor(instance, FIREFLY_MODEL_NAME);
			const inDawnsGuide = isDawnsGuideEffect(instance);
			if (!inTorch && !inFireflies && !inDawnsGuide) return;

			if (instance.IsA("Light")) {
				const defaults = rememberLightDefaults(instance);
				if (inTorch || inDawnsGuide) applyDreamTorchLight(instance, defaults);
				if (inFireflies) applyDreamFireflyLight(instance, defaults);
			} else if (instance.IsA("ParticleEmitter")) {
				const defaults = rememberEmitterDefaults(instance);
				if (inTorch || inDawnsGuide) applyDreamTorchEmitter(instance, defaults);
				if (inFireflies) applyDreamFireflyEmitter(instance, defaults);
			} else if (instance.IsA("Fire") && inTorch) {
				applyDreamTorchFire(instance, rememberFireDefaults(instance));
			}
		});
	});

	startDreamCloudScheduler();

	log(`[CLOUDS] Cloud beam controller initialized (${beamCount} beams); scheduled every 30 minutes for 4 minutes`);
}
