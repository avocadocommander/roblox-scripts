import { Lighting, ReplicatedStorage } from "@rbxts/services";
import { Assignment } from "shared/module";
import { updateAssignments } from "shared/npc-manager";

const time = 20.45;
Lighting.ClockTime = time;

const assignmentsActive: boolean = true;

function coreGameLoop() {
	const assigned: Map<string, Assignment> = new Map();

	task.spawn(() => {
		while (assignmentsActive) {
			updateAssignments(assigned);
		}
	});
}
coreGameLoop();

// const serverReadyEvent: RemoteEvent = new Instance("RemoteEvent");
// serverReadyEvent.Name = "ServerReady";
// serverReadyEvent.Parent = ReplicatedStorage;

// task.defer(() => {
// 	warn("✅ Server Ready ");
// 	serverReadyEvent.FireAllClients();
// });
