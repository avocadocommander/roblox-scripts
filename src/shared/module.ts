import { NPC } from "./npc";

export function makeHello(name: string) {
	return `Hello from ${name}!`;
}

export function useAssetId(id: string) {
	return `rbxassetid://${id}`;
}

export const MEDIEVAL_NPC_NAMES = [
	// Humans
	"Alaric Thornbald",
	"Cedric de Ironsart",
	"Ealdred Cwilmere",
	"Godfrey de Morwen",
	"Osric Greydane",
	"Leofric Æshenford",
	"Theobald de Vexley",
	"Wymond Duskwathe",
	"Merien Chandewick",
	"Rowan Embermere",
	"Greta Millstone",
	"Brenna Wudwhistle",
	"Ulric Fenwatch",
	"Isolde Fairbloom",
	"Bertram de Mere",
	"Thorne Æshgrave",
	"Lyra Goldmead",
	"Edric Thornwell",
	"Moira Blackfen",
	"Garrick Hallowmere",
	"Halric Stonvein",
	"Ansel Ravendock",
	"Wulfgar Ironswake",
	"Thessia Dewmantle",
	"Magnus Coldmere",
	"Selwyn Ashthorne",
	"Idris Moorwatch",
	"Rowena Brambleholt",
	"Giselle Dawnmere",
	"Torvald Ironbriar",

	// Elves
	"Faelanis Windglen",
	"Thalion Brightshade",
	"Elandriel Moonvale",
	"Caerwyn Duskwhisper",
	"Aerendyl Silversong",
	"Thessaly Nywen",
	"Varethion Hollowmantle",
	"Seraphina Duskwillow",
	"Tamsin Silmare",
	"Yseldra Nightbloom",
	"Elira Frostbrook",
	"Fiora Thistlewynd",
	"Selara Moonpetal",
	"Fenriel Duskbranch",
	"Aeloria Silvercrest",
	"Lorien Blackvale",
	"Maelis Stormgrove",

	// Goblins
	"Aldruk Ravensnarl",
	"Baldric Stonhelm",
	"Orrug Grimquill",
	"Tobruk Mudfoot",
	"Edda Barleyroot",
	"Hamlin Wainwright",
	"Aldon Brightforge",
	"Brandok Oakshield",
	"Draven Mirefang",
	"Zara Mudtwig",
	"Korrin Blackgrit",
	"Vrixa Thornsnout",
	"Drogath Greenfang",
	"Orvar Stoneclad",
	"Grishka Tallowhide",
] as const;
export type MedievalNPCName = (typeof MEDIEVAL_NPC_NAMES)[number];

export type Position = "Serf" | "Commoner" | "Merchant" | "Nobility" | "Royalty";
export type Gender = "M" | "F";
export type Race = "Human" | "Elf" | "Goblin";
export interface NPCData {
	gender: Gender;
	race: Race;
	position: Position;
}

export type NPCModel = Record<string, NPCData>;

