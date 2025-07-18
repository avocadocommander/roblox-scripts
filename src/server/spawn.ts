// import { Workspace, ReplicatedStorage } from "@rbxts/services";

// // Get template and patrol root
// const npcTemplate = ReplicatedStorage.WaitForChild("NPC") as Model;
// const patrolRoot = Workspace.WaitForChild("PatrolRoutes") as Folder;

// // Iterate through all route models
// for (const routeModel of patrolRoot.GetChildren()) {
// 	if (!routeModel.IsA("Model")) continue;

// 	// Gather and sort waypoints
// 	const waypoints = routeModel
// 		.GetChildren()
// 		.filter(
// 			(obj): obj is BasePart =>
// 				obj.IsA("Part") && obj.Name.lower().find("route") !== undefined,
// 		)
// 		.sort((a, b) => (a.Name < b.Name ? false : true));

// 	if (waypoints.size() < 1) {
// 		warn(`Route ${routeModel.Name} needs at least 1 waypoint.`);
// 		continue;
// 	}

// 	// Clone NPC and place it at first waypoint
// 	const guard = npcTemplate.Clone();
// 	guard.Parent = Workspace;


// 	const roleValue = guard.WaitForChild("Role");
//     const role = routeModel.WaitForChild("Role")
// 	if (roleValue && roleValue.IsA("StringValue")) {
// 		roleValue.Value = (role && role.IsA("StringValue")) ? role.Value : '';
// 	}

//     guard.Name = routeModel.Name;

// 	guard.PivotTo(new CFrame(waypoints[0].Position));

// 	if (waypoints.size() > 1) {
// 		task.spawn(() => {
// 			const humanoid = guard.WaitForChild("Humanoid") as Humanoid;
// 			let index = 1;
// 			let forward = true;

// 			const moveToNext = () => {
// 				humanoid.MoveTo(waypoints[index].Position);
// 			};

// 			humanoid.MoveToFinished.Connect((reached) => {
// 				if (!reached) return;

// 				if (forward) {
// 					index++;
// 					if (index >= waypoints.size()) {
// 						index = waypoints.size() - 2;
// 						forward = false;
// 					}
// 				} else {
// 					index--;
// 					if (index < 0) {
// 						index = 1;
// 						forward = true;
// 					}
// 				}

// 				task.wait(math.random(1, 10));
// 				moveToNext();
// 			});

// 			moveToNext();
// 		});
// 	}
// }