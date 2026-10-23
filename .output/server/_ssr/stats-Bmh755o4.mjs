import { i as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { o as getStoredSessionToken } from "./session-token-CaBlZnli.mjs";
import { B as ClipboardList, E as MessageSquareText, Q as ArrowUpRight, c as Tickets, i as UsersRound, nt as Activity, tt as ArrowDownRight, u as TicketCheck, x as RefreshCw, z as Clock3 } from "../_libs/lucide-react.mjs";
import { $ as formatRelative, N as getGuildTickets, O as getGuildActivity, X as useModule, Z as useWumpus, _ as Button, et as formatTime, g as Card, u as NativeSelect, v as Badge } from "./router-DjtjaZqs.mjs";
import { a as CartesianGrid, i as Area, n as YAxis, o as ResponsiveContainer, r as XAxis, s as Tooltip, t as AreaChart } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/stats-Bmh755o4.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function StatsPage() {
	const gid = useWumpus((state) => state.activeGuildId);
	const guild = useWumpus((state) => state.guilds.find((item) => item.id === state.activeGuildId));
	const tcfg = useModule("tickets");
	const [period, setPeriod] = (0, import_react.useState)(7);
	const [tickets, setTickets] = (0, import_react.useState)([]);
	const [activity, setActivity] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [refreshing, setRefreshing] = (0, import_react.useState)(false);
	const [selectedDay, setSelectedDay] = (0, import_react.useState)(null);
	const [refreshKey, setRefreshKey] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		let active = true;
		let inFlight = false;
		const refresh = async (showLoading = false) => {
			const token = getStoredSessionToken();
			if (!token || !gid) {
				if (active) {
					setError("Entre com Discord e selecione um servidor para consultar as estatísticas.");
					setLoading(false);
				}
				return;
			}
			if (inFlight) return;
			inFlight = true;
			if (active) {
				setRefreshing(true);
				if (showLoading) {
					setLoading(true);
					setActivity(null);
					setTickets([]);
					setError(null);
				}
			}
			try {
				const [summary, rows] = await Promise.all([getGuildActivity({ data: {
					token,
					guildId: gid,
					periodDays: period,
					slaGoalMinutes: Number(tcfg.config.slaWarningMinutes ?? 60)
				} }), getGuildTickets({ data: {
					token,
					guildId: gid
				} })]);
				if (active) {
					setActivity(summary);
					setTickets(rows);
					setError(null);
				}
			} catch (cause) {
				if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar as estatísticas reais.");
			} finally {
				inFlight = false;
				if (active) {
					setRefreshing(false);
					setLoading(false);
				}
			}
		};
		setSelectedDay(null);
		refresh(true);
		const timer = window.setInterval(() => void refresh(), 3e4);
		return () => {
			active = false;
			window.clearInterval(timer);
		};
	}, [
		gid,
		period,
		refreshKey,
		tcfg.config.slaWarningMinutes
	]);
	const range = activity?.range;
	const previous = activity?.previousRange;
	const chartData = activity?.days ?? [];
	const ticketsBySelectedDay = (0, import_react.useMemo)(() => selectedDay ? tickets.filter((ticket) => Number.isFinite(ticket.createdAt) && new Date(ticket.createdAt).toISOString().slice(0, 10) === selectedDay).sort((a, b) => b.createdAt - a.createdAt) : [], [selectedDay, tickets]);
	const selectedDayRow = chartData.find((day) => day.day === selectedDay);
	const dataInRange = Boolean(range && (range.opened || range.closed || chartData.some((day) => day.messages || day.joins || day.automod || day.moderation)));
	const relativeText = (current, prior) => {
		if (prior === 0) return current === 0 ? "igual ao período anterior" : "novo neste período";
		const difference = current - prior;
		const percent = Math.round(difference / prior * 100);
		return `${difference > 0 ? "+" : ""}${difference} (${percent > 0 ? "+" : ""}${percent}%) vs. período anterior`;
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-7xl flex-col gap-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap items-end justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mb-1 mt-0 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "size-4" }), "Analisar"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "m-0 text-2xl font-semibold tracking-tight",
						children: "Estatísticas"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-0 mt-1 text-sm text-muted-foreground",
						children: "Entenda o ritmo do atendimento e encontre o que precisa de atenção."
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
						"aria-label": "Período das estatísticas",
						value: period,
						onChange: (event) => setPeriod(Number(event.target.value)),
						className: "h-10 w-auto min-w-36",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: 7,
								children: "Últimos 7 dias"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: 30,
								children: "Últimos 30 dias"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: 90,
								children: "Últimos 90 dias"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						variant: "outline",
						disabled: refreshing,
						onClick: () => setRefreshKey((key) => key + 1),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `size-4 ${refreshing ? "animate-spin" : ""}` }), "Atualizar"]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					"De ",
					formatDate(range?.start),
					" a ",
					formatDate(range?.end),
					" · comparação com os ",
					period,
					" dias anteriores"
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "flex flex-wrap items-center gap-2",
					role: "status",
					children: activity ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						tone: activity.bot.status === "online" ? "ok" : activity.bot.status === "offline" ? "warn" : "default",
						children: activity.bot.status === "online" ? "Bot conectado" : activity.bot.status === "offline" ? "Bot sem sinal" : "Bot não localizado"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						activity.bot.lastSeenAt ? `Último sinal ${formatRelative(activity.bot.lastSeenAt)}` : "Sem sinal recente",
						" · dados consultados ",
						formatTime(activity.refreshedAt)
					] })] }) : loading ? "Buscando dados do bot…" : "Aguardando dados"
				})]
			}),
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				role: "alert",
				className: "m-0 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive",
				children: [error, activity ? " Os números exibidos são da última sincronização bem-sucedida." : ""]
			}) : null,
			activity?.bot.status !== "online" && activity ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				role: "note",
				className: "m-0 rounded-xl bg-warn/10 px-3 py-2 text-sm text-muted-foreground",
				children: "O bot não está enviando atualizações agora. Os dados disponíveis podem estar desatualizados."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				"aria-label": "Indicadores do período",
				className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tickets, { className: "size-4" }),
						label: "Tickets criados",
						value: range ? String(range.opened) : loading ? "…" : "—",
						detail: range && previous ? relativeText(range.opened, previous.opened) : "No período selecionado"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TicketCheck, { className: "size-4" }),
						label: "Tickets encerrados",
						value: range ? String(range.closed) : loading ? "…" : "—",
						detail: range && previous ? relativeText(range.closed, previous.closed) : "No período selecionado"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock3, { className: "size-4" }),
						label: "Mediana da 1ª resposta",
						value: range?.medianResponseMinutes == null ? "—" : formatDuration(range.medianResponseMinutes),
						detail: `${range?.responseCount ?? 0} tickets com resposta`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquareText, { className: "size-4" }),
						label: "Satisfação (CSAT)",
						value: range?.csat == null ? "—" : `${range.csat.toFixed(1)}/5`,
						detail: `${range?.csatCount ?? 0} avaliações no período`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "size-4" }),
						label: "Respostas dentro do prazo",
						value: range?.slaMet == null ? "—" : `${range.slaMet}%`,
						detail: Number(tcfg.config.slaWarningMinutes ?? 60) > 0 ? `${range?.slaCount ?? 0} tickets respondidos ou já vencidos · meta ${Number(tcfg.config.slaWarningMinutes ?? 60)} min` : "Meta de resposta desativada"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UsersRound, { className: "size-4" }),
						label: "Fila aberta agora",
						value: activity ? String(activity.currentOpen) : loading ? "…" : "—",
						detail: activity?.oldestUnanswered ? `Mais antigo sem resposta: ${formatRelative(activity.oldestUnanswered.createdAt)}` : "Sem ticket aguardando primeira resposta",
						tone: activity?.oldestUnanswered ? "warn" : "default"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClipboardList, { className: "size-4" }),
						label: "Formulários aguardando",
						value: activity ? String(activity.pendingForms) : loading ? "…" : "—",
						detail: "Envios que ainda precisam de análise",
						tone: activity?.pendingForms ? "warn" : "default"
					})
				]
			}),
			activity && !dataInRange ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "border-dashed p-6 text-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "m-0 text-base font-semibold",
					children: "Ainda sem atividade neste período"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-0 mt-1 text-sm text-muted-foreground",
					children: "Quando houver atendimentos ou eventos do bot, eles aparecerão aqui. Tente ampliar o período para consultar o histórico."
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-3 p-4 sm:p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-start justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "m-0 text-base font-semibold",
							children: "Atividade por dia"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "m-0 mt-1 text-sm text-muted-foreground",
							children: "Selecione um dia no gráfico ou na lista para ver os tickets criados nele."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
								"aria-label": "Ver tickets de um dia",
								value: selectedDay ?? "",
								onChange: (event) => setSelectedDay(event.target.value || null),
								className: "h-9 w-auto min-w-40 text-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "",
									children: "Detalhar um dia…"
								}), chartData.map((day) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: day.day,
									children: formatDate(day.day)
								}, day.day))]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegendDot, {
										color: "var(--color-primary)",
										label: "Criados"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegendDot, {
										color: "var(--color-ok)",
										label: "Encerrados"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegendDot, {
										color: "var(--color-info)",
										label: "AutoMod"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegendDot, {
										color: "var(--color-warn)",
										label: "Moderação"
									})
								]
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-[19rem] w-full",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
							width: "100%",
							height: "100%",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
								data: chartData,
								onClick: (state) => {
									const row = state?.activePayload?.[0]?.payload;
									if (row?.day) setSelectedDay((current) => current === row.day ? null : row.day);
								},
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
										stroke: "var(--wumpus-chart-grid)",
										vertical: false
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
										dataKey: "label",
										interval: period === 90 ? 12 : period === 30 ? 4 : "preserveStartEnd",
										tick: {
											fill: "var(--color-muted-foreground)",
											fontSize: 11
										},
										axisLine: false,
										tickLine: false
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
										allowDecimals: false,
										tick: {
											fill: "var(--color-muted-foreground)",
											fontSize: 11
										},
										axisLine: false,
										tickLine: false,
										width: 32
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
										contentStyle: {
											background: "var(--color-card)",
											border: "1px solid var(--color-border)",
											borderRadius: 12
										},
										labelFormatter: (_, rows) => rows[0]?.payload?.day ? formatDate(rows[0].payload.day) : "Atividade"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
										type: "monotone",
										dataKey: "tickets",
										name: "Tickets criados",
										stroke: "var(--color-primary)",
										fill: "var(--wumpus-chart-tickets)",
										strokeWidth: 2,
										activeDot: { r: 5 }
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
										type: "monotone",
										dataKey: "closed",
										name: "Tickets encerrados",
										stroke: "var(--color-ok)",
										fill: "var(--color-ok)",
										fillOpacity: .08,
										strokeWidth: 1.5,
										activeDot: { r: 4 }
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
										type: "monotone",
										dataKey: "automod",
										name: "AutoMod",
										stroke: "var(--color-info)",
										fill: "var(--wumpus-chart-automod)",
										strokeWidth: 1.5,
										activeDot: { r: 4 }
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
										type: "monotone",
										dataKey: "moderation",
										name: "Moderação",
										stroke: "var(--color-warn)",
										fill: "var(--color-warn)",
										fillOpacity: .06,
										strokeWidth: 1.5,
										activeDot: { r: 4 }
									})
								]
							})
						})
					}),
					selectedDay ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						"aria-label": "Tickets do dia selecionado",
						className: "rounded-2xl border border-primary/25 bg-primary/5 p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-start justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
								className: "m-0 text-sm font-semibold",
								children: ["Tickets criados em ", formatDate(selectedDay)]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "m-0 mt-1 text-xs text-muted-foreground",
								children: [
									selectedDayRow?.tickets ?? 0,
									" no total",
									tickets.length >= 500 ? " · lista limitada aos 500 mais recentes" : ""
								]
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "ghost",
								onClick: () => setSelectedDay(null),
								children: "Fechar lista"
							})]
						}), ticketsBySelectedDay.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-3 mb-0 max-h-72 space-y-2 overflow-y-auto p-0",
							children: ticketsBySelectedDay.map((ticket) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex flex-wrap items-center gap-2 rounded-xl bg-card px-3 py-2.5",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-mono-num text-xs text-muted-foreground",
										children: ["#", ticket.number]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "min-w-0 flex-1 truncate text-sm font-medium",
										children: ticket.subject
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone: ticket.status === "closed" ? "default" : "primary",
										children: ticket.status === "closed" ? "Encerrado" : "Aberto"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs text-muted-foreground",
										children: ticket.department
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
										className: "text-xs font-medium text-primary underline-offset-2 hover:underline",
										href: `https://discord.com/channels/${guild?.id}/${ticket.channelName}`,
										target: "_blank",
										rel: "noreferrer",
										children: "Abrir no Discord"
									})
								]
							}, ticket.id))
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mb-0 mt-3 rounded-xl bg-card px-3 py-3 text-sm text-muted-foreground",
							children: "Não há tickets deste dia na lista recente do bot."
						})]
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid items-start gap-4 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "space-y-3 p-4 sm:p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "m-0 text-base font-semibold",
						children: "Atendimento por departamento"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 mt-1 text-sm text-muted-foreground",
						children: "Abertos e encerrados no período selecionado."
					})] }), range?.departments.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-2",
						children: range.departments.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "truncate text-sm font-medium",
									children: item.department
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-xs text-muted-foreground",
									children: [item.opened, " criados"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-xs text-muted-foreground",
									children: [item.closed, " encerrados"]
								})
							]
						}, item.department))
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground",
						children: "Não há tickets por departamento para mostrar."
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "space-y-3 p-4 sm:p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "size-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "m-0 text-base font-semibold",
								children: "Comparação do período"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "m-0 mt-1 text-sm text-muted-foreground",
								children: [
									period,
									" dias atuais contra os ",
									period,
									" anteriores."
								]
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Comparison, {
							label: "Tickets criados",
							current: range?.opened ?? null,
							previous: previous?.opened ?? null
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Comparison, {
							label: "Tickets encerrados",
							current: range?.closed ?? null,
							previous: previous?.closed ?? null
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Comparison, {
							label: "Mediana da 1ª resposta",
							current: range?.medianResponseMinutes ?? null,
							previous: previous?.medianResponseMinutes ?? null,
							unit: "min"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Comparison, {
							label: "CSAT médio",
							current: range?.csat ?? null,
							previous: previous?.csat ?? null,
							unit: "/5"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Comparison, {
							label: "Respostas dentro do prazo",
							current: range?.slaMet ?? null,
							previous: previous?.slaMet ?? null,
							unit: "%"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Comparison, {
							label: "Eventos AutoMod",
							current: range?.automod ?? null,
							previous: previous?.automod ?? null
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Comparison, {
							label: "Ações de moderação",
							current: range?.moderation ?? null,
							previous: previous?.moderation ?? null
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-3 p-4 sm:p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "m-0 text-base font-semibold",
					children: "Atividade recente"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 mt-1 text-sm text-muted-foreground",
					children: "Últimos registros importantes do servidor."
				})] }), activity?.recentEvents.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "m-0 divide-y divide-border p-0",
					children: activity.recentEvents.map((event) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex flex-wrap items-center gap-2 py-3 first:pt-0 last:pb-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: event.severity === "critical" || event.severity === "error" ? "danger" : event.severity === "warning" ? "warn" : "default",
								children: moduleLabel(event.module)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "min-w-0 flex-1 text-sm",
								children: eventLabel(event.eventType)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-muted-foreground",
								children: formatRelative(event.at)
							})
						]
					}, event.id))
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground",
					children: "Ainda não há registros recentes para este servidor."
				})]
			})
		]
	});
}
function Kpi({ icon, label, value, detail, tone = "default" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "flex min-h-32 items-start gap-3 p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: `grid size-9 shrink-0 place-items-center rounded-xl ${tone === "warn" ? "bg-warn/10 text-warn" : "bg-muted text-muted-foreground"}`,
			children: icon
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 text-xs text-muted-foreground",
					children: label
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-0 mt-1 text-2xl font-semibold tracking-tight",
					children: value
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-0 mt-1 text-xs leading-5 text-muted-foreground",
					children: detail
				})
			]
		})]
	});
}
function Comparison({ label, current, previous, unit }) {
	if (current == null || previous == null) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-sm",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-xs text-muted-foreground",
			children: "Sem dados suficientes"
		})]
	});
	const delta = current - previous;
	if (unit) {
		const value = (amount) => unit === "min" ? formatDuration(amount) : unit === "/5" ? `${amount.toFixed(1)}/5` : `${amount}%`;
		const difference = Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm",
				children: label
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "text-right text-xs text-muted-foreground",
				children: [
					value(current),
					" vs. ",
					value(previous),
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "block",
						children: [
							delta > 0 ? "+" : delta < 0 ? "−" : "",
							difference,
							unit === "/5" ? " pontos" : unit === "%" ? " p.p." : " min"
						]
					})
				]
			})]
		});
	}
	const phrase = previous === 0 ? current === 0 ? "Sem mudança" : "Novo" : `${Math.abs(Math.round(delta / previous * 100))}%`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-sm",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "flex items-center gap-1 text-xs text-muted-foreground",
			children: [
				delta > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "size-3.5" }) : delta < 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDownRight, { className: "size-3.5" }) : null,
				phrase,
				" · ",
				current,
				" vs. ",
				previous
			]
		})]
	});
}
function LegendDot({ color, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "inline-flex items-center gap-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
			className: "size-2 rounded-full",
			style: { background: color }
		}), label]
	});
}
function moduleLabel(module) {
	return {
		automod: "AutoMod",
		tickets: "Atendimento",
		ticket: "Atendimento",
		forms: "Formulários",
		moderation: "Moderação",
		security: "Segurança",
		members: "Membros",
		knowledge: "Base de conhecimento"
	}[module] ?? "Servidor";
}
function eventLabel(eventType) {
	return {
		ticket_opened: "Novo ticket aberto",
		ticket_closed: "Ticket encerrado",
		ticket_claimed: "Ticket assumido pela equipe",
		ticket_reopened: "Ticket reaberto",
		ticket_sla_warning: "Ticket próximo do prazo de resposta",
		ticket_sla_breach: "Ticket passou do prazo de resposta",
		form_submitted: "Novo formulário enviado",
		form_approved: "Formulário aprovado",
		form_rejected: "Formulário recusado",
		knowledge_answered: "Dúvida respondida pela base de conhecimento",
		member_joined: "Novo membro entrou no servidor",
		member_left: "Membro saiu do servidor",
		moderation_ban: "Banimento aplicado",
		moderation_timeout: "Timeout aplicado",
		moderation_kick: "Expulsão aplicada",
		moderation_warn: "Advertência aplicada"
	}[eventType] ?? eventType.replace(/_/g, " ").replace(/^./, (letter) => letter.toLocaleUpperCase("pt-BR"));
}
function formatDuration(minutes) {
	if (minutes < 60) return `${Math.round(minutes)} min`;
	const hours = minutes / 60;
	return hours < 24 ? `${hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h` : `${(hours / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`;
}
function formatDate(value) {
	if (!value) return "—";
	const [year, month, day] = value.slice(0, 10).split("-");
	return `${day}/${month}/${year}`;
}
//#endregion
export { StatsPage as component };
