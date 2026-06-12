export type EnchantmentId = "dawns_guide";

export interface EnchantmentDef {
	id: EnchantmentId;
	displayName: string;
	aliases: string[];
	lightColor: Color3;
	coreColor: Color3;
	secondaryColor: Color3;
}

export const ENCHANTMENTS: Record<EnchantmentId, EnchantmentDef> = {
	dawns_guide: {
		id: "dawns_guide",
		displayName: "Dawn's Guide",
		aliases: ["Dawn's Guide", "Dawns Guide", "dawns_guide", "dawns-guide"],
		lightColor: Color3.fromRGB(255, 176, 74),
		coreColor: Color3.fromRGB(255, 226, 128),
		secondaryColor: Color3.fromRGB(255, 90, 34),
	},
};

const ENCHANTMENT_ALIAS_LOOKUP = (() => {
	const lookup = new Map<string, EnchantmentId>();
	for (const [, enchantment] of pairs(ENCHANTMENTS)) {
		lookup.set(enchantment.id.lower(), enchantment.id);
		lookup.set(enchantment.displayName.lower(), enchantment.id);
		for (const alias of enchantment.aliases) {
			lookup.set(alias.lower(), enchantment.id);
		}
	}
	return lookup;
})();

export function resolveEnchantmentId(value: string | undefined): EnchantmentId | undefined {
	if (value === undefined || value === "") return undefined;
	return ENCHANTMENT_ALIAS_LOOKUP.get(value.lower());
}
