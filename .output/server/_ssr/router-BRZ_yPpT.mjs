import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as lazyRouteComponent, d as Scripts, f as HeadContent, g as Outlet, h as createRouter, v as createFileRoute, y as createRootRoute } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TriangleAlert } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-BRZ_yPpT.js
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var APP_NAME = "Wumpus";
var Route$15 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "A central de comando da sua comunidade no Discord."
			},
			{
				name: "theme-color",
				content: "#09090c"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "manifest",
				href: "/manifest.json"
			},
			{
				rel: "apple-touch-icon",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "pt-BR",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})] })]
	})
});
var $$splitComponentImporter$14 = () => import("./routes-Dz2dfXvm.mjs");
var Route$14 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$14, "component") });
var $$splitComponentImporter$13 = () => import("./admin-B7CXj8LZ.mjs");
var Route$13 = createFileRoute("/admin")({ component: lazyRouteComponent($$splitComponentImporter$13, "component") });
var $$splitComponentImporter$12 = () => import("./app-CSbqkT1H.mjs");
var Route$12 = createFileRoute("/app")({ component: lazyRouteComponent($$splitComponentImporter$12, "component") });
var $$splitComponentImporter$11 = () => import("./entrar-DM9Be8Hm.mjs");
var Route$11 = createFileRoute("/entrar")({ component: lazyRouteComponent($$splitComponentImporter$11, "component") });
var $$splitComponentImporter$10 = () => import("./app-fIZKOHi8.mjs");
var Route$10 = createFileRoute("/app/")({ component: lazyRouteComponent($$splitComponentImporter$10, "component") });
var $$splitComponentImporter$9 = () => import("./forms-DSRC9DGh.mjs");
var Route$9 = createFileRoute("/app/forms")({ component: lazyRouteComponent($$splitComponentImporter$9, "component") });
var $$splitComponentImporter$8 = () => import("./knowledge-B30U7CXQ.mjs");
var Route$8 = createFileRoute("/app/knowledge")({ component: lazyRouteComponent($$splitComponentImporter$8, "component") });
var $$splitComponentImporter$7 = () => import("./logs-pLG2GAQ_.mjs");
var Route$7 = createFileRoute("/app/logs")({ component: lazyRouteComponent($$splitComponentImporter$7, "component") });
var $$splitComponentImporter$6 = () => import("./moderation-CIGywuOR.mjs");
var Route$6 = createFileRoute("/app/moderation")({ component: lazyRouteComponent($$splitComponentImporter$6, "component") });
var $$splitComponentImporter$5 = () => import("./protect-pUCKumdi.mjs");
var Route$5 = createFileRoute("/app/protect")({ component: lazyRouteComponent($$splitComponentImporter$5, "component") });
var $$splitComponentImporter$4 = () => import("./settings-DfVdoEQY.mjs");
var Route$4 = createFileRoute("/app/settings")({ component: lazyRouteComponent($$splitComponentImporter$4, "component") });
var $$splitComponentImporter$3 = () => import("./staff-M1m8JXzl.mjs");
var Route$3 = createFileRoute("/app/staff")({ component: lazyRouteComponent($$splitComponentImporter$3, "component") });
var $$splitComponentImporter$2 = () => import("./stats-B7v3Gk-q.mjs");
var Route$2 = createFileRoute("/app/stats")({ component: lazyRouteComponent($$splitComponentImporter$2, "component") });
var $$splitComponentImporter$1 = () => import("./tickets-vZaCg_jL.mjs");
var Route$1 = createFileRoute("/app/tickets")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./auth.discord.callback-UaAf8-HM.mjs");
var Route = createFileRoute("/auth/discord/callback")({
	validateSearch: (s) => ({
		code: typeof s.code === "string" ? s.code : "",
		error: typeof s.error === "string" ? s.error : ""
	}),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
var IndexRoute = Route$14.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$15
});
var AdminRoute = Route$13.update({
	id: "/admin",
	path: "/admin",
	getParentRoute: () => Route$15
});
var AppRoute = Route$12.update({
	id: "/app",
	path: "/app",
	getParentRoute: () => Route$15
});
var EntrarRoute = Route$11.update({
	id: "/entrar",
	path: "/entrar",
	getParentRoute: () => Route$15
});
var AppIndexRoute = Route$10.update({
	id: "/",
	path: "/",
	getParentRoute: () => AppRoute
});
var AppFormsRoute = Route$9.update({
	id: "/forms",
	path: "/forms",
	getParentRoute: () => AppRoute
});
var AppKnowledgeRoute = Route$8.update({
	id: "/knowledge",
	path: "/knowledge",
	getParentRoute: () => AppRoute
});
var AppLogsRoute = Route$7.update({
	id: "/logs",
	path: "/logs",
	getParentRoute: () => AppRoute
});
var AppModerationRoute = Route$6.update({
	id: "/moderation",
	path: "/moderation",
	getParentRoute: () => AppRoute
});
var AppProtectRoute = Route$5.update({
	id: "/protect",
	path: "/protect",
	getParentRoute: () => AppRoute
});
var AppSettingsRoute = Route$4.update({
	id: "/settings",
	path: "/settings",
	getParentRoute: () => AppRoute
});
var AppStaffRoute = Route$3.update({
	id: "/staff",
	path: "/staff",
	getParentRoute: () => AppRoute
});
var AppStatsRoute = Route$2.update({
	id: "/stats",
	path: "/stats",
	getParentRoute: () => AppRoute
});
var AppTicketsRoute = Route$1.update({
	id: "/tickets",
	path: "/tickets",
	getParentRoute: () => AppRoute
});
var AuthDiscordCallbackRoute = Route.update({
	id: "/auth/discord/callback",
	path: "/auth/discord/callback",
	getParentRoute: () => Route$15
});
var AppRouteChildren = {
	AppFormsRoute,
	AppKnowledgeRoute,
	AppLogsRoute,
	AppModerationRoute,
	AppProtectRoute,
	AppSettingsRoute,
	AppStaffRoute,
	AppStatsRoute,
	AppTicketsRoute,
	AppIndexRoute
};
var rootRouteChildren = {
	IndexRoute,
	AdminRoute,
	AppRoute: AppRoute._addFileChildren(AppRouteChildren),
	EntrarRoute,
	AuthDiscordCallbackRoute
};
var routeTree = Route$15._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { Route as n, router_exports as t };
