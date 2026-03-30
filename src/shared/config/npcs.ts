/**
 * NPC Registry — data-only config.
 *
 * Every NPC in the game is defined here. To add a new NPC just add an entry
 * to `NPC_REGISTRY`. The rest of the codebase reads from this file.
 *
 * Design rule: Occupation describes fantasy identity. Interaction describes
 * player-facing function. A "Merchant" occupation is flavour; "Shop"
 * interaction is system behaviour. They are related but NOT identical.
 *
 * Key concepts:
 *  - `socialClass`   — the NPC's social tier (Serf/Commoner/Merchant/Nobility/Royalty).
 *                      Drives rarity colours, reward scaling, clothing, etc.
 *  - `occupation`    — the NPC's fantasy identity ("Noble", "Merchant", "Herbalist",
 *                      "Guard", "Beggar", "Mentor", "Broker", etc.).
 *  - `interaction`   — the player-facing system behaviour:
 *                        "Ambient"        — floating quips only, no dialog panel.
 *                        "Shop"           — opens dialog with trade grid.
 *                        "Quest"          — opens dialog with quest options.
 *                        "TurnIn"         — guild leader: accepts bounty scrolls for rewards.
 *                        "Mixed"          — combination (dialog + shop, etc.).
 *  - `killable`      — whether the NPC can be assassinated. Unkillable NPCs still
 *                      converse / trade if applicable.
 *  - `fixedRouteId`  — if set, the NPC is always assigned to this specific route
 *                      instead of being randomly allocated on server start.
 *  - `dialog`        — optional conversation lines (greetings, chatLines, farewells).
 *                      Any non-Ambient NPC should have these.
 *  - `shop`          — optional shop items list. Only needed for "Shop" / "Mixed".
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type SocialClass = "Serf" | "Commoner" | "Merchant" | "Nobility" | "Royalty";
export type Gender = "M" | "F";
export type Race = "Human" | "Elf" | "Goblin";

/**
 * Player-facing system behaviour.
 * Occupation is flavour ("Merchant", "Herbalist"). Interaction is function.
 */
export type Interaction = "Ambient" | "Shop" | "Quest" | "TurnIn" | "Mixed";

/** A single item available for purchase at a shop. */
export interface ShopItem {
	itemId: string;
	price: number;
	maxOwned?: number;
}

/** Conversation lines for any non-Ambient NPC. */
export interface NPCDialogDef {
	greetings: string[];
	chatLines: string[];
	farewells: string[];
}

/** Shop inventory — items only. Dialog lines live in NPCDialogDef. */
export interface NPCShopDef {
	shopItems: ShopItem[];
}

export interface NPCDef {
	name: string;
	gender: Gender;
	race: Race;
	socialClass: SocialClass;
	occupation: string;
	interaction: Interaction;
	killable: boolean;
	fixedRouteId: string | undefined;
	dialog: NPCDialogDef | undefined;
	shop: NPCShopDef | undefined;
}

export type NPCRegistry = Record<string, NPCDef>;

// ── Helper to build a standard (killable, randomly-routed) NPC entry ──────────

