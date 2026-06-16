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
	totalDistance: number;
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

type TrailFilter = "all" | "top_distance" | "bottom_distance";
type HistoricalScope = "latest" | "today" | "yesterday";

interface TrailEntry {
	series: PlayerPositionSeries;
	distance: number;
}

interface HistoricalTrailEntry extends TrailEntry {
	sessionKey: string;
	payload: PositionMetricsExport;
}

interface SessionRenderWindow {
	folder: Folder;
	first: number | undefined;
	last: number | undefined;
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
let liveTrailFilter: TrailFilter = "all";
let historicalScope: HistoricalScope = "latest";
let historicalTrailFilter: TrailFilter = "all";

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

function formatDistance(studs: number): string {
	if (studs >= 1000) return tostring(math.floor((studs / 1000) * 10) / 10) + "k st";
	return tostring(math.floor(studs)) + " st";
}

function emptyStats(modeLabel: string): AdminMetricsStats {
	return {
		modeLabel,
		sessions: 0,
		players: 0,
		paths: 0,
		points: 0,
		distance: "0 st",
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
		distance: formatDistance(stats.totalDistance),
		longestSession: formatDuration(stats.longestSessionSecs),
		window:
			stats.firstSampleAt !== undefined && stats.lastSampleAt !== undefined
				? formatDuration(stats.lastSampleAt - stats.firstSampleAt)
				: "0s",
	};
}

function distanceBetweenSamples(a: PlayerPositionSample, b: PlayerPositionSample): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const dz = b.z - a.z;
	return math.sqrt(dx * dx + dy * dy + dz * dz);
}

function distanceForSeries(series: PlayerPositionSeries): number {
	let distance = 0;
	for (let i = 1; i < series.samples.size(); i++) {
		distance += distanceBetweenSamples(series.samples[i - 1], series.samples[i]);
	}
	return distance;
}

function filterLabel(filter: TrailFilter): string {
	if (filter === "top_distance") return "top 10 distance";
	if (filter === "bottom_distance") return "bottom 10 distance";
	return "all";
}

function getLiveTrailFilterLabel(filter: TrailFilter): string {
	return filter === "all" ? "Live trails" : "Live trails: " + filterLabel(filter);
}

function applyDistanceFilter<T extends TrailEntry>(entries: T[], filter: TrailFilter): T[] {
	if (filter === "all") return entries;

	const moving = entries.filter((entry) => entry.distance > 0.01);
	if (filter === "top_distance") {
		moving.sort((a, b) => a.distance > b.distance);
	} else {
		moving.sort((a, b) => a.distance < b.distance);
	}

	const filtered: T[] = [];
	const limit = math.min(10, moving.size());
	for (let i = 0; i < limit; i++) {
		filtered.push(moving[i]);
	}
	return filtered;
}

function getFilteredLiveTrailEntries(filter: TrailFilter): TrailEntry[] {
	const entries: TrailEntry[] = [];
	for (const [, series] of samplesByUserId) {
		if (isPositionMetricsExcludedUserId(series.userId) || series.samples.size() === 0) continue;
		entries.push({ series, distance: distanceForSeries(series) });
	}

	return applyDistanceFilter(entries, filter);
}

