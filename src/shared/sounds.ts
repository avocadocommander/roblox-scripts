import { useAssetId } from "./module";

export function playSound(root: Part, soundAssetId: string, delay = 0) {
	task.delay(delay, () => {
		const sound = new Instance("Sound");
		sound.SoundId = useAssetId(soundAssetId); // replace with real slash sound
		sound.Volume = 1;
		sound.RollOffMode = Enum.RollOffMode.Inverse;
		sound.RollOffMaxDistance = 100;
		sound.Parent = root;
		sound.Play();

		// Optional: Destroy after playing to clean up
		sound.Ended.Connect(() => sound.Destroy());
	});
}
