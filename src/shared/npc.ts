import { log } from "./helpers";

export class NPC {
	displayName: string;
	seed: number;
	humanoid!: Humanoid;
	type: NPCType;
	model!: Model;

	constructor(modelClone: Model, name: string, type: NPCType) {
		modelClone.Parent = Workspace;
		modelClone.Name = name;
		this.type = type;

		this.displayName = name;
		this.seed = this.getSeedFromName(name);
		const humanoid = modelClone.FindFirstChildOfClass("Humanoid");
		if (!humanoid) return;
		const setHumanoid = this.setHumanoidDefaults(humanoid);
		if (!setHumanoid) return;

		this.humanoid = setHumanoid;
		this.model = modelClone;
	}

	public getRandomnessFromSeed() {
		return this.makeSeededRandom(this.seed);
	}

	private getGenericSeededAppearance(
		humanoidDescription: HumanoidDescription,
		seed: () => number,
	): HumanoidDescription | undefined {
		const faces = [
			20418658, 12145366, 25166274, 8329679, 162068415, 10907551, 2222771916, 391496223, 7074893, 15432080,
			8560971, 406001167, 7317765, 616381207,
		];
		const hair = ["63690008", "16630147", "2956239660", "2956239660", "5891039736", "4875445470", "6441556987"];
		const realisticSkinTones: Color3[] = [
			Color3.fromRGB(255, 224, 189), // Fair
			Color3.fromRGB(241, 194, 125), // Light
			Color3.fromRGB(224, 172, 105), // Light tan
			Color3.fromRGB(198, 134, 66), // Olive
			Color3.fromRGB(141, 85, 36), // Brown
			Color3.fromRGB(101, 67, 33), // Dark brown
			Color3.fromRGB(77, 51, 25), // Very dark
			Color3.fromRGB(232, 190, 172), // Rosy fair
			Color3.fromRGB(203, 144, 102), // Warm tan
			Color3.fromRGB(160, 114, 77), // Deep tan
		];

		const skinIndex = math.floor(seed() * realisticSkinTones.size()) + 1;
		const skinColor: Color3 = realisticSkinTones[skinIndex - 1];

		humanoidDescription.HeadColor = skinColor;
		humanoidDescription.LeftArmColor = skinColor;
		humanoidDescription.RightArmColor = skinColor;
		humanoidDescription.LeftLegColor = skinColor;
		humanoidDescription.RightLegColor = skinColor;
		humanoidDescription.TorsoColor = skinColor;

		humanoidDescription.Face = faces[math.floor(seed() * faces.size())];
		humanoidDescription.Head = 746767604;
		humanoidDescription.HairAccessory = hair[math.floor(seed() * hair.size())];

		return humanoidDescription;
	}

	private setHumanoidDefaults(humanoid: Humanoid): Humanoid | undefined {
		humanoid.WalkSpeed = 8;
		const npcDescription = humanoid.GetAppliedDescription();
		if (!npcDescription) {
			log("Appearence unavalialbe for npc spawn", "ERROR");
			return undefined;
		}
		const rand = this.makeSeededRandom(this.seed);
		this.randomizeBodyShape(npcDescription, rand);
		const appearenceDescription = getGenericSeededAppearance(npcDescription, rand);

		if (!appearenceDescription) return;
		humanoid.ApplyDescription(appearenceDescription);
		return humanoid;
	}

	private makeSeededRandom(seed: number): () => number {
		let currentSeed = seed;

		return () => {
			currentSeed = (currentSeed * 9301 + 49297) % 233280;
			return currentSeed / 233280;
		};
	}

	private getSeedFromName(name: string): number {
		if (!name) throw "No see was created with undefined name";

		let seed = 0;
		for (let i = 0; i < name.size(); i++) {
			const char = name.sub(i + 1, i + 1);
			const byte = string.byte(char) as unknown as number;
			seed += byte;
		}
		return seed;
	}

	private randomizeBodyShape(npcDescription: HumanoidDescription, seed: () => number) {
		npcDescription.BodyTypeScale = math.round(seed() * 100) / 100; // 0.0 to 1.0
		npcDescription.ProportionScale = math.round(seed() * 100) / 100;

		npcDescription.HeightScale = math.round((0.9 + seed() * 0.15) * 100) / 100; // 0.9 to 1.05
		npcDescription.WidthScale = math.round((0.9 + seed() * 0.15) * 100) / 100;
		npcDescription.DepthScale = math.round((0.9 + seed() * 0.15) * 100) / 100;

		npcDescription.HeadScale = math.round((0.8 + seed() * 0.4) * 100) / 100; // 0.8 to 1.2
	}
}
