import { DataStoreService, HttpService, Players, Workspace } from "@rbxts/services";
import { log } from "shared/helpers";
import { AdminCommandResult, AdminMetricsStats, ADMIN_USER_IDS } from "shared/remotes/admin-remote";

const TAG = "[POSITION-METRICS]";
const STORE_NAME = "PlayerPositionMetrics_v1";
const INDEX_STORE_NAME = "PlayerPositionMetricsIndex_v1";
const SAMPLE_INTERVAL_SECS = 10;
const SAVE_INTERVAL_SECS = 60;
const MAX_SAMPLES_PER_PLAYER = 720; // 2 hours at 10-second sampling.
const MAX_INDEXED_SESSIONS = 250;
const VISUAL_FOLDER_NAME = "DebugPlayerPositionTrails";
const HISTORICAL_VISUAL_FOLDER_NAME = "DebugHistoricalPositionTrails";
const HISTORICAL_SESSION_LIMIT = 5;
const VISUAL_MAX_SAMPLES_PER_PLAYER = 120; // 20 minutes at 10-second sampling.
const VISUAL_POINT_SIZE = new Vector3(1.25, 1.25, 1.25);
const VISUAL_POINT_Y_OFFSET = 0.65;
const VISUAL_BEAM_WIDTH = 0.22;
const DEBUG_BOARD_NAME = "MetricsDebugBoard";
const DEBUG_BOARD_SIZE = new Vector3(18, 10, 0.4);

interface PlayerPositionSample {
	timestamp: number;
	x: number;
	y: number;
	z: number;
}

interface PlayerPositionSeries {
	userId: number;
	playerName: string;
	displayName: string;
	samples: PlayerPositionSample[];
}

interface PositionMetricsExport {
	schemaVersion: number;
	placeId: number;
	jobId: string;
	sessionKey: string;
	dayKey: string;
	sampleIntervalSecs: number;
	exportedAt: number;
	players: PlayerPositionSeries[];
}

interface PositionMetricsSessionIndex {
	updatedAt: number;
	sessions: string[];
}

interface HistoricalRenderStats {
	modeLabel: string;
	sessionCount: number;
	playerPathCount: number;
	uniquePlayerCount: number;
	pointCount: number;
	longestSessionSecs: number;
	longestSessionLabel: string;
	firstSampleAt: number | undefined;
	lastSampleAt: number | undefined;
	minPosition: Vector3 | undefined;
	maxPosition: Vector3 | undefined;
}

interface PositionMetricsResult extends AdminCommandResult {
	metricsActive: boolean;
	metricsStats?: AdminMetricsStats;
}

const metricsStore = DataStoreService.GetDataStore(STORE_NAME);
const indexStore = DataStoreService.GetDataStore(INDEX_STORE_NAME);
const serverSessionId = game.JobId !== "" ? game.JobId : "studio-" + HttpService.GenerateGUID(false);
const sessionKey = "s:" + serverSessionId;
const excludedUserIds = new Set<number>(ADMIN_USER_IDS.filter((userId) => userId !== 0));
const samplesByUserId = new Map<number, PlayerPositionSeries>();

let initialized = false;
let lastSaveAt = 0;
let visualsEnabled = false;
let historicalVisualsEnabled = false;

function roundCoord(value: number): number {
	return math.round(value * 100) / 100;
}

function colorForUserId(userId: number): Color3 {
	const hue = ((userId * 97) % 360) / 360;
	return Color3.fromHSV(hue, 0.75, 1);
}

function isPositionMetricsExcludedUserId(userId: number): boolean {
	if (excludedUserIds.has(userId)) return true;
	return game.CreatorType === Enum.CreatorType.User && userId === game.CreatorId;
}

function shouldRecordPlayer(player: Player): boolean {
	return !isPositionMetricsExcludedUserId(player.UserId);
}

export function excludePlayerFromPositionMetrics(player: Player): void {
	excludedUserIds.add(player.UserId);
	samplesByUserId.delete(player.UserId);
}

function getDayKey(timestamp: number): string {
	return "day:" + tostring(math.floor(timestamp / 86400));
}

