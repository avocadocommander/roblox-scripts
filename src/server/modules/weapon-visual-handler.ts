import { ReplicatedStorage } from "@rbxts/services";
import { WEAPONS, WeaponDef } from "shared/config/weapons";
import { log } from "shared/helpers";
import { createDawnsGuideSpiritEffect } from "./enchantment-visual-handler";
import { getWeaponAnimationRemote } from "shared/remotes/weapon-animation-remote";

const WEAPON_FOLDER_NAME = "Weapons";
const ACTIVE_VISUAL_NAME = "ActiveWeaponVisual";
const SHEATHED_VISUAL_NAME = "SheathedWeaponVisual";

const HANDLE_NAME = "Handle";
const GRIP_ATTACHMENT_NAME = "GripAttachment";
const OFFHAND_ATTACHMENT_NAME = "OffhandAttachment";
const SHEATH_ATTACHMENT_NAME = "SheathAttachment";
const BLADE_TIP_ATTACHMENT_NAME = "BladeTipAttachment";

const RIGHT_HAND_ANCHOR_NAME = "RightHandWeaponAnchor";
const LEFT_HAND_ANCHOR_NAME = "LeftHandSupportAnchor";
const HIP_SHEATH_ANCHOR_NAME = "HipSheathAnchor";
const BACK_SHEATH_ANCHOR_NAME = "BackSheathAnchor";
const weaponAnimationRemote = getWeaponAnimationRemote();
type WeaponVisualMode = "held" | "sheathed";

function findPart(character: Model, names: string[]): BasePart | undefined {
	for (const name of names) {
		const inst = character.FindFirstChild(name);
		if (inst?.IsA("BasePart")) return inst;
	}
	return undefined;
}

function getRightHand(character: Model): BasePart | undefined {
	return findPart(character, ["RightHand", "Right Arm"]);
}

function getLeftHand(character: Model): BasePart | undefined {
	return findPart(character, ["LeftHand", "Left Arm"]);
}

function getHipPart(character: Model): BasePart | undefined {
	return findPart(character, ["LowerTorso", "Torso", "HumanoidRootPart"]);
}

function getBackPart(character: Model): BasePart | undefined {
	return findPart(character, ["UpperTorso", "Torso", "HumanoidRootPart"]);
}

function getOrCreateAttachment(parent: BasePart, name: string, cframe: CFrame): Attachment {
	const existing = parent.FindFirstChild(name);
	if (existing?.IsA("Attachment")) return existing;

	const attachment = new Instance("Attachment");
	attachment.Name = name;
	attachment.CFrame = cframe;
	attachment.Parent = parent;
	return attachment;
}

function getRightHandAnchor(character: Model): Attachment | undefined {
	const part = getRightHand(character);
	return part ? getOrCreateAttachment(part, RIGHT_HAND_ANCHOR_NAME, new CFrame()) : undefined;
}

function getLeftHandAnchor(character: Model): Attachment | undefined {
	const part = getLeftHand(character);
	return part ? getOrCreateAttachment(part, LEFT_HAND_ANCHOR_NAME, new CFrame()) : undefined;
}

function getHipSheathAnchor(character: Model): Attachment | undefined {
	const part = getHipPart(character);
	return part
		? getOrCreateAttachment(
				part,
				HIP_SHEATH_ANCHOR_NAME,
				new CFrame(0.75, -0.55, 0.15).mul(CFrame.Angles(math.rad(0), math.rad(0), math.rad(-25))),
			)
		: undefined;
}

function getBackSheathAnchor(character: Model): Attachment | undefined {
	const part = getBackPart(character);
	return part
		? getOrCreateAttachment(
				part,
				BACK_SHEATH_ANCHOR_NAME,
				new CFrame(0, 0.15, 0.65).mul(CFrame.Angles(math.rad(35), math.rad(0), math.rad(45))),
			)
		: undefined;
}

