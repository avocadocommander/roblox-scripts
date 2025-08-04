import { NPC } from "./npc";

export function makeHello(name: string) {
	return `Hello from ${name}!`;
}

export function useAssetId(id: string) {
	return `rbxassetid://${id}`;
}

export const MEDIEVAL_NPC_NAMES = [
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
	"Ulric Fenwatch",
	"Isolde Fairbloom",
	"Bertram Deepmere",
	"Seraphina Duskwillow",
	"Thorne Ashgrave",
	"Lyra Goldmead",
	"Edric Thornwell",
	"Moira Blackfen",
	"Garrick Hollowvale",
	"Tamsin Silvermere",
	"Aldon Brightforge",
	"Yseldra Nightbloom",
	"Halric Stonevein",
	"Ansel Ravenwharf",
	"Elira Frostbrook",
	"Wulfgar Ironwake",
	"Thessia Dewmantle",
	"Brandis Oakshield",
	"Fiora Thistlewynd",
	"Magnus Coldmere",
] as const;
export type MedievalNPCName = (typeof MEDIEVAL_NPC_NAMES)[number];

export type Position = "Serf" | "Commoner" | "Merchant" | "Nobility" | "Royalty";
export type Gender = "M" | "F";
export interface NPCData {
	gender: Gender;
	position: Position;
}

export type NPCModel = Record<string, NPCData>;

export const MEDIEVAL_NPCS: NPCModel = {
	"Alaric Thornblade": { gender: "M", position: "Serf" },
	"Cedric Ironhart": { gender: "M", position: "Royalty" },
	"Ealdred Crowmere": { gender: "M", position: "Serf" },
	"Godfrey Blackmoor": { gender: "M", position: "Nobility" },
	"Aldwyn Ravenshield": { gender: "F", position: "Nobility" },
	"Baldric Stonehelm": { gender: "M", position: "Merchant" },
	"Osric Greydawn": { gender: "M", position: "Serf" },
	"Leofric Ashenford": { gender: "M", position: "Serf" },
	"Theobald Vexmere": { gender: "M", position: "Serf" },
	"Wymond Duskwharf": { gender: "M", position: "Serf" },
	"Faelan Windglen": { gender: "F", position: "Serf" },
	"Thalion Brightshade": { gender: "M", position: "Serf" },
	"Elandor Moonvale": { gender: "F", position: "Commoner" },
	"Caerwyn Duskwhisper": { gender: "M", position: "Commoner" },
	"Aerendyl Silversong": { gender: "F", position: "Royalty" },
	"Merien Candlewick": { gender: "F", position: "Serf" },
	"Rowan Emberhollow": { gender: "F", position: "Serf" },
	"Orren Grimquill": { gender: "M", position: "Serf" },
	"Thessaly Nightglen": { gender: "F", position: "Merchant" },
	"Vareth Hollowmantle": { gender: "M", position: "Nobility" },
	"Tobias Mudfoot": { gender: "M", position: "Serf" },
	"Edda Barleyroot": { gender: "F", position: "Merchant" },
	"Hamlin Wainwright": { gender: "M", position: "Serf" },
	"Greta Millstone": { gender: "F", position: "Serf" },
	"Brenna Woodwhistle": { gender: "F", position: "Serf" },
	"Ulric Fenwatch": { gender: "M", position: "Serf" },
	"Isolde Fairbloom": { gender: "F", position: "Commoner" },
	"Bertram Deepmere": { gender: "M", position: "Merchant" },
	"Seraphina Duskwillow": { gender: "F", position: "Nobility" },
	"Thorne Ashgrave": { gender: "M", position: "Serf" },
	"Lyra Goldmead": { gender: "F", position: "Merchant" },
	"Edric Thornwell": { gender: "M", position: "Commoner" },
	"Moira Blackfen": { gender: "F", position: "Serf" },
	"Garrick Hollowvale": { gender: "M", position: "Merchant" },
	"Tamsin Silvermere": { gender: "F", position: "Royalty" },
	"Aldon Brightforge": { gender: "M", position: "Merchant" },
	"Yseldra Nightbloom": { gender: "F", position: "Nobility" },
	"Halric Stonevein": { gender: "M", position: "Commoner" },
	"Ansel Ravenwharf": { gender: "M", position: "Serf" },
	"Elira Frostbrook": { gender: "F", position: "Commoner" },
	"Wulfgar Ironwake": { gender: "M", position: "Nobility" },
	"Thessia Dewmantle": { gender: "F", position: "Serf" },
	"Brandis Oakshield": { gender: "M", position: "Merchant" },
	"Fiora Thistlewynd": { gender: "F", position: "Merchant" },
	"Magnus Coldmere": { gender: "M", position: "Serf" },
};

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
	npc: NPC;
	route: Folder;
}

export type RoutePace = "Slow" | "Medium" | "Fast";