function std(
	name: string,
	gender: Gender,
	race: Race,
	socialClass: SocialClass,
	occupation?: string,
	interaction?: Interaction,
): NPCDef {
	return {
		name,
		gender,
		race,
		socialClass,
		occupation: occupation ?? socialClass,
		interaction: interaction ?? "Ambient",
		killable: true,
		fixedRouteId: undefined,
		dialog: undefined,
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
		...std("Bertram de Mere", "M", "Human", "Nobility", "Guildmaster"),
		interaction: "TurnIn",
		fixedRouteId: "Templar",
		dialog: {
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
		},
	},
	"Thorne Æshgrave": {
		...std("Thorne Æshgrave", "M", "Human", "Serf", "Guildmaster"),
		interaction: "TurnIn",
		fixedRouteId: "Thorne",
		killable: false,
		dialog: {
			greetings: ["Listen -- theres far more you will hear", "Do i know you?"],
			chatLines: [
				"You bring me bounties -- and I give you coin",
				"Don't cary too many bounties at once -- the vultures are out",
				"Who is my boss? ...Nobody",
			],
			farewells: ["Come back again - we are always open", "Until next time -- if there is a next time."],
		},
	},
	"Veyra Ashenmaw": {
		...std("Veyra Ashenmaw", "F", "Elf", "Merchant", "Merchant"),
		interaction: "Shop",
		fixedRouteId: "Merchant House Main",
		killable: true,
		dialog: {
			greetings: [
				"Another errand runner. Show me what you have.",
				"You smell of blood. Good. That means you have something for me.",
				"Thorne sends his scraps my way. I prefer the whole meal.",
			],
			chatLines: [
				"Thorne is a relic. His guild crumbles while mine grows.",
				"Loyalty is purchased, not earned. Remember that.",
				"The more scrolls you bring me, the more I trust you.",
				"Every name on those scrolls is one less problem in my way.",
			],
			farewells: [
				"Do not waste my time with empty hands next visit.",
				"Run along. And bring more next time.",
				"We are not finished. We are never finished.",
			],
		},
		shop: {
			shopItems: [
				{ itemId: "fleetfoot_elixir", price: 280 },
				{ itemId: "featherfall_draught", price: 400 },
				{ itemId: "veil_of_silence", price: 580 },
			],
		},
	},
	"Lyra Goldmead": {
		...std("Lyra Goldmead", "F", "Human", "Merchant", "Merchant"),
		interaction: "Shop",
		fixedRouteId: "Merchant House 1",
		dialog: {
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
		},
		shop: {
			shopItems: [
				{ itemId: "levitation_poison", price: 300 },
				{ itemId: "shrinking_curse", price: 450 },
				{ itemId: "dismembering_blight", price: 700 },
			],
		},
	},
	"Edric Thornwell": std("Edric Thornwell", "M", "Human", "Commoner"),
	"Moira Blackfen": std("Moira Blackfen", "F", "Human", "Serf"),
	"Garrick Hallowmere": {
		...std("Garrick Hallowmere", "M", "Human", "Merchant", "Merchant"),
		interaction: "Shop",
		fixedRouteId: "Tender",
		dialog: {
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
		},
		shop: {
			shopItems: [
				{ itemId: "fleetfoot_elixir", price: 250 },
				{ itemId: "featherfall_draught", price: 380 },
				{ itemId: "veil_of_silence", price: 550 },
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
		fixedRouteId: "Back Camp Merchant",
		interaction: "Shop",
		dialog: {
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
		},
		shop: {
			shopItems: [
				{ itemId: "dagger", price: 450 },
				{ itemId: "levitation_poison", price: 280 },
				{ itemId: "fleetfoot_elixir", price: 260 },
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
		interaction: "Shop",
		fixedRouteId: "Cart Merchant",
		dialog: {
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
		},
		shop: {
			shopItems: [
				{ itemId: "levitation_poison", price: 350 },
				{ itemId: "shrinking_curse", price: 500 },
				{ itemId: "dismembering_blight", price: 750 },
				{ itemId: "fleetfoot_elixir", price: 300 },
				{ itemId: "featherfall_draught", price: 400 },
				{ itemId: "veil_of_silence", price: 600 },
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

/** All NPCs that can be randomly assigned to routes (killable, no fixed route, ambient-only). */
export const ROUTABLE_NPC_NAMES = NPC_NAMES.filter((n) => {
	const def = NPC_REGISTRY[n];
	return def.killable && def.fixedRouteId === undefined && def.interaction === "Ambient";
});

/** All NPCs with a fixed route assignment. */
export const FIXED_ROUTE_NPC_NAMES = NPC_NAMES.filter((n) => NPC_REGISTRY[n].fixedRouteId !== undefined);

/** Returns true if `npcName` is killable (can be assassinated). */
export function isNPCKillable(npcName: string): boolean {
	const def = NPC_REGISTRY[npcName];
	return def !== undefined && def.killable;
}

/** Get the player-facing interaction type for an NPC. */
export function getNPCInteraction(npcName: string): Interaction {
	return NPC_REGISTRY[npcName]?.interaction ?? "Ambient";
}

/** Returns true if the NPC opens a dialog panel (anything other than Ambient). */
export function hasNPCDialog(npcName: string): boolean {
	const def = NPC_REGISTRY[npcName];
	return def !== undefined && def.interaction !== "Ambient";
}
