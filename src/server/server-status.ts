let serverReady = false;

export function serverIsReady() {
	return serverReady;
}

export function setServerStatus(status: boolean) {
	serverReady = status;
}