export const MEDIEVAL_NPCS: NPCModel = {
	// Humans
	"Alaric Thornbald": { gender: "M", race: "Human", position: "Serf" },
	"Cedric de Ironsart": { gender: "M", race: "Human", position: "Royalty" },
	"Ealdred Cwilmere": { gender: "M", race: "Human", position: "Serf" },
	"Godfrey de Morwen": { gender: "M", race: "Human", position: "Nobility" },
	"Osric Greydane": { gender: "M", race: "Human", position: "Serf" },
	"Leofric Æshenford": { gender: "M", race: "Human", position: "Serf" },
	"Theobald de Vexley": { gender: "M", race: "Human", position: "Serf" },
	"Wymond Duskwathe": { gender: "M", race: "Human", position: "Serf" },
	"Merien Chandewick": { gender: "F", race: "Human", position: "Serf" },
	"Rowan Embermere": { gender: "F", race: "Human", position: "Serf" },
	"Greta Millstone": { gender: "F", race: "Human", position: "Serf" },
	"Brenna Wudwhistle": { gender: "F", race: "Human", position: "Serf" },
	"Ulric Fenwatch": { gender: "M", race: "Human", position: "Serf" },
	"Isolde Fairbloom": { gender: "F", race: "Human", position: "Commoner" },
	"Bertram de Mere": { gender: "M", race: "Human", position: "Merchant" },
	"Thorne Æshgrave": { gender: "M", race: "Human", position: "Serf" },
	"Lyra Goldmead": { gender: "F", race: "Human", position: "Merchant" },
	"Edric Thornwell": { gender: "M", race: "Human", position: "Commoner" },
	"Moira Blackfen": { gender: "F", race: "Human", position: "Serf" },
	"Garrick Hallowmere": { gender: "M", race: "Human", position: "Merchant" },
	"Halric Stonvein": { gender: "M", race: "Human", position: "Commoner" },
	"Ansel Ravendock": { gender: "M", race: "Human", position: "Serf" },
	"Wulfgar Ironswake": { gender: "M", race: "Human", position: "Nobility" },
	"Thessia Dewmantle": { gender: "F", race: "Human", position: "Serf" },
	"Magnus Coldmere": { gender: "M", race: "Human", position: "Serf" },
	"Selwyn Ashthorne": { gender: "M", race: "Human", position: "Serf" },
	"Idris Moorwatch": { gender: "M", race: "Human", position: "Commoner" },
	"Rowena Brambleholt": { gender: "F", race: "Human", position: "Merchant" },
	"Giselle Dawnmere": { gender: "F", race: "Human", position: "Nobility" },
	"Torvald Ironbriar": { gender: "M", race: "Human", position: "Serf" },

	// Elves
	"Faelanis Windglen": { gender: "F", race: "Elf", position: "Serf" },
	"Thalion Brightshade": { gender: "M", race: "Elf", position: "Serf" },
	"Elandriel Moonvale": { gender: "M", race: "Elf", position: "Serf" },
	"Caerwyn Duskwhisper": { gender: "M", race: "Elf", position: "Commoner" },
	"Aerendyl Silversong": { gender: "F", race: "Elf", position: "Royalty" },
	"Thessaly Nywen": { gender: "F", race: "Elf", position: "Merchant" },
	"Varethion Hollowmantle": { gender: "M", race: "Elf", position: "Nobility" },
	"Seraphina Duskwillow": { gender: "F", race: "Elf", position: "Nobility" },
	"Tamsin Silmare": { gender: "F", race: "Elf", position: "Royalty" },
	"Yseldra Nightbloom": { gender: "F", race: "Elf", position: "Nobility" },
	"Elira Frostbrook": { gender: "F", race: "Elf", position: "Commoner" },
	"Fiora Thistlewynd": { gender: "F", race: "Elf", position: "Merchant" },
	"Selara Moonpetal": { gender: "F", race: "Elf", position: "Commoner" },
	"Fenriel Duskbranch": { gender: "M", race: "Elf", position: "Merchant" },
	"Aeloria Silvercrest": { gender: "F", race: "Elf", position: "Nobility" },
	"Lorien Blackvale": { gender: "F", race: "Elf", position: "Serf" },
	"Maelis Stormgrove": { gender: "F", race: "Elf", position: "Royalty" },

	// Goblins
	"Aldruk Ravensnarl": { gender: "M", race: "Goblin", position: "Nobility" },
	"Baldric Stonhelm": { gender: "M", race: "Goblin", position: "Merchant" },
	"Orrug Grimquill": { gender: "M", race: "Goblin", position: "Serf" },
	"Tobruk Mudfoot": { gender: "M", race: "Goblin", position: "Serf" },
	"Edda Barleyroot": { gender: "F", race: "Goblin", position: "Merchant" },
	"Hamlin Wainwright": { gender: "M", race: "Goblin", position: "Serf" },
	"Aldon Brightforge": { gender: "M", race: "Goblin", position: "Merchant" },
	"Brandok Oakshield": { gender: "M", race: "Goblin", position: "Merchant" },
	"Draven Mirefang": { gender: "M", race: "Goblin", position: "Serf" },
	"Zara Mudtwig": { gender: "F", race: "Goblin", position: "Commoner" },
	"Korrin Blackgrit": { gender: "M", race: "Goblin", position: "Merchant" },
	"Vrixa Thornsnout": { gender: "F", race: "Goblin", position: "Serf" },
	"Drogath Greenfang": { gender: "M", race: "Goblin", position: "Nobility" },
	"Orvar Stoneclad": { gender: "M", race: "Goblin", position: "Serf" },
	"Grishka Tallowhide": { gender: "F", race: "Goblin", position: "Serf" },
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
