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
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type SocialClass = "Serf" | "Commoner" | "Merchant" | "Nobility" | "Royalty";
export type Gender = "M" | "F";
export type Race = "Human" | "Elf" | "Goblin";

export interface NPCDef {
	name: string;
	gender: Gender;
	race: Race;
	socialClass: SocialClass;
	occupation: string;
	killable: boolean;
	fixedRouteId: string | undefined;
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
	"Bertram de Mere": std("Bertram de Mere", "M", "Human", "Merchant", "Merchant"),
	"Thorne Æshgrave": std("Thorne Æshgrave", "M", "Human", "Serf"),
	"Lyra Goldmead": std("Lyra Goldmead", "F", "Human", "Merchant", "Merchant"),
	"Edric Thornwell": std("Edric Thornwell", "M", "Human", "Commoner"),
	"Moira Blackfen": std("Moira Blackfen", "F", "Human", "Serf"),
	"Garrick Hallowmere": std("Garrick Hallowmere", "M", "Human", "Merchant", "Merchant"),
	"Halric Stonvein": std("Halric Stonvein", "M", "Human", "Commoner"),
	"Ansel Ravendock": std("Ansel Ravendock", "M", "Human", "Serf"),
	"Wulfgar Ironswake": std("Wulfgar Ironswake", "M", "Human", "Nobility", "Noble"),
	"Thessia Dewmantle": std("Thessia Dewmantle", "F", "Human", "Serf"),
	"Magnus Coldmere": std("Magnus Coldmere", "M", "Human", "Serf"),
	"Selwyn Ashthorne": std("Selwyn Ashthorne", "M", "Human", "Serf"),
	"Idris Moorwatch": std("Idris Moorwatch", "M", "Human", "Commoner"),
	"Rowena Brambleholt": std("Rowena Brambleholt", "F", "Human", "Merchant", "Merchant"),
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
	"Thessaly Nywen": std("Thessaly Nywen", "F", "Elf", "Merchant", "Merchant"),
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

/** All NPCs that can be randomly assigned to routes (killable, no fixed route). */
export const ROUTABLE_NPC_NAMES = NPC_NAMES.filter((n) => {
	const def = NPC_REGISTRY[n];
	return def.killable && def.fixedRouteId === undefined;
});

/** All NPCs with a fixed route assignment. */
export const FIXED_ROUTE_NPC_NAMES = NPC_NAMES.filter((n) => NPC_REGISTRY[n].fixedRouteId !== undefined);

/** Returns true if `npcName` is killable (can be assassinated). */
export function isNPCKillable(npcName: string): boolean {
	const def = NPC_REGISTRY[npcName];
	return def !== undefined && def.killable;
}