function formatDuration(seconds: number): string {
	const whole = math.max(0, math.floor(seconds));
	const hours = math.floor(whole / 3600);
	const minutes = math.floor((whole % 3600) / 60);
	const secs = whole % 60;
	if (hours > 0) return `${hours}h ${minutes}m`;
	if (minutes > 0) return `${minutes}m ${secs}s`;
	return `${secs}s`;
}

function emptyStats(modeLabel: string): AdminMetricsStats {
	return {
		modeLabel,
		sessions: 0,
		players: 0,
		paths: 0,
		points: 0,
		longestSession: "0s",
		window: "0s",
	};
}

function statsPayload(stats: HistoricalRenderStats): AdminMetricsStats {
	return {
		modeLabel: stats.modeLabel,
		sessions: stats.sessionCount,
		players: stats.uniquePlayerCount,
		paths: stats.playerPathCount,
		points: stats.pointCount,
		longestSession: formatDuration(stats.longestSessionSecs),
		window:
			stats.firstSampleAt !== undefined && stats.lastSampleAt !== undefined
				? formatDuration(stats.lastSampleAt - stats.firstSampleAt)
				: "0s",
	};
}

function liveStatsPayload(): AdminMetricsStats {
	let playerCount = 0;
	let pointCount = 0;
	let firstSampleAt: number | undefined;
	let lastSampleAt: number | undefined;
	let longestSeriesSecs = 0;

	for (const [, series] of samplesByUserId) {
		if (isPositionMetricsExcludedUserId(series.userId) || series.samples.size() === 0) continue;
		playerCount += 1;
		pointCount += series.samples.size();
		const first = series.samples[0].timestamp;
		const last = series.samples[series.samples.size() - 1].timestamp;
		firstSampleAt = firstSampleAt === undefined ? first : math.min(firstSampleAt, first);
		lastSampleAt = lastSampleAt === undefined ? last : math.max(lastSampleAt, last);
		longestSeriesSecs = math.max(longestSeriesSecs, last - first);
	}

	return {
		modeLabel: "Live trails",
		sessions: 1,
		players: playerCount,
		paths: playerCount,
		points: pointCount,
		longestSession: formatDuration(longestSeriesSecs),
		window:
			firstSampleAt !== undefined && lastSampleAt !== undefined ? formatDuration(lastSampleAt - firstSampleAt) : "0s",
	};
}

function getOrCreateVisualsFolder(folderName: string): Folder {
	let folder = Workspace.FindFirstChild(folderName) as Folder | undefined;
	if (!folder) {
		folder = new Instance("Folder");
		folder.Name = folderName;
		folder.Parent = Workspace;
	}
	return folder;
}

function clearVisualsFolder(folderName: string): void {
	const folder = Workspace.FindFirstChild(folderName);
	if (folder) folder.Destroy();
}

function clearPositionVisuals(): void {
	clearVisualsFolder(VISUAL_FOLDER_NAME);
}

function clearHistoricalPositionVisuals(): void {
	clearVisualsFolder(HISTORICAL_VISUAL_FOLDER_NAME);
}

function getOrCreateSeries(player: Player): PlayerPositionSeries {
	let series = samplesByUserId.get(player.UserId);
	if (!series) {
		series = {
			userId: player.UserId,
			playerName: player.Name,
			displayName: player.DisplayName,
			samples: [],
		};
		samplesByUserId.set(player.UserId, series);
	} else {
		series.playerName = player.Name;
		series.displayName = player.DisplayName;
	}
	return series;
}

function getCharacterPosition(player: Player): Vector3 | undefined {
	const character = player.Character;
	if (!character) return undefined;

	const root = character.FindFirstChild("HumanoidRootPart");
	if (root?.IsA("BasePart")) return root.Position;

	const primary = character.PrimaryPart;
	if (primary) return primary.Position;

	return undefined;
}

function recordPlayerPosition(player: Player, timestamp: number): void {
	if (!shouldRecordPlayer(player)) {
		samplesByUserId.delete(player.UserId);
		return;
	}

	const position = getCharacterPosition(player);
	if (position === undefined) return;

	const series = getOrCreateSeries(player);
	series.samples.push({
		timestamp,
		x: roundCoord(position.X),
		y: roundCoord(position.Y),
		z: roundCoord(position.Z),
	});

	while (series.samples.size() > MAX_SAMPLES_PER_PLAYER) {
		series.samples.remove(0);
	}
}

