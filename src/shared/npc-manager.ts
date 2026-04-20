import { CollectionService, Workspace } from "@rbxts/services";
import { bountyService, Bounty } from "./bounty";
import { getActiveNPCNames, log } from "./helpers";
import { Assignment, MEDIEVAL_NPC_NAMES, MEDIEVAL_NPCS } from "./module";
import { NPC, createNPCModelAndGenerateHumanoid } from "./npc/main";

import { getBountyTarget } from "./player-state";

/** A function that plays a visual animation at the moment an NPC dies. */
type DeathEffectFn = (model: Model) => void;

/**
 * A function for a status effect that runs *while* the NPC is still alive.
 * `onDeath` is a DeathEffectFn that must be called once the effect ends
 * so the NPC still receives a proper death animation.
 */
type StatusEffectFn = (model: Model, onDeath: DeathEffectFn) => void;

/**
 * Tracks every NPC model that is currently dying or has a status effect
 * running on it. Once a model is in this set it cannot be targeted again.
 */
const dyingNPCs = new Set<Model>();

/** Returns true if the NPC is alive and not already being killed/poisoned. */
export function isNPCActive(model: Model): boolean {
	return model.Parent !== undefined && !dyingNPCs.has(model);
}

/**
 * Mark an NPC as dying/afflicted so no further effects can be applied.
 * Automatically removes it from the set once the model is destroyed.
 */
export function markNPCDying(model: Model): void {
	dyingNPCs.add(model);
	// Clean up when Roblox removes the model from the DataModel
	model.Destroying.Connect(() => dyingNPCs.delete(model));
}

/**
 * DEATH_EFFECTS — visual animations that play at the exact moment of death.
 * These are responsible for stopping the humanoid, playing their animation,
 * and ultimately destroying the model.
 */
