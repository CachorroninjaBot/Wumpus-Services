import { join } from "node:path";
import { readFile } from "node:fs/promises";
//#region node_modules/.nitro/vite/services/ssr/assets/health.server-CEYWHLwq.js
function configuredHealthPath() {
	return process.env.WUMPUS_HEALTH_PATH?.trim() || null;
}
function healthPath() {
	return configuredHealthPath() ?? join(process.cwd(), "data", "wumpus-health.json");
}
function parseBotHealth(value) {
	if (!value || typeof value !== "object") return null;
	const record = value;
	if (record.status !== "online" && record.status !== "offline" || typeof record.at !== "number" || typeof record.startedAt !== "number" || typeof record.guildCount !== "number" || record.guildIds !== void 0 && (!Array.isArray(record.guildIds) || !record.guildIds.every((id) => typeof id === "string")) || typeof record.pingMs !== "number" && record.pingMs !== null) return null;
	return {
		status: record.status,
		at: record.at,
		startedAt: record.startedAt,
		guildCount: record.guildCount,
		guildIds: Array.isArray(record.guildIds) ? record.guildIds.filter((id) => typeof id === "string" && /^\d{17,20}$/.test(id)) : [],
		guildResources: record.guildResources && typeof record.guildResources === "object" ? record.guildResources : {},
		pingMs: record.pingMs
	};
}
async function inspectBotHealth() {
	const path = healthPath();
	const pathSource = configuredHealthPath() ? "configured" : "default";
	let raw;
	try {
		raw = await readFile(path, "utf8");
	} catch (error) {
		const code = error.code;
		if (code === "ENOENT") return {
			state: "missing",
			pathSource,
			record: null
		};
		return {
			state: "unreadable",
			pathSource,
			record: null,
			errorCode: code ?? "UNKNOWN"
		};
	}
	let value;
	try {
		value = JSON.parse(raw);
	} catch {
		return {
			state: "invalid",
			pathSource,
			record: null,
			errorCode: "INVALID_JSON"
		};
	}
	const record = parseBotHealth(value);
	return record ? {
		state: "available",
		pathSource,
		record
	} : {
		state: "invalid",
		pathSource,
		record: null,
		errorCode: "INVALID_RECORD"
	};
}
async function readBotHealth() {
	const inspection = await inspectBotHealth();
	if (inspection.state === "unreadable") throw new Error(`Não foi possível ler o arquivo de saúde do Wumpus (${inspection.errorCode}).`);
	return inspection.record;
}
//#endregion
export { readBotHealth as n, inspectBotHealth as t };
