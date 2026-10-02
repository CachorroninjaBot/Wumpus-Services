import { i as __toESM } from "../_runtime.mjs";
import { n as formatRelative } from "./utils-H16dNBFI.mjs";
import { o as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as Badge } from "./badge-C2mxnvvX.mjs";
import { t as Button } from "./button-BUiFN9VL.mjs";
import { t as Card } from "./card-DaYenTQt.mjs";
import { t as Input } from "./input-Cyzc7r1j.mjs";
import { b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { d as useActiveGuild, m as useWumpus, p as useModule, u as ticketSla } from "./store-B26y7m0l.mjs";
import { f as Clock3, h as ArrowRight, i as Ticket, n as TriangleAlert, o as Shield } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app-fIZKOHi8.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Overview() {
	const guild = useActiveGuild();
	const gid = useWumpus((s) => s.activeGuildId);
	const allTickets = useWumpus((s) => s.tickets);
	const tcfg = useModule("tickets");
	const allIncidents = useWumpus((s) => s.incidents);
	const allLogs = useWumpus((s) => s.logs);
	const allSubs = useWumpus((s) => s.submissions);
	const lockdown = Boolean(useModule("security").config.lockdown);
	const automod = useModule("automod");
	const [cmd, setCmd] = (0, import_react.useState)("/config status");
	const [cmdOut, setCmdOut] = (0, import_react.useState)(null);
	const tickets = allTickets.filter((t) => t.guildId === gid);
	const incidents = allIncidents.filter((i) => i.guildId === gid && i.status !== "closed");
	const logs = allLogs.filter((l) => l.guildId === gid).slice(0, 6);
	const submissions = allSubs.filter((x) => x.guildId === gid && x.status === "pending");
	const open = tickets.filter((t) => t.status === "open" || t.status === "claimed");
	const breaches = open.filter((t) => ticketSla(t, tcfg.config) !== "ok");
	const csat = tickets.filter((t) => t.feedback);
	const avg = csat.length === 0 ? "—" : (csat.reduce((s, t) => s + (t.feedback?.rating ?? 0), 0) / csat.length).toFixed(1);
	function runCommand(raw) {
		const name = raw.trim().replace(/^\//, "").split(/\s+/)[0]?.toLowerCase() ?? "";
		if (name === "config") {
			setCmdOut(`Plano ${guild.plan} · preset ${guild.preset}\nAtendimento ${tcfg.enabled ? "ligado" : "pausado"} · SLA ${String(tcfg.config.slaWarningMinutes)} min\nAutoMod ${automod.enabled ? String(automod.config.action) : "pausado"} · lockdown ${lockdown ? "sim" : "não"}`);
			return;
		}
		if (name === "stats") {
			setCmdOut(`Abertos ${open.length} · SLA atrasado ${breaches.length} · CSAT ${avg} · candidaturas ${submissions.length}`);
			return;
		}
		if (name === "ticket") {
			setCmdOut(open.length ? open.map((t) => `#${t.number} ${t.department} — ${t.subject}`).join("\n") : "Fila vazia.");
			return;
		}
		if (name === "mod") {
			setCmdOut("Use Moderação para advertir, silenciar, expulsar ou banir. O limiar de strikes está nas regras daquele painel.");
			return;
		}
		setCmdOut("Comandos: /config status · /stats · /ticket · /mod");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-5xl flex-col gap-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase",
					children: guild.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-1 mb-0 text-2xl font-semibold tracking-tight",
					children: "O que precisa de você agora"
				})] }), lockdown ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: "danger",
					children: "Lockdown ativo"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: "ok",
					children: "Bot operacional"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Fila aberta",
						value: String(open.length),
						hint: "tickets sem encerrar"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "SLA em atraso",
						value: String(breaches.length),
						hint: "sem 1ª resposta a tempo",
						warn: breaches.length > 0
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Candidaturas",
						value: String(submissions.length),
						hint: "esperando review"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "CSAT",
						value: avg,
						hint: `${csat.length} avaliações`
					})
				]
			}),
			breaches.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "flex flex-col gap-3 sm:flex-row sm:items-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid size-10 place-items-center rounded-xl bg-destructive/15 text-destructive",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "m-0 font-medium",
							children: [
								"Há atendimento fora do SLA de ",
								String(tcfg.config.slaWarningMinutes),
								" min"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "m-0 text-sm text-muted-foreground",
							children: breaches.map((t) => `#${t.number} ${t.subject}`).join(" · ")
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/app/tickets",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, { children: ["Ir para a fila", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" })] })
					})
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-3 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "m-0 text-base font-semibold",
						children: "Fila"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/app/tickets",
						className: "text-sm text-primary",
						children: "Ver todos"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "m-0 space-y-2 p-0",
					children: [open.slice(0, 4).map((t) => {
						const sla = ticketSla(t, tcfg.config);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-start justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "m-0 truncate text-sm font-medium",
									children: [
										"#",
										t.number,
										" · ",
										t.subject
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "m-0 text-xs text-muted-foreground",
									children: [
										t.department,
										" · ",
										formatRelative(t.createdAt)
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: sla === "ok" ? "ok" : sla === "warning" ? "warn" : "danger",
								children: sla === "ok" ? "no prazo" : sla === "warning" ? "alerta" : "atraso"
							})]
						}, t.id);
					}), open.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 text-sm text-muted-foreground",
						children: "Nada na fila."
					}) : null]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-3 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "m-0 text-base font-semibold",
						children: "Auditoria recente"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/app/logs",
						className: "text-sm text-primary",
						children: "Ver logs"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "m-0 space-y-2 p-0",
					children: logs.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex gap-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock3, { className: "mt-0.5 size-3.5 shrink-0 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted-foreground",
							children: [l.actor, " · "]
						}), l.summary] })]
					}, l.id))
				})] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-0 text-base font-semibold",
					children: "Comandos da equipe"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Os mesmos slash que a staff usa no Discord, lendo a config deste servidor."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "mt-3 flex gap-2",
					onSubmit: (e) => {
						e.preventDefault();
						runCommand(cmd);
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: cmd,
						onChange: (e) => setCmd(e.target.value),
						placeholder: "/config status"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						children: "Rodar"
					})]
				}),
				cmdOut ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
					className: "mt-3 mb-0 whitespace-pre-wrap font-sans text-sm",
					children: cmdOut
				}) : null
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Quick, {
						to: "/app/tickets",
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ticket, { className: "size-4" }),
						title: "Assumir um ticket"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Quick, {
						to: "/app/forms",
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ticket, { className: "size-4" }),
						title: "Revisar candidaturas"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Quick, {
						to: "/app/protect",
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "size-4" }),
						title: "Testar o AutoMod"
					})
				]
			}),
			incidents.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mt-0 mb-2 text-base font-semibold",
				children: "Incidentes abertos"
			}), incidents.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "m-0 text-sm text-muted-foreground",
				children: [
					i.title,
					" — ",
					i.detail
				]
			}, i.id))] }) : null
		]
	});
}
function Stat({ label, value, hint, warn }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "m-0 text-xs text-muted-foreground",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: `mt-1 mb-0 font-mono-num text-3xl font-semibold ${warn ? "text-destructive" : ""}`,
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "m-0 text-xs text-muted-foreground",
				children: hint
			})
		]
	});
}
function Quick({ to, icon, title }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to,
		className: "flex min-h-12 items-center gap-2 rounded-2xl bg-card px-4 text-sm font-medium shadow-border",
		children: [
			icon,
			title,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "ml-auto size-4 text-muted-foreground" })
		]
	});
}
//#endregion
export { Overview as component };
