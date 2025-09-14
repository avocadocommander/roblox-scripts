export type Pace = "Stationary" | "Slow" | "Medium" | "Fast";
export type Position = "Guard" | "Preacher";
export type Tempo = "Chill" | "Hurry" | "Gas";
export type RouteConfig = Partial<RouteConfiguration>;

interface RouteConfiguration {
	pace: Pace;
	position: Position;
	tempo: number;
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

	const tempo = configFromPart.FindFirstChild("Tempo") as StringValue;
	if (tempo) {
		const tempoMap: Record<Tempo, number> = {
			Chill: math.random(10, 60),
			Hurry: math.random(5, 10),
			Gas: math.random(1, 2),
		};
		routeConfig.tempo = tempoMap[tempo.Value as Tempo];
	}
	return routeConfig;
}
