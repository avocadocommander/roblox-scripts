export type Pace = "Stationary" | "Slow" | "Medium" | "Fast";
export type Position = "Guard" | "Preacher";
export type RouteConfig = Partial<RouteConfiguration>;

interface RouteConfiguration {
	pace: Pace;
	position: Position;
}

export function getConfigFromRoute(routeConfigParent: Folder): RouteConfig | undefined {
	const routeConfig: RouteConfig = {};
	const configFromPart = routeConfigParent.FindFirstChild("Configuration") as Configuration;
	if (!configFromPart) {
		return undefined;
	}
	const pace = configFromPart.FindFirstChild("Pace") as StringValue;
	if (pace) {
		routeConfig.pace = pace.Value as Pace;
	}
	const npcType = configFromPart.FindFirstChild("NPCType") as StringValue;
	if (npcType) {
		routeConfig.position = npcType.Value as Position;
	}
	return routeConfig;
}
