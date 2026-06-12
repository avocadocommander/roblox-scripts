import { ENCHANTMENTS, EnchantmentId } from "shared/config/enchantments";
import { log } from "shared/helpers";

const ACTIVE_ENCHANTMENT_VISUAL_NAME = "ActiveEnchantmentVisual";
const DAWNS_GUIDE_EFFECT_LIGHT_BRIGHTNESS = 2.4;
const DAWNS_GUIDE_EFFECT_LIGHT_RANGE = 16;

function findFollowPart(character: Model): BasePart | undefined {
	const head = character.FindFirstChild("Head");
	if (head?.IsA("BasePart")) return head;

	const root = character.FindFirstChild("HumanoidRootPart");
	if (root?.IsA("BasePart")) return root;

	return character.FindFirstChildWhichIsA("BasePart", true) as BasePart | undefined;
}

function clearEnchantmentVisual(character: Model): void {
	const existing = character.FindFirstChild(ACTIVE_ENCHANTMENT_VISUAL_NAME);
	if (existing) existing.Destroy();
}

export function createDawnsGuideSpiritEffect(parent: Instance): void {
	const def = ENCHANTMENTS.dawns_guide;

	const light = new Instance("PointLight");
	light.Name = "DawnsGuideLight";
	light.Color = def.lightColor;
	light.Brightness = DAWNS_GUIDE_EFFECT_LIGHT_BRIGHTNESS;
	light.Range = DAWNS_GUIDE_EFFECT_LIGHT_RANGE;
	light.Shadows = true;
	light.Parent = parent;

	const aura = new Instance("ParticleEmitter");
	aura.Name = "DawnsGuideAura";
	aura.Texture = "rbxasset://textures/particles/sparkles_main.dds";
	aura.Color = new ColorSequence([
		new ColorSequenceKeypoint(0, def.coreColor),
		new ColorSequenceKeypoint(1, def.lightColor),
	]);
	aura.LightEmission = 0.9;
	aura.Rate = 10;
	aura.Lifetime = new NumberRange(0.8, 1.4);
	aura.Speed = new NumberRange(0.15, 0.55);
	aura.SpreadAngle = new Vector2(180, 180);
	aura.Size = new NumberSequence([
		new NumberSequenceKeypoint(0, 0.34),
		new NumberSequenceKeypoint(0.5, 0.2),
		new NumberSequenceKeypoint(1, 0),
	]);
	aura.Transparency = new NumberSequence([
		new NumberSequenceKeypoint(0, 0.38),
		new NumberSequenceKeypoint(0.55, 0.55),
		new NumberSequenceKeypoint(1, 1),
	]);
	aura.Parent = parent;

	const motes = new Instance("ParticleEmitter");
	motes.Name = "DawnsGuideSpiritMotes";
	motes.Texture = "rbxasset://textures/particles/sparkles_main.dds";
	motes.Color = new ColorSequence([
		new ColorSequenceKeypoint(0, def.coreColor),
		new ColorSequenceKeypoint(0.7, def.lightColor),
		new ColorSequenceKeypoint(1, def.secondaryColor),
	]);
	motes.LightEmission = 1;
	motes.Rate = 8;
	motes.Lifetime = new NumberRange(1.1, 1.9);
	motes.Speed = new NumberRange(0.25, 0.8);
	motes.SpreadAngle = new Vector2(180, 180);
	motes.Size = new NumberSequence([
		new NumberSequenceKeypoint(0, 0.12),
		new NumberSequenceKeypoint(0.45, 0.07),
		new NumberSequenceKeypoint(1, 0),
	]);
	motes.Transparency = new NumberSequence([
		new NumberSequenceKeypoint(0, 0.12),
		new NumberSequenceKeypoint(0.65, 0.4),
		new NumberSequenceKeypoint(1, 1),
	]);
	motes.Parent = parent;
}

function createDawnsGuideOrb(character: Model, enchantmentId: EnchantmentId): BasePart | undefined {
	const def = ENCHANTMENTS[enchantmentId];
	if (!def) return undefined;

	const orb = new Instance("Part");
	orb.Name = ACTIVE_ENCHANTMENT_VISUAL_NAME;
	orb.Shape = Enum.PartType.Ball;
	orb.Size = new Vector3(0.38, 0.38, 0.38);
	orb.Material = Enum.Material.Neon;
	orb.Color = def.coreColor;
	orb.Transparency = 0.18;
	orb.Anchored = true;
	orb.CanCollide = false;
	orb.CanTouch = false;
	orb.CanQuery = false;
	orb.CastShadow = false;
	orb.Parent = character;

	const attachment = new Instance("Attachment");
	attachment.Name = "DawnsGuideMotes";
	attachment.Parent = orb;
	createDawnsGuideSpiritEffect(attachment);

	return orb;
}

function animateOrb(character: Model, orb: BasePart): void {
	const start = os.clock() + math.random();
	task.spawn(() => {
		while (character.Parent !== undefined && orb.Parent !== undefined) {
			const followPart = findFollowPart(character);
			if (!followPart) {
				task.wait(0.2);
				continue;
			}

			const t = os.clock() - start;
			const bob = math.sin(t * 2.4) * 0.22;
			const driftX = math.sin(t * 1.35) * 0.28;
			const driftZ = math.cos(t * 1.1) * 0.18;
			const orbit = CFrame.Angles(0, t * 0.35, 0).mul(new CFrame(driftX, 3.05 + bob, driftZ));
			orb.CFrame = followPart.CFrame.mul(orbit);

			task.wait(0.04);
		}
	});
}

export function applyEnchantmentVisualToCharacter(character: Model, enchantmentId: EnchantmentId | undefined): void {
	clearEnchantmentVisual(character);
	if (enchantmentId === undefined) return;

	if (enchantmentId !== "dawns_guide") {
		log("[ENCHANTMENT-VISUAL] No visual handler for enchantment: " + enchantmentId, "WARN");
		return;
	}

	const orb = createDawnsGuideOrb(character, enchantmentId);
	if (!orb) return;

	animateOrb(character, orb);
}
