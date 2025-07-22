export function makeSeededRandom(seed: number): () => number {
	let currentSeed = seed;

	return () => {
		currentSeed = (currentSeed * 9301 + 49297) % 233280;
		return currentSeed / 233280;
	};
}

export function getSeedFromName(name: string): number {
	let seed = 0;
	for (let i = 0; i < name.size(); i++) {
		const char = name.sub(i + 1, i + 1);
		const byte = string.byte(char) as unknown as number;
		seed += byte;
	}
	return seed;
}