export function ensureCharacterWeaponAnchors(character: Model): void {
	getRightHandAnchor(character);
	getLeftHandAnchor(character);
	getHipSheathAnchor(character);
	getBackSheathAnchor(character);
}

function clearWeaponVisual(character: Model, visualName: string): void {
	const existing = character.FindFirstChild(visualName);
	if (existing) existing.Destroy();
}

function clearWeaponVisuals(character: Model): void {
	clearWeaponVisual(character, ACTIVE_VISUAL_NAME);
	clearWeaponVisual(character, SHEATHED_VISUAL_NAME);
}

function getWeaponTemplate(def: WeaponDef): Instance | undefined {
	const weaponFolder = ReplicatedStorage.FindFirstChild(WEAPON_FOLDER_NAME);
	return weaponFolder?.FindFirstChild(def.heldModelName!) ?? ReplicatedStorage.FindFirstChild(def.heldModelName!);
}

function cloneAsModel(template: Instance, modelName: string): Model {
	if (template.IsA("Model")) {
		const clone = template.Clone();
		clone.Name = modelName;
		return clone;
	}

	const wrapper = new Instance("Model");
	wrapper.Name = modelName;
	const clone = template.Clone();
	clone.Parent = wrapper;
	if (clone.IsA("BasePart")) wrapper.PrimaryPart = clone;
	return wrapper;
}

function getHandle(visual: Model): BasePart | undefined {
	const direct = visual.FindFirstChild(HANDLE_NAME);
	if (direct?.IsA("BasePart")) return direct;
	if (visual.PrimaryPart) return visual.PrimaryPart;
	const firstPart = visual.FindFirstChildWhichIsA("BasePart", true) as BasePart | undefined;
	if (firstPart) visual.PrimaryPart = firstPart;
	return firstPart;
}

function getWeaponAttachment(handle: BasePart, name: string): Attachment | undefined {
	const direct = handle.FindFirstChild(name);
	if (direct?.IsA("Attachment")) return direct;
	for (const desc of handle.GetDescendants()) {
		if (desc.IsA("Attachment") && desc.Name === name) return desc;
	}
	return undefined;
}

function getVisualParts(visual: Model): BasePart[] {
	const parts: BasePart[] = [];
	for (const desc of visual.GetDescendants()) {
		if (desc.IsA("BasePart")) parts.push(desc);
	}
	return parts;
}

function prepareVisualParts(visual: Model, handle: BasePart): void {
	for (const part of getVisualParts(visual)) {
		part.Anchored = false;
		part.CanCollide = false;
		part.CanTouch = false;
		part.CanQuery = false;
		part.Massless = true;
		if (part !== handle) {
			const weld = new Instance("WeldConstraint");
			weld.Part0 = handle;
			weld.Part1 = part;
			weld.Parent = handle;
		}
	}
}

function pivotByHandle(visual: Model, handle: BasePart, desiredHandleCFrame: CFrame): void {
	const pivotOffsetFromHandle = handle.CFrame.ToObjectSpace(visual.GetPivot());
	visual.PivotTo(desiredHandleCFrame.mul(pivotOffsetFromHandle));
}

function attachHandleToAnchor(handle: BasePart, anchorParent: BasePart, name: string): void {
	const weld = new Instance("WeldConstraint");
	weld.Name = name;
	weld.Part0 = anchorParent;
	weld.Part1 = handle;
	weld.Parent = handle;
}

function getTargetAnchor(character: Model, def: WeaponDef, mode: WeaponVisualMode): Attachment | undefined {
	if (mode === "held") return getRightHandAnchor(character);
	return def.handedness === "twoHanded" ? getBackSheathAnchor(character) : getHipSheathAnchor(character);
}

function getSourceAttachment(handle: BasePart, mode: WeaponVisualMode): Attachment | undefined {
	if (mode === "held") return getWeaponAttachment(handle, GRIP_ATTACHMENT_NAME);
	return getWeaponAttachment(handle, SHEATH_ATTACHMENT_NAME) ?? getWeaponAttachment(handle, GRIP_ATTACHMENT_NAME);
}

