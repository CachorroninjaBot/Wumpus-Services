import { i as __toESM } from "../_runtime.mjs";
import { n as formatRelative, r as formatTime, t as cn } from "./utils-H16dNBFI.mjs";
import { o as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { r as MemberAvatar } from "./brand-9-bk6ia6.mjs";
import { t as Badge } from "./badge-C2mxnvvX.mjs";
import { t as Button } from "./button-BUiFN9VL.mjs";
import { t as Card } from "./card-DaYenTQt.mjs";
import { i as Textarea, n as Label, r as NativeSelect, t as Input } from "./input-Cyzc7r1j.mjs";
import { c as searchArticles, d as useActiveGuild, f as useGuildMembers, i as getPublishStatus, l as shouldAutoClose, m as useWumpus, n as asString, o as planAllows, p as useModule, t as asList, u as ticketSla } from "./store-B26y7m0l.mjs";
import { n as DiscordPanel } from "./discord-panel-BH_80gju.mjs";
import { a as analyzeWithGrok, i as DialogTitle, n as DialogContent, r as DialogDesc, t as Dialog } from "./analyze-B-MSwHFT.mjs";
import { t as Switch } from "./switch-C8XyncjG.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/tickets-vZaCg_jL.js
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
	const tickets = useWumpus((s) => s.tickets).filter((t) => t.guildId === gid);
	const members = useGuildMembers();
	const tcfg = useModule("tickets");
	const updateConfig = useWumpus((s) => s.updateConfig);
	const setEnabled = useWumpus((s) => s.setModuleEnabled);
	const claim = useWumpus((s) => s.claimTicket);
	const close = useWumpus((s) => s.closeTicket);
	const archive = useWumpus((s) => s.archiveTicket);
	const reopen = useWumpus((s) => s.reopenTicket);
	const addMsg = useWumpus((s) => s.addTicketMessage);
	const setPri = useWumpus((s) => s.setTicketPriority);
	const setTags = useWumpus((s) => s.setTicketTags);
	const openTicket = useWumpus((s) => s.openTicket);
	const sweep = useWumpus((s) => s.sweepInactive);
	const publishPanel = useWumpus((s) => s.publishPanel);
	const articles = useWumpus((s) => s.articles);
	const kcfg = useModule("knowledge");
	const aiAllowed = planAllows(guild.plan, "ai") && Boolean(tcfg.config.aiSupportEnabled);
	const departments = planAllows(guild.plan, "multiDepartment") ? asList(tcfg.config.departments) : asList(tcfg.config.departments).slice(0, 1);
	const [filter, setFilter] = (0, import_react.useState)("active");
	const [selectedId, setSelectedId] = (0, import_react.useState)(tickets[0]?.id ?? null);
	const [reply, setReply] = (0, import_react.useState)("");
	const [settings, setSettings] = (0, import_react.useState)(false);
	const [compose, setCompose] = (0, import_react.useState)(false);
	const [ai, setAi] = (0, import_react.useState)(null);
	const [aiBusy, setAiBusy] = (0, import_react.useState)(false);
	const [closeOpen, setCloseOpen] = (0, import_react.useState)(false);
	const [rating, setRating] = (0, import_react.useState)(5);
	const [comment, setComment] = (0, import_react.useState)("");
	const [notice, setNotice] = (0, import_react.useState)(null);
	const [pubBusy, setPubBusy] = (0, import_react.useState)(false);
	const list = (0, import_react.useMemo)(() => {
		return tickets.filter((t) => filter === "active" ? t.status === "open" || t.status === "claimed" : t.status === filter).sort((a, b) => b.createdAt - a.createdAt);
	}, [tickets, filter]);
	const ticket = tickets.find((t) => t.id === selectedId) ?? list[0] ?? null;
	const memberById = (id) => members.find((m) => m.id === id);
	async function runAi(t) {
		setAiBusy(true);
		setAi(null);
		const transcript = t.messages.map((m) => `${m.kind}: ${m.content}`).join("\n");
		const knowledge = (kcfg.enabled ? searchArticles(`${t.subject}\n${transcript}`, articles.filter((a) => a.guildId === gid), Boolean(kcfg.config.requireApprovedArticles)).slice(0, 3) : []).map((a) => `${a.title}: ${a.body}`).join("\n");
		const res = await analyzeWithGrok({ data: {
			kind: "ticket",
			title: `#${t.number} ${t.subject} (${t.department})`,
			body: transcript,
			extra: `SLA ${String(tcfg.config.slaWarningMinutes)} min. Prioridade ${t.priority}.${knowledge ? `\nBase do servidor:\n${knowledge}` : ""}`
		} });
		setAiBusy(false);
		setAi(res.ok ? res.text : res.error);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-6xl flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mr-auto m-0 text-xl font-semibold tracking-tight",
						children: "Atendimento"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						size: "sm",
						onClick: () => setSettings(true),
						children: "Painel e SLA"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						onClick: () => {
							const r = sweep();
							setNotice(r.closed > 0 ? `${r.closed} atendimento(s) encerrado(s) por inatividade.` : r.error ?? "Nada ocioso.");
						},
						children: "Fechar ociosos"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						onClick: () => setCompose(true),
						children: "Abrir ticket"
					})
				]
			}),
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
				children: [
					"active",
					"closed",
					"archived"
				].map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setFilter(f),
					className: cn("h-9 rounded-full px-3 text-sm", filter === f ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted"),
					children: f === "active" ? "Abertos" : f === "closed" ? "Encerrados" : "Arquivo"
				}, f))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "max-h-[70vh] overflow-y-auto p-2",
					children: list.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "p-4 text-sm text-muted-foreground",
						children: "Nenhum atendimento nesta vista."
					}) : list.map((t) => {
						const sla = ticketSla(t, tcfg.config);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => {
								setSelectedId(t.id);
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
					className: "flex min-h-[70vh] flex-col p-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "border-b border-border px-4 py-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-start gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0 flex-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "m-0 text-xs text-muted-foreground",
											children: [
												"#",
												ticket.number,
												" · #",
												ticket.channelName
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
											className: "mt-0.5 mb-0 text-lg font-semibold",
											children: ticket.subject
										})]
									}), tcfg.config.priorityEnabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
										className: "h-9 w-auto",
										value: ticket.priority,
										onChange: (e) => setPri(ticket.id, e.target.value),
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
									}) : null]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: ticket.department }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["aberto ", formatTime(ticket.createdAt)] }),
										ticket.claimedBy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["com ", memberById(ticket.claimedBy)?.displayName] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "sem dono" })
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-3 flex flex-wrap gap-2",
									children: [ticket.status === "open" || ticket.status === "claimed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											size: "sm",
											variant: "secondary",
											onClick: () => {
												const r = claim(ticket.id, user.id);
												setNotice(r.ok ? "Atendimento assumido." : r.error);
											},
											children: "Assumir"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											size: "sm",
											variant: "outline",
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
									] }) : null, ticket.status === "closed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "secondary",
										onClick: () => archive(ticket.id),
										children: "Arquivar"
									}), Boolean(tcfg.config.reopenEnabled) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "outline",
										onClick: () => reopen(ticket.id),
										children: "Reabrir"
									}) : null] }) : null]
								})
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
													who?.displayName ?? "Sistema",
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
								addMsg(ticket.id, user.id, reply.trim(), "staff");
								setReply("");
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: reply,
								onChange: (e) => setReply(e.target.value),
								placeholder: "Responder como staff…"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								children: "Enviar"
							})]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border-t border-border px-4 py-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Tags" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								className: "mt-1 h-9",
								defaultValue: ticket.tags.join(", "),
								onBlur: (e) => setTags(ticket.id, e.target.value.split(",").map((x) => x.trim()).filter(Boolean))
							}, ticket.id)]
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "grid min-h-64 place-items-center text-sm text-muted-foreground",
					children: "Selecione um atendimento."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: settings,
				onOpenChange: setSettings,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
					className: "max-h-[85vh] overflow-y-auto",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Painel e fluxo" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDesc, { children: "O que você muda aqui o bot usa na hora de abrir e fechar ticket." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 space-y-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Atendimento ligado" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
										checked: tcfg.enabled,
										onCheckedChange: (v) => setEnabled("tickets", v)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Título do painel",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										defaultValue: asString(tcfg.config.panelTitle),
										onBlur: (e) => updateConfig("tickets", { panelTitle: e.target.value })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Descrição",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
										defaultValue: asString(tcfg.config.panelDescription),
										onBlur: (e) => updateConfig("tickets", { panelDescription: e.target.value })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Mensagem de boas-vindas",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
										defaultValue: asString(tcfg.config.welcomeMessage),
										onBlur: (e) => updateConfig("tickets", { welcomeMessage: e.target.value })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Departamentos (vírgula)",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										defaultValue: departments.join(", "),
										onBlur: (e) => updateConfig("tickets", { departments: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Alerta de SLA (minutos)",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										type: "number",
										defaultValue: Number(tcfg.config.slaWarningMinutes ?? 60),
										onBlur: (e) => updateConfig("tickets", { slaWarningMinutes: Number(e.target.value) || 0 })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Pedir feedback ao encerrar" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
										checked: Boolean(tcfg.config.feedbackEnabled),
										onCheckedChange: (v) => updateConfig("tickets", { feedbackEnabled: v })
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "IA de apoio à equipe" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
										checked: Boolean(tcfg.config.aiSupportEnabled),
										onCheckedChange: (v) => updateConfig("tickets", { aiSupportEnabled: v })
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Inatividade até encerrar (horas, 0 desliga)",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										type: "number",
										defaultValue: Number(tcfg.config.autoCloseInactiveHours ?? 24),
										onBlur: (e) => updateConfig("tickets", { autoCloseInactiveHours: Number(e.target.value) || 0 })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									disabled: pubBusy,
									onClick: async () => {
										setPubBusy(true);
										publishPanel("tickets");
										let last = null;
										for (let attempt = 0; attempt < 10; attempt++) {
											await new Promise((resolve) => setTimeout(resolve, 2e3));
											const rows = await getPublishStatus({ data: { guildId: gid } }).catch(() => []);
											last = rows[rows.length - 1] ?? null;
											if (last && last.status !== "queued") break;
										}
										setPubBusy(false);
										setNotice(!last ? "Pedido enviado. O bot publica em instantes." : last.status === "done" ? `Publicado no canal "${last.channelRef}".` : `Não deu: ${last.detail ?? "motivo desconhecido"}`);
									},
									children: pubBusy ? "Publicando…" : "Publicar painel no Discord"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordPanel, {
									title: asString(tcfg.config.panelTitle),
									description: asString(tcfg.config.panelDescription),
									accent: asString(tcfg.config.panelAccentColor, "#7c5cff"),
									buttons: departments
								})
							]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: compose,
				onOpenChange: setCompose,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Simular abertura" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDesc, { children: "Como se o membro tivesse apertado o botão no Discord." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComposeForm, {
						departments,
						members,
						onCreate: (data) => {
							const res = openTicket(data);
							if (res.ok) {
								setSelectedId(res.id);
								setCompose(false);
							} else alert(res.error);
						}
					})
				] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: closeOpen,
				onOpenChange: setCloseOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Encerrar atendimento" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDesc, { children: "A transcrição vai para o canal configurado. Opcional: registrar a nota do cliente." }),
					tcfg.config.feedbackEnabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 space-y-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Nota" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NativeSelect, {
								value: rating,
								onChange: (e) => setRating(Number(e.target.value)),
								children: [
									5,
									4,
									3,
									2,
									1
								].map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
									value: n,
									children: [n, " / 5"]
								}, n))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
								value: comment,
								onChange: (e) => setComment(e.target.value),
								placeholder: "Comentário"
							})
						]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "mt-4 w-full",
						onClick: () => {
							if (!ticket) return;
							close(ticket.id, user.id, tcfg.config.feedbackEnabled ? {
								rating,
								comment
							} : void 0);
							setCloseOpen(false);
						},
						children: "Encerrar e gerar transcrição"
					})
				] })
			})
		]
	});
}
function Field({ label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }), children]
	});
}
function ComposeForm({ departments, members, onCreate }) {
	const [openerId, setOpenerId] = (0, import_react.useState)(members.find((m) => !m.roleIds.includes("role_staff"))?.id ?? members[0]?.id);
	const [department, setDepartment] = (0, import_react.useState)(departments[0] ?? "Suporte");
	const [subject, setSubject] = (0, import_react.useState)("");
	const [body, setBody] = (0, import_react.useState)("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "mt-4 space-y-3",
		onSubmit: (e) => {
			e.preventDefault();
			if (!openerId || !subject.trim() || !body.trim()) return;
			onCreate({
				openerId,
				department,
				subject: subject.trim(),
				body: body.trim()
			});
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: "Membro",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NativeSelect, {
					value: openerId,
					onChange: (e) => setOpenerId(e.target.value),
					children: members.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: m.id,
						children: m.displayName
					}, m.id))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: "Departamento",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NativeSelect, {
					value: department,
					onChange: (e) => setDepartment(e.target.value),
					children: departments.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: d,
						children: d
					}, d))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: "Assunto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: subject,
					onChange: (e) => setSubject(e.target.value),
					required: true
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: "Primeira mensagem",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
					value: body,
					onChange: (e) => setBody(e.target.value),
					required: true
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "submit",
				className: "w-full",
				children: "Abrir"
			})
		]
	});
}
//#endregion
export { TicketsPage as component };