function buildExportPayload(): PositionMetricsExport {
	const players: PlayerPositionSeries[] = [];
	for (const [, series] of samplesByUserId) {
		if (isPositionMetricsExcludedUserId(series.userId)) continue;
		players.push({
			userId: series.userId,
			playerName: series.playerName,
			displayName: series.displayName,
			samples: series.samples.map((sample) => ({
				timestamp: sample.timestamp,
				x: sample.x,
				y: sample.y,
				z: sample.z,
			})),
		});
	}

	players.sort((a, b) => a.userId < b.userId);

	return {
		schemaVersion: 1,
		placeId: game.PlaceId,
		jobId: serverSessionId,
		sessionKey,
		dayKey: getDayKey(os.time()),
		sampleIntervalSecs: SAMPLE_INTERVAL_SECS,
		exportedAt: os.time(),
		players,
	};
}

function upsertSessionIndex(indexKey: string): void {
	const [ok, err] = pcall(() => {
		indexStore.UpdateAsync(indexKey, (existing: unknown) => {
			const current = typeIs(existing, "table")
				? (existing as PositionMetricsSessionIndex)
				: ({ updatedAt: 0, sessions: [] } as PositionMetricsSessionIndex);
			const sessions = current.sessions ?? [];

			if (!sessions.includes(sessionKey)) {
				sessions.push(sessionKey);
			}
			while (sessions.size() > MAX_INDEXED_SESSIONS) {
				sessions.remove(0);
			}

			return $tuple({
				updatedAt: os.time(),
				sessions,
			});
		});
	});
	if (!ok) warn(`${TAG} Index update failed for ${indexKey}: ${err}`);
}

function updateSessionIndexes(): void {
	upsertSessionIndex("latestSessions");
	upsertSessionIndex(getDayKey(os.time()));
}

function saveSessionSnapshot(): void {
	const payload = buildExportPayload();
	const [ok, err] = pcall(() => {
		metricsStore.SetAsync(sessionKey, payload);
	});
	if (!ok) {
		warn(`${TAG} DataStore save failed for ${sessionKey}: ${err}`);
		return;
	}
	lastSaveAt = os.time();
	updateSessionIndexes();
}

function sampleAllPlayers(): void {
	const timestamp = os.time();
	for (const player of Players.GetPlayers()) {
		recordPlayerPosition(player, timestamp);
	}

	if (visualsEnabled) {
		refreshPositionVisuals();
	}

	if (timestamp - lastSaveAt >= SAVE_INTERVAL_SECS) {
		task.spawn(saveSessionSnapshot);
	}
}

function createTrailPoint(
	parent: Folder,
	series: PlayerPositionSeries,
	sample: PlayerPositionSample,
	color: Color3,
	pointIndex: number,
): Attachment {
	const part = new Instance("Part");
	part.Name = "Point_" + tostring(pointIndex);
	part.Size = VISUAL_POINT_SIZE;
	part.CFrame = new CFrame(sample.x, sample.y + VISUAL_POINT_Y_OFFSET, sample.z);
	part.Anchored = true;
	part.CanCollide = false;
	part.CanTouch = false;
	part.CanQuery = false;
	part.Material = Enum.Material.Neon;
	part.Color = color;
	part.Transparency = 0.15;
	part.SetAttribute("UserId", series.userId);
	part.SetAttribute("PlayerName", series.playerName);
	part.SetAttribute("DisplayName", series.displayName);
	part.SetAttribute("Timestamp", sample.timestamp);
	part.SetAttribute("X", sample.x);
	part.SetAttribute("Y", sample.y);
	part.SetAttribute("Z", sample.z);
	part.Parent = parent;

	const attachment = new Instance("Attachment");
	attachment.Name = "TrailAttachment";
	attachment.Parent = part;
	return attachment;
}

