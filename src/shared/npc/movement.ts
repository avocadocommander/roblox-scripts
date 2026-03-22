import { PathfindingService, TweenService } from "@rbxts/services";
import { Pace, RouteConfig } from "../npc-manager";
import type { NPC, NPCStateKeys } from "./main";
import { makeSeededRandom, getSeedFromName } from "./utils";

// ── Pace → base WalkSpeed ─────────────────────────────────────────────────────

function getHumanoidPace(pace: Pace | undefined): number {
	const paceSpeedMap: Record<Pace, number> = {
		Stationary: 0,
		Slow: math.random(3, 4),
		Medium: math.random(5, 6),
		Fast: math.random(7, 8),
	};

	if (!pace) return paceSpeedMap["Medium"];
	return paceSpeedMap[pace];
}

// ── Natural speed helpers ─────────────────────────────────────────────────────

/** Gently nudge WalkSpeed +-15% each segment for organic movement. */
function varySpeed(humanoid: Humanoid, basePace: number): void {
	const variation = basePace * 0.15;
	const newSpeed = basePace + (math.random() * 2 - 1) * variation;
	humanoid.WalkSpeed = math.max(1, newSpeed);
}

/** Smoothly rotate an NPC to face a world position instead of snapping. */
function smoothTurn(npc: NPC, targetPosition: Vector3): void {
	const root = npc.model.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
	if (!root) return;

	const lookCF = CFrame.lookAt(root.Position, new Vector3(targetPosition.X, root.Position.Y, targetPosition.Z));
	const info = new TweenInfo(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut);
	TweenService.Create(root, info, { CFrame: lookCF }).Play();
}

/** Brief idle behaviour at a waypoint — small random head‑turn or pause. */
function idleFidget(npc: NPC): void {
	const root = npc.model.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
	if (!root) return;

	const roll = math.random();
	if (roll < 0.35) {
		// Slight random turn while idle
		const angle = math.rad((math.random() * 40) - 20);
		const turnCF = root.CFrame.mul(CFrame.Angles(0, angle, 0));
		const info = new TweenInfo(0.6, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut);
		TweenService.Create(root, info, { CFrame: turnCF }).Play();
	}
	// Otherwise: just stand still (natural variation in behaviour)
}

// ── Route loop ────────────────────────────────────────────────────────────────

async function assignNpcToRoute(
	npc: NPC,
	routePoints: BasePart[],
	routeConfig: RouteConfig | undefined,
	setState: (state: NPCStateKeys, npc: NPC) => void,
) {
	let routeActiveIndex = 0;
	const basePace = getHumanoidPace(routeConfig?.pace);
	const isStationary = routeConfig?.pace === "Stationary";

	while (npc && npc.model.Parent) {
		const activeRoutePoint = routePoints[routeActiveIndex];
		const lookAtDirection: Attachment | undefined = activeRoutePoint.FindFirstChild("Look") as Attachment;

		if (isStationary) {
			// ── Stationary NPCs: occasional idle fidget ──────────────────
			setState("IDLE", npc);
			idleFidget(npc);

			if (lookAtDirection) {
				smoothTurn(npc, lookAtDirection.WorldPosition);
			}

			await Promise.delay(math.random(4, 12));
			continue;
		}

		// ── Walking NPCs ─────────────────────────────────────────────────

		// Slight speed variation per segment
		varySpeed(npc.humanoid, basePace);

		await navigate(activeRoutePoint.Position, npc, setState);

		// Arrived — face the look target smoothly
		if (lookAtDirection) {
			smoothTurn(npc, lookAtDirection.WorldPosition);
		}

		// Idle fidget while waiting
		setState("IDLE", npc);
		idleFidget(npc);

		// Vary wait time at each stop instead of fixed tempo
		const baseTempo = routeConfig?.tempo ?? math.random(3, 10);
		const tempoVariation = baseTempo * 0.3;
		const waitTime = math.max(1, baseTempo + (math.random() * 2 - 1) * tempoVariation);
		await Promise.delay(waitTime);

		if (routeActiveIndex >= routePoints.size() - 1) {
			routeActiveIndex = 0;
		} else {
			routeActiveIndex++;
		}
	}
}

// ── Pathfinding ───────────────────────────────────────────────────────────────

async function navigate(
	moveToPosition: Vector3,
	npc: NPC,
	setState: (state: NPCStateKeys, npc: NPC) => void,
): Promise<void> {
	const path = PathfindingService.CreatePath({
		AgentRadius: 2,
		AgentHeight: 5,
		AgentCanJump: true,
		AgentCanClimb: false,
		Costs: {
			Water: 100,
			Carpet: 0,
			Cobblestone: 0,
		},
	});
	path.ComputeAsync(npc.humanoid.RootPart!.Position, moveToPosition);
	if (path.Status === Enum.PathStatus.Success) {
		const waypoints = path.GetWaypoints();
		let current = 0;
		const moveToNextWaypoint = async () => {
			current++;
			if (current >= waypoints.size() - 1) {
				setState("IDLE", npc);
				return;
			}
			const wp = waypoints[current];

			npc.humanoid.MoveTo(wp.Position);
			setState("WALKING", npc);
			await new Promise<void>((resolve) => {
				npc.humanoid.MoveToFinished.Once(() => {
					return resolve();
				});
			});
			await moveToNextWaypoint();
		};
		await moveToNextWaypoint();
	}
}

export { getHumanoidPace, assignNpcToRoute, navigate };
