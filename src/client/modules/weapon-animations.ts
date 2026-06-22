import { Players } from "@rbxts/services";
import { WEAPONS } from "shared/config/weapons";
import { useAssetId } from "shared/module";
import { getWeaponAnimationRemote } from "shared/remotes/weapon-animation-remote";

const player = Players.LocalPlayer;

let equippedWeaponId = "fists";
let idleTrack: AnimationTrack | undefined;
let runningConnection: RBXScriptConnection | undefined;
let initialized = false;
let isMoving = false;

function stopIdle(): void {
	if (!idleTrack) return;
	idleTrack.Stop(0.15);
	idleTrack.Destroy();
	idleTrack = undefined;
}

function getAnimator(): Animator | undefined {
	const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
	if (!humanoid) return undefined;
	return humanoid.FindFirstChildOfClass("Animator") ?? humanoid.WaitForChild("Animator", 3) as Animator | undefined;
}

function loadTrack(animationId: string, name: string, priority: Enum.AnimationPriority): AnimationTrack | undefined {
	const animator = getAnimator();
	if (!animator) {
		warn("[WEAPON-ANIMATION] No Animator for " + name);
		return undefined;
	}

	const animation = new Instance("Animation");
	animation.Name = name;
	animation.AnimationId = useAssetId(animationId);
	const [loaded, result] = pcall(() => animator.LoadAnimation(animation));
	animation.Destroy();
	if (!loaded) {
		warn("[WEAPON-ANIMATION] Failed to load " + name + ": " + tostring(result));
		return undefined;
	}

	const track = result as AnimationTrack;
	track.Name = name;
	track.Priority = priority;
	return track;
}

function refreshIdle(speed = 0): void {
	const movingNow = speed > 0.1;
	if (movingNow) {
		isMoving = true;
		stopIdle();
		return;
	}
	isMoving = false;
	if (equippedWeaponId === "fists") {
		stopIdle();
		return;
	}
	if (idleTrack?.IsPlaying) return;

	const animationId = WEAPONS[equippedWeaponId]?.idleAnimationId;
	if (!animationId) {
		stopIdle();
		return;
	}

	idleTrack = loadTrack(animationId, "WeaponIdle_" + equippedWeaponId, Enum.AnimationPriority.Action);
	if (idleTrack) {
		idleTrack.Looped = true;
		idleTrack.Play(0.2);
		print("[WEAPON-ANIMATION] Playing idle for " + equippedWeaponId);
	}
}

function bindCharacter(character: Model): void {
	stopIdle();
	isMoving = false;
	runningConnection?.Disconnect();
	const humanoid = character.WaitForChild("Humanoid") as Humanoid;
	runningConnection = humanoid.Running.Connect((speed) => refreshIdle(speed));
	task.defer(() => refreshIdle(humanoid.MoveDirection.Magnitude * humanoid.WalkSpeed));
}

function playAttack(weaponId: string): void {
	const animationId = WEAPONS[weaponId]?.attackAnimationId;
	if (!animationId) return;

	const track = loadTrack(animationId, "WeaponAttack_" + weaponId, Enum.AnimationPriority.Action4);
	if (!track) return;
	track.Looped = false;
	track.Stopped.Once(() => {
		track.Destroy();
		const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
		refreshIdle(humanoid ? humanoid.MoveDirection.Magnitude * humanoid.WalkSpeed : 0);
	});
	track.Play(0.05);
	print("[WEAPON-ANIMATION] Playing attack for " + weaponId);
}

export function initializeWeaponAnimations(): void {
	if (initialized) return;
	initialized = true;

	if (player.Character) bindCharacter(player.Character);
	player.CharacterAdded.Connect(bindCharacter);

	const remote = getWeaponAnimationRemote();
	remote.OnClientEvent.Connect((action: unknown, weaponId: unknown) => {
		if (!typeIs(action, "string") || !typeIs(weaponId, "string")) return;
		if (action === "equip") {
			const weaponChanged = equippedWeaponId !== weaponId;
			equippedWeaponId = weaponId;
			if (weaponChanged) stopIdle();
			const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
			refreshIdle(humanoid ? humanoid.MoveDirection.Magnitude * humanoid.WalkSpeed : 0);
		} else if (action === "sheathe") {
			equippedWeaponId = "fists";
			stopIdle();
		} else if (action === "attack") {
			playAttack(weaponId);
		}
	});
}