function renderSeriesTrail(root: Instance, series: PlayerPositionSeries, folderPrefix = ""): number {
	const samples = series.samples;
	if (samples.size() === 0) return 0;

	const color = colorForUserId(series.userId);
	const playerFolder = new Instance("Folder");
	playerFolder.Name = `${folderPrefix}${series.playerName}_${series.userId}`;
	playerFolder.SetAttribute("UserId", series.userId);
	playerFolder.SetAttribute("PlayerName", series.playerName);
	playerFolder.SetAttribute("DisplayName", series.displayName);
	playerFolder.SetAttribute("Color", color);
	playerFolder.Parent = root;

	let previousAttachment: Attachment | undefined;
	let renderedIndex = 0;
	const startIndex = math.max(0, samples.size() - VISUAL_MAX_SAMPLES_PER_PLAYER);
	for (let i = startIndex; i < samples.size(); i++) {
		renderedIndex += 1;
		const attachment = createTrailPoint(playerFolder, series, samples[i], color, renderedIndex);
		if (previousAttachment !== undefined) {
			const beam = new Instance("Beam");
			beam.Name = "Link_" + tostring(renderedIndex - 1) + "_To_" + tostring(renderedIndex);
			beam.Attachment0 = previousAttachment;
			beam.Attachment1 = attachment;
			beam.Color = new ColorSequence(color);
			beam.Width0 = VISUAL_BEAM_WIDTH;
			beam.Width1 = VISUAL_BEAM_WIDTH;
			beam.FaceCamera = true;
			beam.LightEmission = 0.7;
			beam.Transparency = new NumberSequence(0.1);
			beam.Parent = playerFolder;
		}
		previousAttachment = attachment;
	}

	return renderedIndex;
}

function refreshPositionVisuals(): void {
	clearPositionVisuals();

	const root = getOrCreateVisualsFolder(VISUAL_FOLDER_NAME);
	root.SetAttribute("SampleIntervalSecs", SAMPLE_INTERVAL_SECS);
	root.SetAttribute("MaxSamplesPerPlayer", VISUAL_MAX_SAMPLES_PER_PLAYER);
	root.SetAttribute("UpdatedAt", os.time());

	for (const [, series] of samplesByUserId) {
		renderSeriesTrail(root, series);
	}
}

function loadSessionKeysFromIndex(indexKey: string): string[] {
	const [ok, valueOrErr] = pcall(() => indexStore.GetAsync(indexKey));
	if (!ok) {
		warn(`${TAG} Failed to load session index ${indexKey}: ${valueOrErr}`);
		return [];
	}

	if (!typeIs(valueOrErr, "table")) return [];
	const index = valueOrErr as PositionMetricsSessionIndex;
	const sessions = index.sessions ?? [];
	const keys: string[] = [];
	let remaining = HISTORICAL_SESSION_LIMIT;
	for (let i = sessions.size() - 1; i >= 0 && remaining > 0; i--) {
		const key = sessions[i];
		if (key !== undefined) {
			keys.push(key);
			remaining -= 1;
		}
	}
	return keys;
}

function loadLatestSessionKeys(): string[] {
	return loadSessionKeysFromIndex("latestSessions");
}

function loadDaySessionKeys(daysAgo: number): string[] {
	return loadSessionKeysFromIndex(getDayKey(os.time() - daysAgo * 86400));
}

function loadSessionPayload(sessionDataKey: string): PositionMetricsExport | undefined {
	const [ok, valueOrErr] = pcall(() => metricsStore.GetAsync(sessionDataKey));
	if (!ok) {
		warn(`${TAG} Failed to load session ${sessionDataKey}: ${valueOrErr}`);
		return undefined;
	}
	if (!typeIs(valueOrErr, "table")) return undefined;
	return valueOrErr as PositionMetricsExport;
}

function updateStatsSampleWindow(
	stats: HistoricalRenderStats,
	sample: PlayerPositionSample,
): void {
	stats.firstSampleAt =
		stats.firstSampleAt === undefined ? sample.timestamp : math.min(stats.firstSampleAt, sample.timestamp);
	stats.lastSampleAt =
		stats.lastSampleAt === undefined ? sample.timestamp : math.max(stats.lastSampleAt, sample.timestamp);

	const position = new Vector3(sample.x, sample.y, sample.z);
	if (stats.minPosition === undefined || stats.maxPosition === undefined) {
		stats.minPosition = position;
		stats.maxPosition = position;
		return;
	}

	stats.minPosition = new Vector3(
		math.min(stats.minPosition.X, sample.x),
		math.min(stats.minPosition.Y, sample.y),
		math.min(stats.minPosition.Z, sample.z),
	);
	stats.maxPosition = new Vector3(
		math.max(stats.maxPosition.X, sample.x),
		math.max(stats.maxPosition.Y, sample.y),
		math.max(stats.maxPosition.Z, sample.z),
	);
}

