import { Players, ReplicatedStorage, Workspace } from "@rbxts/services";
import { Assignment, getRandomMedievalPhrase, isNPCType, MEDIEVAL_NAMES, NPCType, useAssetId } from "shared/module";
import { getSeedFromName, makeSeededRandom } from "../shared/seed";
import { PlayerDataService } from "shared/common-data-service";
import { defaultPlayerStoreData, PLAYER_STORE_NAME, StoreData } from "./player-store";
import { applySpeed, log, SPEEDS } from "shared/helpers";

export const enum AnimationState {
	WALK = "WALK",
	IDLE = "IDLE",
}

function spawnNPC(spawnPoint: BasePart, routePoints: BasePart[], npcType: NPCType): Model | undefined {
	const npcTemplate = ReplicatedStorage.WaitForChild("NPC") as Model;

	const npc = npcTemplate.Clone();
	const name = MEDIEVAL_NAMES[math.random(0, MEDIEVAL_NAMES.size())];
	const seed = getSeedFromName(name);

	if (!seed) {
		log("Bad seed", "ERROR");
		return undefined;
	}

	const rand = makeSeededRandom(seed);

	npc.Name = `(${npcType}) ${name}`;
	npc.PivotTo(new CFrame(spawnPoint.Position));
	npc.Parent = Workspace;

	addTalkPrompt(npc, getRandomMedievalPhrase());

	const npcHumanoid = npc.FindFirstChildOfClass("Humanoid");

	if (!npcHumanoid) {
		log("Humanoid not found for npc spawn", "ERROR");
		return undefined;
	}
	applySpeed(SPEEDS.WALK, npcHumanoid);

	const npcDescription = npcHumanoid.GetAppliedDescription();
	if (!npcDescription) {
		log("Appearence unavalialbe for npc spawn", "ERROR");
		return undefined;
	}
	randomizeBodyShape(npcDescription, rand);
	const appearenceDescription = getGenericSeededAppearance(npcDescription, rand);

	if (!appearenceDescription) return;
	npcHumanoid.ApplyDescription(appearenceDescription);
	npc.SetAttribute("Type", npcType);
	if (routePoints) {
		patrol(npc, routePoints);
	}
	return npc;
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

function randomizeBodyShape(npcDescription: HumanoidDescription, seed: () => number) {
	npcDescription.BodyTypeScale = math.round(seed() * 100) / 100; // 0.0 to 1.0
	npcDescription.ProportionScale = math.round(seed() * 100) / 100;

	npcDescription.HeightScale = math.round((0.9 + seed() * 0.15) * 100) / 100; // 0.9 to 1.05
	npcDescription.WidthScale = math.round((0.9 + seed() * 0.15) * 100) / 100;
	npcDescription.DepthScale = math.round((0.9 + seed() * 0.15) * 100) / 100;

	npcDescription.HeadScale = math.round((0.8 + seed() * 0.4) * 100) / 100; // 0.8 to 1.2
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

function getGenericSeededAppearance(
	humanoidDescription: HumanoidDescription,
	seed: () => number,
): HumanoidDescription | undefined {
	const faces = [
		20418658, 12145366, 25166274, 8329679, 162068415, 10907551, 2222771916, 391496223, 7074893, 15432080, 8560971,
		406001167, 7317765, 616381207,
	];
	const hair = ["63690008", "16630147", "2956239660", "2956239660", "5891039736", "4875445470", "6441556987"];
	const realisticSkinTones: Color3[] = [
		Color3.fromRGB(255, 224, 189), // Fair
		Color3.fromRGB(241, 194, 125), // Light
		Color3.fromRGB(224, 172, 105), // Light tan
		Color3.fromRGB(198, 134, 66), // Olive
		Color3.fromRGB(141, 85, 36), // Brown
		Color3.fromRGB(101, 67, 33), // Dark brown
		Color3.fromRGB(77, 51, 25), // Very dark
		Color3.fromRGB(232, 190, 172), // Rosy fair
		Color3.fromRGB(203, 144, 102), // Warm tan
		Color3.fromRGB(160, 114, 77), // Deep tan
	];

	const skinIndex = math.floor(seed() * realisticSkinTones.size()) + 1;
	const skinColor: Color3 = realisticSkinTones[skinIndex - 1];

	humanoidDescription.HeadColor = skinColor;
	humanoidDescription.LeftArmColor = skinColor;
	humanoidDescription.RightArmColor = skinColor;
	humanoidDescription.LeftLegColor = skinColor;
	humanoidDescription.RightLegColor = skinColor;
	humanoidDescription.TorsoColor = skinColor;

	humanoidDescription.Face = faces[math.floor(seed() * faces.size())];
	humanoidDescription.Head = 746767604;
	humanoidDescription.HairAccessory = hair[math.floor(seed() * hair.size())];

	return humanoidDescription;
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
