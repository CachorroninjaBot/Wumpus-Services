import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { r as MemberAvatar } from "./brand-9-bk6ia6.mjs";
import { t as Badge } from "./badge-C2mxnvvX.mjs";
import { t as Card } from "./card-DaYenTQt.mjs";
import { n as Label, t as Input } from "./input-Cyzc7r1j.mjs";
import { f as useGuildMembers, m as useWumpus, p as useModule, u as ticketSla } from "./store-B26y7m0l.mjs";
import { t as Switch } from "./switch-C8XyncjG.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/staff-M1m8JXzl.js
var import_jsx_runtime = require_jsx_runtime();
function StaffPage() {
	const gid = useWumpus((s) => s.activeGuildId);
	const members = useGuildMembers();
	const tickets = useWumpus((s) => s.tickets).filter((t) => t.guildId === gid);
	const scfg = useModule("staff");
	const tcfg = useModule("tickets");
	const updateConfig = useWumpus((s) => s.updateConfig);
	const roles = useWumpus((s) => s.roles[gid] ?? []);
	const staffRoles = new Set(scfg.config.staffRoleIds ?? []);
	const staff = members.filter((m) => m.roleIds.some((r) => staffRoles.has(r) || r === "role_owner"));
	const goal = Number(scfg.config.responseTimeGoalMinutes ?? 30);
	const maxC = Number(scfg.config.maxConcurrentTickets ?? 5);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-5xl flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "m-0 text-xl font-semibold tracking-tight",
				children: "Equipe"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "m-0 text-xs text-muted-foreground",
							children: "Meta de 1ª resposta"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 mb-0 font-mono-num text-2xl font-semibold",
							children: [goal, " min"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "m-0 text-xs text-muted-foreground",
							children: "Máx. simultâneos"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 mb-0 font-mono-num text-2xl font-semibold",
							children: maxC
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "m-0 text-xs text-muted-foreground",
							children: "Staff ativo"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 mb-0 font-mono-num text-2xl font-semibold",
							children: [
								staff.filter((s) => s.status === "online").length,
								"/",
								staff.length
							]
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "overflow-x-auto p-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[640px] text-left text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "text-xs text-muted-foreground",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3 font-medium",
								children: "Pessoa"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3 font-medium",
								children: "Carga"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3 font-medium",
								children: "1ª resposta média"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3 font-medium",
								children: "CSAT"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3 font-medium",
								children: "SLA"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: staff.map((s) => {
						const mine = tickets.filter((t) => t.claimedBy === s.id);
						const open = mine.filter((t) => t.status === "open" || t.status === "claimed");
						const responded = mine.filter((t) => t.firstResponseAt);
						const avg = responded.length === 0 ? null : responded.reduce((acc, t) => acc + (t.firstResponseAt - t.createdAt) / 6e4, 0) / responded.length;
						const rated = mine.filter((t) => t.feedback);
						const csat = rated.length === 0 ? null : rated.reduce((acc, t) => acc + (t.feedback?.rating ?? 0), 0) / rated.length;
						const late = open.filter((t) => ticketSla(t, tcfg.config) !== "ok").length;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-border",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-3",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemberAvatar, {
											name: s.displayName,
											hue: s.hue,
											size: 28
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [s.displayName, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "block text-xs text-muted-foreground",
											children: roles.filter((r) => s.roleIds.includes(r.id)).map((r) => r.name).join(" · ")
										})] })]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "px-4 py-3 font-mono-num",
									children: [
										open.length,
										"/",
										maxC,
										open.length >= maxC ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											tone: "warn",
											className: "ml-2",
											children: "cheio"
										}) : null
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-3 font-mono-num",
									children: avg == null ? "—" : `${Math.round(avg)} min`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-3 font-mono-num",
									children: csat == null ? "—" : csat.toFixed(1)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-3",
									children: late ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
										tone: "danger",
										children: [late, " atrasado"]
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone: "ok",
										children: "ok"
									})
								})
							]
						}, s.id);
					}) })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "grid gap-4 sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Meta de resposta (min)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "mt-1",
						type: "number",
						defaultValue: goal,
						onBlur: (e) => updateConfig("staff", { responseTimeGoalMinutes: Number(e.target.value) || 5 })
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Máximo simultâneo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "mt-1",
						type: "number",
						defaultValue: maxC,
						onBlur: (e) => updateConfig("staff", { maxConcurrentTickets: Number(e.target.value) || 1 })
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Exigir motivo nas ações" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							checked: Boolean(scfg.config.requireReason),
							onCheckedChange: (v) => updateConfig("staff", { requireReason: v })
						})]
					})
				]
			})
		]
	});
}
//#endregion
export { StaffPage as component };