function liveStatsPayload(entries = getFilteredLiveTrailEntries(liveTrailFilter)): AdminMetricsStats {
	let playerCount = 0;
	let pointCount = 0;
	let totalDistance = 0;
	let firstSampleAt: number | undefined;
	let lastSampleAt: number | undefined;
	let longestSeriesSecs = 0;

	for (const entry of entries) {
		const series = entry.series;
		playerCount += 1;
		pointCount += series.samples.size();
		totalDistance += entry.distance;
		const first = series.samples[0].timestamp;
		const last = series.samples[series.samples.size() - 1].timestamp;
		firstSampleAt = firstSampleAt === undefined ? first : math.min(firstSampleAt, first);
		lastSampleAt = lastSampleAt === undefined ? last : math.max(lastSampleAt, last);
		longestSeriesSecs = math.max(longestSeriesSecs, last - first);
	}

	return {
		modeLabel: getLiveTrailFilterLabel(liveTrailFilter),
		sessions: 1,
		players: playerCount,
		paths: playerCount,
		points: pointCount,
		distance: formatDistance(totalDistance),
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

function sampleCurrentPlayersNow(): void {
	const timestamp = os.time();
	for (const player of Players.GetPlayers()) {
		recordPlayerPosition(player, timestamp);
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
	playerFolder.SetAttribute("DistanceStuds", math.floor(distanceForSeries(series)));
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
	sampleCurrentPlayersNow();
	clearPositionVisuals();

	const root = getOrCreateVisualsFolder(VISUAL_FOLDER_NAME);
	root.SetAttribute("SampleIntervalSecs", SAMPLE_INTERVAL_SECS);
	root.SetAttribute("MaxSamplesPerPlayer", VISUAL_MAX_SAMPLES_PER_PLAYER);
	root.SetAttribute("UpdatedAt", os.time());
	root.SetAttribute("Filter", liveTrailFilter);

	const entries = getFilteredLiveTrailEntries(liveTrailFilter);
	for (const entry of entries) {
		renderSeriesTrail(root, entry.series);
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

function historicalScopeLabel(scope: HistoricalScope): string {
	if (scope === "today") return "Today activity";
	if (scope === "yesterday") return "Yesterday activity";
	return "Latest sessions";
}

function getHistoricalScopeKeys(scope: HistoricalScope): string[] {
	if (scope === "today") return loadDaySessionKeys(0);
	if (scope === "yesterday") return loadDaySessionKeys(1);
	return loadLatestSessionKeys();
}

function renderHistoricalPositionVisuals(
	scope: HistoricalScope,
	filter: TrailFilter,
	sessionKeys: string[],
): PositionMetricsResult {
	clearHistoricalPositionVisuals();

	const baseLabel = historicalScopeLabel(scope);
	const modeLabel = filter === "all" ? baseLabel : baseLabel + ": " + filterLabel(filter);

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
		totalDistance: 0,
		longestSessionSecs: 0,
		longestSessionLabel: "none",
		firstSampleAt: undefined,
		lastSampleAt: undefined,
		minPosition: undefined,
		maxPosition: undefined,
	};
	const uniquePlayers = new Set<number>();
	const entries: HistoricalTrailEntry[] = [];

	for (const key of sessionKeys) {
		const payload = loadSessionPayload(key);
		if (payload === undefined) continue;

		for (const series of payload.players ?? []) {
			if (isPositionMetricsExcludedUserId(series.userId)) continue;
			if (series.samples.size() === 0) continue;
			entries.push({ sessionKey: key, payload, series, distance: distanceForSeries(series) });
		}
	}

	const selectedEntries = applyDistanceFilter(entries, filter);
	const renderedSessions = new Map<string, SessionRenderWindow>();

	for (const entry of selectedEntries) {
		let sessionWindow = renderedSessions.get(entry.sessionKey);
		if (sessionWindow === undefined) {
			const sessionFolder = new Instance("Folder");
			sessionFolder.Name = entry.payload.sessionKey ?? entry.sessionKey;
			sessionFolder.SetAttribute("SessionKey", entry.payload.sessionKey ?? entry.sessionKey);
			sessionFolder.SetAttribute("JobId", entry.payload.jobId ?? "unknown");
			sessionFolder.SetAttribute("DayKey", entry.payload.dayKey ?? "unknown");
			sessionFolder.SetAttribute("ExportedAt", entry.payload.exportedAt ?? 0);
			sessionFolder.Parent = root;
			sessionWindow = { folder: sessionFolder, first: undefined, last: undefined };
			renderedSessions.set(entry.sessionKey, sessionWindow);
		}

		stats.playerPathCount += 1;
		stats.totalDistance += entry.distance;
		uniquePlayers.add(entry.series.userId);
		stats.pointCount += renderSeriesTrail(sessionWindow.folder, entry.series);
		for (const sample of entry.series.samples ?? []) {
			sessionWindow.first =
				sessionWindow.first === undefined ? sample.timestamp : math.min(sessionWindow.first, sample.timestamp);
			sessionWindow.last =
				sessionWindow.last === undefined ? sample.timestamp : math.max(sessionWindow.last, sample.timestamp);
			updateStatsSampleWindow(stats, sample);
		}
	}

	for (const [, sessionWindow] of renderedSessions) {
		if (sessionWindow.first !== undefined && sessionWindow.last !== undefined) {
			const duration = sessionWindow.last - sessionWindow.first;
			if (duration > stats.longestSessionSecs) {
				stats.longestSessionSecs = duration;
				stats.longestSessionLabel = sessionWindow.folder.Name;
			}
		}
	}

	stats.sessionCount = renderedSessions.size();
	stats.uniquePlayerCount = uniquePlayers.size();

	return {
		message: `${modeLabel}: ${stats.pointCount} points, ${stats.playerPathCount} paths, ${stats.sessionCount} sessions, longest ${formatDuration(stats.longestSessionSecs)}`,
		metricsActive: true,
		metricsStats: statsPayload(stats),
	};
}

export function togglePositionMetricsVisuals(): PositionMetricsResult {
	visualsEnabled = !visualsEnabled;
	if (visualsEnabled) {
		liveTrailFilter = "all";
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

export function showAllLivePositionTrails(): PositionMetricsResult {
	visualsEnabled = true;
	liveTrailFilter = "all";
	refreshPositionVisuals();
	return {
		message: `Live trails showing all paths: ${getPositionMetricsSampleCount()} samples`,
		metricsActive: true,
		metricsStats: liveStatsPayload(),
	};
}

export function showTopDistanceLivePositionTrails(): PositionMetricsResult {
	visualsEnabled = true;
	liveTrailFilter = "top_distance";
	refreshPositionVisuals();
	const stats = liveStatsPayload();
	return {
		message:
			stats.paths > 0
				? `Live trails filtered to top 10 by distance: ${stats.paths} paths, ${stats.distance}`
				: "No moving live trails yet. Let other players move for a few samples, then refresh.",
		metricsActive: true,
		metricsStats: stats,
	};
}

export function showBottomDistanceLivePositionTrails(): PositionMetricsResult {
	visualsEnabled = true;
	liveTrailFilter = "bottom_distance";
	refreshPositionVisuals();
	const stats = liveStatsPayload();
	return {
		message:
			stats.paths > 0
				? `Live trails filtered to bottom 10 by distance: ${stats.paths} paths, ${stats.distance}`
				: "No non-zero live trails yet. Bottom 10 ignores paths with 0 distance.",
		metricsActive: true,
		metricsStats: stats,
	};
}

export function toggleHistoricalPositionMetricsVisuals(): PositionMetricsResult {
	historicalVisualsEnabled = !historicalVisualsEnabled;
	if (historicalVisualsEnabled) {
		historicalScope = "latest";
		historicalTrailFilter = "all";
		saveSessionSnapshot();
		return renderHistoricalPositionVisuals(historicalScope, historicalTrailFilter, getHistoricalScopeKeys(historicalScope));
	}
	clearHistoricalPositionVisuals();
	return { message: "Historical position trails disabled", metricsActive: false };
}

export function showLatestHistoricalPositionMetrics(): PositionMetricsResult {
	historicalVisualsEnabled = true;
	historicalScope = "latest";
	historicalTrailFilter = "all";
	saveSessionSnapshot();
	return renderHistoricalPositionVisuals(historicalScope, historicalTrailFilter, getHistoricalScopeKeys(historicalScope));
}

export function showTodayHistoricalPositionMetrics(): PositionMetricsResult {
	historicalVisualsEnabled = true;
	historicalScope = "today";
	historicalTrailFilter = "all";
	saveSessionSnapshot();
	return renderHistoricalPositionVisuals(historicalScope, historicalTrailFilter, getHistoricalScopeKeys(historicalScope));
}

export function showYesterdayHistoricalPositionMetrics(): PositionMetricsResult {
	historicalVisualsEnabled = true;
	historicalScope = "yesterday";
	historicalTrailFilter = "all";
	saveSessionSnapshot();
	return renderHistoricalPositionVisuals(historicalScope, historicalTrailFilter, getHistoricalScopeKeys(historicalScope));
}

export function showTopDistanceHistoricalPositionTrails(): PositionMetricsResult {
	historicalVisualsEnabled = true;
	historicalTrailFilter = "top_distance";
	saveSessionSnapshot();
	const result = renderHistoricalPositionVisuals(
		historicalScope,
		historicalTrailFilter,
		getHistoricalScopeKeys(historicalScope),
	);
	if ((result.metricsStats?.paths ?? 0) === 0) {
		result.message = "No moving historical trails found for " + historicalScopeLabel(historicalScope) + ".";
	}
	return result;
}

export function showBottomDistanceHistoricalPositionTrails(): PositionMetricsResult {
	historicalVisualsEnabled = true;
	historicalTrailFilter = "bottom_distance";
	saveSessionSnapshot();
	const result = renderHistoricalPositionVisuals(
		historicalScope,
		historicalTrailFilter,
		getHistoricalScopeKeys(historicalScope),
	);
	if ((result.metricsStats?.paths ?? 0) === 0) {
		result.message =
			"No non-zero historical trails found for " +
			historicalScopeLabel(historicalScope) +
			". Bottom 10 ignores 0 distance.";
	}
	return result;
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
