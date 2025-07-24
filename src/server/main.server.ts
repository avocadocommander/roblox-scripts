import { ReplicatedStorage, Workspace } from "@rbxts/services";
import { Assignment, isNPCType, MEDIEVAL_NAMES, NPCType, useAssetId } from "shared/module";
import { PlayerDataService } from "shared/common-data-service";
import { defaultPlayerStoreData, PLAYER_STORE_NAME, StoreData } from "./player-store";
import { log } from "shared/helpers";
import { NPC } from "shared/npc";

export const enum AnimationState {
	WALK = "WALK",
	IDLE = "IDLE",
}

export enum NPCState {
	Idle,
	Patrol,
	Alert,
	Talk,
	Stunned,
	Dead,
}

// interface NPC {
// 	model: Model;
// 	name: string;
// 	seed: number;
// 	humanoid?: Humanoid;
// 	animator?: Animator;
// 	stateStack?: NPCState[];
// 	stateTick?: number;
// 	activeTracks?: AnimationTrack[];
// }

function spawnNPC(spawnPoint: BasePart, routePoints: BasePart[], npcType: NPCType): Model | undefined {
	const npcTemplate = ReplicatedStorage.WaitForChild("NPC") as Model;

	const npc = new NPC(npcTemplate.Clone(), MEDIEVAL_NAMES[math.random(0, MEDIEVAL_NAMES.size())], npcType);
	npc.model.PivotTo(new CFrame(spawnPoint.Position));

	if (routePoints) {
		patrol(npc.model, routePoints);
	}
	return npc.model;
}

function patrol(npc: Model, routePoints: BasePart[]) {
	const humanoid = npc.FindFirstChildOfClass("Humanoid");
	if (!humanoid) return;

	const animator = humanoid.FindFirstChildOfClass("Animator") as Animator;

	const walkAnim = new Instance("Animation");
	walkAnim.Name = "Walk";
	walkAnim.AnimationId = useAssetId("133708367021932");

	const idleAnim = new Instance("Animation");
	idleAnim.Name = "Idle";
	idleAnim.AnimationId = useAssetId("507766951");

	const walkTrack = animator.LoadAnimation(walkAnim);
	walkTrack.Priority = Enum.AnimationPriority.Movement;
	walkTrack.Looped = true;

	const idleTrack = animator.LoadAnimation(idleAnim);
	idleTrack.Priority = Enum.AnimationPriority.Movement;
	idleTrack.Looped = true;

	let connected = false;

	if (!connected) {
		connected = true;
		humanoid.StateChanged.Connect((oldState, newState) => {
			print(`${oldState} -> ${newState}`);

			walkTrack.Stop();
			idleTrack.Stop();

			switch (newState) {
				case Enum.HumanoidStateType.Running:
					walkTrack.Play();
					break;
				default:
					idleTrack.Play();
					break;
			}
		});
	}

	let activeRouteIndex = 0;

	const startPatrol = () => {
		if (!npc || !npc.Parent) return;
		humanoid.MoveTo(routePoints[activeRouteIndex].Position);
		humanoid.MoveToFinished.Once(() => {
			if (activeRouteIndex >= routePoints.size() - 1) {
				activeRouteIndex = 0;
				humanoid.Move(Vector3.zero);
				idleTrack.Play();
				task.delay(math.random(0, 10), startPatrol);
			} else {
				activeRouteIndex++;
				startPatrol();
			}
		});
	};

	startPatrol();
}

function changeAnimationState(npc: Model, state: AnimationState) {
	const humanoid = npc.FindFirstChildOfClass("Humanoid");
	if (!humanoid) return;

	switch (state) {
		case AnimationState.WALK: {
			let animator = humanoid.FindFirstChildOfClass("Animator");
			if (!animator) {
				animator = new Instance("Animator");
				animator.Parent = humanoid;
			}
			const walkAnimation = new Instance("Animation");
			walkAnimation.Name = "Walk";
			walkAnimation.AnimationId = useAssetId("133708367021932");

			const track = animator.LoadAnimation(walkAnimation);
			track.Priority = Enum.AnimationPriority.Movement;
			track.Looped = true;
			track.Play();

			break;
		}
		case AnimationState.IDLE: {
			humanoid.ChangeState(Enum.HumanoidStateType.None);

			break;
		}
		default: {
			print("ERROR UNKNOWN ANIMATION STATE");
		}
	}
}

function getNPCSpawnPoints(): BasePart[] {
	const spawnPoints = Workspace.WaitForChild("NPCSpawnPoints")
		.GetChildren()
		.filter((child): child is BasePart => {
			return child.IsA("BasePart") && child.Name === "NPCSpawn";
		});

	if (spawnPoints.size() === 0) {
		warn("⚠️ No spawn points named 'NPCSpawn' found!");
		return [];
	}

	return spawnPoints;
}

function getNPCRoutes(): Folder[] {
	const routes = Workspace.WaitForChild("NPCRoutes")
		.GetChildren()
		.filter((child): child is Folder => {
			return child.IsA("Folder");
		});

	if (routes.size() === 0) {
		warn("⚠️ No Routes found!");
		return [];
	}

	return routes;
}

