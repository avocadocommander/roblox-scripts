import { CollectionService, Players, Workspace } from "@rbxts/services";
import { bountyService, Bounty } from "./bounty";
import { getActiveNPCNames, log } from "./helpers";
import { Assignment, MEDIEVAL_NPC_NAMES, MEDIEVAL_NPCS } from "./module";
import { NPC, createNPCModelAndGenerateHumanoid } from "./npc/main";
import { requestAddView, requestRemoveView } from "./player-visiualization";
import { getBountyTarget } from "./player-state";

type DEATH_TYPE = {
	[key: string]: (model: Model) => void;
};

/**
 * Death effects system - easily configurable death animations
 * Each death type can:
 * - Stop NPC movement/humanoid
 * - Apply visual effects (transparency, color, particles, etc.)
 * - Add models/effects to the NPC
 * - Animate the death sequence
 * - Finally destroy the model
 */
export const DEATH_TYPES: DEATH_TYPE = {
	/**
	 * DEFAULT: Drop and collapse (breaks joints, falls, waits, then destroys)
	 */
	DEFAULT: (model: Model) => {
		const humanoid = model.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			humanoid.Health = 0; // Kill the humanoid
		}

		// Break joints to make them collapse
		model.GetDescendants().forEach((descendant) => {
			if (descendant.IsA("JointInstance")) {
				descendant.Destroy();
			}
		});

		task.wait(5);
		model.Destroy();
	},

	/**
	 * EVAPORATE: Fade out silently (stops movement, gradually becomes transparent, then destroys)
	 */
	EVAPORATE: (model: Model) => {
		// Stop the NPC from moving
		const humanoid = model.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			humanoid.Health = 0;
		}

		// Disable collisions
		model.GetDescendants().forEach((descendant) => {
			if (descendant.IsA("BasePart")) {
				(descendant as BasePart).CanCollide = false;
			}
		});

		// Animate evaporation - gradually become transparent
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
	 * SMOKE: Creates smoke effect before destroying (good for poof effects)
	 */
	SMOKE: (model: Model) => {
		// Stop the NPC
		const humanoid = model.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			humanoid.Health = 0;
		}

		// Create smoke effect
		const rootPart = model.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (rootPart) {
			const smoke = new Instance("Smoke");
			smoke.Parent = rootPart;
			smoke.Opacity = 0.8;

			task.wait(1);
		}

		// Destroy
		model.Destroy();
	},

	/**
	 * POISON: Applies poison effect with delayed death (4 second duration)
	 * Creates a visual poisoned effect then slowly kills the NPC
	 */
	POISON: (model: Model) => {
		// Change appearance to indicate poisoning (transparent purple)
		model.GetDescendants().forEach((descendant) => {
			if (descendant.IsA("BasePart")) {
				const part = descendant as BasePart;
				part.Color = Color3.fromRGB(138, 43, 226); // Purple poison color
				part.Transparency = (part.Transparency ?? 0) + 0.3; // Make more transparent
			}
		});

		// Create poison particle effect
		const rootPart = model.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (rootPart) {
			const particle = new Instance("ParticleEmitter");
			particle.Parent = rootPart;
			particle.Texture = "rbxasset://textures/particles/sparkles_main.dds";
			particle.Speed = new NumberRange(3, 6);
			particle.Lifetime = new NumberRange(1.5, 3);
			particle.Size = new NumberSequence(0.3, 0.1); // Much smaller particles
			particle.Color = new ColorSequence(Color3.fromRGB(138, 43, 226));
			particle.Rate = 30;
			particle.Transparency = new NumberSequence([
				new NumberSequenceKeypoint(0, 0.5),
				new NumberSequenceKeypoint(1, 1),
			]);
		}

		// Wait for poison effect duration
		task.wait(4);

		// Then destroy
		model.Destroy();
	},
};

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

export function setNpcDeath(npc: NPC) {
	DEATH_TYPES["DEFAULT"](npc.model);
	warn(`💀 ${npc.name} was slain`);
}

export function addKillPrompt(npc: NPC) {
	// DEPRECATED: Assassination prompts are now handled by custom client-side UI system
	// See: client/modules/npc-proximity.ts and server/modules/assassination-handler.ts
	return;
}

