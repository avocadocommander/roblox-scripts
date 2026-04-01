/**
 * Inspect Handler — server module.
 *
 * Validates inspect requests, looks up the inspectId attribute on the model,
 * resolves it against the shared inspect registry, and fires the payload
 * back to the requesting client.
 */

import { Players, Workspace } from "@rbxts/services";
import { log } from "shared/helpers";
import { awardAchievement } from "./achievement-handler";
import { getInspectDef } from "shared/config/inspectables";
import { getOpenInspectRemote, getInspectPayloadRemote, InspectPayload } from "shared/remotes/inspect-remote";

const openInspectRemote = getOpenInspectRemote();
const inspectPayloadRemote = getInspectPayloadRemote();
const MAX_INSPECT_DISTANCE = 12;

export function initializeInspectHandler(): void {
	openInspectRemote.OnServerEvent.Connect((player: Player, ...args: unknown[]) => {
		const model = args[0] as Model | undefined;
		if (!model || !model.IsA("Model")) return;

		// Validate the model is still in the workspace
		if (!model.IsDescendantOf(Workspace)) return;

		// Distance check
		const char = player.Character;
		if (!char) return;
		const hrp = char.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (!hrp) return;
		const modelPart = model.PrimaryPart ?? (model.FindFirstChildWhichIsA("BasePart") as BasePart | undefined);
		if (!modelPart) return;
		if (hrp.Position.sub(modelPart.Position).Magnitude > MAX_INSPECT_DISTANCE) return;

		// Read the inspectId attribute
		const inspectId = model.GetAttribute("inspectId") as string | undefined;
		if (inspectId === undefined || inspectId === "") {
			warn("[INSPECT] Model '" + model.Name + "' has no inspectId attribute");
			return;
		}

		// Look up in registry
		const def = getInspectDef(inspectId);
		if (!def) {
			warn("[INSPECT] inspectId '" + inspectId + "' on model '" + model.Name + "' not found in INSPECT_REGISTRY");
			return;
		}

		const payload: InspectPayload = {
			modelName: model.Name,
			displayName: def.displayName,
			description: def.description,
		};

		awardAchievement(player, "A_CURIOUS_MIND");
		inspectPayloadRemote.FireClient(player, payload);
		log("[INSPECT] " + player.Name + " inspecting " + def.displayName + " (" + model.Name + ")");
	});

	log("[INSPECT] Inspect handler initialised");
}
