/**
 * NPC Registry — data-only config.
 *
 * Every NPC in the game is defined here. To add a new NPC just add an entry
 * to `NPC_REGISTRY`. The rest of the codebase reads from this file.
 *
 * Key concepts:
 *  - `socialClass`   — the NPC's social tier (Serf/Commoner/Merchant/Nobility/Royalty).
 *                      Drives rarity colours, reward scaling, clothing, etc.
 *  - `occupation`    — the NPC's functional role ("Noble", "Merchant", "Mentor", etc.).
 *                      Metadata for now; will drive dialog/shop behaviour later.
 *  - `killable`      — whether the NPC can be assassinated. Unkillable NPCs still
 *                      converse / trade if applicable.
 *  - `fixedRouteId`  — if set, the NPC is always assigned to this specific route
 *                      instead of being randomly allocated on server start.
 *  - `shop`          — optional shop config. If present the NPC is a vendor.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type SocialClass = "Serf" | "Commoner" | "Merchant" | "Nobility" | "Royalty";
export type Gender = "M" | "F";
export type Race = "Human" | "Elf" | "Goblin";

/** A single item available for purchase at a shop. */
export interface ShopItem {
	itemId: string;
	price: number;
	maxOwned?: number;
}

/** Full shop definition for one NPC vendor. */
export interface NPCShopDef {
	greetings: string[];
	chatLines: string[];
	farewells: string[];
	shopItems: ShopItem[];
}

export interface NPCDef {
	name: string;
	gender: Gender;
	race: Race;
	socialClass: SocialClass;
	occupation: string;
	killable: boolean;
	fixedRouteId: string | undefined;
	shop: NPCShopDef | undefined;
}

export type NPCRegistry = Record<string, NPCDef>;

// ── Helper to build a standard (killable, randomly-routed) NPC entry ──────────

function std(name: string, gender: Gender, race: Race, socialClass: SocialClass, occupation?: string): NPCDef {
	return {
		name,
		gender,
		race,
		socialClass,
		occupation: occupation ?? socialClass,
		killable: true,
		fixedRouteId: undefined,
		shop: undefined,
	};
}

// ── The Registry ──────────────────────────────────────────────────────────────

