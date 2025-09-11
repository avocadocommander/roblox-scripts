import { Assignment } from "shared/module";
import { updateAssignments } from "shared/npc-manager";

const assignmentsActive: boolean = true;

function main() {
	const assigned: Map<string, Assignment> = new Map();

	task.spawn(() => {
		while (assignmentsActive) {
			task.wait(5);

			updateAssignments(assigned);
		}
	});
}
main();