const INSTANCES_FOR_NPC_VISION_TO_IGNORE = new Set<Instance>();

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

export function setupWatcherGaze(npc: NPC, routeData: RouteConfig | undefined) {
	const defaultDetectionRadius = 60;
	const guardDetectionRadius = defaultDetectionRadius * 2;
	const detectionRadius = routeData?.position === "Guard" ? guardDetectionRadius : defaultDetectionRadius;

	const viewAngle = 180;

	const humanoidRootPart = npc.model.FindFirstChild("HumanoidRootPart") as BasePart;
	if (!humanoidRootPart) return;

	const visibilityMap = new Map<Player, boolean>();

	task.spawn(() => {
		while (npc.model.Parent && npc.model.IsDescendantOf(Workspace)) {
			const npcLookDir = humanoidRootPart.CFrame.LookVector;

			for (const player of Players.GetPlayers()) {
				const currentPlayerIsAlreadyVisible: boolean = visibilityMap.get(player) ?? false;

				if (player.Character?.PrimaryPart?.Position) {
					const playerPart = player.Character?.PrimaryPart;

					let attachment1 = playerPart.FindFirstChild("VisionAttachment") as Attachment;
					if (!attachment1) {
						attachment1 = new Instance("Attachment");
						attachment1.Name = "VisionAttachment";
						attachment1.Parent = playerPart;
					}
					let attachment0 = humanoidRootPart.FindFirstChild("VisionAttachment") as Attachment;
					if (!attachment0) {
						attachment0 = new Instance("Attachment");
						attachment0.Name = "VisionAttachment";
						attachment0.Parent = humanoidRootPart;
					}

					const npcPosition = humanoidRootPart.Position;
					const playerPosition = player.Character?.PrimaryPart?.Position;

					const dirrectionToPlayer = playerPosition.sub(npcPosition).Unit;
					const distance = npcPosition.sub(playerPosition).Magnitude;
					const angle = math.acos(dirrectionToPlayer.Dot(npcLookDir)) * (180 / math.pi);

					const inRadius = distance <= detectionRadius / 2;
					const inView = angle <= viewAngle / 2;

					if (inRadius && inView) {
						const ray = createRaycast(npc.model, npcPosition, dirrectionToPlayer, distance);
						if (ray && ray.Instance) {
							const hitModel = ray.Instance.FindFirstAncestorOfClass("Model");
							const isPlayerHit = hitModel === player.Character;

							if (isPlayerHit) {
								if (!currentPlayerIsAlreadyVisible) {
									requestAddView(player, npc.model.Name);
								}
								//DEBUG
								// createVisionBeam(attachment0, attachment1);
								visibilityMap.set(player, true);
							} else {
								requestRemoveView(player, npc.model.Name);
							}
						}
					} else {
						if (currentPlayerIsAlreadyVisible) {
							requestRemoveView(player, npc.model.Name);
							visibilityMap.set(player, false);
						}
					}
				}
			}
			task.wait(0.4);
		}
	});
}

function createRaycast(npc: Model, npcPosition: Vector3, directionToPlayer: Vector3, distance: number) {
	const rayParams = new RaycastParams();
	rayParams.FilterType = Enum.RaycastFilterType.Exclude;
	const ignoreList: (Model | Instance)[] = [npc];
	for (const instanceToIgnore of INSTANCES_FOR_NPC_VISION_TO_IGNORE) {
		ignoreList.push(instanceToIgnore);
	}

	rayParams.FilterDescendantsInstances = ignoreList;
	rayParams.IgnoreWater = true;

	return Workspace.Raycast(npcPosition, directionToPlayer.mul(distance), rayParams);
}

function createVisionBeam(attachment0: Attachment, attachment1: Attachment): void {
	const beam = new Instance("Beam");
	beam.Name = `VisionBeam_${attachment0.Parent?.Name}_to_${attachment1.Parent?.Name}_${math.random()}`;

	beam.Attachment0 = attachment0;
	beam.Attachment1 = attachment1;
	beam.Color = new ColorSequence(Color3.fromHSV(math.random(), 1, 1));
	beam.Width0 = 0.1;
	beam.Width1 = 0.1;
	beam.FaceCamera = true;
	beam.LightInfluence = 0;

	beam.Parent = Workspace;

	task.delay(0.5, () => beam.Destroy());
}
