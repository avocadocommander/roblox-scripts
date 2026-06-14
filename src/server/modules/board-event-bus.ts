import { getBoardBroadcastRemote } from "shared/remotes/board-broadcast-remote";

type BoardBroadcastType = "info" | "warning" | "event" | "unlock";

interface ActiveServerEvent {
	text: string;
	order: number;
}

const activeServerEvents = new Map<string, ActiveServerEvent>();
let eventOrder = 0;

function getCurrentServerEventText(): string | undefined {
	const events: ActiveServerEvent[] = [];
	for (const [, event] of activeServerEvents) {
		events.push(event);
	}
	if (events.size() === 0) return undefined;
	events.sort((a, b) => a.order > b.order);
	return events.map((event) => event.text).join("\n");
}

function pushServerEventToAll(): void {
	getBoardBroadcastRemote().FireAllClients("event", getCurrentServerEventText() ?? "");
}

export function initializeBoardEventBus(): void {
	getBoardBroadcastRemote();
}

export function broadcastBoardMessage(messageType: Exclude<BoardBroadcastType, "event">, text: string): void {
	getBoardBroadcastRemote().FireAllClients(messageType, text);
}

export function setBoardServerEvent(key: string, text: string): void {
	if (text === "") {
		clearBoardServerEvent(key);
		return;
	}
	eventOrder += 1;
	activeServerEvents.set(key, { text, order: eventOrder });
	pushServerEventToAll();
}

export function clearBoardServerEvent(key: string): void {
	if (!activeServerEvents.delete(key)) return;
	pushServerEventToAll();
}

export function syncBoardServerEvent(player: Player): void {
	const text = getCurrentServerEventText();
	if (text !== undefined) {
		getBoardBroadcastRemote().FireClient(player, "event", text);
	}
}
