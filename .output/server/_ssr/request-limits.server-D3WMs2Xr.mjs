import { c as getRequestIP$1, i as TSS_SERVER_FUNCTION } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/request-limits.server-D3WMs2Xr.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var buckets = /* @__PURE__ */ new Map();
/** Best-effort per-process throttle for costly or administrative RPC calls. */
function enforceRequestLimit(bucket, limit, windowMs, identity) {
	const ip = getRequestIP$1({ xForwardedFor: false }) ?? "unknown";
	const key = `${bucket}:${identity ?? ip}`;
	const now = Date.now();
	const current = buckets.get(key);
	if (!current || now - current.start >= windowMs) {
		buckets.set(key, {
			start: now,
			count: 1
		});
		return;
	}
	if (current.count >= limit) throw new Error("Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.");
	current.count += 1;
	if (buckets.size > 1e4) {
		for (const [entry, value] of buckets) if (now - value.start >= windowMs) buckets.delete(entry);
	}
}
//#endregion
export { enforceRequestLimit as n, createServerRpc as t };
