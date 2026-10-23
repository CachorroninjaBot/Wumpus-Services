import { r as createServerFn } from "./ssr.mjs";
import { n as enforceRequestLimit, t as createServerRpc } from "./request-limits.server-D3WMs2Xr.mjs";
import { n as readBotHealth } from "./health.server-CEYWHLwq.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/health-DU0bf93P.js
var getPublicBotHealth_createServerFn_handler = createServerRpc({
	id: "a3cf4b1c0e81389dd1f5eee5a0b6f2b16d615eb7afdaa62f92c4fb55b3e5a056",
	name: "getPublicBotHealth",
	filename: "src/lib/wumpus/health.ts"
}, (opts) => getPublicBotHealth.__executeServer(opts));
var getPublicBotHealth = createServerFn({ method: "GET" }).handler(getPublicBotHealth_createServerFn_handler, async () => {
	enforceRequestLimit("public-bot-health", 120, 6e4);
	const record = await readBotHealth();
	if (!record) return {
		status: "unknown",
		lastSeenAt: null,
		guildCount: null,
		pingMs: null
	};
	return {
		status: record.status === "online" && Date.now() - record.at <= 9e4 ? "online" : "offline",
		lastSeenAt: null,
		guildCount: null,
		pingMs: null
	};
});
//#endregion
export { getPublicBotHealth_createServerFn_handler };
