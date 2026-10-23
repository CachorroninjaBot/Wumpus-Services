import { i as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as getStoredSessionToken } from "./session-token-CaBlZnli.mjs";
import { $ as ArrowRight, l as Ticket, m as Shield, o as TriangleAlert, z as Clock3 } from "../_libs/lucide-react.mjs";
import { $ as formatRelative, K as ticketSla, N as getGuildTickets, O as getGuildActivity, P as getPublishStatus, X as useModule, Y as useGuildMembers, Z as useWumpus, _ as Button, g as Card, v as Badge } from "./router-DjtjaZqs.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app-cPRqs41z.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Overview() {
	const members = useGuildMembers();
	const gid = useWumpus((s) => s.activeGuildId);
	const tcfg = useModule("tickets");
	const lockdown = Boolean(useModule("security").config.lockdown);
	const [publishStatuses, setPublishStatuses] = (0, import_react.useState)([]);
	const [statusError, setStatusError] = (0, import_react.useState)(null);
	const [tickets, setTickets] = (0, import_react.useState)([]);
	const [activity, setActivity] = (0, import_react.useState)(null);
	const submissions = activity?.pendingForms ?? 0;
	const logs = activity?.recentEvents ?? [];
	const pendingSync = publishStatuses.filter((job) => job.status === "queued").length;
	const failedSync = publishStatuses.filter((job) => job.status === "failed");
	const latestAttempt = [...publishStatuses].sort((a, b) => (b.at ?? b.createdAt) - (a.at ?? a.createdAt))[0];
	const latestConfirmed = publishStatuses.filter((job) => job.status === "done").sort((a, b) => (b.at ?? b.createdAt) - (a.at ?? a.createdAt))[0];
	(0, import_react.useEffect)(() => {
		let active = true;
		const refreshStatus = async () => {
			try {
				const token = getStoredSessionToken();
				if (!token) {
					if (active) setStatusError(null);
					return;
				}
				const [statuses, liveTickets, liveActivity] = await Promise.all([
					getPublishStatus({ data: {
						token,
						guildId: gid
					} }),
					getGuildTickets({ data: {
						token,
						guildId: gid
					} }),
					getGuildActivity({ data: {
						token,
						guildId: gid
					} })
				]);
				if (active) {
					setPublishStatuses(statuses);
					setTickets(liveTickets);
					setActivity(liveActivity);
					setStatusError(null);
				}
			} catch (error) {
				if (active) setStatusError(error instanceof Error ? error.message : "Não foi possível consultar o estado real do bot.");
			}
		};
		refreshStatus();
		const timer = window.setInterval(() => void refreshStatus(), 3e4);
		return () => {
			active = false;
			window.clearInterval(timer);
		};
	}, [gid]);
	const open = tickets.filter((t) => t.status === "open" || t.status === "claimed");
	const breaches = open.filter((t) => ticketSla(t, tcfg.config) !== "ok");
	const priorityTicket = breaches[0] ?? open[0] ?? null;
	const csat = tickets.filter((t) => t.feedback);
	const avg = csat.length === 0 ? "—" : (csat.reduce((s, t) => s + (t.feedback?.rating ?? 0), 0) / csat.length).toFixed(1);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-7xl flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "m-0 text-2xl font-semibold tracking-tight",
					children: "O que precisa de atenção?"
				}), lockdown ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: "danger",
					children: "Lockdown ativo"
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-2 rounded-xl border border-border bg-card px-3 py-3 text-sm sm:grid-cols-3",
				"aria-label": "Estado do bot e das publicações",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusLine, {
						label: "Bot neste servidor",
						tone: activity?.bot.status === "online" ? "ok" : activity?.bot.status === "offline" ? "danger" : "warn",
						children: activity?.bot.status === "online" ? `Conectado${activity.bot.pingMs == null ? "" : ` · ${activity.bot.pingMs} ms`}` : activity?.bot.status === "offline" ? "Sem conexão recente" : "Estado indisponível"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StatusLine, {
						label: "Fila de publicação",
						tone: failedSync.length ? "danger" : pendingSync ? "warn" : "ok",
						children: [pendingSync || failedSync.length ? `${pendingSync} aguardando · ${failedSync.length} com falha` : "Sem pendências", failedSync[0]?.detail ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block truncate text-xs text-destructive",
							children: failedSync[0].detail
						}) : null]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StatusLine, {
						label: "Última publicação confirmada",
						tone: latestConfirmed ? "ok" : "warn",
						children: [latestConfirmed ? formatRelative(latestConfirmed.at ?? latestConfirmed.createdAt) : "Ainda não confirmada pelo bot", latestAttempt?.status === "failed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "block text-xs text-muted-foreground",
							children: ["Última tentativa falhou · ", formatRelative(latestAttempt.at ?? latestAttempt.createdAt)]
						}) : null]
					})
				]
			}),
			statusError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "m-0 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive",
				role: "alert",
				children: ["Não foi possível atualizar o estado: ", statusError]
			}) : null,
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
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-2xl border border-border bg-card p-4 sm:p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-4 flex flex-wrap items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "m-0 text-lg font-semibold",
							children: "Próximos atendimentos"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "m-0 mt-1 text-sm text-muted-foreground",
							children: "Acompanhe responsável, prioridade e prazo numa única leitura."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/app/tickets",
							className: "inline-flex items-center gap-1 text-sm font-semibold text-primary",
							children: ["Abrir fila completa ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" })]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "hidden grid-cols-[90px_minmax(180px,1fr)_130px_140px_100px_110px] gap-3 border-b border-border pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Registro" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Assunto" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Departamento" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Responsável" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Prioridade" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Prazo" })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "m-0 divide-y divide-border p-0",
						children: [open.slice(0, 6).map((t) => {
							const sla = ticketSla(t, tcfg.config);
							const tone = sla === "ok" ? "ok" : sla === "warning" ? "warn" : "danger";
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "grid gap-2 py-3 lg:grid-cols-[90px_minmax(180px,1fr)_130px_140px_100px_110px] lg:items-center lg:gap-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-mono-num text-sm font-semibold text-primary",
										children: ["#", t.number]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "min-w-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
											href: `/app/tickets?ticket=${encodeURIComponent(t.id)}`,
											className: "block truncate text-sm font-medium text-foreground underline-offset-2 hover:text-primary hover:underline",
											children: t.subject || `Ticket #${t.number}`
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", {
											className: "text-muted-foreground",
											children: ["Aberto ", formatRelative(t.createdAt)]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-sm",
										children: t.department
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-sm text-muted-foreground",
										children: t.claimedBy ? `Em atendimento · ${members.find((member) => member.id === t.claimedBy)?.displayName ?? t.claimedBy}` : "Aguardando equipe"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone: t.priority === "urgent" ? "danger" : t.priority === "high" ? "warn" : "default",
										children: t.priority === "urgent" ? "Urgente" : t.priority === "high" ? "Alta" : t.priority === "low" ? "Baixa" : "Normal"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone,
										children: sla === "ok" ? "No prazo" : sla === "warning" ? "Atenção" : "Atrasado"
									})
								]
							}, t.id);
						}), open.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "py-8 text-center",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "m-0 font-medium",
								children: "A fila está em dia"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "m-0 mt-1 text-sm text-muted-foreground",
								children: "Tickets novos aparecem aqui assim que alguém abrir um atendimento."
							})]
						}) : null]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
				className: "grid grid-cols-2 gap-y-3 rounded-xl border border-border bg-card px-4 py-3 lg:grid-cols-4 lg:divide-x lg:divide-border",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Summary, {
						label: "Tickets abertos",
						value: String(open.length),
						hint: "sem encerrar"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Summary, {
						label: "SLA em atraso",
						value: String(breaches.length),
						hint: "sem primeira resposta",
						warn: breaches.length > 0
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Summary, {
						label: "Formulários",
						value: String(submissions),
						hint: "aguardando revisão"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Summary, {
						label: "Satisfação",
						value: avg,
						hint: `${csat.length} avaliações`
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-4 lg:grid-cols-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-3 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "m-0 text-base font-semibold",
						children: "Auditoria recente do bot"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/app/logs",
						className: "text-sm text-primary",
						children: "Ver logs"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "m-0 space-y-2 p-0",
					children: [logs.map((event) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex gap-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock3, { className: "mt-0.5 size-3.5 shrink-0 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
								className: "font-medium",
								children: eventLabel(event.eventType)
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "block truncate text-xs text-muted-foreground",
								children: [
									moduleLabel(event.module),
									" · ",
									event.actorId ? members.find((member) => member.id === event.actorId)?.displayName ?? "Equipe" : "Wumpus",
									" · ",
									formatRelative(event.at)
								]
							})]
						})]
					}, event.id)), logs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "text-sm text-muted-foreground",
						children: "Nenhum evento retornado pelo bot."
					}) : null]
				})] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Quick, {
						to: priorityTicket ? `/app/tickets?ticket=${encodeURIComponent(priorityTicket.id)}` : "/app/tickets",
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ticket, { className: "size-4" }),
						title: priorityTicket ? breaches.length ? `Abrir ticket atrasado #${priorityTicket.number}` : `Abrir ticket #${priorityTicket.number}` : "Abrir fila de tickets"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Quick, {
						to: "/app/forms",
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ticket, { className: "size-4" }),
						title: "Revisar formulários"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Quick, {
						to: "/app/protect",
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "size-4" }),
						title: "Testar o AutoMod"
					})
				]
			}),
			logs.some((event) => event.module === "security" && event.severity === "critical") ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mt-0 mb-2 text-base font-semibold",
				children: "Alertas críticos recentes"
			}), logs.filter((event) => event.module === "security" && event.severity === "critical").slice(0, 3).map((event) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "m-0 text-sm text-muted-foreground",
				children: [
					eventLabel(event.eventType),
					" · ",
					formatRelative(event.at)
				]
			}, event.id))] }) : null
		]
	});
}
function Summary({ label, value, hint, warn }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0 px-2 first:pl-0 lg:px-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
			className: "truncate text-xs text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", {
			className: `m-0 mt-0.5 inline-flex items-baseline gap-2 font-mono-num text-lg font-semibold ${warn ? "text-destructive" : ""}`,
			children: [value, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-sans text-[11px] font-normal text-muted-foreground",
				children: hint
			})]
		})]
	});
}
function Quick({ to, icon, title }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
		href: to,
		className: "flex min-h-12 items-center gap-2 rounded-2xl bg-card px-4 text-sm font-medium shadow-border hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
		children: [
			icon,
			title,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "ml-auto size-4 text-muted-foreground" })
		]
	});
}
function StatusLine({ label, tone, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block text-xs text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "mt-1 flex min-w-0 items-start gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: `mt-1 inline-block size-2 shrink-0 rounded-full ${tone === "ok" ? "bg-ok" : tone === "danger" ? "bg-destructive" : "bg-warn"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "min-w-0 truncate",
				children
			})]
		})]
	});
}
function moduleLabel(module) {
	return {
		tickets: "Atendimento",
		forms: "Formulários",
		automod: "Proteção",
		security: "Segurança",
		moderation: "Moderação",
		knowledge: "Base de conhecimento",
		members: "Membros",
		staff: "Equipe",
		automation: "Automação",
		integrations: "Integrações",
		roles: "Cargos",
		channels: "Canais",
		bans: "Banimentos"
	}[module] ?? "Servidor";
}
function eventLabel(eventType) {
	const exact = {
		ticket_opened: "Novo atendimento aberto",
		ticket_claimed: "Atendimento assumido",
		ticket_closed: "Atendimento encerrado",
		ticket_reopened: "Atendimento reaberto",
		ticket_priority_changed: "Prioridade alterada",
		ticket_sla_warning: "Prazo de resposta próximo",
		ticket_sla_breach: "Prazo de resposta ultrapassado",
		form_submitted: "Nova resposta recebida",
		form_approved: "Resposta aprovada",
		form_rejected: "Resposta recusada",
		knowledge_answered: "Resposta sugerida pela base de conhecimento",
		member_joined: "Novo membro entrou",
		member_left: "Membro saiu",
		member_updated: "Perfil de membro atualizado",
		automation_awaiting_approval: "Automação aguarda aprovação",
		automation_failed: "Automação não foi concluída",
		staff_overloaded: "Equipe acima da capacidade",
		staff_inactive: "Atendente inativo"
	};
	if (exact[eventType]) return exact[eventType];
	if (eventType.startsWith("automod_")) return "Regra automática aplicada";
	if (eventType.startsWith("moderation_")) return "Ação de moderação registrada";
	if (eventType.startsWith("security_")) return "Alerta de segurança registrado";
	if (eventType.startsWith("integration_")) return "Integração atualizada";
	return "Atividade registrada";
}
//#endregion
export { Overview as component };