export const DEATH_EFFECTS: Record<string, DeathEffectFn> = {
	/**
	 * DEFAULT: Break joints so the NPC collapses, then destroy after a short wait.
	 */
	DEFAULT: (model: Model) => {
		if (!model.Parent) return;
		markNPCDying(model);

		const humanoid = model.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			humanoid.Health = 0;
		}

		model.GetDescendants().forEach((descendant) => {
			if (descendant.IsA("JointInstance")) {
				descendant.Destroy();
			}
		});

		task.wait(5);
		model.Destroy();
	},

	/**
	 * EVAPORATE: Disable collisions and fade the NPC out gradually, then destroy.
	 */
	EVAPORATE: (model: Model) => {
		if (!model.Parent) return;
		markNPCDying(model);

		const humanoid = model.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			humanoid.Health = 0;
		}

		model.GetDescendants().forEach((descendant) => {
			if (descendant.IsA("BasePart")) {
				(descendant as BasePart).CanCollide = false;
			}
		});

		for (let i = 0; i <= 20; i++) {
			model.GetDescendants().forEach((descendant) => {
				if (descendant.IsA("BasePart")) {
					(descendant as BasePart).Transparency = math.min(1, i / 20);
				}
			});
			task.wait(0.1);
		}

		model.Destroy();
	},

	/**
	 * SMOKE: Spawn a smoke cloud at the root part, then destroy.
	 */
	SMOKE: (model: Model) => {
		if (!model.Parent) return;
		markNPCDying(model);

		const humanoid = model.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			humanoid.Health = 0;
		}

		const rootPart = model.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (rootPart) {
			const smoke = new Instance("Smoke");
			smoke.Parent = rootPart;
			smoke.Opacity = 0.8;
			task.wait(1);
		}

		model.Destroy();
	},

	/**
	 * LEVITATION: Freeze the NPC, tint white/ghostly, float the whole body
	 * upward ~20 studs over 5 seconds, then fade out and destroy.
	 */
	LEVITATION: (model: Model) => {
		if (!model.Parent) return;
		markNPCDying(model);

		const humanoid = model.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			// Keep alive so joints stay intact — just immobilise
			humanoid.PlatformStand = true;
			humanoid.WalkSpeed = 0;
			humanoid.JumpPower = 0;
		}

		// Disable collisions so the body floats through geometry
		model.GetDescendants().forEach((descendant) => {
			if (descendant.IsA("BasePart")) {
				(descendant as BasePart).CanCollide = false;
			}
		});

		// Ghostly white tint + semi-transparent
		model.GetDescendants().forEach((descendant) => {
			if (descendant.IsA("BasePart")) {
				const part = descendant as BasePart;
				part.Color = Color3.fromRGB(240, 240, 255);
				part.Transparency = math.max(part.Transparency, 0.4);
			}
		});

		// Float upward using BodyVelocity on the root part
		const rootPart = model.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (rootPart) {
			// Also keep the root part unanchored so BodyVelocity works
			rootPart.Anchored = false;

			const bv = new Instance("BodyVelocity");
			bv.Velocity = new Vector3(0, 4, 0);
			bv.MaxForce = new Vector3(0, math.huge, 0);
			bv.P = 1250;
			bv.Parent = rootPart;

			// Particle trail — bright white sparkles
			const emitter = new Instance("ParticleEmitter");
			emitter.Parent = rootPart;
			emitter.Texture = "rbxasset://textures/particles/sparkles_main.dds";
			emitter.Speed = new NumberRange(1, 3);
			emitter.Lifetime = new NumberRange(1, 2);
			emitter.Size = new NumberSequence(0.4, 0.1);
			emitter.Color = new ColorSequence(Color3.fromRGB(220, 220, 255));
			emitter.Rate = 40;
			emitter.Transparency = new NumberSequence([
				new NumberSequenceKeypoint(0, 0.3),
				new NumberSequenceKeypoint(1, 1),
			]);
		}

		// Float for 5 seconds, then fade out and destroy
		task.wait(5);

		// Kill humanoid now so it stops any internal updates
		if (humanoid) {
			humanoid.Health = 0;
		}

		// Fade out over 1 second
		for (let i = 0; i <= 10; i++) {
			model.GetDescendants().forEach((descendant) => {
				if (descendant.IsA("BasePart")) {
					(descendant as BasePart).Transparency = math.min(1, i / 10);
				}
			});
			task.wait(0.1);
		}

		model.Destroy();
	},

	/**
	 * SHRINK: Gradually shrink the NPC over 5 seconds, then a small
	 * particle implosion and destroy. Eerie and unsettling.
	 */
	SHRINK: (model: Model) => {
		if (!model.Parent) return;
		markNPCDying(model);

		const humanoid = model.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			humanoid.PlatformStand = true;
			humanoid.WalkSpeed = 0;
			humanoid.JumpPower = 0;
		}

		// Disable collisions so parts don't fight the ground
		model.GetDescendants().forEach((descendant) => {
			if (descendant.IsA("BasePart")) {
				(descendant as BasePart).CanCollide = false;
			}
		});

		const rootPart = model.FindFirstChild("HumanoidRootPart") as BasePart | undefined;

		// Anchor root so model doesn't fall through the floor while shrinking
		if (rootPart) {
			rootPart.Anchored = true;
		}

		// Tint sickly green-yellow to show the curse taking hold
		model.GetDescendants().forEach((descendant) => {
			if (descendant.IsA("BasePart")) {
				(descendant as BasePart).Color = Color3.fromRGB(120, 140, 60);
			}
		});

		// Gradually shrink over 5 seconds (50 steps)
		for (let i = 0; i < 50; i++) {
			const scale = 1 - i / 50;
			model.GetDescendants().forEach((descendant) => {
				if (descendant.IsA("BasePart")) {
					const part = descendant as BasePart;
					part.Size = part.Size.mul(scale > 0.02 ? 0.98 : 0);
					part.Transparency = math.min(1, part.Transparency + 0.008);
				}
			});
			task.wait(0.1);
		}

		// Implosion particle burst
		if (rootPart) {
			const emitter = new Instance("ParticleEmitter");
			emitter.Parent = rootPart;
			emitter.Texture = "rbxasset://textures/particles/sparkles_main.dds";
			emitter.Speed = new NumberRange(8, 14);
			emitter.Lifetime = new NumberRange(0.3, 0.6);
			emitter.Size = new NumberSequence(0.6, 0);
			emitter.Color = new ColorSequence(Color3.fromRGB(100, 120, 50));
			emitter.Rate = 200;
			emitter.SpreadAngle = new Vector2(180, 180);
			emitter.Transparency = new NumberSequence([
				new NumberSequenceKeypoint(0, 0),
				new NumberSequenceKeypoint(1, 1),
			]);
			task.wait(0.4);
			emitter.Rate = 0;
		}

		task.wait(0.5);
		model.Destroy();
	},

	/**
	 * DISMEMBER: Progressively break Motor6D joints so limbs detach one by
	 * one and tumble away under physics. After all joints are severed the
	 * remains fade and are destroyed.
	 */
	DISMEMBER: (model: Model) => {
		if (!model.Parent) return;
		markNPCDying(model);

		const humanoid = model.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			humanoid.PlatformStand = true;
			humanoid.WalkSpeed = 0;
			humanoid.JumpPower = 0;
		}

		// Tint dark crimson to signal the blight spreading
		model.GetDescendants().forEach((descendant) => {
			if (descendant.IsA("BasePart")) {
				(descendant as BasePart).Color = Color3.fromRGB(80, 20, 20);
			}
		});

		// Collect all Motor6D joints for sequential destruction
		const joints: Motor6D[] = [];
		model.GetDescendants().forEach((descendant) => {
			if (descendant.IsA("Motor6D")) {
				joints.push(descendant as Motor6D);
			}
		});

		// Detach joints one at a time with a delay between each
		const delayPerJoint = joints.size() > 0 ? 5 / joints.size() : 1;
		for (const joint of joints) {
			if (!joint.Parent) continue;

			// Unanchor the limb so it falls with physics
			const part1 = joint.Part1;
			if (part1) {
				(part1 as BasePart).CanCollide = true;

				// Small outward impulse so the limb tumbles away
				const impulse = new Instance("BodyVelocity");
				impulse.Velocity = new Vector3(math.random(-4, 4), math.random(2, 6), math.random(-4, 4));
				impulse.MaxForce = new Vector3(math.huge, math.huge, math.huge);
				impulse.P = 1000;
				impulse.Parent = part1;

				// Remove impulse after a short burst
				task.delay(0.3, () => {
					if (impulse.Parent) impulse.Destroy();
				});
			}

			joint.Destroy();
			task.wait(delayPerJoint);
		}

		// Kill humanoid after all joints severed
		if (humanoid) {
			humanoid.Health = 0;
		}

		// Fade remains and destroy
		for (let i = 0; i <= 10; i++) {
			model.GetDescendants().forEach((descendant) => {
				if (descendant.IsA("BasePart")) {
					(descendant as BasePart).Transparency = math.min(1, i / 10);
				}
			});
			task.wait(0.15);
		}

		model.Destroy();
	},

	/**
	 * DIVINE_PULL: A beam of light descends from the sky onto the NPC,
	 * ragdolls it, then rapidly pulls it upward into the heavens.
	 * Faster and more violent than LEVITATION — divine judgement.
	 */
	DIVINE_PULL: (model: Model) => {
		if (!model.Parent) return;
		markNPCDying(model);

		const humanoid = model.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			humanoid.PlatformStand = true;
			humanoid.WalkSpeed = 0;
			humanoid.JumpPower = 0;
		}

		// Disable collisions so the body flies through geometry
		model.GetDescendants().forEach((descendant) => {
			if (descendant.IsA("BasePart")) {
				(descendant as BasePart).CanCollide = false;
			}
		});

		const rootPart = model.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (!rootPart) {
			model.Destroy();
			return;
		}

		// ── Beam from sky ──────────────────────────────────────────────
		// Create a tall glowing beam part from the NPC position upward
		const beamPart = new Instance("Part");
		beamPart.Name = "DivineBeam";
		beamPart.Anchored = true;
		beamPart.CanCollide = false;
		beamPart.Size = new Vector3(5, 200, 5);
		beamPart.CFrame = new CFrame(rootPart.Position.add(new Vector3(0, 100, 0)));
		beamPart.Material = Enum.Material.Neon;
		beamPart.Color = Color3.fromRGB(255, 230, 150);
		beamPart.Transparency = 0.88;
		beamPart.Parent = Workspace;

		// Golden sparkle particles on the beam
		const beamEmitter = new Instance("ParticleEmitter");
		beamEmitter.Parent = beamPart;
		beamEmitter.Texture = "rbxasset://textures/particles/sparkles_main.dds";
		beamEmitter.Speed = new NumberRange(2, 6);
		beamEmitter.Lifetime = new NumberRange(0.5, 1);
		beamEmitter.Size = new NumberSequence(0.6, 0.1);
		beamEmitter.Color = new ColorSequence(Color3.fromRGB(255, 215, 80));
		beamEmitter.Rate = 80;
		beamEmitter.SpreadAngle = new Vector2(15, 15);
		beamEmitter.Transparency = new NumberSequence([
			new NumberSequenceKeypoint(0, 0.2),
			new NumberSequenceKeypoint(1, 1),
		]);

		// Bright sparks on the NPC root
		const npcEmitter = new Instance("ParticleEmitter");
		npcEmitter.Parent = rootPart;
		npcEmitter.Texture = "rbxasset://textures/particles/sparkles_main.dds";
		npcEmitter.Speed = new NumberRange(4, 10);
		npcEmitter.Lifetime = new NumberRange(0.3, 0.8);
		npcEmitter.Size = new NumberSequence(0.5, 0);
		npcEmitter.Color = new ColorSequence(Color3.fromRGB(255, 240, 180));
		npcEmitter.Rate = 120;
		npcEmitter.SpreadAngle = new Vector2(180, 180);
		npcEmitter.Transparency = new NumberSequence([
			new NumberSequenceKeypoint(0, 0),
			new NumberSequenceKeypoint(1, 1),
		]);

		// ── Ragdoll the NPC ────────────────────────────────────────────
		// Break Motor6D joints and replace with BallSocketConstraints
		const descendants = model.GetDescendants();
		for (const desc of descendants) {
			if (desc.IsA("Motor6D")) {
				const part0 = desc.Part0;
				const part1 = desc.Part1;
				if (part0 && part1) {
					const att0 = new Instance("Attachment");
					att0.CFrame = desc.C0;
					att0.Parent = part0;

					const att1 = new Instance("Attachment");
					att1.CFrame = desc.C1;
					att1.Parent = part1;

					const socket = new Instance("BallSocketConstraint");
					socket.Attachment0 = att0;
					socket.Attachment1 = att1;
					socket.Parent = part0;
				}
				desc.Destroy();
			}
		}

		// Tint golden-white to show divine energy
		model.GetDescendants().forEach((descendant) => {
			if (descendant.IsA("BasePart")) {
				const part = descendant as BasePart;
				part.Color = Color3.fromRGB(255, 235, 180);
				part.Transparency = math.max(part.Transparency, 0.2);
			}
		});

		// Brief pause for the beam to register visually
		task.wait(0.4);

		// ── Rapid upward pull ──────────────────────────────────────────
		// Much faster than LEVITATION (velocity 25 vs 4)
		rootPart.Anchored = false;
		const bv = new Instance("BodyVelocity");
		bv.Velocity = new Vector3(0, 25, 0);
		bv.MaxForce = new Vector3(0, math.huge, 0);
		bv.P = 5000;
		bv.Parent = rootPart;

		// Kill humanoid as the body rockets upward
		if (humanoid) {
			humanoid.Health = 0;
		}

		// Fade out rapidly over 2 seconds as the NPC ascends
		for (let i = 0; i <= 20; i++) {
			model.GetDescendants().forEach((descendant) => {
				if (descendant.IsA("BasePart")) {
					(descendant as BasePart).Transparency = math.min(1, i / 20);
				}
			});
			task.wait(0.1);
		}

		// Fade the beam out
		for (let i = 0; i <= 10; i++) {
			beamPart.Transparency = math.min(1, 0.3 + i * 0.07);
			task.wait(0.05);
		}

		beamPart.Destroy();
		model.Destroy();
	},
};