export const NPC_REGISTRY: NPCRegistry = {
	// ── Humans ────────────────────────────────────────────────────────────
	"Alaric Thornbald": std("Alaric Thornbald", "M", "Human", "Serf"),
	"Cedric de Ironsart": std("Cedric de Ironsart", "M", "Human", "Royalty"),
	"Ealdred Cwilmere": std("Ealdred Cwilmere", "M", "Human", "Serf"),
	"Godfrey de Morwen": std("Godfrey de Morwen", "M", "Human", "Nobility", "Noble"),
	"Osric Greydane": std("Osric Greydane", "M", "Human", "Serf"),
	"Leofric Æshenford": std("Leofric Æshenford", "M", "Human", "Serf"),
	"Theobald de Vexley": std("Theobald de Vexley", "M", "Human", "Serf"),
	"Wymond Duskwathe": std("Wymond Duskwathe", "M", "Human", "Serf"),
	"Merien Chandewick": std("Merien Chandewick", "F", "Human", "Serf"),
	"Rowan Embermere": std("Rowan Embermere", "F", "Human", "Serf"),
	"Greta Millstone": std("Greta Millstone", "F", "Human", "Serf"),
	"Brenna Wudwhistle": std("Brenna Wudwhistle", "F", "Human", "Serf"),
	"Ulric Fenwatch": std("Ulric Fenwatch", "M", "Human", "Serf"),
	"Isolde Fairbloom": std("Isolde Fairbloom", "F", "Human", "Commoner"),
	"Bertram de Mere": {
		...std("Bertram de Mere", "M", "Human", "Merchant", "Merchant"),
		fixedRouteId: "Top Dog",
		shop: {
			greetings: [
				"Ah, a customer. Browse, but do not touch what you cannot afford.",
				"Welcome to my humble stall. Everything here has a price.",
				"You look like someone who needs... supplies.",
			],
			chatLines: [
				"The roads grow dangerous. Wise folk carry protection.",
				"I once sold a dagger to a man who returned it... in my back. I learned to charge more.",
				"Business has been slow since the guard patrols increased.",
				"Keep your coin purse close. Thieves lurk in every shadow.",
			],
			farewells: [
				"Come again when your purse is heavier.",
				"Safe travels. Try not to die before you spend more.",
				"Until next time, friend.",
			],
			shopItems: [
				{ itemId: "dagger", price: 500 },
				{ itemId: "floating_death", price: 300 },
				{ itemId: "slow_decay", price: 200 },
				{ itemId: "swiftness_elixir", price: 250 },
			],
		},
	},
	"Thorne Æshgrave": std("Thorne Æshgrave", "M", "Human", "Serf"),
	"Lyra Goldmead": {
		...std("Lyra Goldmead", "F", "Human", "Merchant", "Merchant"),
		shop: {
			greetings: [
				"Step closer, dear. I have just the thing.",
				"Potions, poisons, and a smile. What more could you want?",
				"Ah, another seeker of liquid courage.",
			],
			chatLines: [
				"The elves distill finer brews, but mine work just as well.",
				"A drop of this in the right goblet... well, you understand.",
				"I test everything I sell. That is why I shake sometimes.",
				"The apothecary guild frowns on my methods. I frown back.",
			],
			farewells: [
				"May your aim be true and your poisons potent.",
				"Do not mix those together. Seriously.",
				"Return when you need more. You always do.",
			],
			shopItems: [
				{ itemId: "floating_death", price: 280 },
				{ itemId: "slow_decay", price: 180 },
				{ itemId: "paralysis_toxin", price: 350 },
				{ itemId: "dragons_breath", price: 600 },
				{ itemId: "phantom_venom", price: 500 },
			],
		},
	},
	"Edric Thornwell": std("Edric Thornwell", "M", "Human", "Commoner"),
	"Moira Blackfen": std("Moira Blackfen", "F", "Human", "Serf"),
	"Garrick Hallowmere": {
		...std("Garrick Hallowmere", "M", "Human", "Merchant", "Merchant"),
		fixedRouteId: "Merchant House 1",
		shop: {
			greetings: [
				"Need something to keep you alive? You have come to the right place.",
				"Elixirs, tonics, and the occasional miracle. Step right up.",
				"I can see you are the type who values survival. Smart.",
			],
			chatLines: [
				"The Vitality Draught saved my life once. Twice, actually.",
				"Ghost Oil is not cheap, but neither is your life.",
				"I brew under moonlight. Old habit. Probably means nothing.",
				"The market has been rough since the new tariffs. Prices reflect that.",
			],
			farewells: [
				"Stay alive out there. Repeat customers are my favourite.",
				"Good luck. You will need it.",
				"Off you go. And remember -- drink responsibly.",
			],
			shopItems: [
				{ itemId: "swiftness_elixir", price: 200 },
				{ itemId: "sky_step", price: 350 },
				{ itemId: "shadow_cloak", price: 500 },
				{ itemId: "eagle_eye", price: 400 },
				{ itemId: "vitality_draught", price: 300 },
				{ itemId: "ghost_oil", price: 700 },
			],
		},
	},
	"Halric Stonvein": std("Halric Stonvein", "M", "Human", "Commoner"),
	"Ansel Ravendock": std("Ansel Ravendock", "M", "Human", "Serf"),
	"Wulfgar Ironswake": std("Wulfgar Ironswake", "M", "Human", "Nobility", "Noble"),
	"Thessia Dewmantle": std("Thessia Dewmantle", "F", "Human", "Serf"),
	"Magnus Coldmere": std("Magnus Coldmere", "M", "Human", "Serf"),
	"Selwyn Ashthorne": std("Selwyn Ashthorne", "M", "Human", "Serf"),
	"Idris Moorwatch": std("Idris Moorwatch", "M", "Human", "Commoner"),
	"Rowena Brambleholt": {
		...std("Rowena Brambleholt", "F", "Human", "Merchant", "Merchant"),
		shop: {
			greetings: [
				"What do you need, stranger? Make it quick.",
				"Weapons, tools of the trade. Browse at your leisure.",
				"You have the look of someone who needs a sharp edge.",
			],
			chatLines: [
				"Every blade I sell has tasted blood at least once. Quality assurance.",
				"The guards do not bother me. Professional courtesy.",
				"A good weapon is the difference between predator and prey.",
				"I sharpen blades and tongues. Both cut deep.",
			],
			farewells: [
				"May your steel stay sharp.",
				"Do not come back broken. Come back richer.",
				"Mind the edge. I just honed it.",
			],
			shopItems: [
				{ itemId: "dagger", price: 450 },
				{ itemId: "slow_decay", price: 220 },
				{ itemId: "swiftness_elixir", price: 280 },
				{ itemId: "sky_step", price: 380 },
			],
		},
	},
	"Giselle Dawnmere": std("Giselle Dawnmere", "F", "Human", "Nobility", "Noble"),
	"Torvald Ironbriar": std("Torvald Ironbriar", "M", "Human", "Serf"),
	"Crispin Hayward": std("Crispin Hayward", "M", "Human", "Commoner"),
	"Merek de Lowenford": std("Merek de Lowenford", "M", "Human", "Merchant", "Merchant"),
	"Agnes Hearthwyfe": std("Agnes Hearthwyfe", "F", "Human", "Serf"),
	"Tilda Mossbraid": std("Tilda Mossbraid", "F", "Human", "Commoner"),
	"Oswyn Blackmere": std("Oswyn Blackmere", "M", "Human", "Serf"),
	"Hugh Caskwell": std("Hugh Caskwell", "M", "Human", "Commoner"),
	"Sabine de Wintermere": std("Sabine de Wintermere", "F", "Human", "Nobility", "Noble"),
	"Frida Thatchbrook": std("Frida Thatchbrook", "F", "Human", "Serf"),
	"Geoffrey Saltmarsh": std("Geoffrey Saltmarsh", "M", "Human", "Merchant", "Merchant"),
	"Alinor Fairholt": std("Alinor Fairholt", "F", "Human", "Commoner"),

	// ── Elves ─────────────────────────────────────────────────────────────
	"Faelanis Windglen": std("Faelanis Windglen", "F", "Elf", "Serf"),
	"Thalion Brightshade": std("Thalion Brightshade", "M", "Elf", "Serf"),
	"Elandriel Moonvale": std("Elandriel Moonvale", "M", "Elf", "Serf"),
	"Caerwyn Duskwhisper": std("Caerwyn Duskwhisper", "M", "Elf", "Commoner"),
	"Aerendyl Silversong": std("Aerendyl Silversong", "F", "Elf", "Royalty"),
	"Thessaly Nywen": {
		...std("Thessaly Nywen", "F", "Elf", "Merchant", "Merchant"),
		shop: {
			greetings: [
				"An outsider. How... quaint. What do you seek?",
				"Elven craft at human prices. You will not find a better deal.",
				"The forest provides. For a fee.",
			],
			chatLines: [
				"Elven poisons are an art. Human poisons are... enthusiastic.",
				"I have lived three of your lifetimes. Trust my expertise.",
				"The Phantom Venom was my grandmother's recipe. She was terrifying.",
				"Do not mistake my patience for weakness.",
			],
			farewells: ["Walk softly, short-lived one.", "The forest watches. As do I.", "Until the next moon."],
			shopItems: [
				{ itemId: "phantom_venom", price: 450 },
				{ itemId: "dragons_breath", price: 550 },
				{ itemId: "shadow_cloak", price: 480 },
				{ itemId: "eagle_eye", price: 380 },
				{ itemId: "ghost_oil", price: 650 },
			],
		},
	},
	"Varethion Hollowmantle": std("Varethion Hollowmantle", "M", "Elf", "Nobility", "Noble"),
	"Seraphina Duskwillow": std("Seraphina Duskwillow", "F", "Elf", "Nobility", "Noble"),
	"Tamsin Silmare": std("Tamsin Silmare", "F", "Elf", "Royalty"),
	"Yseldra Nightbloom": std("Yseldra Nightbloom", "F", "Elf", "Nobility", "Noble"),
	"Elira Frostbrook": std("Elira Frostbrook", "F", "Elf", "Commoner"),
	"Fiora Thistlewynd": std("Fiora Thistlewynd", "F", "Elf", "Merchant", "Merchant"),
	"Selara Moonpetal": std("Selara Moonpetal", "F", "Elf", "Commoner"),
	"Fenriel Duskbranch": std("Fenriel Duskbranch", "M", "Elf", "Merchant", "Merchant"),
	"Aeloria Silvercrest": std("Aeloria Silvercrest", "F", "Elf", "Nobility", "Noble"),
	"Lorien Blackvale": std("Lorien Blackvale", "F", "Elf", "Serf"),
	"Maelis Stormgrove": std("Maelis Stormgrove", "F", "Elf", "Royalty"),
	"Ithariel Dawnsong": std("Ithariel Dawnsong", "M", "Elf", "Nobility", "Noble"),
	"Sylwen Starbrook": std("Sylwen Starbrook", "F", "Elf", "Commoner"),
	"Vaelion Greenmantle": std("Vaelion Greenmantle", "M", "Elf", "Merchant", "Merchant"),
	"Orendis Whisperglen": std("Orendis Whisperglen", "M", "Elf", "Serf"),
	"Nythera Frostpetal": std("Nythera Frostpetal", "F", "Elf", "Commoner"),
	"Thalindra Emberglen": std("Thalindra Emberglen", "F", "Elf", "Merchant", "Merchant"),
	"Corenith Leafwhisper": std("Corenith Leafwhisper", "M", "Elf", "Serf"),
	"Elvandar Duskpetal": std("Elvandar Duskpetal", "M", "Elf", "Nobility", "Noble"),

	// ── Goblins ───────────────────────────────────────────────────────────
	"Aldruk Ravensnarl": std("Aldruk Ravensnarl", "M", "Goblin", "Nobility", "Noble"),
	"Baldric Stonhelm": std("Baldric Stonhelm", "M", "Goblin", "Merchant", "Merchant"),
	"Orrug Grimquill": std("Orrug Grimquill", "M", "Goblin", "Serf"),
	"Tobruk Mudfoot": std("Tobruk Mudfoot", "M", "Goblin", "Serf"),
	"Edda Barleyroot": std("Edda Barleyroot", "F", "Goblin", "Merchant", "Merchant"),
	"Hamlin Wainwright": std("Hamlin Wainwright", "M", "Goblin", "Serf"),
	"Aldon Brightforge": std("Aldon Brightforge", "M", "Goblin", "Merchant", "Merchant"),
	"Brandok Oakshield": std("Brandok Oakshield", "M", "Goblin", "Merchant", "Merchant"),
	"Draven Mirefang": std("Draven Mirefang", "M", "Goblin", "Serf"),
	"Zara Mudtwig": std("Zara Mudtwig", "F", "Goblin", "Commoner"),
	"Korrin Blackgrit": std("Korrin Blackgrit", "M", "Goblin", "Merchant", "Merchant"),
	"Vrixa Thornsnout": std("Vrixa Thornsnout", "F", "Goblin", "Serf"),
	"Drogath Greenfang": std("Drogath Greenfang", "M", "Goblin", "Nobility", "Noble"),
	"Orvar Stoneclad": std("Orvar Stoneclad", "M", "Goblin", "Serf"),
	"Grishka Tallowhide": std("Grishka Tallowhide", "F", "Goblin", "Serf"),
	"Grubnik Sootfang": std("Grubnik Sootfang", "M", "Goblin", "Serf"),
	"Snaga Miregut": std("Snaga Miregut", "F", "Goblin", "Serf"),
	"Drekka Ironnose": std("Drekka Ironnose", "M", "Goblin", "Merchant", "Merchant"),
	"Fizzle Toadsnout": std("Fizzle Toadsnout", "F", "Goblin", "Commoner"),
	"Zogmar Brambletoe": std("Zogmar Brambletoe", "M", "Goblin", "Serf"),
	"Krilla Tallowtongue": std("Krilla Tallowtongue", "F", "Goblin", "Merchant", "Merchant"),
	"Mograt Splinterjaw": std("Mograt Splinterjaw", "M", "Goblin", "Serf"),
	"Prixa Coalbriar": std("Prixa Coalbriar", "F", "Goblin", "Commoner"),
};

// ── Derived helpers ───────────────────────────────────────────────────────────

/** Build a names list from the registry keys using pairs(). */
function registryKeys(): string[] {
	const out: string[] = [];
	for (const [name] of pairs(NPC_REGISTRY)) {
		out.push(name as string);
	}
	return out;
}

/** Ordered list of all NPC names (mirrors the old MEDIEVAL_NPC_NAMES). */
export const NPC_NAMES = registryKeys();

/** All NPCs that can be randomly assigned to routes (killable, no fixed route, non-merchant). */
export const ROUTABLE_NPC_NAMES = NPC_NAMES.filter((n) => {
	const def = NPC_REGISTRY[n];
	return def.killable && def.fixedRouteId === undefined && def.socialClass !== "Merchant";
});

/** All NPCs with a fixed route assignment. */
export const FIXED_ROUTE_NPC_NAMES = NPC_NAMES.filter((n) => NPC_REGISTRY[n].fixedRouteId !== undefined);

/** Returns true if `npcName` is killable (can be assassinated). */
export function isNPCKillable(npcName: string): boolean {
	const def = NPC_REGISTRY[npcName];
	return def !== undefined && def.killable;
}
