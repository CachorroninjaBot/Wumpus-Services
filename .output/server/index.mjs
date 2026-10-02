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
		"mtime": "2026-10-02T00:33:17.685Z",
		"size": 299,
		"path": "../public/favicon.svg"
	},
	"/assets/admin-DvFrCRfw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a93-EO6jn2OwMQbbBetvhwAUFVir5U0\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 6803,
		"path": "../public/assets/admin-DvFrCRfw.js"
	},
	"/assets/analyze-zX1eKeoI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a8-ZoSVyQrLgbZt22yZDxSujr679Ro\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 1448,
		"path": "../public/assets/analyze-zX1eKeoI.js"
	},
	"/manifest.json": {
		"type": "application/json",
		"etag": "\"129-5iZcRhLG4hB6n+7j49hGq90h5KI\"",
		"mtime": "2026-10-02T00:33:17.685Z",
		"size": 297,
		"path": "../public/manifest.json"
	},
	"/assets/auth.discord.callback-BWvwaCLZ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bed-vz5JyG0P1HaD19HdwbfhsdlGR8o\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 3053,
		"path": "../public/assets/auth.discord.callback-BWvwaCLZ.js"
	},
	"/assets/app-Bp8wk9wJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1c1b-etLY+/PCIidwn1AN9j4Bwm8ByVs\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 7195,
		"path": "../public/assets/app-Bp8wk9wJ.js"
	},
	"/assets/app-dU8-enu5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"23f2-61i8e8CaICy4NufMA3Uu+i2j2Wc\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 9202,
		"path": "../public/assets/app-dU8-enu5.js"
	},
	"/assets/badge-tp9Y2AM_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24f-PGa4iME+LeIPx6gsx5Gzb6zNWTQ\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 591,
		"path": "../public/assets/badge-tp9Y2AM_.js"
	},
	"/icon.svg": {
		"type": "image/svg+xml",
		"etag": "\"1f0-/hsud+0l/XbYF29Pe0ndVsQeU9c\"",
		"mtime": "2026-10-02T00:33:17.685Z",
		"size": 496,
		"path": "../public/icon.svg"
	},
	"/assets/brand-CbZbxl3x.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"649-6764620k/RTVDlrbwtqFERSnjFw\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 1609,
		"path": "../public/assets/brand-CbZbxl3x.js"
	},
	"/assets/brand-DpVfhAQy.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"475-NZ236CKg6yOtba7CUd1vW/0eS7I\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 1141,
		"path": "../public/assets/brand-DpVfhAQy.js"
	},
	"/assets/button-BRmHbviV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4fa-lMuPqHuBrXHqnqwQ9PFBSjD8mnI\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 1274,
		"path": "../public/assets/button-BRmHbviV.js"
	},
	"/assets/card-BvyqNSxd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f3-r1EplIbi8L0eXWDyt6xNXONcxzI\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 243,
		"path": "../public/assets/card-BvyqNSxd.js"
	},
	"/assets/catalog-c-QOFz4c.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"902-P5Doj9sRvjjlRl0lOndtZevPww4\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 2306,
		"path": "../public/assets/catalog-c-QOFz4c.js"
	},
	"/assets/createServerFn-BVLtfQMT.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"112d-lVvrmcOFVa/w+PQFQX2KjXdXdJA\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 4397,
		"path": "../public/assets/createServerFn-BVLtfQMT.js"
	},
	"/assets/clsx-DB0hHKMi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"171-ECuaYbqpb4owKgP3JEL6PnaLhH4\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 369,
		"path": "../public/assets/clsx-DB0hHKMi.js"
	},
	"/assets/defaults-DEm6DJXB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"131d-9iv8/UQqF9gHzvUJeSuXhlmmLYM\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 4893,
		"path": "../public/assets/defaults-DEm6DJXB.js"
	},
	"/assets/discord-panel-oOtERz4c.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c71-OqiepBuE+nuVozXrM0793wCWzyw\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 3185,
		"path": "../public/assets/discord-panel-oOtERz4c.js"
	},
	"/assets/dist-BogNzeK9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"280-sDgEuAfwWdL8PSjNbxppEOBzYbY\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 640,
		"path": "../public/assets/dist-BogNzeK9.js"
	},
	"/assets/dist-C8gPQN6b.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c72-VVxu9rwvSQidjajweYeeXVHmCTk\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 3186,
		"path": "../public/assets/dist-C8gPQN6b.js"
	},
	"/assets/dist-CJXAvlSr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"136b-6hCpjclqtvSBzCpeJPe7ZBxpBgY\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 4971,
		"path": "../public/assets/dist-CJXAvlSr.js"
	},
	"/assets/dist-CM4n001X.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b3c-haiR0Oy65H/MEwsMRk+03tjL1Ok\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 2876,
		"path": "../public/assets/dist-CM4n001X.js"
	},
	"/assets/entrar-BGWH03J7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"568-mQqEERF5+B7JvSzdIonBviXyESg\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 1384,
		"path": "../public/assets/entrar-BGWH03J7.js"
	},
	"/assets/dist-CTY2Cwlu.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"68f9-3tC+ze1Fc8Cn5ojzOmyMXihK9FU\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 26873,
		"path": "../public/assets/dist-CTY2Cwlu.js"
	},
	"/assets/forms-BumFw6qG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24c2-l8NiB+Kz/fO5+ZTaFTfGZk/4c6s\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 9410,
		"path": "../public/assets/forms-BumFw6qG.js"
	},
	"/assets/input-B-R9C4XB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"47a-7RH4YqgRO7db+HSNU0ZINcBpwA8\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 1146,
		"path": "../public/assets/input-B-R9C4XB.js"
	},
	"/assets/knowledge-BdkXNj1y.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"bf2-BxeOJl0tEUJT860MUrYrp8eYdqs\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 3058,
		"path": "../public/assets/knowledge-BdkXNj1y.js"
	},
	"/assets/logs-D0SbLMh7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9ab-5wCo7JliSPdVt4pkQHsIqrhFe/A\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 2475,
		"path": "../public/assets/logs-D0SbLMh7.js"
	},
	"/assets/index-BgO0hdbT.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"9b34-gtIBhyAWe4+B9fhFdxJNOoi0kdU\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 39732,
		"path": "../public/assets/index-BgO0hdbT.css"
	},
	"/assets/link-D68ZUTD1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2bda-LNYJvwHqxMiyuPT1EomkxZRUnbE\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 11226,
		"path": "../public/assets/link-D68ZUTD1.js"
	},
	"/assets/jsx-runtime-BtJnwV6f.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a1f0-U3PkpEhBiO6oR/GMujs8fl+BHrM\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 41456,
		"path": "../public/assets/jsx-runtime-BtJnwV6f.js"
	},
	"/assets/moderation-D3GXWM12.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1881-FV2J0AUWeBqDlYsKeFccKghsN/o\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 6273,
		"path": "../public/assets/moderation-D3GXWM12.js"
	},
	"/assets/plus-Byn39v_F.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8e-eI/dpMcGyVFRdkU3xh4QS0RPc+k\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 142,
		"path": "../public/assets/plus-Byn39v_F.js"
	},
	"/assets/protect-CMARJe70.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"229e-c+/a9BiDWCugxXXRdZ2QyKa+jis\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 8862,
		"path": "../public/assets/protect-CMARJe70.js"
	},
	"/assets/routes-C2Ug1kWA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2165-CzGkpMzMWho72AlX2R3dChRJkTQ\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 8549,
		"path": "../public/assets/routes-C2Ug1kWA.js"
	},
	"/assets/settings-r9sbLbGC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"192c-Lr1Dl2J8t7jPnKEJNuNEv5Vioag\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 6444,
		"path": "../public/assets/settings-r9sbLbGC.js"
	},
	"/assets/shield-aOzGBHL1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"105-fT0Q9DapYlTLnt5YSQGjJnTQVR4\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 261,
		"path": "../public/assets/shield-aOzGBHL1.js"
	},
	"/assets/staff-7sceHqCk.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10e1-loS7qr0qYkNpZvVaxDrNRL2pl1M\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 4321,
		"path": "../public/assets/staff-7sceHqCk.js"
	},
	"/assets/switch-zgvTPJtM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"11c7-0cAEKBqihdN3hM4CLI5cbrA0Mh0\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 4551,
		"path": "../public/assets/switch-zgvTPJtM.js"
	},
	"/assets/index-Bse-nOcM.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"47c4b-WGu5FLbqvvMiBL3W7qPOhVepHk4\"",
		"mtime": "2026-10-02T00:33:15.520Z",
		"size": 293963,
		"path": "../public/assets/index-Bse-nOcM.js"
	},
	"/assets/tabs-CJjs3Dnp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3716-aDBGAQQJnq37BcHAIH+8Ghi0iao\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 14102,
		"path": "../public/assets/tabs-CJjs3Dnp.js"
	},
	"/assets/ticket-CEJ6EFs1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a6-3+75CFJimv7jZfJteyaPaRAddLI\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 422,
		"path": "../public/assets/ticket-CEJ6EFs1.js"
	},
	"/assets/use-billing-D5Ujg9wQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1f6-exeGIR4JyBks7UJV2mG4EE+6ysI\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 502,
		"path": "../public/assets/use-billing-D5Ujg9wQ.js"
	},
	"/assets/tickets-BIKWTkTJ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"347c-4Nna/7+UG0/qKiJy263eLM11W9g\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 13436,
		"path": "../public/assets/tickets-BIKWTkTJ.js"
	},
	"/assets/store-BwW1Sl0Y.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"912f-vZEQgtadt9rsx5Ph4ZxxBKLdjaM\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 37167,
		"path": "../public/assets/store-BwW1Sl0Y.js"
	},
	"/assets/utils-JQAQI5jf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6df6-j3EIueu2SLAsDv71ZfxE9MXEbl8\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 28150,
		"path": "../public/assets/utils-JQAQI5jf.js"
	},
	"/assets/stats-CugLImtm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5d117-DLagCXuf861bG8xZO9iPeEDZRJ0\"",
		"mtime": "2026-10-02T00:33:15.524Z",
		"size": 381207,
		"path": "../public/assets/stats-CugLImtm.js"
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
var _lazy_jPnBRt = defineLazyEventHandler(() => import("./_chunks/ssr-renderer.mjs"));
var findRoute = /* @__PURE__ */ (() => {
	const data = {
		route: "/**",
		handler: _lazy_jPnBRt
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
