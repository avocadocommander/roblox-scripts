// import { Players, ReplicatedStorage } from "@rbxts/services";
// import { makeHello } from "shared/module";

// print(makeHello("main.server.ts"));

// const player = Players.LocalPlayer;

// const baseAxe = ReplicatedStorage.WaitForChild("Axe") as Tool;
// const backpack = player.FindFirstChild("Backpack") as Backpack;

// const clonedSword = baseAxe.Clone();
// clonedSword.Parent = backpack;

// clonedSword.Activated.Connect(() => {
// 	const character = clonedSword.Parent;
// 	if (!character || !character.IsA("Model")) return;

// 	const humanoid = character.FindFirstChildOfClass("Humanoid");
// 	if (!humanoid) return;

// 	let animator = humanoid.FindFirstChildOfClass("Animator");
// 	if (!animator) {
// 		animator = new Instance("Animator");
// 		animator.Parent = humanoid;
// 	}

// 	const anim = new Instance("Animation");
// 	anim.AnimationId = "rbxassetid://120887923201458";
// 	const track = animator.LoadAnimation(anim);
// 	track.Play();
// });