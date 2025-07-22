export function makeHello(name: string) {
	return `Hello from ${name}!`;
}

export function useAssetId(id: string) {
	return `rbxassetid://${id}`;
}

export const MEDIEVAL_NAMES: string[] = [
	"Alaric Thornblade",
	"Cedric Ironhart",
	"Ealdred Crowmere",
	"Godfrey Blackmoor",
	"Aldwyn Ravenshield",
	"Baldric Stonehelm",
	"Osric Greydawn",
	"Leofric Ashenford",
	"Theobald Vexmere",
	"Wymond Duskwharf",

	"Faelan Windglen",
	"Thalion Brightshade",
	"Elandor Moonvale",
	"Caerwyn Duskwhisper",
	"Aerendyl Silversong",

	"Merien Candlewick",
	"Rowan Emberhollow",
	"Orren Grimquill",
	"Thessaly Nightglen",
	"Vareth Hollowmantle",

	"Tobias Mudfoot",
	"Edda Barleyroot",
	"Hamlin Wainwright",
	"Greta Millstone",
	"Brenna Woodwhistle",
];

export const NPC_TYPE_VALUES = ["GUARD", "TARGET", "MERCHANT", "COMMONER"] as const;
export type NPCType = (typeof NPC_TYPE_VALUES)[number];
export function isNPCType(value: string): value is NPCType {
	return typeOf(value) === "string" && NPC_TYPE_VALUES.includes(value as NPCType);
}

export const MEDIEVAL_PHRASES = [
	"Hail, traveler! What brings thee to these lands?",
	"Stay thy blade, friend. There's no quarrel here.",
	"Mind thy step—the woods are not kind to fools.",
	"The king’s taxes grow heavier with each moon.",
	"A pint of mead cures all ills, or so they say.",
	"The blacksmith’s temper is as hot as his forge.",
	"Beware the road east—bandits lie in wait.",
	"These lands once knew peace, before the war.",
	"Magic? Aye, it flows still, but it's not free.",
	"No coin, no service. That’s the way of things.",
	"I’ve seen dragons in my dreams... or worse.",
	"A noble heart beats stronger than any sword.",
	"The well’s gone dry. Rain better come soon.",
	"Speak not of the old ruins. Dark things stir.",
	"The stars above are restless tonight...",
	"Many a hero has walked that path. Few return.",
	"Care for a game of dice? I’ve coin to win.",
	"Strangers are rare. Are you lost—or hunting?",
	"They say the forest whispers to those who listen.",
	"A good cloak and a sharp dagger—every rogue's kit.",
];

export function getRandomMedievalPhrase(): string {
	const index = math.random(1, MEDIEVAL_PHRASES.size());
	return MEDIEVAL_PHRASES[index - 1];
}


export interface Assignment {
	npc: Model;
	route: Folder;
}