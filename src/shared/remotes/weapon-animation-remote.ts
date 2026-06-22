import { getRemotesFolder, getRemoteEvent } from "shared/remote-utils";

/** Server -> owning client: update or play a weapon animation. */
export function getWeaponAnimationRemote(): RemoteEvent {
	return getRemoteEvent(getRemotesFolder(), "WeaponAnimation");
}
