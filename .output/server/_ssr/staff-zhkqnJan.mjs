import { i as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { o as getStoredSessionToken } from "./session-token-CaBlZnli.mjs";
import { K as ticketSla, N as getGuildTickets, X as useModule, Y as useGuildMembers, Z as useWumpus, _ as Button, b as DiscordSelect, c as Input, g as Card, l as Label, s as Switch, u as NativeSelect, v as Badge, y as DiscordMultiSelect } from "./router-DjtjaZqs.mjs";
import { r as MemberAvatar } from "./brand-E6aTdQpB.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/staff-zhkqnJan.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function StaffPage() {
	const gid = useWumpus((s) => s.activeGuildId);
	const members = useGuildMembers();
	const [tickets, setTickets] = (0, import_react.useState)([]);
	const [ticketsLoading, setTicketsLoading] = (0, import_react.useState)(true);
	const [ticketError, setTicketError] = (0, import_react.useState)(null);
	const [refreshKey, setRefreshKey] = (0, import_react.useState)(0);
	const scfg = useModule("staff");
	const tcfg = useModule("tickets");
	const updateConfig = useWumpus((s) => s.updateConfig);
	const roles = useWumpus((s) => s.roles[gid] ?? []);
	const staffRoleRefs = scfg.config.staffRoleIds ?? [];
	const staffRoles = roles.filter((role) => staffRoleRefs.includes(role.id) || staffRoleRefs.includes(role.name)).map((role) => role.id);
	const staff = [...new Set(tickets.map((ticket) => ticket.claimedBy).filter((id) => Boolean(id)))].map((id) => members.find((member) => member.id === id) ?? {
		id,
		displayName: `Atendente · ${id.slice(-4)}`,
		hue: 176,
		roleIds: []
	});
	const goal = Number(scfg.config.responseTimeGoalMinutes ?? 30);
	const maxC = Number(scfg.config.maxConcurrentTickets ?? 5);
	const [windowDays, setWindowDays] = (0, import_react.useState)(30);
	(0, import_react.useEffect)(() => {
		let active = true;
		const load = async () => {
			const token = getStoredSessionToken();
			if (!token || !gid) {
				if (active) {
					setTickets([]);
					setTicketError("Entre com Discord para ver a atividade real da equipe.");
					setTicketsLoading(false);
				}
				return;
			}
			try {
				const rows = await getGuildTickets({ data: {
					token,
					guildId: gid
				} });
				if (active) {
					setTickets(rows);
					setTicketError(null);
					setTicketsLoading(false);
				}
			} catch (error) {
				if (active) {
					setTicketError(error instanceof Error ? error.message : "Não foi possível carregar os tickets deste servidor.");
					setTicketsLoading(false);
				}
			}
		};
		setTickets([]);
		setTicketsLoading(true);
		load();
		const timer = window.setInterval(() => void load(), 15e3);
		return () => {
			active = false;
			window.clearInterval(timer);
		};
	}, [gid, refreshKey]);
	const metricsCutoff = Date.now() - windowDays * 24 * 60 * 60 * 1e3;
	const metricTickets = tickets.filter((ticket) => ticket.createdAt >= metricsCutoff);
	const unassigned = tickets.filter((ticket) => (ticket.status === "open" || ticket.status === "claimed") && !ticket.claimedBy).length;
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
							children: "Sem responsável"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 mb-0 font-mono-num text-2xl font-semibold",
							children: ticketsLoading || ticketError ? "—" : unassigned
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "m-0 text-base font-semibold",
						children: "Atividade por responsável"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "m-0 mt-1 text-sm text-muted-foreground",
						children: [
							"Tickets atribuídos consideram até 500 registros reais recentes, criados nos últimos ",
							windowDays,
							" dias. Atualiza a cada 15 segundos."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 mt-1 text-xs text-muted-foreground",
						children: "O bot ainda não registra quem enviou a primeira resposta; tempos médios e avaliações individuais não são atribuídos para evitar números incorretos."
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-end gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "staff-window",
						children: "Período"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
						id: "staff-window",
						value: windowDays,
						onChange: (event) => setWindowDays(Number(event.target.value)),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: 7,
								children: "7 dias"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: 30,
								children: "30 dias"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: 90,
								children: "90 dias"
							})
						]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						size: "sm",
						disabled: ticketsLoading,
						onClick: () => {
							setTicketsLoading(true);
							setRefreshKey((key) => key + 1);
						},
						children: ticketsLoading ? "Atualizando…" : "Atualizar"
					})]
				})]
			}),
			ticketError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "m-0 rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn",
				role: "alert",
				children: ticketError
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-3 rounded-xl border border-border p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "m-0 text-base font-semibold",
					children: "Quem atende os tickets?"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 mt-1 text-sm text-muted-foreground",
					children: "Escolha os cargos da equipe. Só membros com esses cargos entram na lista e recebem alertas."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordMultiSelect, {
					value: [...staffRoles],
					onChange: (staffRoleIds) => updateConfig("staff", { staffRoleIds })
				})]
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
								children: "Fora do prazo"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3 font-medium",
								children: "Tickets atribuídos no período"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [
						ticketsLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							colSpan: 4,
							className: "px-4 py-10 text-center text-muted-foreground",
							children: "Carregando atividade real do bot…"
						}) }) : null,
						!ticketsLoading && ticketError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							colSpan: 4,
							className: "px-4 py-10 text-center text-muted-foreground",
							children: "Não foi possível calcular as métricas com os tickets deste servidor."
						}) }) : null,
						!ticketsLoading && !ticketError && !tickets.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							colSpan: 4,
							className: "px-4 py-10 text-center",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "m-0 font-medium",
								children: "Ainda não há tickets registrados"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-0 mt-1 text-sm text-muted-foreground",
								children: "As métricas aparecerão quando o bot registrar os primeiros atendimentos neste servidor."
							})]
						}) }) : null,
						!ticketsLoading && !ticketError && tickets.length > 0 && !staff.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							colSpan: 4,
							className: "px-4 py-10 text-center",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "m-0 font-medium",
								children: "Nenhum responsável registrado nos tickets"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-0 mt-1 text-sm text-muted-foreground",
								children: "Quando alguém da equipe assumir um atendimento, sua carga aparecerá aqui."
							})]
						}) }) : null,
						!ticketsLoading && !ticketError ? staff.map((s) => {
							const mine = metricTickets.filter((t) => t.claimedBy === s.id);
							const open = tickets.filter((t) => t.claimedBy === s.id && (t.status === "open" || t.status === "claimed"));
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
												children: members.some((member) => member.id === s.id) ? roles.filter((r) => s.roleIds.includes(r.id)).map((r) => r.name).join(" · ") : "ID do atendente registrado pelo bot"
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
										className: "px-4 py-3",
										children: late ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
											tone: "danger",
											children: [late, " atrasado"]
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											tone: "ok",
											children: "Nenhum"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-4 py-3 font-mono-num",
										children: mine.length
									})
								]
							}, s.id);
						}) : null
					] })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "grid gap-4 sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Canal de avisos da equipe" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
						kind: "text",
						value: String(scfg.config.logChannelId ?? ""),
						onChange: (logChannelId) => updateConfig("staff", { logChannelId }),
						placeholder: "Sem canal de avisos"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Cargo para escalonamento" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
						kind: "role",
						value: String(scfg.config.escalationRoleId ?? ""),
						onChange: (escalationRoleId) => updateConfig("staff", { escalationRoleId }),
						placeholder: "Sem escalonamento"
					})] }),
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
