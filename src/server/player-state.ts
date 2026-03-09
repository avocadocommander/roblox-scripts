const readyPlayers = new Map<number, boolean>();

export function setReadyPlayerStatus(player: Player, ready: boolean) {
	readyPlayers.set(player.UserId, ready);
}
