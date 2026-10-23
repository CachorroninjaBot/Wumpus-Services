import { i as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { l as planAllows, o as getStoredSessionToken } from "./session-token-CaBlZnli.mjs";
import { y as Search } from "../_libs/lucide-react.mjs";
import { $ as formatRelative, C as asList, G as shouldAutoClose, I as getTicketActionStatus, J as useActiveGuild, K as ticketSla, N as getGuildTickets, Q as cn, V as requestTicketAction, W as searchArticles, X as useModule, Y as useGuildMembers, Z as useWumpus, _ as Button, a as TabsList, b as DiscordSelect, c as Input, d as Textarea, et as formatTime, f as Dialog, g as Card, h as DialogTitle, i as TabsContent, l as Label, m as DialogDesc, o as TabsTrigger, p as DialogContent, r as Tabs, s as Switch, u as NativeSelect, v as Badge, w as asString, y as DiscordMultiSelect } from "./router-DlyrBhH9.mjs";
import { r as MemberAvatar } from "./brand-E6aTdQpB.mjs";
import { r as DiscordPanel } from "./discord-panel-B_4DZK8m.mjs";
import { n as publishPanelAndWait, r as publishResultMessage, t as analyzeWithGrok } from "./publish-panel-D-0ICJIh.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/tickets-DP9jmp4S.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var slaTone = {
	ok: "ok",
	warning: "warn",
	breach: "danger"
};
function TicketsPage() {
	const gid = useWumpus((s) => s.activeGuildId);
	const guild = useActiveGuild();
	const user = useWumpus((s) => s.sessionUser);
	const [tickets, setTickets] = (0, import_react.useState)([]);
	const [ticketsLoaded, setTicketsLoaded] = (0, import_react.useState)(false);
	const [ticketLoadError, setTicketLoadError] = (0, import_react.useState)(null);
	const members = useGuildMembers();
	const tcfg = useModule("tickets");
	const staffConfig = useModule("staff");
	const updateConfig = useWumpus((s) => s.updateConfig);
	const setEnabled = useWumpus((s) => s.setModuleEnabled);
	const articles = useWumpus((s) => s.articles);
	const kcfg = useModule("knowledge");
	const aiAllowed = planAllows(guild.plan, "ai") && Boolean(tcfg.config.aiSupportEnabled);
	const departments = planAllows(guild.plan, "multiDepartment") ? asList(tcfg.config.departments) : asList(tcfg.config.departments).slice(0, 1);
	const [filter, setFilter] = (0, import_react.useState)("active");
	const [query, setQuery] = (0, import_react.useState)("");
	const [departmentFilter, setDepartmentFilter] = (0, import_react.useState)("all");
	const [priorityFilter, setPriorityFilter] = (0, import_react.useState)("all");
	const [selectedId, setSelectedId] = (0, import_react.useState)(tickets[0]?.id ?? null);
	const [showTicketOnMobile, setShowTicketOnMobile] = (0, import_react.useState)(false);
	const [reply, setReply] = (0, import_react.useState)("");
	const [transferStaffInput, setTransferStaffInput] = (0, import_react.useState)("");
	const [closeReason, setCloseReason] = (0, import_react.useState)("");
	const [activeView, setActiveView] = (0, import_react.useState)("queue");
	const [ai, setAi] = (0, import_react.useState)(null);
	const [aiBusy, setAiBusy] = (0, import_react.useState)(false);
	const [closeOpen, setCloseOpen] = (0, import_react.useState)(false);
	const [notice, setNotice] = (0, import_react.useState)(null);
	const [pubBusy, setPubBusy] = (0, import_react.useState)(false);
	const [actionBusy, setActionBusy] = (0, import_react.useState)(false);
	const firstTicketId = tickets[0]?.id ?? null;
	(0, import_react.useEffect)(() => {
		let stopped = false;
		const refresh = async () => {
			const token = getStoredSessionToken();
			if (!token || !gid) {
				if (!stopped) {
					setTickets([]);
					setTicketLoadError("Entre com Discord para consultar os tickets deste servidor.");
					setTicketsLoaded(true);
				}
				return;
			}
			try {
				const rows = await getGuildTickets({ data: {
					token,
					guildId: gid
				} });
				if (!stopped) {
					setTickets(rows);
					setTicketLoadError(null);
					setTicketsLoaded(true);
					const requestedTicket = new URLSearchParams(window.location.search).get("ticket");
					const requested = requestedTicket && rows.find((row) => row.id === requestedTicket || String(row.number) === requestedTicket);
					if (requested) {
						setSelectedId(requested.id);
						setShowTicketOnMobile(true);
					}
				}
			} catch (error) {
				if (!stopped) {
					setTicketLoadError(error instanceof Error ? error.message : "Não foi possível carregar os atendimentos reais.");
					setTicketsLoaded(true);
				}
			}
		};
		setTickets([]);
		setTicketsLoaded(false);
		refresh();
		const timer = window.setInterval(() => void refresh(), 1e4);
		return () => {
			stopped = true;
			window.clearInterval(timer);
		};
	}, [gid]);
	async function runTicketAction(action, input = {}) {
		if (!ticket) return false;
		const token = getStoredSessionToken();
		if (!token) {
			setNotice("Entre novamente com Discord para atender tickets.");
			return false;
		}
		setActionBusy(true);
		try {
			const { jobId } = await requestTicketAction({ data: {
				token,
				guildId: gid,
				ticketId: ticket.number,
				actorId: user.id,
				action,
				...input
			} });
			for (let attempt = 0; attempt < 24; attempt++) {
				await new Promise((resolve) => window.setTimeout(resolve, 1e3));
				const result = await getTicketActionStatus({ data: {
					token,
					guildId: gid,
					jobId
				} });
				if (result.status === "done" || result.status === "failed") {
					setNotice(result.detail ?? (result.status === "done" ? "Concluído." : "O bot não conseguiu executar a ação."));
					const rows = await getGuildTickets({ data: {
						token,
						guildId: gid
					} });
					setTickets(rows);
					return result.status === "done";
				}
			}
			setNotice("O bot ainda está processando. A fila será atualizada automaticamente.");
			return false;
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Não foi possível solicitar a ação ao bot.");
			return false;
		} finally {
			setActionBusy(false);
		}
	}
	(0, import_react.useEffect)(() => {
		const requestedTicket = new URLSearchParams(window.location.search).get("ticket");
		const requested = requestedTicket ? tickets.find((row) => row.id === requestedTicket || String(row.number) === requestedTicket) : void 0;
		if (requested) {
			const url = new URL(window.location.href);
			url.searchParams.delete("ticket");
			window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
		}
		setSelectedId(requested?.id ?? firstTicketId);
		setShowTicketOnMobile(Boolean(requested));
	}, [
		gid,
		tickets,
		firstTicketId
	]);
	const memberById = (0, import_react.useCallback)((id) => members.find((m) => m.id === id), [members]);
	const list = (0, import_react.useMemo)(() => {
		return tickets.filter((t) => filter === "active" ? t.status === "open" || t.status === "claimed" : t.status === filter).filter((t) => departmentFilter === "all" || t.department === departmentFilter).filter((t) => priorityFilter === "all" || t.priority === priorityFilter).filter((t) => {
			const opener = memberById(t.openerId)?.displayName ?? t.openerId;
			return `#${t.number} ${t.subject} ${t.department} ${opener} ${t.claimedBy ?? ""}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"));
		}).sort((a, b) => b.createdAt - a.createdAt);
	}, [
		tickets,
		filter,
		departmentFilter,
		priorityFilter,
		query,
		memberById
	]);
	const ticket = list.find((t) => t.id === selectedId) ?? list[0] ?? null;
	async function runAi(t) {
		const token = getStoredSessionToken();
		if (!token) {
			setAi("Entre novamente com Discord para usar a análise por IA.");
			return;
		}
		setAiBusy(true);
		setAi(null);
		const redact = (value) => value.replace(/<@!?\d{17,20}>|<@&\d{17,20}>|<#\d{17,20}>/g, "[referência Discord]").replace(/\b\d{17,20}\b/g, "[ID removido]").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[e-mail removido]").replace(/(?:\+?\d[\d ().-]{7,}\d)/g, "[telefone removido]").replace(/(?:discord\.gg|discord\.com\/invite)\/[\w-]+/gi, "[convite removido]");
		const includeConversation = Boolean(tcfg.config.aiIncludeConversation);
		const transcript = includeConversation ? t.messages.map((m) => `${m.kind}: ${redact(m.content)}`).join("\n") : "A conversa foi omitida conforme a configuração de privacidade do servidor.";
		const safeSubject = includeConversation ? redact(t.subject) : `Atendimento #${t.number}`;
		const knowledge = (kcfg.enabled ? searchArticles(includeConversation ? `${safeSubject}\n${transcript}` : "", articles.filter((a) => a.guildId === gid), Boolean(kcfg.config.requireApprovedArticles)).slice(0, 3) : []).map((a) => `${a.title}: ${a.body}`).join("\n");
		try {
			const res = await analyzeWithGrok({ data: {
				token,
				guildId: gid,
				kind: "ticket",
				title: `#${t.number} ${safeSubject} (${t.department})`,
				body: transcript,
				extra: `SLA ${String(tcfg.config.slaWarningMinutes)} min. Prioridade ${t.priority}.${knowledge ? `\nBase do servidor:\n${knowledge}` : ""}`
			} });
			setAi(res.ok ? res.text : res.error);
		} catch (error) {
			setAi(error instanceof Error ? error.message : "A análise não ficou disponível.");
		} finally {
			setAiBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-7xl flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mr-auto",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "m-0 text-2xl font-semibold tracking-tight",
						children: "Atendimento"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 mt-1 text-sm text-muted-foreground",
						children: "Configure o painel e acompanhe cada conversa com sua equipe."
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
				value: activeView,
				onValueChange: (value) => setActiveView(value),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, {
						"aria-label": "Área de atendimento",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
							value: "queue",
							children: "Fila de tickets"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
							value: "panel",
							children: "Painel e regras"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
						value: "queue",
						className: "mt-4 space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								role: "note",
								className: "m-0 rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground",
								children: "Esta fila lê os atendimentos persistidos pelo bot. As ações são encaminhadas ao Discord pelo bot."
							}),
							ticketLoadError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								role: "alert",
								className: "m-0 rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn",
								children: ticketLoadError
							}) : null,
							!tcfg.enabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "m-0 rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn",
								children: "Atendimento pausado neste servidor."
							}) : null,
							notice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "m-0 rounded-xl bg-muted px-3 py-2 text-sm",
								children: notice
							}) : null,
							!planAllows(guild.plan, "ai") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "m-0 text-sm text-muted-foreground",
								children: "Plano Essencial não inclui IA. O Pro libera a análise para a equipe."
							}) : null,
							!planAllows(guild.plan, "transcripts") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "m-0 text-sm text-muted-foreground",
								children: "Transcrição no encerramento entra no Pro."
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-1.5",
								children: ["active", "closed"].map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setFilter(f),
									className: cn("h-9 rounded-full px-3 text-sm", filter === f ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted"),
									children: f === "active" ? "Abertos" : "Encerrados"
								}, f))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-2 rounded-2xl border border-border bg-card p-3 sm:grid-cols-[minmax(220px,1fr)_180px_150px]",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
											"aria-hidden": "true",
											className: "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											"aria-label": "Buscar tickets",
											className: "pl-9",
											value: query,
											onChange: (event) => setQuery(event.target.value),
											placeholder: "Buscar por assunto, pessoa ou número"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
										"aria-label": "Filtrar por departamento",
										value: departmentFilter,
										onChange: (event) => setDepartmentFilter(event.target.value),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "all",
											children: "Todos os departamentos"
										}), [...new Set(tickets.map((item) => item.department).filter(Boolean))].map((department) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: department,
											children: department
										}, department))]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
										"aria-label": "Filtrar por prioridade",
										value: priorityFilter,
										onChange: (event) => setPriorityFilter(event.target.value),
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "all",
												children: "Todas as prioridades"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "urgent",
												children: "Urgente"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "high",
												children: "Alta"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "normal",
												children: "Normal"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "low",
												children: "Baixa"
											})
										]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									list.length,
									" ",
									list.length === 1 ? "atendimento" : "atendimentos",
									" nesta vista · fila mantida ao abrir um registro"
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex items-center gap-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "mr-1 inline-block size-2 rounded-full bg-ok" }), "No prazo"] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "mr-1 inline-block size-2 rounded-full bg-warn" }), "Atenção"] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "mr-1 inline-block size-2 rounded-full bg-destructive" }), "Atrasado"] })
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid min-w-0 gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
									className: cn("max-h-[70vh] overflow-y-auto p-2", showTicketOnMobile && "hidden lg:block"),
									children: list.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-3 p-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
											className: "m-0 text-base font-semibold",
											children: !ticketsLoaded ? "Carregando atendimentos…" : tickets.length === 0 ? "Sua fila começa aqui" : "Nenhum atendimento nesta vista"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-1 mb-0 text-sm text-muted-foreground",
											children: !ticketsLoaded ? "Buscando tickets reais no armazenamento do bot." : tickets.length === 0 ? "Configure o canal e os cargos de atendimento e publique o painel no Discord para receber os primeiros tickets." : "Troque o filtro para consultar os atendimentos de outro estado."
										})] }), tickets.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											size: "sm",
											onClick: () => setActiveView("panel"),
											children: "Configurar o painel de atendimento"
										}) : null]
									}) : list.map((t) => {
										const sla = ticketSla(t, tcfg.config);
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => {
												setSelectedId(t.id);
												setShowTicketOnMobile(true);
												setAi(null);
											},
											className: cn("flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left", ticket?.id === t.id ? "bg-muted" : "hover:bg-muted/50"),
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "flex items-center gap-2 text-sm font-medium",
													children: [
														"#",
														t.number,
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
															tone: slaTone[sla],
															children: t.priority
														}),
														shouldAutoClose(t, tcfg.config) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
															tone: "warn",
															children: "ocioso"
														}) : null
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "truncate text-[13px] text-muted-foreground",
													children: t.subject
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[11px] text-muted-foreground",
													children: [
														t.department,
														" · ",
														formatRelative(t.createdAt)
													]
												})
											]
										}, t.id);
									})
								}), ticket ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
									className: cn("min-h-[70vh] min-w-0 flex-col p-0", showTicketOnMobile ? "flex" : "hidden lg:flex"),
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
											className: "border-b border-border px-4 py-3",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex flex-wrap items-start gap-2",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
															className: "lg:hidden",
															size: "sm",
															variant: "ghost",
															onClick: () => setShowTicketOnMobile(false),
															children: "Voltar à fila"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "min-w-0 flex-1",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
																className: "m-0 text-xs text-muted-foreground",
																children: [
																	"#",
																	ticket.number,
																	" · ",
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
																		className: "underline underline-offset-2",
																		href: `https://discord.com/channels/${ticket.guildId}/${ticket.channelName}`,
																		target: "_blank",
																		rel: "noreferrer",
																		children: "Abrir canal"
																	})
																]
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
																className: "mt-0.5 mb-0 text-lg font-semibold",
																children: ticket.subject
															})]
														}),
														tcfg.config.priorityEnabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
															className: "h-9 w-auto",
															value: ticket.priority,
															disabled: actionBusy || ticket.status === "closed",
															onChange: (e) => void runTicketAction("priority", { priority: e.target.value }),
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "low",
																	children: "baixa"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "normal",
																	children: "normal"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "high",
																	children: "alta"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "urgent",
																	children: "urgente"
																})
															]
														}) : null
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: ticket.department }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["aberto ", formatTime(ticket.createdAt)] }),
														ticket.claimedBy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["com ", memberById(ticket.claimedBy)?.displayName ?? ticket.claimedBy] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "sem dono" })
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "mt-3 flex flex-wrap gap-2",
													children: ticket.status === "open" || ticket.status === "claimed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
															size: "sm",
															variant: "secondary",
															disabled: actionBusy,
															onClick: () => void runTicketAction("claim"),
															children: "Assumir"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
															size: "sm",
															variant: "outline",
															disabled: actionBusy || ticket.priority === "urgent",
															onClick: () => void runTicketAction("escalate"),
															children: "Escalar"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
															size: "sm",
															variant: "outline",
															disabled: actionBusy,
															onClick: () => setCloseOpen(true),
															children: "Encerrar"
														}),
														aiAllowed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
															size: "sm",
															variant: "ghost",
															disabled: aiBusy,
															onClick: () => void runAi(ticket),
															children: aiBusy ? "Analisando…" : "Analisar com IA"
														}) : null
													] }) : null
												}),
												ticket.status !== "closed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
													className: "mt-3 flex flex-wrap gap-2",
													onSubmit: (event) => {
														event.preventDefault();
														const match = transferStaffInput.trim().match(/^(?:<@!?(\d{17,20})>|(\d{17,20}))$/);
														const targetStaffId = match?.[1] ?? match?.[2];
														if (targetStaffId) runTicketAction("transfer", { targetStaffId }).then((ok) => {
															if (ok) setTransferStaffInput("");
														});
													},
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
														className: "min-w-48 flex-1",
														value: transferStaffInput,
														onChange: (event) => setTransferStaffInput(event.target.value),
														placeholder: "ID ou menção do novo atendente",
														"aria-label": "Atendente para transferência"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
														size: "sm",
														variant: "outline",
														type: "submit",
														disabled: actionBusy || !/^(?:<@!?\d{17,20}>|\d{17,20})$/.test(transferStaffInput.trim()),
														children: "Transferir"
													})]
												}) : null
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex-1 space-y-3 overflow-y-auto px-4 py-4",
											children: [
												ticket.messages.map((m) => {
													const who = m.kind === "system" ? null : memberById(m.authorId);
													return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex gap-2",
														children: [who ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemberAvatar, {
															name: who.displayName,
															hue: who.hue,
															size: 28
														}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-7" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "min-w-0",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
																className: "m-0 text-[11px] text-muted-foreground",
																children: [
																	who?.displayName ?? m.authorName ?? "Sistema",
																	" · ",
																	formatRelative(m.at)
																]
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
																className: "m-0 text-sm leading-relaxed",
																children: m.content
															})]
														})]
													}, m.id);
												}),
												ai ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "rounded-xl bg-primary/10 px-3 py-2 text-sm whitespace-pre-wrap",
													children: ai
												}) : null,
												ticket.transcript && ticket.status !== "open" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
													className: "rounded-xl bg-muted px-3 py-2 text-sm",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
														className: "cursor-pointer font-medium",
														children: "Transcrição"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
														className: "mt-2 mb-0 overflow-x-auto whitespace-pre-wrap font-sans text-muted-foreground",
														children: ticket.transcript
													})]
												}) : null,
												ticket.feedback ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "m-0 text-sm",
													children: [
														"Feedback: ",
														ticket.feedback.rating,
														"/5 — ",
														ticket.feedback.comment
													]
												}) : null
											]
										}),
										ticket.status === "open" || ticket.status === "claimed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
											className: "flex gap-2 border-t border-border p-3",
											onSubmit: (e) => {
												e.preventDefault();
												if (!reply.trim()) return;
												runTicketAction("reply", { content: reply.trim() }).then((ok) => {
													if (ok) setReply("");
												});
											},
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												value: reply,
												onChange: (e) => setReply(e.target.value),
												placeholder: "Responder como staff…"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												type: "submit",
												disabled: actionBusy,
												children: "Enviar"
											})]
										}) : null
									]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
									className: cn("min-h-64 place-items-center text-sm text-muted-foreground", showTicketOnMobile ? "grid" : "hidden lg:grid"),
									children: tickets.length ? "Selecione um atendimento da fila." : "Configure e publique o painel para começar a receber atendimentos."
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
						value: "panel",
						className: "mt-4 space-y-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "m-0 text-xl font-semibold tracking-tight",
							children: "Prepare o primeiro painel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "m-0 mt-1 max-w-2xl text-sm text-muted-foreground",
							children: "Escolha onde ele aparece e quem atende. O restante pode ficar como está até você precisar."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,.82fr)]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 space-y-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-4 rounded-2xl border border-border bg-card p-4",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-start gap-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold",
													children: "1"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "m-0 text-base font-semibold",
													children: "Onde a pessoa encontra ajuda?"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "m-0 mt-1 text-sm text-muted-foreground",
													children: "Escolha o canal público e a categoria para os canais privados."
												})] })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												label: "Canal do painel de atendimento",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
													kind: "text",
													value: asString(tcfg.config.panelChannelId),
													onChange: (panelChannelId) => updateConfig("tickets", { panelChannelId }),
													placeholder: "Selecione um canal"
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												label: "Categoria onde os canais privados serão criados",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
													kind: "category",
													value: asString(tcfg.config.categoryId),
													onChange: (categoryId) => updateConfig("tickets", { categoryId }),
													placeholder: "Selecione uma categoria"
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Atendimento ligado" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "m-0 text-xs text-muted-foreground",
													children: "Desligue para pausar a abertura de novos tickets."
												})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
													checked: tcfg.enabled,
													onCheckedChange: (v) => setEnabled("tickets", v)
												})]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-4 rounded-2xl border border-border bg-card p-4",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-start gap-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold",
													children: "2"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "m-0 text-base font-semibold",
													children: "Dê contexto ao painel"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "m-0 mt-1 text-sm text-muted-foreground",
													children: "A pessoa verá esta mensagem antes de escolher o tipo de atendimento."
												})] })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												label: "Título do painel",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
													maxLength: 100,
													value: asString(tcfg.config.panelTitle),
													onChange: (e) => updateConfig("tickets", { panelTitle: e.target.value })
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
												label: "Descrição do painel",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
													maxLength: 4e3,
													value: asString(tcfg.config.panelDescription),
													onChange: (e) => updateConfig("tickets", { panelDescription: e.target.value })
												})
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-4 rounded-2xl border border-border bg-card p-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-start gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold",
												children: "3"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "m-0 text-base font-semibold",
												children: "Escolha quem responde"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "m-0 mt-1 text-sm text-muted-foreground",
												children: "Cargos selecionados poderão acessar os canais privados."
											})] })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
											label: "Cargos da equipe",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordMultiSelect, {
												value: asList(tcfg.config.staffRoleIds),
												onChange: (staffRoleIds) => updateConfig("tickets", { staffRoleIds })
											})
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
										className: "rounded-2xl border border-border bg-card p-4",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
												className: "cursor-pointer font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
												children: "Mais configurações de atendimento"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "mb-4 mt-2 text-sm text-muted-foreground",
												children: "Prazos, automações, registros e aparência. Você pode voltar a elas quando quiser."
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "space-y-4",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "grid gap-3 sm:grid-cols-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
															className: "m-0 self-center text-xs text-muted-foreground",
															children: "O painel usa os componentes modernos do Discord."
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
															label: "Cor de destaque",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
																type: "color",
																className: "h-11 p-1",
																value: asString(tcfg.config.panelAccentColor, "#28655b"),
																onChange: (e) => updateConfig("tickets", { panelAccentColor: e.target.value })
															})
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "grid gap-3 sm:grid-cols-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
															label: "Máximo de tickets abertos por pessoa",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
																type: "number",
																min: 1,
																max: 25,
																defaultValue: Number(tcfg.config.maxOpenPerUser ?? 1),
																onBlur: (e) => updateConfig("tickets", { maxOpenPerUser: Math.max(1, Math.min(25, Number(e.target.value) || 1)) })
															})
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
															label: "Nome do canal · use {user} e {number}",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
																defaultValue: asString(tcfg.config.namingPattern, "atendimento-{user}"),
																onBlur: (e) => updateConfig("tickets", { namingPattern: e.target.value.trim() || "atendimento-{user}" })
															})
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
														label: "Avisar a equipe depois de (minutos; 0 desliga)",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
															type: "number",
															min: 0,
															max: 10080,
															defaultValue: Number(tcfg.config.slaWarningMinutes ?? 60),
															onBlur: (e) => updateConfig("tickets", { slaWarningMinutes: Math.max(0, Number(e.target.value) || 0) })
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center justify-between gap-3",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Pedir avaliação ao encerrar" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
															className: "m-0 text-xs text-muted-foreground",
															children: "Receba uma nota e um comentário do cliente."
														})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
															checked: Boolean(tcfg.config.feedbackEnabled),
															onCheckedChange: (v) => updateConfig("tickets", { feedbackEnabled: v })
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "space-y-4",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Field, {
																label: "Categorias de atendimento (uma por linha)",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
																	rows: 3,
																	defaultValue: departments.join("\n"),
																	onBlur: (e) => updateConfig("tickets", { departments: e.target.value.split("\n").map((value) => value.trim()).filter(Boolean) })
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
																	className: "m-0 text-xs text-muted-foreground",
																	children: "A pessoa escolhe uma categoria ao abrir um ticket. Você pode organizar suporte, denúncias e parcerias em opções claras."
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "grid gap-3 sm:grid-cols-2",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
																	label: "Canal de transcrições",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
																		kind: "text",
																		value: asString(tcfg.config.transcriptChannelId),
																		onChange: (transcriptChannelId) => updateConfig("tickets", { transcriptChannelId }),
																		placeholder: "Selecione um canal"
																	})
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
																	label: "Canal de auditoria",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
																		kind: "text",
																		value: asString(tcfg.config.logChannelId),
																		onChange: (logChannelId) => updateConfig("tickets", { logChannelId }),
																		placeholder: "Selecione um canal"
																	})
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Field, {
																label: "Apagar mensagens após (dias; 0 mantém sem prazo)",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
																	type: "number",
																	min: 0,
																	max: 3650,
																	defaultValue: Number(tcfg.config.ticketMessageRetentionDays ?? 0),
																	onBlur: (e) => updateConfig("tickets", { ticketMessageRetentionDays: Math.max(0, Math.min(3650, Number(e.target.value) || 0)) })
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
																	className: "m-0 text-xs text-muted-foreground",
																	children: "Remove mensagens e transcripts rastreados de tickets encerrados. O resumo permanece para estatísticas; arquivos antigos sem referência não podem ser apagados automaticamente."
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "grid gap-3 sm:grid-cols-2",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																		className: "flex items-center justify-between gap-3 rounded-xl border border-border p-3",
																		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Notificar a equipe" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
																			className: "m-0 text-xs text-muted-foreground",
																			children: "Menciona os cargos ao abrir."
																		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
																			checked: Boolean(tcfg.config.pingStaffOnOpen),
																			onCheckedChange: (value) => updateConfig("tickets", { pingStaffOnOpen: value })
																		})]
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																		className: "flex items-center justify-between gap-3 rounded-xl border border-border p-3",
																		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Permitir reabertura" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
																			className: "m-0 text-xs text-muted-foreground",
																			children: "A pessoa pode voltar ao canal."
																		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
																			checked: Boolean(tcfg.config.reopenEnabled),
																			onCheckedChange: (value) => updateConfig("tickets", { reopenEnabled: value })
																		})]
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																		className: "flex items-center justify-between gap-3 rounded-xl border border-border p-3",
																		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Prioridade" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
																			className: "m-0 text-xs text-muted-foreground",
																			children: "A equipe classifica urgência."
																		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
																			checked: Boolean(tcfg.config.priorityEnabled),
																			onCheckedChange: (value) => updateConfig("tickets", { priorityEnabled: value })
																		})]
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
																		label: "Prazo para fechar automaticamente (horas; 0 desliga)",
																		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
																			type: "number",
																			min: 0,
																			max: 8760,
																			defaultValue: Number(tcfg.config.closeAfterHours ?? 48),
																			onBlur: (e) => updateConfig("tickets", { closeAfterHours: Math.max(0, Number(e.target.value) || 0) })
																		})
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
																		label: "Prazo de inatividade (horas; 0 desliga)",
																		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
																			type: "number",
																			min: 0,
																			max: 8760,
																			defaultValue: Number(tcfg.config.autoCloseInactiveHours ?? 24),
																			onBlur: (e) => updateConfig("tickets", { autoCloseInactiveHours: Math.max(0, Number(e.target.value) || 0) })
																		})
																	})
																]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "grid gap-3 sm:grid-cols-2",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
																	label: "Meta para primeira resposta (minutos)",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
																		type: "number",
																		min: 5,
																		max: 10080,
																		defaultValue: Number(staffConfig.config.responseTimeGoalMinutes ?? 30),
																		onBlur: (e) => updateConfig("staff", { responseTimeGoalMinutes: Math.max(5, Math.min(10080, Number(e.target.value) || 30)) })
																	})
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
																	label: "Tickets simultâneos por atendente",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
																		type: "number",
																		min: 1,
																		max: 100,
																		defaultValue: Number(staffConfig.config.maxConcurrentTickets ?? 5),
																		onBlur: (e) => updateConfig("staff", { maxConcurrentTickets: Math.max(1, Math.min(100, Number(e.target.value) || 5)) })
																	})
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Field, {
																label: "Mensagem de boas-vindas no canal privado",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
																	rows: 3,
																	defaultValue: asString(tcfg.config.welcomeMessage),
																	onBlur: (e) => updateConfig("tickets", { welcomeMessage: e.target.value })
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
																	className: "m-0 text-xs text-muted-foreground",
																	children: "Enviada automaticamente quando o atendimento é aberto."
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
																label: "IA de apoio à equipe",
																description: "Gera sugestões privadas para os atendentes.",
																checked: Boolean(tcfg.config.aiSupportEnabled),
																onChange: (value) => updateConfig("tickets", { aiSupportEnabled: value })
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
																label: "Incluir conversa nas análises por IA",
																description: "Quando desligado, o conteúdo das mensagens não é enviado à IA.",
																checked: Boolean(tcfg.config.aiIncludeConversation),
																onChange: (value) => updateConfig("tickets", { aiIncludeConversation: value })
															})
														]
													})
												]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-2 rounded-2xl border border-border p-4",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "m-0 text-base font-semibold",
												children: "Publicar no Discord"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "m-0 text-sm text-muted-foreground",
												children: "A publicação só aparece como concluída depois que o bot confirmar no Discord."
											}),
											!asString(tcfg.config.panelChannelId).trim() ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "m-0 text-sm text-warn",
												children: "Escolha o canal do painel acima para continuar."
											}) : null,
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												disabled: pubBusy || !asString(tcfg.config.panelChannelId).trim(),
												onClick: async () => {
													setPubBusy(true);
													setNotice(null);
													try {
														const result = await publishPanelAndWait({
															guildId: gid,
															target: "tickets",
															channelRef: asString(tcfg.config.panelChannelId).trim()
														});
														setNotice(publishResultMessage(result));
													} catch (cause) {
														setNotice(cause instanceof Error ? cause.message : "Não foi possível pedir a publicação ao bot.");
													} finally {
														setPubBusy(false);
													}
												},
												children: pubBusy ? "Aguardando confirmação do bot…" : "Publicar painel no Discord"
											}),
											notice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												role: "status",
												className: "m-0 rounded-lg bg-muted px-3 py-2 text-sm",
												children: notice
											}) : null
										]
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
								className: "min-w-0 space-y-2 xl:sticky xl:top-24 xl:self-start",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 text-sm font-semibold",
									children: "Prévia do painel"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 mt-1 text-xs text-muted-foreground",
									children: "Amostra das configurações atuais. A confirmação real depende do bot."
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordPanel, {
									channel: asString(tcfg.config.panelChannelId, "abrir-ticket").replace(/^#/, "") || "abrir-ticket",
									title: asString(tcfg.config.panelTitle, "Precisa de ajuda?"),
									description: asString(tcfg.config.panelDescription, "Escolha uma opção para falar com nossa equipe."),
									accent: asString(tcfg.config.panelAccentColor, "#28655b"),
									buttons: departments
								})]
							})]
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: closeOpen,
				onOpenChange: setCloseOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Encerrar atendimento" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDesc, { children: "Informe um motivo para manter o histórico consistente. O bot encerrará o canal e enviará a pesquisa configurada." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Motivo do encerramento",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							rows: 3,
							maxLength: 500,
							value: closeReason,
							onChange: (event) => setCloseReason(event.target.value),
							placeholder: "Ex.: dúvida resolvida, solicitação concluída…"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "mt-4 w-full",
						disabled: actionBusy || !closeReason.trim(),
						onClick: () => void runTicketAction("close", { reason: closeReason.trim() }).then((ok) => {
							if (ok) {
								setCloseOpen(false);
								setCloseReason("");
							}
						}),
						children: "Encerrar e gerar transcrição"
					})
				] })
			})
		]
	}, gid);
}
function Field({ label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }), children]
	});
}
function ToggleRow({ label, description, checked, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between gap-3 rounded-xl border border-border p-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "m-0 mt-0.5 text-xs text-muted-foreground",
				children: description
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
			checked,
			onCheckedChange: onChange
		})]
	});
}
//#endregion
export { TicketsPage as component };
