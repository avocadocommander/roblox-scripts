/**
 * Moonbat — animates the wings of any Model in Workspace named "moonbat"
 * so it looks like a hovering bat flapping its wings.
 *
 * Each bat model is expected to contain:
 *   - a body part (named "abdomen", falls back to PrimaryPart)
 *   - "leftwing" and "rightwing" BaseParts, each with an Attachment marking
 *     the hinge point where the wing meets the body
 *
 * The wings are anchored and rotated around the body's forward axis through
 * the attachment world position on every Heartbeat.
 */

import { RunService, Workspace } from "@rbxts/services";
import { log } from "shared/helpers";
import { onPlayerInitialized } from "../modules/client-init";

const TAG = "[MOONBAT]";

const FLAP_SPEED = 6; // radians per second of the sine driver
const FLAP_ANGLE = math.rad(45); // peak rotation from rest in either direction
const MODEL_NAME = "moonbat";

interface BatRig {
	model: Model;
	leftWing: BasePart;
	rightWing: BasePart;
	leftPivot: Vector3;
	rightPivot: Vector3;
	leftRest: CFrame;
	rightRest: CFrame;
	flapAxis: Vector3;
}

const rigs: BatRig[] = [];
let phase = 0;

function findWing(model: Model, name: string): BasePart | undefined {
	for (const desc of model.GetDescendants()) {
		if (desc.Name === name && desc.IsA("BasePart") && desc.FindFirstChildWhichIsA("Attachment")) {
			return desc;
		}
	}
	const direct = model.FindFirstChild(name);
	return direct && direct.IsA("BasePart") ? direct : undefined;
}

function buildRig(model: Model): BatRig | undefined {
	const body =
		(model.FindFirstChild("abdomen") as BasePart | undefined) ??
		(model.PrimaryPart as BasePart | undefined);
	if (!body) {
		log(`${TAG} ${model.Name} missing body part (abdomen / PrimaryPart)`, "WARN");
		return undefined;
	}

	const leftWing = findWing(model, "leftwing");
	const rightWing = findWing(model, "rightwing");
	if (!leftWing || !rightWing) {
		log(`${TAG} ${model.Name} missing leftwing/rightwing BasePart with Attachment`, "WARN");
		return undefined;
	}

	const leftAttach = leftWing.FindFirstChildWhichIsA("Attachment");
	const rightAttach = rightWing.FindFirstChildWhichIsA("Attachment");
	if (!leftAttach || !rightAttach) return undefined;

	body.Anchored = true;
	leftWing.Anchored = true;
	rightWing.Anchored = true;

	return {
		model,
		leftWing,
		rightWing,
		leftPivot: leftAttach.WorldPosition,
		rightPivot: rightAttach.WorldPosition,
		leftRest: leftWing.CFrame,
		rightRest: rightWing.CFrame,
		flapAxis: body.CFrame.LookVector,
	};
}

function flap(rig: BatRig, angle: number): void {
	const leftPivotCF = new CFrame(rig.leftPivot);
	const rightPivotCF = new CFrame(rig.rightPivot);
	const leftRotation = CFrame.fromAxisAngle(rig.flapAxis, angle);
	const rightRotation = CFrame.fromAxisAngle(rig.flapAxis, -angle);

	rig.leftWing.CFrame = leftPivotCF.mul(leftRotation).mul(leftPivotCF.Inverse()).mul(rig.leftRest);
	rig.rightWing.CFrame = rightPivotCF.mul(rightRotation).mul(rightPivotCF.Inverse()).mul(rig.rightRest);
}

function tryRegister(instance: Instance): void {
	if (!instance.IsA("Model") || instance.Name !== MODEL_NAME) return;
	const rig = buildRig(instance);
	if (!rig) return;
	rigs.push(rig);
	instance.AncestryChanged.Connect((_child, parent) => {
		if (parent !== undefined) return;
		const idx = rigs.indexOf(rig);
		if (idx !== -1) rigs.remove(idx);
	});
	log(`${TAG} registered ${instance.GetFullName()}`);
}

function initializeMoonbats(): void {
	for (const child of Workspace.GetChildren()) {
		tryRegister(child);
	}
	Workspace.ChildAdded.Connect(tryRegister);

	RunService.Heartbeat.Connect((dt) => {
		if (rigs.size() === 0) return;
		phase += dt * FLAP_SPEED;
		const angle = math.sin(phase) * FLAP_ANGLE;
		for (const rig of rigs) {
			flap(rig, angle);
		}
	});
}

onPlayerInitialized(() => {
	initializeMoonbats();
});
