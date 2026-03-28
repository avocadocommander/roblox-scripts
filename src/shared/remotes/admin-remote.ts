import { getRemotesFolder, getRemoteFunction } from "shared/remote-utils";

/** Client -> Server: admin command (add money, xp, level up, reset, random bounty, etc.). */
export function getAdminCommandRemote(): RemoteFunction {
	return getRemoteFunction(getRemotesFolder(), "AdminCommand");
}

/**
 * Admin user IDs allowed to use the admin panel.
 * Add your Roblox UserId here. 0 = allow everyone (dev/testing mode).
 */
export const ADMIN_USER_IDS: number[] = [0];
