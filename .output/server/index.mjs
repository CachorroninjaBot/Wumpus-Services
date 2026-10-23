globalThis.__nitro_main__ = import.meta.url;
import { a as toEventHandler, c as serve, i as defineLazyEventHandler, n as HTTPError, r as defineHandler, s as NodeResponse, t as H3Core } from "./_libs/h3+rou3+srvx.mjs";
import { i as withoutTrailingSlash, n as joinURL, r as withLeadingSlash, t as decodePath } from "./_libs/ufo.mjs";
import { promises } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
//#region node_modules/nitro/dist/runtime/internal/route-rules.mjs
var headers = ((m) => function headersRouteRule(event) {
	for (const [key, value] of Object.entries(m.options || {})) event.res.headers.set(key, value);
});
//#endregion
//#region #nitro/virtual/public-assets-data
var public_assets_data_default = {
	"/favicon.svg": {
		"type": "image/svg+xml",
		"etag": "\"12b-sbobLoLCmGg7uUH7Wrrsd+czxvU\"",
		"mtime": "2026-10-23T18:04:17.023Z",
		"size": 299,
		"path": "../public/favicon.svg"
	},
	"/assets/admin-Bbp848hb.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"60ae-JqITVNK6qScHcp+auRJ2HAAa+sE\"",
		"mtime": "2026-10-23T18:52:58.254Z",
		"size": 24750,
		"path": "../public/assets/admin-Bbp848hb.js"
	},
	"/icon.svg": {
		"type": "image/svg+xml",
		"etag": "\"1f0-/hsud+0l/XbYF29Pe0ndVsQeU9c\"",
		"mtime": "2026-10-23T18:04:16.965Z",
		"size": 496,
		"path": "../public/icon.svg"
	},
	"/assets/app-CDIN2HDg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2d43-EdIyFD9eR7pWijh9XFhjqasVrfs\"",
		"mtime": "2026-10-23T18:52:58.257Z",
		"size": 11587,
		"path": "../public/assets/app-CDIN2HDg.js"
	},
	"/assets/arrow-up-BPb2AMtR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"112-XfTM3ZBJKl94wdavkaog9/+BseQ\"",
		"mtime": "2026-10-23T18:52:58.265Z",
		"size": 274,
		"path": "../public/assets/arrow-up-BPb2AMtR.js"
	},
	"/assets/auth.discord.callback-CU7yFdW2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"516-Hza2nccruWYrMMq1tb9kAKtjAOw\"",
		"mtime": "2026-10-23T18:52:58.266Z",
		"size": 1302,
		"path": "../public/assets/auth.discord.callback-CU7yFdW2.js"
	},
	"/assets/brand-Ch2nACGz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"528-R7o8+AeBWvuTBiF7IB62XpEpS8k\"",
		"mtime": "2026-10-23T18:52:58.274Z",
		"size": 1320,
		"path": "../public/assets/brand-Ch2nACGz.js"
	},
	"/assets/chevron-down-CyPjp7IR.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c7-knCF+FlSo665Ec0CmWHUkn0fnf4\"",
		"mtime": "2026-10-23T18:52:58.277Z",
		"size": 199,
		"path": "../public/assets/chevron-down-CyPjp7IR.js"
	},
	"/assets/brand-BC8LHN9J.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"647-j7UOEkrGZAFj21aTqlVSUyFemyY\"",
		"mtime": "2026-10-23T18:52:58.271Z",
		"size": 1607,
		"path": "../public/assets/brand-BC8LHN9J.js"
	},
	"/assets/clock-3-BprsPzPH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bb-JllRes/LpscxfAWdajEhS7kuTbA\"",
		"mtime": "2026-10-23T18:52:58.279Z",
		"size": 187,
		"path": "../public/assets/clock-3-BprsPzPH.js"
	},
	"/assets/createLucideIcon-Cv1Uyldk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4a5-BisMuj6dBYiEi+TuouU0zzyNk84\"",
		"mtime": "2026-10-23T18:52:58.280Z",
		"size": 1189,
		"path": "../public/assets/createLucideIcon-Cv1Uyldk.js"
	},
	"/assets/discord-panel-Dk-G9u0H.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c2c-XGv+TExLzDnaoMqErZjbxtTBr+I\"",
		"mtime": "2026-10-23T18:52:58.288Z",
		"size": 7212,
		"path": "../public/assets/discord-panel-Dk-G9u0H.js"
	},
	"/assets/dist-BRo0S_3w.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7979-tGXS/epwglcMjMJU/yz258OgZB8\"",
		"mtime": "2026-10-23T18:52:58.291Z",
		"size": 31097,
		"path": "../public/assets/dist-BRo0S_3w.js"
	},
	"/assets/dist-D2hpw1o1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2224-BJqhc0GCRmfpO4cf1HL14Ybsf38\"",
		"mtime": "2026-10-23T18:52:58.294Z",
		"size": 8740,
		"path": "../public/assets/dist-D2hpw1o1.js"
	},
	"/assets/entrar-BLFxs7y8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"942-cmLmO78+6UK+CVKP+w9T2Yi2T44\"",
		"mtime": "2026-10-23T18:52:58.297Z",
		"size": 2370,
		"path": "../public/assets/entrar-BLFxs7y8.js"
	},
	"/assets/index-Dmu8kRw_.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"ef2b-MpgYZgt3SsO+jYTyqULdusQxMxI\"",
		"mtime": "2026-10-23T18:52:58.359Z",
		"size": 61227,
		"path": "../public/assets/index-Dmu8kRw_.css"
	},
	"/assets/forms-I3r2g3s-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"770c-wME4j5abcAXx/uwsLD+9SNPjZyc\"",
		"mtime": "2026-10-23T18:52:58.299Z",
		"size": 30476,
		"path": "../public/assets/forms-I3r2g3s-.js"
	},
	"/assets/knowledge-C9pFjzZ8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"67e2-DDGddT6Fm+iyLJvPfaQM1n+Xf8U\"",
		"mtime": "2026-10-23T18:52:58.303Z",
		"size": 26594,
		"path": "../public/assets/knowledge-C9pFjzZ8.js"
	},
	"/assets/link-D0jQ3Wt9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2bdd-N9yNcN9FgAsTfM9punOYlIjK0VI\"",
		"mtime": "2026-10-23T18:52:58.307Z",
		"size": 11229,
		"path": "../public/assets/link-D0jQ3Wt9.js"
	},
	"/assets/app-CNRHrxwA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"67cf-45ybJeY3U6nxtmWq1WG6J0yM9Vw\"",
		"mtime": "2026-10-23T18:52:58.260Z",
		"size": 26575,
		"path": "../public/assets/app-CNRHrxwA.js"
	},
	"/assets/loader-circle-CvZpzMlE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"18b-8HG79axqOVF/wtfk8vqZAtQEDY4\"",
		"mtime": "2026-10-23T18:52:58.309Z",
		"size": 395,
		"path": "../public/assets/loader-circle-CvZpzMlE.js"
	},
	"/manifest.json": {
		"type": "application/json",
		"etag": "\"129-5iZcRhLG4hB6n+7j49hGq90h5KI\"",
		"mtime": "2026-10-23T18:04:16.988Z",
		"size": 297,
		"path": "../public/manifest.json"
	},
	"/assets/index-BNXdPJE3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6ce6e-AsWmYeGx2We0YI7EKHw4Tnz/P08\"",
		"mtime": "2026-10-23T18:52:58.252Z",
		"size": 446062,
		"path": "../public/assets/index-BNXdPJE3.js"
	},
	"/assets/createServerFn-C1m-hK_m.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b2dc-wY7WoKMS3tuP2ZgSbjmBc3foglI\"",
		"mtime": "2026-10-23T18:52:58.283Z",
		"size": 45788,
		"path": "../public/assets/createServerFn-C1m-hK_m.js"
	},
	"/assets/logs-DIIhHDfZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"202d-Q4BpDbR5lOpR6hOrmK9hU8WUI9Q\"",
		"mtime": "2026-10-23T18:52:58.311Z",
		"size": 8237,
		"path": "../public/assets/logs-DIIhHDfZ.js"
	},
	"/assets/moderation-DsbywA1e.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"17d8-JnkyIjc5vGePqNg9hI3Qve6qG58\"",
		"mtime": "2026-10-23T18:52:58.315Z",
		"size": 6104,
		"path": "../public/assets/moderation-DsbywA1e.js"
	},
	"/assets/owner-workspace-BIlnYDtT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"747-7SV+o010eXh4FZNVTuJKWi5lbIw\"",
		"mtime": "2026-10-23T18:52:58.319Z",
		"size": 1863,
		"path": "../public/assets/owner-workspace-BIlnYDtT.js"
	},
	"/assets/search-DHuld3kc.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ae-8ukNbgh8Xt4RZsFFLRZ9HpyFrTs\"",
		"mtime": "2026-10-23T18:52:58.334Z",
		"size": 174,
		"path": "../public/assets/search-DHuld3kc.js"
	},
	"/assets/publish-panel-1uF_rNT3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"13520-Vs79wcRMtQb99qXs2kwudTCyTa0\"",
		"mtime": "2026-10-23T18:52:58.326Z",
		"size": 79136,
		"path": "../public/assets/publish-panel-1uF_rNT3.js"
	},
	"/assets/settings-DC2K-iXH.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4f28-xSYMaDiH2nO+iuY/Poc2LTto2e0\"",
		"mtime": "2026-10-23T18:52:58.340Z",
		"size": 20264,
		"path": "../public/assets/settings-DC2K-iXH.js"
	},
	"/assets/session-token-8SA8KRFz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1927-cbSwJqGdLQpflSZ5PqKUvD+Hj7k\"",
		"mtime": "2026-10-23T18:52:58.335Z",
		"size": 6439,
		"path": "../public/assets/session-token-8SA8KRFz.js"
	},
	"/assets/shield-SNBtcM6r.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"110-K1XzZhKuO0r3rpa9VG//PqP3oso\"",
		"mtime": "2026-10-23T18:52:58.341Z",
		"size": 272,
		"path": "../public/assets/shield-SNBtcM6r.js"
	},
	"/assets/routes-ku6kbuet.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"26d8-+VbZGjiH1SeaKu0YnW0gX/0MwvY\"",
		"mtime": "2026-10-23T18:52:58.328Z",
		"size": 9944,
		"path": "../public/assets/routes-ku6kbuet.js"
	},
	"/assets/sparkles-BGjwcJ3h.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2e9-cn2cr+dEFJ8oqk/n4dvKuU5mReY\"",
		"mtime": "2026-10-23T18:52:58.343Z",
		"size": 745,
		"path": "../public/assets/sparkles-BGjwcJ3h.js"
	},
	"/assets/tickets-NZJodE-S.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6c64-XZr6nfoiBqcnLjtKO326mtfQMRE\"",
		"mtime": "2026-10-23T18:52:58.353Z",
		"size": 27748,
		"path": "../public/assets/tickets-NZJodE-S.js"
	},
	"/assets/staff-DCfUVLY3.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1fbf-5Lfzh6NfZuW0ex2UaUm/AfXYqCE\"",
		"mtime": "2026-10-23T18:52:58.346Z",
		"size": 8127,
		"path": "../public/assets/staff-DCfUVLY3.js"
	},
	"/assets/trash-2-CXxVF42V.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24f-tlNWnGyflnsunBGONIQNHDi3SnI\"",
		"mtime": "2026-10-23T18:52:58.355Z",
		"size": 591,
		"path": "../public/assets/trash-2-CXxVF42V.js"
	},
	"/assets/plus-14W7krtZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"99-WU2FPLXqEV2AMt3osN+WOEG+t2k\"",
		"mtime": "2026-10-23T18:52:58.324Z",
		"size": 153,
		"path": "../public/assets/plus-14W7krtZ.js"
	},
	"/assets/use-billing-DUNAagLY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"248-UTkbkNJIDhr6C0CY08X8wjcZr4g\"",
		"mtime": "2026-10-23T18:52:58.357Z",
		"size": 584,
		"path": "../public/assets/use-billing-DUNAagLY.js"
	},
	"/assets/useMatch-BYUZm-Ki.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"235-jlTcVEqGCXQAhNqLEoZnVMA6rTk\"",
		"mtime": "2026-10-23T18:52:58.358Z",
		"size": 565,
		"path": "../public/assets/useMatch-BYUZm-Ki.js"
	},
	"/assets/users-WHhdTm1l.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"132-Y6vj4rwBeB/x5p3vzdmlSkeBtyg\"",
		"mtime": "2026-10-23T18:52:58.359Z",
		"size": 306,
		"path": "../public/assets/users-WHhdTm1l.js"
	},
	"/assets/ticket-BaD4DdhE.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"141-01VvTu6vIr6EOt5PWAa3Y1zxefY\"",
		"mtime": "2026-10-23T18:52:58.352Z",
		"size": 321,
		"path": "../public/assets/ticket-BaD4DdhE.js"
	},
	"/assets/stats-BVbyZMA7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"60ee7-IdOhmSF0oNyDsQpAmax3qrIz7M8\"",
		"mtime": "2026-10-23T18:52:58.349Z",
		"size": 397031,
		"path": "../public/assets/stats-BVbyZMA7.js"
	}
};
//#endregion
//#region #nitro/virtual/public-assets-node
function readAsset(id) {
	const serverDir = dirname(fileURLToPath(globalThis.__nitro_main__));
	return promises.readFile(resolve(serverDir, public_assets_data_default[id].path));
}
//#endregion
//#region #nitro/virtual/public-assets
var publicAssetBases = {};
function isPublicAssetURL(id = "") {
	if (public_assets_data_default[id]) return true;
	for (const base in publicAssetBases) if (id.startsWith(base)) return true;
	return false;
}
function getAsset(id) {
	return public_assets_data_default[id];
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/static.mjs
var METHODS = /* @__PURE__ */ new Set(["HEAD", "GET"]);
var EncodingMap = {
	gzip: ".gz",
	br: ".br",
	zstd: ".zst"
};
var static_default = defineHandler((event) => {
	if (event.req.method && !METHODS.has(event.req.method)) return;
	let id = decodePath(withLeadingSlash(withoutTrailingSlash(event.url.pathname)));
	let asset;
	const encodings = [...(event.req.headers.get("accept-encoding") || "").split(",").map((e) => EncodingMap[e.trim()]).filter(Boolean).sort(), ""];
	for (const encoding of encodings) for (const _id of [id + encoding, joinURL(id, "index.html" + encoding)]) {
		const _asset = getAsset(_id);
		if (_asset) {
			asset = _asset;
			id = _id;
			break;
		}
	}
	if (!asset) {
		if (isPublicAssetURL(id)) {
			event.res.headers.delete("Cache-Control");
			throw new HTTPError({ status: 404 });
		}
		return;
	}
	if (encodings.length > 1) event.res.headers.append("Vary", "Accept-Encoding");
	if (event.req.headers.get("if-none-match") === asset.etag) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	const ifModifiedSinceH = event.req.headers.get("if-modified-since");
	const mtimeDate = new Date(asset.mtime);
	if (ifModifiedSinceH && asset.mtime && new Date(ifModifiedSinceH) >= mtimeDate) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	if (asset.type) event.res.headers.set("Content-Type", asset.type);
	if (asset.etag && !event.res.headers.has("ETag")) event.res.headers.set("ETag", asset.etag);
	if (asset.mtime && !event.res.headers.has("Last-Modified")) event.res.headers.set("Last-Modified", mtimeDate.toUTCString());
	if (asset.encoding && !event.res.headers.has("Content-Encoding")) event.res.headers.set("Content-Encoding", asset.encoding);
	if (asset.size > 0 && !event.res.headers.has("Content-Length")) event.res.headers.set("Content-Length", asset.size.toString());
	return readAsset(id);
});
//#endregion
//#region #nitro/virtual/routing
var findRouteRules = /* @__PURE__ */ (() => {
	const $0 = [{
		name: "headers",
		route: "/assets/**",
		handler: headers,
		options: { "cache-control": "public, max-age=31536000, immutable" }
	}];
	return (m, p) => {
		let r = [];
		if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1) || "/";
		let s = p.split("/");
		if (s.length > 1) {
			if (s[1] === "assets") r.unshift({
				data: $0,
				params: { "_": s.slice(2).join("/") }
			});
		}
		return r;
	};
})();
var _lazy_qZBOZh = defineLazyEventHandler(() => import("./_chunks/ssr-renderer.mjs"));
var findRoute = /* @__PURE__ */ (() => {
	const data = {
		route: "/**",
		handler: _lazy_qZBOZh
	};
	return ((_m, p) => {
		return {
			data,
			params: { "_": p.slice(1) }
		};
	});
})();
var globalMiddleware = [toEventHandler(static_default)].filter(Boolean);
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/prod.mjs
var errorHandler = (error, event) => {
	const res = defaultHandler(error, event);
	return new NodeResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
};
function defaultHandler(error, event) {
	const unhandled = error.unhandled ?? !HTTPError.isError(error);
	const { status = 500, statusText = "" } = unhandled ? {} : error;
	if (status === 404) {
		const url = event.url || new URL(event.req.url);
		const baseURL = "/";
		if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) return {
			status: 302,
			headers: new Headers({ location: `${baseURL}${url.pathname.slice(1)}${url.search}` })
		};
	}
	const headers = new Headers(unhandled ? {} : error.headers);
	headers.set("content-type", "application/json; charset=utf-8");
	return {
		status,
		statusText,
		headers,
		body: {
			error: true,
			...unhandled ? {
				status,
				unhandled: true
			} : typeof error.toJSON === "function" ? error.toJSON() : {
				status,
				statusText,
				message: error.message
			}
		}
	};
}
//#endregion
//#region #nitro/virtual/error-handler
var errorHandlers = [errorHandler];
async function error_handler_default(error, event) {
	for (const handler of errorHandlers) try {
		const response = await handler(error, event, { defaultHandler });
		if (response) return response;
	} catch (error) {
		console.error(error);
	}
}
//#endregion
//#region #nitro/virtual/app
function createNitroApp() {
	const captureError = (error, errorCtx) => {
		if (errorCtx?.event) {
			const errors = errorCtx.event.req.context?.nitro?.errors;
			if (errors) errors.push({
				error,
				context: errorCtx
			});
		}
	};
	const h3App = createH3App({ onError(error, event) {
		return error_handler_default(error, event);
	} });
	let appHandler = (req) => {
		req.context ||= {};
		req.context.nitro = req.context.nitro || { errors: [] };
		return h3App.fetch(req);
	};
	return {
		fetch: appHandler,
		h3: h3App,
		hooks: void 0,
		captureError
	};
}
function createH3App(config) {
	const h3App = new H3Core(config);
	h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);
	h3App["~middleware"].push(...globalMiddleware);
	h3App["~getMiddleware"] = (event, route) => {
		const pathname = event.url.pathname;
		const method = event.req.method;
		const middleware = [];
		const routeRules = getRouteRules(method, pathname);
		event.context.routeRules = routeRules?.routeRules;
		if (routeRules?.routeRuleMiddleware.length) middleware.push(...routeRules.routeRuleMiddleware);
		middleware.push(...h3App["~middleware"]);
		if (route?.data?.middleware?.length) middleware.push(...route.data.middleware);
		return middleware;
	};
	return h3App;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/app.mjs
