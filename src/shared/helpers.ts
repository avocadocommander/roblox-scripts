export function isArray(value: unknown): boolean {
	if (typeOf(value) === "table") {
		const tbl = value as Record<number, unknown>;
		return tbl[1] !== undefined;
	}
	return false;
}

export function deepEqual<T extends object>(a: T, b: T): boolean {
	if (a === b) return true;
	if (typeOf(a) !== "table" || typeOf(b) !== "table") return false;

	const aKeys: string[] = [];
	const bKeys: string[] = [];

	// Collect keys
	for (const [key] of pairs(a)) {
		aKeys.push(key as string);
	}
	for (const [key] of pairs(b)) {
		bKeys.push(key as string);
	}

	// Check key count
	if (aKeys.size() !== bKeys.size()) return false;

	for (const key of aKeys) {
		const aVal = (a as Record<string, unknown>)[key];
		const bVal = (b as Record<string, unknown>)[key];

		if (typeOf(aVal) === "table" && typeOf(bVal) === "table") {
			if (!deepEqual(aVal as object, bVal as object)) {
				return false;
			}
		} else if (aVal !== bVal) {
			return false;
		}
	}

	return true;
}

export function log(message: string, logType: "INFO" | "WARN" | "ERROR" = "INFO") {
	switch (logType) {
		case "WARN": {
			warn(`📣 ${message}`);
			break;
		}
		case "ERROR": {
			error(`🚨 ${message}`);
			break;
		}
		default: {
			print(`${message}`);
			break;
		}
	}
}
