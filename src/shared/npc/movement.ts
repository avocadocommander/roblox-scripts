import { PathfindingService } from "@rbxts/services";
import { Pace, RouteConfig } from "../npc-manager";
import type { NPC, NPCStateKeys } from "./main";

// We'll pass setState as a parameter to avoid circular dependencies
function getHumanoidPace(pace: Pace | undefined): number {
	const paceSpeedMap: Record<Pace, number> = {
		Stationary: 5,
		Slow: math.random(3, 4),
		Medium: math.random(5, 6),
		Fast: math.random(7, 8),
	};

	if (!pace) {
		return paceSpeedMap["Medium"];
	}
	return pace ? paceSpeedMap[pace] : paceSpeedMap["Medium"];
}

async function assignNpcToRoute(
	npc: NPC,
	routePoints: BasePart[],
	routeConfig: RouteConfig | undefined,
	setState: (state: NPCStateKeys, npc: NPC) => void,
) {
	let routeActiveIndex = 0;

	while (npc && npc.model.Parent) {
		const activeRoutePoint = routePoints[routeActiveIndex];
		const lookAtDirrection: Attachment | undefined = activeRoutePoint.FindFirstChild("Look") as Attachment;
		const npcHumanoidRootPart: BasePart = npc.model.FindFirstChild("HumanoidRootPart") as BasePart;

		if (!npcHumanoidRootPart) break;

		await navigate(activeRoutePoint.Position, npc, setState);

		if (lookAtDirrection) {
			const look = CFrame.lookAt(npcHumanoidRootPart.Position, lookAtDirrection.WorldPosition);
			npcHumanoidRootPart.CFrame = look;
		}

		await Promise.delay(routeConfig?.tempo ?? math.random(2, 10));
		if (routeActiveIndex >= routePoints.size() - 1) {
			routeActiveIndex = 0;
		} else {
			routeActiveIndex++;
		}
	}
}

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
