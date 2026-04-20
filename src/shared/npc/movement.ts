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

/** Brief idle behaviour at a waypoint — multiple organic behaviours. */
function idleFidget(npc: NPC, waitTime: number): void {
	const root = npc.model.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
	if (!root) return;

	const roll = math.random();

	if (roll < 0.30) {
		// ── Look around: two gentle turns ────────────────────────────────
		const angle1 = math.rad((math.random() * 60) - 30);
		const turn1 = root.CFrame.mul(CFrame.Angles(0, angle1, 0));
		const t1 = TweenService.Create(root, new TweenInfo(0.8, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut), {
			CFrame: turn1,
		});
		t1.Play();

		// Second glance after a pause
		task.delay(math.min(waitTime * 0.5, 2.5), () => {
			if (!npc.model.Parent || npc.state !== "IDLE") return;
			const angle2 = math.rad((math.random() * 50) - 25);
			const turn2 = root.CFrame.mul(CFrame.Angles(0, angle2, 0));
			TweenService.Create(root, new TweenInfo(0.7, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut), {
				CFrame: turn2,
			}).Play();
		});
	} else if (roll < 0.50) {
		// ── Weight shift: subtle side-to-side sway ──────────────────────
		const swayAngle = math.rad((math.random() * 3) - 1.5);
		const swayCF = root.CFrame.mul(CFrame.Angles(0, 0, swayAngle));
		const swayInfo = new TweenInfo(1.2, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut);
		const t = TweenService.Create(root, swayInfo, { CFrame: swayCF });
		t.Play();

		// Sway back
		task.delay(1.4, () => {
			if (!npc.model.Parent || npc.state !== "IDLE") return;
			TweenService.Create(root, swayInfo, { CFrame: root.CFrame.mul(CFrame.Angles(0, 0, -swayAngle)) }).Play();
		});
	} else if (roll < 0.65) {
		// ── Small pace: take 1-2 tiny steps in a random direction ───────
		const offset = new Vector3((math.random() * 2) - 1, 0, (math.random() * 2) - 1).Unit;
		const stepTarget = root.Position.add(offset.mul(math.random() + 0.5));
		npc.humanoid.MoveTo(stepTarget);

		// Return to idle look after the micro-step
		task.delay(1.5, () => {
			if (!npc.model.Parent || npc.state !== "IDLE") return;
			const turnBack = math.rad((math.random() * 30) - 15);
			const cf = root.CFrame.mul(CFrame.Angles(0, turnBack, 0));
			TweenService.Create(root, new TweenInfo(0.5, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut), {
				CFrame: cf,
			}).Play();
		});
	} else if (roll < 0.80) {
		// ── Slow head turn to one side ──────────────────────────────────
		const angle = math.rad((math.random() * 40) - 20);
		const turnCF = root.CFrame.mul(CFrame.Angles(0, angle, 0));
		TweenService.Create(root, new TweenInfo(1.0, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut), {
			CFrame: turnCF,
		}).Play();
	}
	// else: just stand still — variety by doing nothing
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
			const stationaryWait = math.random(4, 12);
			idleFidget(npc, stationaryWait);

			if (lookAtDirection) {
				smoothTurn(npc, lookAtDirection.WorldPosition);
			}

			await Promise.delay(stationaryWait);
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

		// Vary wait time at each stop instead of fixed tempo
		const baseTempo = routeConfig?.tempo ?? math.random(3, 10);
		const tempoVariation = baseTempo * 0.3;
		const waitTime = math.max(1, baseTempo + (math.random() * 2 - 1) * tempoVariation);

		idleFidget(npc, waitTime);
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

		setState("WALKING", npc);

		const moveToNextWaypoint = async () => {
			current++;
			if (current >= waypoints.size()) {
				setState("IDLE", npc);
				return;
			}
			const wp = waypoints[current];

			npc.humanoid.MoveTo(wp.Position);
			await new Promise<void>((resolve) => {
				const conn = npc.humanoid.MoveToFinished.Connect((reached) => {
					if (reached) {
						conn.Disconnect();
						resolve();
					} else {
						// Re-issue MoveTo to beat the 8-second timeout
						if (npc.model.Parent) {
							npc.humanoid.MoveTo(wp.Position);
						} else {
							conn.Disconnect();
							resolve();
						}
					}
				});
			});
			await moveToNextWaypoint();
		};
		await moveToNextWaypoint();
	}
}

export { getHumanoidPace, assignNpcToRoute, navigate };