/**
 * STATUS_EFFECTS — effects applied to an NPC *while it is still alive*.
 * These are NOT death animations. They run over a duration and then call
 * `onDeath` to trigger a proper death effect when the effect finally kills
 * the NPC. This means a poisoned NPC will still play a death animation.
 */
export const STATUS_EFFECTS: Record<string, StatusEffectFn> = {
	/**
	 * POISON: Tint the NPC purple and emit particles for 4 seconds.
	 * After the duration, `onDeath` is called so the NPC still receives a
	 * regular death animation (e.g. DEFAULT, SMOKE, EVAPORATE).
	 */
	POISON: (model: Model, onDeath: DeathEffectFn) => {
		if (!isNPCActive(model)) return;
		markNPCDying(model);

		applyPoisonVisuals(model, 4, () => onDeath(model));
	},
};

/** Convenience alias kept for backwards compatibility. */
export const DEATH_TYPES = DEATH_EFFECTS;

/**
 * Apply poison visuals to an NPC (purple tint + particles) for the given
 * duration, then invoke `onComplete`. This does NOT check `isNPCActive` or
 * call `markNPCDying` — the caller is responsible for that.
 *
 * Used by the delivery handler to sequence:
 *   weapon hit-effect → poison visuals → death effect
 */
export function applyPoisonVisuals(model: Model, durationSecs: number, onComplete: () => void): void {
	// Visual: tint the NPC purple and add transparency to show poisoning
	model.GetDescendants().forEach((descendant) => {
		if (descendant.IsA("BasePart")) {
			const part = descendant as BasePart;
			part.Color = Color3.fromRGB(138, 43, 226);
			part.Transparency = math.min(1, (part.Transparency ?? 0) + 0.3);
		}
	});

	// Particle effect while alive
	const rootPart = model.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
	let particle: ParticleEmitter | undefined;
	if (rootPart) {
		particle = new Instance("ParticleEmitter");
		particle.Parent = rootPart;
		particle.Texture = "rbxasset://textures/particles/sparkles_main.dds";
		particle.Speed = new NumberRange(3, 6);
		particle.Lifetime = new NumberRange(1.5, 3);
		particle.Size = new NumberSequence(0.3, 0.1);
		particle.Color = new ColorSequence(Color3.fromRGB(138, 43, 226));
		particle.Rate = 30;
		particle.Transparency = new NumberSequence([
			new NumberSequenceKeypoint(0, 0.5),
			new NumberSequenceKeypoint(1, 1),
		]);
	}

	// Wait for the poison duration, then clean up and hand off
	task.wait(durationSecs);

	if (particle) {
		particle.Rate = 0;
	}

	onComplete();
}