function applyWeaponVisualToCharacter(character: Model, weaponId: string, mode: WeaponVisualMode): void {
	ensureCharacterWeaponAnchors(character);
	const def = WEAPONS[weaponId];
	if (!def?.heldModelName) return;

	const template = getWeaponTemplate(def);
	if (!template) {
		log(
			"[WEAPON-VISUAL] Missing ReplicatedStorage/" +
				WEAPON_FOLDER_NAME +
				"/" +
				def.heldModelName +
				" and ReplicatedStorage/" +
				def.heldModelName,
			"WARN",
		);
		return;
	}

	const visual = cloneAsModel(template, mode === "held" ? ACTIVE_VISUAL_NAME : SHEATHED_VISUAL_NAME);
	visual.Parent = character;

	const handle = getHandle(visual);
	if (!handle) {
		visual.Destroy();
		log("[WEAPON-VISUAL] Weapon visual has no Handle/BasePart: " + def.heldModelName, "WARN");
		return;
	}
	visual.PrimaryPart = handle;

	const sourceAttachment = getSourceAttachment(handle, mode);
	const targetAnchor = getTargetAnchor(character, def, mode);
	if (!sourceAttachment || !targetAnchor) {
		visual.Destroy();
		log(
			"[WEAPON-VISUAL] Missing " +
				(mode === "held" ? GRIP_ATTACHMENT_NAME : SHEATH_ATTACHMENT_NAME + "/" + GRIP_ATTACHMENT_NAME) +
				" or character anchor for " +
				def.heldModelName,
			"WARN",
		);
		return;
	}

	prepareVisualParts(visual, handle);
	const desiredHandleCFrame = targetAnchor.WorldCFrame.mul(sourceAttachment.CFrame.Inverse());
	pivotByHandle(visual, handle, desiredHandleCFrame);
	attachHandleToAnchor(handle, targetAnchor.Parent as BasePart, mode === "held" ? "HeldWeaponWeld" : "SheathedWeaponWeld");

	const heldGripStyle = def.heldGripStyle ?? def.handedness;
	// Two-handed grip weapons expose the left-hand anchor and OffhandAttachment for
	// animation/IK systems. We avoid welding both hands to one rigid weapon here
	// because that fights Roblox character joints on live rigs.
	if (mode === "held" && heldGripStyle === "twoHanded") {
		getWeaponAttachment(handle, OFFHAND_ATTACHMENT_NAME);
		getLeftHandAnchor(character);
	}

	if (mode === "held" && def.bladeTipEffect === "dawnsGuide") {
		const bladeTip = getWeaponAttachment(handle, BLADE_TIP_ATTACHMENT_NAME);
		if (bladeTip) {
			createDawnsGuideSpiritEffect(bladeTip);
		} else {
			log("[WEAPON-VISUAL] Missing " + BLADE_TIP_ATTACHMENT_NAME + " for " + def.heldModelName, "WARN");
		}
	}
}

export function applyHeldWeaponVisualToCharacter(character: Model, weaponId: string): void {
	clearWeaponVisuals(character);
	if (weaponId === "fists") return;
	applyWeaponVisualToCharacter(character, weaponId, "held");
}

export function applySheathedWeaponVisualToCharacter(character: Model, weaponId: string): void {
	clearWeaponVisuals(character);
	if (weaponId === "fists") return;
	applyWeaponVisualToCharacter(character, weaponId, "sheathed");
}

export function applyHeldWeaponVisual(player: Player, weaponId: string): void {
	const character = player.Character;
	if (!character) return;

	applyHeldWeaponVisualToCharacter(character, weaponId);
	weaponAnimationRemote.FireClient(player, "equip", weaponId);
}

export function applySheathedWeaponVisual(player: Player, weaponId: string): void {
	const character = player.Character;
	if (!character) return;

	weaponAnimationRemote.FireClient(player, "sheathe", weaponId);
	applySheathedWeaponVisualToCharacter(character, weaponId);
}