function addDebugLabel(
	parent: Instance,
	text: string,
	y: number,
	height: number,
	color: Color3,
	textSize: number,
	bold = false,
): TextLabel {
	const label = new Instance("TextLabel");
	label.BackgroundTransparency = 1;
	label.Position = new UDim2(0, 10, 0, y);
	label.Size = new UDim2(1, -20, 0, height);
	label.Font = bold ? Enum.Font.GothamBold : Enum.Font.Gotham;
	label.Text = text;
	label.TextColor3 = color;
	label.TextSize = textSize;
	label.TextXAlignment = Enum.TextXAlignment.Left;
	label.TextYAlignment = Enum.TextYAlignment.Center;
	label.TextWrapped = true;
	label.Parent = parent;
	return label;
}

function addDebugButton(parent: Instance, text: string, y: number): void {
	const button = new Instance("Frame");
	button.BackgroundColor3 = Color3.fromRGB(24, 24, 30);
	button.BorderSizePixel = 0;
	button.Position = new UDim2(0, 10, 0, y);
	button.Size = new UDim2(1, -20, 0, 32);
	button.Parent = parent;

	const stroke = new Instance("UIStroke");
	stroke.Color = Color3.fromRGB(120, 98, 44);
	stroke.Thickness = 1;
	stroke.Transparency = 0.2;
	stroke.Parent = button;

	addDebugLabel(button, text, 0, 32, Color3.fromRGB(220, 202, 156), 18, true);
}

function addDebugStatBar(parent: Instance, label: string, valueText: string, ratio: number, y: number): void {
	const row = new Instance("Frame");
	row.BackgroundTransparency = 1;
	row.Position = new UDim2(0, 10, 0, y);
	row.Size = new UDim2(1, -20, 0, 30);
	row.Parent = parent;

	const title = new Instance("TextLabel");
	title.BackgroundTransparency = 1;
	title.Position = new UDim2(0, 0, 0, 0);
	title.Size = new UDim2(0.42, 0, 1, 0);
	title.Font = Enum.Font.GothamBold;
	title.Text = label;
	title.TextColor3 = Color3.fromRGB(165, 142, 86);
	title.TextSize = 15;
	title.TextXAlignment = Enum.TextXAlignment.Left;
	title.Parent = row;

	const bg = new Instance("Frame");
	bg.BackgroundColor3 = Color3.fromRGB(18, 18, 22);
	bg.BorderSizePixel = 0;
	bg.Position = new UDim2(0.42, 0, 0.24, 0);
	bg.Size = new UDim2(0.35, 0, 0.52, 0);
	bg.Parent = row;

	const fill = new Instance("Frame");
	fill.BackgroundColor3 = Color3.fromRGB(86, 154, 176);
	fill.BorderSizePixel = 0;
	fill.Size = new UDim2(math.clamp(ratio, 0, 1), 0, 1, 0);
	fill.Parent = bg;

	const value = new Instance("TextLabel");
	value.BackgroundTransparency = 1;
	value.Position = new UDim2(0.8, 0, 0, 0);
	value.Size = new UDim2(0.2, 0, 1, 0);
	value.Font = Enum.Font.Gotham;
	value.Text = valueText;
	value.TextColor3 = Color3.fromRGB(198, 188, 164);
	value.TextSize = 14;
	value.TextXAlignment = Enum.TextXAlignment.Right;
	value.Parent = row;
}