export function assassinateTarget(player: Player, npcTarget: NPC) {
	warn(`${player.Name} wanting to get that ${npcTarget.name}`);
	const currentPlayerbounty: string | undefined = getBountyTarget(player);

	if (npcTarget.name === currentPlayerbounty) {
		warn("Payday bois");
	} else {
		warn("Killing with no means i see");
	}
	setNpcDeath(npcTarget);
}

export function setNpcDeath(npc: NPC, deathEffect: keyof typeof DEATH_EFFECTS = "DEFAULT") {
	if (!isNPCActive(npc.model)) {
		warn(`⚠️ ${npc.name} is already dying, ignoring duplicate kill`);
		return;
	}
	DEATH_EFFECTS[deathEffect](npc.model);
	warn(`💀 ${npc.name} was slain`);
}

/**
 * Apply a status effect to an NPC while it is alive.
 * When the effect expires the NPC will die using the given `deathEffect`.
 *
 * Example: applyStatusEffect(npc, "POISON", "EVAPORATE")
 * → NPC turns purple for 4 s, then evaporates.
 */
export function applyStatusEffect(
	npc: NPC,
	statusEffect: keyof typeof STATUS_EFFECTS,
	deathEffect: keyof typeof DEATH_EFFECTS = "DEFAULT",
) {
	if (!isNPCActive(npc.model)) {
		warn(`⚠️ ${npc.name} is already dying, cannot apply ${statusEffect}`);
		return;
	}
	STATUS_EFFECTS[statusEffect](npc.model, DEATH_EFFECTS[deathEffect]);
	warn(`☠️  ${npc.name} was afflicted with ${statusEffect}`);
}

