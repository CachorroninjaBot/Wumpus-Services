import { i as __toESM } from "../_runtime.mjs";
import { r as formatTime } from "./utils-H16dNBFI.mjs";
import { o as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as Card } from "./card-DaYenTQt.mjs";
import { n as Label, t as Input } from "./input-Cyzc7r1j.mjs";
import { m as useWumpus, p as useModule } from "./store-B26y7m0l.mjs";
import { t as Switch } from "./switch-C8XyncjG.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/logs-pLG2GAQ_.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function LogsPage() {
	const gid = useWumpus((s) => s.activeGuildId);
	const logs = useWumpus((s) => s.logs).filter((l) => l.guildId === gid);
	const lcfg = useModule("logs");
	const updateConfig = useWumpus((s) => s.updateConfig);
	const [q, setQ] = (0, import_react.useState)("");
	const [cat, setCat] = (0, import_react.useState)("all");
	const cats = (0, import_react.useMemo)(() => ["all", ...Array.from(new Set(logs.map((l) => l.category)))], [logs]);
	const filtered = logs.filter((l) => {
		if (cat !== "all" && l.category !== cat) return false;
		if (q && !`${l.summary} ${l.actor}`.toLowerCase().includes(q.toLowerCase())) return false;
		return true;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-5xl flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "m-0 text-xl font-semibold tracking-tight",
				children: "Auditoria"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-2",
				children: cats.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setCat(c),
					className: `h-9 rounded-full px-3 text-sm ${cat === c ? "bg-secondary" : "text-muted-foreground hover:bg-muted"}`,
					children: c === "all" ? "tudo" : c
				}, c))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: q,
				onChange: (e) => setQ(e.target.value),
				placeholder: "Filtrar"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "p-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "m-0 divide-y divide-border p-0",
					children: filtered.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "w-36 shrink-0 font-mono-num text-xs text-muted-foreground",
								children: formatTime(l.at)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "w-24 shrink-0 text-xs uppercase tracking-wide text-muted-foreground",
								children: l.category
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-muted-foreground",
									children: [l.actor, " · "]
								}), l.summary]
							})
						]
					}, l.id))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "flex flex-wrap items-center gap-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Modo compacto" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							checked: Boolean(lcfg.config.compactMode),
							onCheckedChange: (v) => updateConfig("logs", { compactMode: v })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Registrar AutoMod" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							checked: Boolean(lcfg.config.logAutoMod),
							onCheckedChange: (v) => updateConfig("logs", { logAutoMod: v })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Registrar moderação" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							checked: Boolean(lcfg.config.logModeration),
							onCheckedChange: (v) => updateConfig("logs", { logModeration: v })
						})]
					})
				]
			})
		]
	});
}
//#endregion
export { LogsPage as component };