function getClosestSpawnPointRelativeToRoute(firstRoutePointToCompare: BasePart): BasePart | undefined {
	if (!firstRoutePointToCompare) {
		log("No basepart used as fist index", "ERROR");
		return undefined;
	}
	const spawnPoints = getNPCSpawnPoints();
	let nearestSpawn: BasePart = spawnPoints[0];
	let shortestDistance = math.huge;

	spawnPoints.forEach((spawnPoint: BasePart) => {
		const distance = spawnPoint.Position.sub(firstRoutePointToCompare.Position).Magnitude;
		if (distance < shortestDistance) {
			shortestDistance = distance;
			nearestSpawn = spawnPoint;
		}
	});
	return nearestSpawn;
}

function addTalkPrompt(npc: Model, message: string) {
	const head = npc.FindFirstChild("Head") as BasePart;
	if (!head) return warn("No head for NPC");

	const prompt = new Instance("ProximityPrompt");
	prompt.Name = "TalkPrompt";
	prompt.ObjectText = npc.Name;
	prompt.ActionText = "Talk";
	prompt.KeyboardKeyCode = Enum.KeyCode.E;
	prompt.HoldDuration = 0;
	prompt.RequiresLineOfSight = false;
	prompt.MaxActivationDistance = 10;
	prompt.Parent = head;

	prompt.Triggered.Connect((player) => {
		if (!npc.GetTags().includes("Targeted")) {
			return;
		}
		const store = PlayerDataService.getInstance(PLAYER_STORE_NAME, defaultPlayerStoreData);
		store.updatePlayerData(player, (state: Partial<StoreData>) => {
			const currentTitles = state.eliminations ?? [];
			if (!currentTitles.includes(npc.Name)) {
				return {
					eliminations: [...currentTitles, npc.Name],
				};
			}
			return {};
		});
		//createSpeechBillboard(head, message);
		npc.Destroy();
	});
}

function createSpeechBillboard(head: BasePart, message: string): void {
	const gui = new Instance("BillboardGui");
	gui.Size = new UDim2(0, 200, 0, 50);
	gui.StudsOffset = new Vector3(0, 4, 0);
	gui.Adornee = head;
	gui.AlwaysOnTop = true;
	gui.Name = "SpeechBillboard";

	const label = new Instance("TextLabel");
	label.Size = new UDim2(1, 0, 1, 0);
	label.BackgroundTransparency = 1;
	label.TextScaled = true;
	label.TextColor3 = Color3.fromRGB(255, 255, 255);
	label.Font = Enum.Font.Fantasy;
	label.Text = message;
	label.Parent = gui;

	gui.Parent = head;

	task.delay(3, () => {
		gui.Destroy();
	});
}

function spawnNpcForRoute(npcRoute: Folder, assigned: Map<string, Assignment>): Model | undefined {
	if (!npcRoute) {
		throw "No parent route folder";
	}
	log("Route Names for: " + npcRoute.Name);
	const npcTypeAttribute = npcRoute.GetAttribute("NPCType") as string;
	const isNPC = isNPCType(npcTypeAttribute);
	const npcType: NPCType = isNPC ? npcTypeAttribute : "COMMONER";
	const routePoints = npcRoute.GetChildren().filter((route) => route.Name === "Route") as Part[];
	if (routePoints.size() === 0) {
		throw "No routePoints avaliable under parent route folder";
	}
	const closestSpawnPointRelativeToRoute = getClosestSpawnPointRelativeToRoute(routePoints[0]);
	if (!closestSpawnPointRelativeToRoute) {
		throw "Close spawnpoint not located";
	}
	return spawnNPC(closestSpawnPointRelativeToRoute, routePoints, npcType);
}

function updateAssignments(assigned: Map<string, Assignment>) {
	const npcRoutes: Folder[] = getNPCRoutes();

	npcRoutes.forEach((npcRoute: Folder) => {
		if (!assigned.has(npcRoute.Name)) {
			try {
				const npc = spawnNpcForRoute(npcRoute, assigned);
				if (npc) {
					assigned.set(npcRoute.Name, { npc, route: npcRoute });
					npc.AddTag("Targeted");
					log(`⚜️ ${npc.Name} assigned to ${npcRoute.Name}`);
					npc.AncestryChanged.Connect((child, parent) => {
						if (!parent) {
							log(`💀 ${child.Name} was removed from this life and from ${npcRoute.Name}`);
							assigned.delete(npcRoute.Name);
						}
					});
				} else {
					log(`NPC did not spawn due to issues`, "ERROR");
				}
			} catch (error) {
				log(`Spawn failed for NPC: ${error as string}`, "ERROR");
			}
		}
	});
}

async function main() {
	const assigned: Map<string, Assignment> = new Map();

	task.spawn(() => {
		while (true) {
			updateAssignments(assigned);
			task.wait(5);
		}
	});
}

main();