export function addKillPrompt(npc: NPC) {
	// DEPRECATED: Assassination prompts are now handled by custom client-side UI system
	// See: client/modules/npc-proximity.ts and server/modules/assassination-handler.ts
	return;
}

export type Pace = "Stationary" | "Slow" | "Medium" | "Fast";
export type Position = "Guard" | "Preacher";
export type Tempo = "Chill" | "Hurry" | "Gas";
export type RouteConfig = Partial<RouteConfiguration>;

interface RouteConfiguration {
	pace: Pace;
	position: Position;
	tempo: number;
}

export function getConfigFromRoute(routeConfigParent: Folder): RouteConfig | undefined {
	const routeConfig: RouteConfig = {};
	const configFromPart = routeConfigParent.FindFirstChild("Configuration") as Configuration;
	if (!configFromPart) {
		return undefined;
	}
	const pace = configFromPart.FindFirstChild("Pace") as StringValue;
	if (pace) {
		routeConfig.pace = pace.Value as Pace;
	}
	const npcType = configFromPart.FindFirstChild("NPCType") as StringValue;
	if (npcType) {
		routeConfig.position = npcType.Value as Position;
	}

	const tempo = configFromPart.FindFirstChild("Tempo") as StringValue;
	if (tempo) {
		const tempoMap: Record<Tempo, number> = {
			Chill: math.random(10, 60),
			Hurry: math.random(5, 10),
			Gas: math.random(1, 2),
		};
		routeConfig.tempo = tempoMap[tempo.Value as Tempo];
	}
	return routeConfig;
}