function renderMetricsDebugBoard(root: Folder, stats: HistoricalRenderStats): void {
	const old = root.FindFirstChild(DEBUG_BOARD_NAME);
	if (old) old.Destroy();

	const center =
		stats.minPosition !== undefined && stats.maxPosition !== undefined
			? stats.minPosition.add(stats.maxPosition).div(2)
			: new Vector3(0, 6, 0);
	const boardPosition =
		stats.maxPosition !== undefined
			? new Vector3(stats.maxPosition.X + 12, math.max(stats.maxPosition.Y + 7, 8), center.Z)
			: new Vector3(0, 8, 0);

	const board = new Instance("Part");
	board.Name = DEBUG_BOARD_NAME;
	board.Size = DEBUG_BOARD_SIZE;
	board.Anchored = true;
	board.CanCollide = false;
	board.CanQuery = false;
	board.CanTouch = false;
	board.Material = Enum.Material.SmoothPlastic;
	board.Color = Color3.fromRGB(9, 10, 13);
	board.CFrame = new CFrame(boardPosition);
	board.Parent = root;

	const gui = new Instance("SurfaceGui");
	gui.Name = "MetricsDebugGui";
	gui.Face = Enum.NormalId.Front;
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
	gui.PixelsPerStud = 42;
	gui.AlwaysOnTop = true;
	gui.LightInfluence = 0;
	gui.Parent = board;

	const frame = new Instance("Frame");
	frame.Size = UDim2.fromScale(1, 1);
	frame.BackgroundColor3 = Color3.fromRGB(10, 11, 15);
	frame.BackgroundTransparency = 0.04;
	frame.BorderSizePixel = 0;
	frame.Parent = gui;

	const stroke = new Instance("UIStroke");
	stroke.Color = Color3.fromRGB(120, 98, 44);
	stroke.Thickness = 2;
	stroke.Parent = frame;

	addDebugLabel(frame, "POSITION METRICS", 12, 30, Color3.fromRGB(220, 178, 74), 22, true);
	addDebugLabel(frame, stats.modeLabel, 42, 28, Color3.fromRGB(188, 178, 154), 16);
	addDebugButton(frame, "1  Today activity", 84);
	addDebugButton(frame, "2  Yesterday activity", 124);
	addDebugButton(frame, "3  Latest sessions", 164);

	addDebugLabel(frame, "STATS", 214, 24, Color3.fromRGB(220, 178, 74), 17, true);
	addDebugStatBar(frame, "Sessions", tostring(stats.sessionCount), stats.sessionCount / HISTORICAL_SESSION_LIMIT, 246);
	addDebugStatBar(frame, "Players", tostring(stats.uniquePlayerCount), stats.uniquePlayerCount / 8, 280);
	addDebugStatBar(frame, "Paths", tostring(stats.playerPathCount), stats.playerPathCount / 12, 314);
	addDebugStatBar(frame, "Points", tostring(stats.pointCount), stats.pointCount / 600, 348);
	addDebugStatBar(frame, "Longest", formatDuration(stats.longestSessionSecs), stats.longestSessionSecs / 7200, 382);
	addDebugLabel(frame, "Longest session: " + stats.longestSessionLabel, 426, 36, Color3.fromRGB(198, 188, 164), 14);
	addDebugLabel(
		frame,
		stats.firstSampleAt !== undefined && stats.lastSampleAt !== undefined
			? "Window: " + formatDuration(stats.lastSampleAt - stats.firstSampleAt)
			: "Window: no samples",
		466,
		30,
		Color3.fromRGB(132, 124, 104),
		13,
	);
}

