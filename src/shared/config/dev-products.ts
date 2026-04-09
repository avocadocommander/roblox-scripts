/**
 * Developer Product configuration — repeat-purchasable Robux items.
 *
 * Unlike Game Passes (one-time), Developer Products can be bought multiple
 * times. Each purchase fires `ProcessReceipt` on the server, which grants
 * the reward defined here.
 */

export interface DevProductDef {
	/** Roblox Developer Product ID. */
	productId: number;
	/** Human-readable name. */
	name: string;
	/** Item ID to grant on purchase (looked up in ITEMS). */
	grantItemId: string;
	/** How many of that item to grant per purchase. */
	grantCount: number;
}

/** Master Developer Product catalogue — keyed by product ID. */
export const DEV_PRODUCTS: Record<number, DevProductDef> = {
	3571561126: {
		productId: 3571561126,
		name: "O's Guidance",
		grantItemId: "os_guidance",
		grantCount: 2,
	},
};