var APP_ID = "default";
function useNitroApp() {
	let instance = useNitroApp._instance;
	if (instance) return instance;
	instance = useNitroApp._instance = createNitroApp();
	globalThis.__nitro__ = globalThis.__nitro__ || {};
	globalThis.__nitro__[APP_ID] = instance;
	return instance;
}
function getRouteRules(method, pathname) {
	const m = findRouteRules(method, pathname);
	if (!m?.length) return { routeRuleMiddleware: [] };
	const routeRules = {};
	for (const layer of m) for (const rule of layer.data) {
		const currentRule = routeRules[rule.name];
		if (currentRule) {
			if (rule.options === false) {
				delete routeRules[rule.name];
				continue;
			}
			if (typeof currentRule.options === "object" && typeof rule.options === "object") currentRule.options = {
				...currentRule.options,
				...rule.options
			};
			else currentRule.options = rule.options;
			currentRule.route = rule.route;
			currentRule.params = {
				...currentRule.params,
				...layer.params
			};
		} else if (rule.options !== false) routeRules[rule.name] = {
			...rule,
			params: layer.params
		};
	}
	const middleware = [];
	const orderedRules = Object.values(routeRules).sort((a, b) => (a.handler?.order || 0) - (b.handler?.order || 0));
	for (const rule of orderedRules) {
		if (rule.options === false || !rule.handler) continue;
		middleware.push(rule.handler(rule));
	}
	return {
		routeRules,
		routeRuleMiddleware: middleware
	};
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/hooks.mjs
function _captureError(error, type) {
	console.error(`[${type}]`, error);
	useNitroApp().captureError?.(error, { tags: [type] });
}
function trapUnhandledErrors() {
	process.on("unhandledRejection", (error) => _captureError(error, "unhandledRejection"));
	process.on("uncaughtException", (error) => _captureError(error, "uncaughtException"));
}
//#endregion
//#region #nitro/virtual/tracing
var tracingSrvxPlugins = [];
//#endregion
//#region node_modules/nitro/dist/presets/node/runtime/node-server.mjs
var _parsedPort = Number.parseInt(process.env.NITRO_PORT ?? process.env.PORT ?? "");
var port = Number.isNaN(_parsedPort) ? 3e3 : _parsedPort;
var host = process.env.NITRO_HOST || process.env.HOST;
var cert = process.env.NITRO_SSL_CERT;
var key = process.env.NITRO_SSL_KEY;
var nitroApp = useNitroApp();
serve({
	port,
	hostname: host,
	tls: cert && key ? {
		cert,
		key
	} : void 0,
	fetch: nitroApp.fetch,
	plugins: [...tracingSrvxPlugins]
});
trapUnhandledErrors();
var node_server_default = {};
//#endregion
export { node_server_default as default };