function renderHistoricalPositionVisuals(modeLabel: string, sessionKeys: string[]): PositionMetricsResult {
	clearHistoricalPositionVisuals();

	if (sessionKeys.size() === 0) {
		return {
			message: `No historical position sessions found for ${modeLabel}`,
			metricsActive: true,
			metricsStats: emptyStats(modeLabel),
		};
	}

	const root = getOrCreateVisualsFolder(HISTORICAL_VISUAL_FOLDER_NAME);
	root.SetAttribute("SampleIntervalSecs", SAMPLE_INTERVAL_SECS);
	root.SetAttribute("MaxSessions", HISTORICAL_SESSION_LIMIT);
	root.SetAttribute("MaxSamplesPerPlayer", VISUAL_MAX_SAMPLES_PER_PLAYER);
	root.SetAttribute("UpdatedAt", os.time());
	root.SetAttribute("Mode", modeLabel);

	const stats: HistoricalRenderStats = {
		modeLabel,
		sessionCount: 0,
		playerPathCount: 0,
		uniquePlayerCount: 0,
		pointCount: 0,
		longestSessionSecs: 0,
		longestSessionLabel: "none",
		firstSampleAt: undefined,
		lastSampleAt: undefined,
		minPosition: undefined,
		maxPosition: undefined,
	};
	const uniquePlayers = new Set<number>();

	for (const key of sessionKeys) {
		const payload = loadSessionPayload(key);
		if (payload === undefined) continue;

		stats.sessionCount += 1;
		const sessionFolder = new Instance("Folder");
		sessionFolder.Name = payload.sessionKey ?? key;
		sessionFolder.SetAttribute("SessionKey", payload.sessionKey ?? key);
		sessionFolder.SetAttribute("JobId", payload.jobId ?? "unknown");
		sessionFolder.SetAttribute("DayKey", payload.dayKey ?? "unknown");
		sessionFolder.SetAttribute("ExportedAt", payload.exportedAt ?? 0);
		sessionFolder.Parent = root;

		let sessionFirst: number | undefined;
		let sessionLast: number | undefined;
		for (const series of payload.players ?? []) {
			if (isPositionMetricsExcludedUserId(series.userId)) continue;
			stats.playerPathCount += 1;
			uniquePlayers.add(series.userId);
			stats.pointCount += renderSeriesTrail(sessionFolder, series);
			for (const sample of series.samples ?? []) {
				sessionFirst = sessionFirst === undefined ? sample.timestamp : math.min(sessionFirst, sample.timestamp);
				sessionLast = sessionLast === undefined ? sample.timestamp : math.max(sessionLast, sample.timestamp);
				updateStatsSampleWindow(stats, sample);
			}
		}

		if (sessionFirst !== undefined && sessionLast !== undefined) {
			const duration = sessionLast - sessionFirst;
			if (duration > stats.longestSessionSecs) {
				stats.longestSessionSecs = duration;
				stats.longestSessionLabel = payload.sessionKey ?? key;
			}
		}
	}

	stats.uniquePlayerCount = uniquePlayers.size();
	renderMetricsDebugBoard(root, stats);

	return {
		message: `${modeLabel}: ${stats.pointCount} points, ${stats.playerPathCount} paths, ${stats.sessionCount} sessions, longest ${formatDuration(stats.longestSessionSecs)}`,
		metricsActive: true,
		metricsStats: statsPayload(stats),
	};
}

export function togglePositionMetricsVisuals(): PositionMetricsResult {
	visualsEnabled = !visualsEnabled;
	if (visualsEnabled) {
		refreshPositionVisuals();
		return {
			message: `Position trail visuals enabled: ${getPositionMetricsSampleCount()} samples`,
			metricsActive: true,
			metricsStats: liveStatsPayload(),
		};
	}
	clearPositionVisuals();
	return { message: "Position trail visuals disabled", metricsActive: false };
}

export function toggleHistoricalPositionMetricsVisuals(): PositionMetricsResult {
	historicalVisualsEnabled = !historicalVisualsEnabled;
	if (historicalVisualsEnabled) {
		saveSessionSnapshot();
		return renderHistoricalPositionVisuals("Latest sessions", loadLatestSessionKeys());
	}
	clearHistoricalPositionVisuals();
	return { message: "Historical position trails disabled", metricsActive: false };
}

export function showLatestHistoricalPositionMetrics(): PositionMetricsResult {
	historicalVisualsEnabled = true;
	saveSessionSnapshot();
	return renderHistoricalPositionVisuals("Latest sessions", loadLatestSessionKeys());
}

export function showTodayHistoricalPositionMetrics(): PositionMetricsResult {
	historicalVisualsEnabled = true;
	saveSessionSnapshot();
	return renderHistoricalPositionVisuals("Today activity", loadDaySessionKeys(0));
}

export function showYesterdayHistoricalPositionMetrics(): PositionMetricsResult {
	historicalVisualsEnabled = true;
	saveSessionSnapshot();
	return renderHistoricalPositionVisuals("Yesterday activity", loadDaySessionKeys(1));
}

export function getPositionMetricsSampleCount(): number {
	let count = 0;
	for (const [, series] of samplesByUserId) {
		count += series.samples.size();
	}
	return count;
}

export function initializePositionMetrics(): void {
	if (initialized) return;
	initialized = true;

	Players.PlayerRemoving.Connect((player) => {
		recordPlayerPosition(player, os.time());
		task.spawn(saveSessionSnapshot);
	});

	game.BindToClose(() => {
		saveSessionSnapshot();
	});

	task.spawn(() => {
		while (true) {
			task.wait(SAMPLE_INTERVAL_SECS);
			sampleAllPlayers();
		}
	});

	log(`${TAG} Initialized. Sampling player positions every ${SAMPLE_INTERVAL_SECS}s into ${sessionKey}.`);
}
