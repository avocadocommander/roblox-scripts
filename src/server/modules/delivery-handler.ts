/**
 * Delivery handler — server-side kill delivery logic.
 *
 * Two delivery kinds:
 *   BLUNT  — Knockback + ragdoll. NPC stays ragdolled the entire time.
 *            No poison = destroy after ragdoll. With poison = death effect fires directly.
 *   PIERCE — Instant hit. No poison = immediate random death effect.
 *            With poison = poison's death effect fires after poisonDelaySecs.
 *
 * Poisons ALWAYS do the killing blow (the death animation).
 * There is NO intermediate purple phase — weapon hit flows straight into death effect.
 */

import { DELIVERY_TYPES } from "shared/config/delivery";
import { WEAPONS } from "shared/config/weapons";
import { DEATH_EFFECTS, isNPCActive, markNPCDying } from "shared/npc-manager";
import { log } from "shared/helpers";

type DeathEffectFn = (model: Model) => void;

/**
 * BLUNT delivery: ragdoll the NPC, launch it away from the attacker,
 * and keep it ragdolled until death resolves.
 */
function deliverBlunt(
	model: Model,
	attackerPosition: Vector3,
	knockbackForce: number,
	knockbackLift: number,
	ragdollSecs: number,
	onDeath: DeathEffectFn | undefined,
): void {
	if (!isNPCActive(model)) return;
	markNPCDying(model);

	const humanoid = model.FindFirstChildOfClass("Humanoid");
	if (humanoid) {
		humanoid.PlatformStand = true;
		humanoid.WalkSpeed = 0;
		humanoid.JumpPower = 0;
	}

	// Break Motor6D joints and replace with BallSocketConstraints so the
	// body ragdolls as one connected piece.
	const descendants = model.GetDescendants();
	for (const desc of descendants) {
		if (desc.IsA("Motor6D")) {
			const part0 = desc.Part0;
			const part1 = desc.Part1;
			if (part0 && part1) {
				const att0 = new Instance("Attachment");
				att0.CFrame = desc.C0;
				att0.Parent = part0;

				const att1 = new Instance("Attachment");
				att1.CFrame = desc.C1;
				att1.Parent = part1;

				const socket = new Instance("BallSocketConstraint");
				socket.Attachment0 = att0;
				socket.Attachment1 = att1;
				socket.Parent = part0;
			}
			desc.Destroy();
		}
	}

	for (const desc of descendants) {
		if (desc.IsA("BasePart")) {
			(desc as BasePart).CanCollide = true;
		}
	}

	// Knockback force
	const hrp = model.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
	if (hrp) {
		const direction = hrp.Position.sub(attackerPosition).Unit;
		const force = new Instance("BodyVelocity");
		force.Velocity = direction.mul(knockbackForce).add(new Vector3(0, knockbackLift, 0));
		force.MaxForce = new Vector3(1e5, 1e5, 1e5);
		force.P = 1e4;
		force.Parent = hrp;
		task.delay(0.35, () => {
			if (force.Parent) force.Destroy();
		});
	}

	if (onDeath) {
		// Poison active — stay ragdolled, then poison's death effect fires directly
		task.delay(ragdollSecs, () => {
			if (model.Parent) onDeath(model);
		});
	} else {
		// No poison — ragdoll IS the death. Kill and destroy.
		if (humanoid) {
			task.delay(0.05, () => {
				humanoid.Health = 0;
			});
		}
		task.delay(ragdollSecs, () => {
			if (model.Parent) model.Destroy();
		});
	}
}

/**
 * Execute a kill delivery on an NPC model.
 *
 * @param model            The NPC to kill.
 * @param weaponId         The equipped weapon ID (looks up delivery type).
 * @param attackerPosition World position of the attacker.
 * @param deathEffect      Death effect to play (undefined = no poison, weapon kills).
 * @param poisonDelaySecs  Seconds before poison's death effect fires (pierce only).
 */
export function executeDelivery(
	model: Model,
	weaponId: string,
	attackerPosition: Vector3,
	deathEffect?: DeathEffectFn,
	poisonDelaySecs?: number,
): void {
	const delivery = DELIVERY_TYPES[weaponId] ?? DELIVERY_TYPES["dagger"];
	const weaponDef = WEAPONS[weaponId];

	log(`[DELIVERY] ${model.Name} -- kind=${delivery.kind} weapon=${weaponId} poison=${deathEffect !== undefined}`);

	if (delivery.kind === "blunt") {
		const force = weaponDef?.knockbackForce ?? 55;
		const lift = weaponDef?.knockbackLift ?? 18;
		const ragdoll = weaponDef?.ragdollSecs ?? 1;
		deliverBlunt(model, attackerPosition, force, lift, ragdoll, deathEffect);
	} else {
		// PIERCE — instant
		if (!isNPCActive(model)) return;

		if (deathEffect && poisonDelaySecs !== undefined && poisonDelaySecs > 0) {
			// Poison active — mark dying, wait for poison duration, then death effect
			markNPCDying(model);
			const humanoid = model.FindFirstChildOfClass("Humanoid");
			if (humanoid) {
				humanoid.PlatformStand = true;
				humanoid.WalkSpeed = 0;
				humanoid.JumpPower = 0;
			}
			task.delay(poisonDelaySecs, () => {
				if (model.Parent) deathEffect(model);
			});
		} else if (deathEffect) {
			// Poison but 0 delay — fire immediately
			task.spawn(() => deathEffect(model));
		} else {
			// No poison — instant random death effect
			const fallbacks = ["DEFAULT", "EVAPORATE", "SMOKE"];
			const style = fallbacks[math.random(0, fallbacks.size() - 1)];
			task.spawn(() => DEATH_EFFECTS[style](model));
		}
	}
}
