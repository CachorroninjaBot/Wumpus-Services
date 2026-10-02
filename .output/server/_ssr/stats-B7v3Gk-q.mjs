import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as Card } from "./card-DaYenTQt.mjs";
import { m as useWumpus, p as useModule, u as ticketSla } from "./store-B26y7m0l.mjs";
import { a as CartesianGrid, i as Area, n as YAxis, o as ResponsiveContainer, r as XAxis, s as Tooltip, t as AreaChart } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/stats-B7v3Gk-q.js
var import_jsx_runtime = require_jsx_runtime();
function StatsPage() {
	const gid = useWumpus((s) => s.activeGuildId);
	const allTickets = useWumpus((s) => s.tickets);
	const allHits = useWumpus((s) => s.automodHits);
	const allCases = useWumpus((s) => s.cases);
	const tickets = allTickets.filter((t) => t.guildId === gid);
	const hits = allHits.filter((h) => h.guildId === gid);
	const cases = allCases.filter((c) => c.guildId === gid);
	const tcfg = useModule("tickets");
	const closed = tickets.filter((t) => t.closedAt);
	const rated = tickets.filter((t) => t.feedback);
	const csat = rated.length ? rated.reduce((s, t) => s + (t.feedback?.rating ?? 0), 0) / rated.length : 0;
	const first = tickets.filter((t) => t.firstResponseAt);
	const avgFirst = first.length === 0 ? 0 : first.reduce((s, t) => s + (t.firstResponseAt - t.createdAt) / 6e4, 0) / first.length;
	const late = tickets.filter((t) => ticketSla(t, tcfg.config) === "breach").length;
	const series = Array.from({ length: 7 }, (_, index) => {
		const end = /* @__PURE__ */ new Date();
		end.setHours(24, 0, 0, 0);
		const dayEnd = end.getTime() - (6 - index) * 864e5;
		const dayStart = dayEnd - 864e5;
		const label = new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(new Date(dayStart + 36e5));
		return {
			d: index === 6 ? "hoje" : label.replace(".", ""),
			tickets: tickets.filter((t) => t.createdAt >= dayStart && t.createdAt < dayEnd).length,
			automod: hits.filter((h) => h.at >= dayStart && h.at < dayEnd).length,
			mod: cases.filter((c) => c.createdAt >= dayStart && c.createdAt < dayEnd).length
		};
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-5xl flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "m-0 text-xl font-semibold tracking-tight",
				children: "Estatísticas"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Tickets no período",
						value: String(tickets.length)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "1ª resposta média",
						value: `${Math.round(avgFirst)} min`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "CSAT",
						value: rated.length ? csat.toFixed(1) : "—"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "SLA estourado",
						value: String(late)
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "h-72",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 mb-2 text-sm text-muted-foreground",
					children: "Atividade dos últimos 7 dias, a partir dos eventos reais"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
					width: "100%",
					height: "90%",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
						data: series,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
								stroke: "rgba(243,244,247,0.08)",
								vertical: false
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
								dataKey: "d",
								tick: {
									fill: "#9aa0ad",
									fontSize: 12
								},
								axisLine: false,
								tickLine: false
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
								tick: {
									fill: "#9aa0ad",
									fontSize: 12
								},
								axisLine: false,
								tickLine: false,
								width: 28
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, { contentStyle: {
								background: "#16161d",
								border: "1px solid rgba(255,255,255,0.08)",
								borderRadius: 12
							} }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
								type: "monotone",
								dataKey: "tickets",
								stroke: "#7c5cff",
								fill: "rgba(124,92,255,0.25)"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
								type: "monotone",
								dataKey: "automod",
								stroke: "#5b8def",
								fill: "rgba(91,141,239,0.15)"
							})
						]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "m-0 text-sm text-muted-foreground",
				children: [
					"Encerrados com transcrição: ",
					closed.filter((t) => t.transcript).length,
					" · hits AutoMod: ",
					hits.length,
					" · casos de mod: ",
					cases.length
				]
			})
		]
	});
}
function Kpi({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "m-0 text-xs text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 mb-0 font-mono-num text-3xl font-semibold",
			children: value
		})]
	});
}
//#endregion
export { StatsPage as component };
