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
export type Race = "Human" | "Elf" | "Dwarf" | "Hobbit" | "Goblin";
export interface NPCData {
	gender: Gender;
	race: Race;
	position: Position;
}

export type NPCModel = Record<string, NPCData>;

export const MEDIEVAL_NPCS: NPCModel = {
	"Alaric Thornblade": { gender: "M", race: "Human", position: "Serf" },
	"Cedric Ironhart": { gender: "M", race: "Dwarf", position: "Royalty" },
	"Ealdred Crowmere": { gender: "M", race: "Human", position: "Serf" },
	"Godfrey Blackmoor": { gender: "M", race: "Human", position: "Nobility" },
	"Aldwyn Ravenshield": { gender: "F", race: "Elf", position: "Nobility" },
	"Baldric Stonehelm": { gender: "M", race: "Dwarf", position: "Merchant" },
	"Osric Greydawn": { gender: "M", race: "Human", position: "Serf" },
	"Leofric Ashenford": { gender: "M", race: "Human", position: "Serf" },
	"Theobald Vexmere": { gender: "M", race: "Human", position: "Serf" },
	"Wymond Duskwharf": { gender: "M", race: "Human", position: "Serf" },
	"Faelan Windglen": { gender: "F", race: "Elf", position: "Serf" },
	"Thalion Brightshade": { gender: "M", race: "Elf", position: "Serf" },
	"Elandor Moonvale": { gender: "F", race: "Elf", position: "Commoner" },
	"Caerwyn Duskwhisper": { gender: "M", race: "Elf", position: "Commoner" },
	"Aerendyl Silversong": { gender: "F", race: "Elf", position: "Royalty" },
	"Merien Candlewick": { gender: "F", race: "Human", position: "Serf" },
	"Rowan Emberhollow": { gender: "F", race: "Human", position: "Serf" },
	"Orren Grimquill": { gender: "M", race: "Goblin", position: "Serf" },
	"Thessaly Nightglen": { gender: "F", race: "Elf", position: "Merchant" },
	"Vareth Hollowmantle": { gender: "M", race: "Elf", position: "Nobility" },
	"Tobias Mudfoot": { gender: "M", race: "Hobbit", position: "Serf" },
	"Edda Barleyroot": { gender: "F", race: "Hobbit", position: "Merchant" },
	"Hamlin Wainwright": { gender: "M", race: "Hobbit", position: "Serf" },
	"Greta Millstone": { gender: "F", race: "Human", position: "Serf" },
	"Brenna Woodwhistle": { gender: "F", race: "Human", position: "Serf" },
	"Ulric Fenwatch": { gender: "M", race: "Human", position: "Serf" },
	"Isolde Fairbloom": { gender: "F", race: "Human", position: "Commoner" },
	"Bertram Deepmere": { gender: "M", race: "Human", position: "Merchant" },
	"Seraphina Duskwillow": { gender: "F", race: "Elf", position: "Nobility" },
	"Thorne Ashgrave": { gender: "M", race: "Human", position: "Serf" },
	"Lyra Goldmead": { gender: "F", race: "Human", position: "Merchant" },
	"Edric Thornwell": { gender: "M", race: "Human", position: "Commoner" },
	"Moira Blackfen": { gender: "F", race: "Human", position: "Serf" },
	"Garrick Hollowvale": { gender: "M", race: "Human", position: "Merchant" },
	"Tamsin Silvermere": { gender: "F", race: "Elf", position: "Royalty" },
	"Aldon Brightforge": { gender: "M", race: "Dwarf", position: "Merchant" },
	"Yseldra Nightbloom": { gender: "F", race: "Elf", position: "Nobility" },
	"Halric Stonevein": { gender: "M", race: "Human", position: "Commoner" },
	"Ansel Ravenwharf": { gender: "M", race: "Human", position: "Serf" },
	"Elira Frostbrook": { gender: "F", race: "Elf", position: "Commoner" },
	"Wulfgar Ironwake": { gender: "M", race: "Human", position: "Nobility" },
	"Thessia Dewmantle": { gender: "F", race: "Human", position: "Serf" },
	"Brandis Oakshield": { gender: "M", race: "Dwarf", position: "Merchant" },
	"Fiora Thistlewynd": { gender: "F", race: "Elf", position: "Merchant" },
	"Magnus Coldmere": { gender: "M", race: "Human", position: "Serf" },
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

export const SATIRICAL_BOUNTY_OFFENSES: string[] = [
	"Whispered 'Nice Hat' to the King. The king hasn't recovered emotionally.",
	"Milked the tavern goat without a permit. The goat is pressing charges.",
	"Played the lute poorly… thrice. The instrument begged for mercy.",
	"Insisted the earth is round—while in the presence of flatlanders. Caused a riot at the cartography guild.",
	"Sold invisible swords to children. Surprisingly effective, but still illegal.",
	"Laughed during a public execution (too soon). The condemned was offended.",
	"Challenged a guard to a duel, then immediately ran away. Was heard yelling 'psych!' mid-sprint.",
	"Used a healing potion recreationally. Claimed it 'enhanced vibes'.",
	"Attempted to bribe a pigeon for state secrets. The pigeon accepted.",
	"Declared themselves 'King of the Alley' without proper lineage. The rats were not impressed.",
	"Drew a mustache on the royal statue. The likeness was uncanny.",
	"Brewed tea using necromantic herbs. Now the teacup whispers at night.",
	"Held a staring contest with the sun. Lost. Twice.",
	"Filed a noise complaint against thunder. Nature did not respond kindly.",
	"Illegally enchanted a spoon to sing sea shanties. It won't stop. Please make it stop.",
	"Claimed to be a dragon slayer but only had chicken bones. Excellent storytelling, poor evidence.",
	"Stole a noble’s shadow and refused to give it back. The noble is now only visible at night.",
	"Fed the town’s ducks experimental bread. Ducks now float three inches above water.",
	"Said 'Yeet' in a court of law. Confused the magistrate and enraged the bailiff.",
	"Held an unlicensed beard-growing contest. The winner was promptly arrested.",
	"Grew suspiciously tall overnight. Villagers demand to know what fertilizer was used.",
	"Painted fake doors around town. Citizens now trapped in elaborate mime routines.",
	"Attempted to marry a ghost for land rights. The ghost declined.",
	"Summoned rain indoors 'for ambiance'. Tavern owner still drying mugs.",
	"Declared war on a scarecrow. Victory was swift but unnecessary.",
	"Built a ladder to eavesdrop on the moon. The moon said nothing.",
	"Spoke only in riddles for a week. Was eventually thrown in a well.",
	"Put googly eyes on the royal guard’s helmets. Morale has never been higher. Still treason.",
	"Attempted to patent 'breathing'. The town exhaled in protest.",
	"Formed a cult worshipping bread crusts. Surprisingly well attended.",
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
