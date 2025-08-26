import { ReplicatedStorage } from "@rbxts/services";

const invNet = ReplicatedStorage.WaitForChild("Net").WaitForChild("Level") as Folder;
const GetLevel = invNet.WaitForChild("GetLevel") as RemoteFunction;

export function accessCheck(requiredLevel: number) {
	const accessLevel = GetLevel.InvokeServer() as number;
	warn(`requiredLevel ${requiredLevel} | myLevel ${accessLevel}`);
	return requiredLevel >= accessLevel;
}
