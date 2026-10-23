import { i as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { o as getStoredSessionToken } from "./session-token-CaBlZnli.mjs";
import { X as useModule, Z as useWumpus, b as DiscordSelect, c as Input, et as formatTime, g as Card, k as getGuildAudit, l as Label, s as Switch, y as DiscordMultiSelect } from "./router-DjtjaZqs.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/logs-BuO_gV2m.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var categories = [
	["logModeration", "Moderação"],
	["logMembers", "Membros"],
	["logMessages", "Mensagens"],
	["logVoice", "Voz"],
	["logRoles", "Cargos"],
	["logChannels", "Canais"],
	["logBans", "Banimentos"],
	["logAutoMod", "AutoMod"]
];
var extendedCategories = [
	["logThreadEvents", "Threads"],
	["logStageEvents", "Stages"],
	["logScheduledEvents", "Eventos agendados"]
];
function LogsPage() {
	const gid = useWumpus((s) => s.activeGuildId);
	const lcfg = useModule("logs");
	const updateConfig = useWumpus((s) => s.updateConfig);
	const [events, setEvents] = (0, import_react.useState)([]);
	const [error, setError] = (0, import_react.useState)(null);
	const [q, setQ] = (0, import_react.useState)("");
	const [cat, setCat] = (0, import_react.useState)("all");
	const [ignoredDraft, setIgnoredDraft] = (0, import_react.useState)({ ignoredUserIds: "" });
	const [retentionDraft, setRetentionDraft] = (0, import_react.useState)(String(lcfg.config.retentionDays ?? 180));
	(0, import_react.useEffect)(() => {
		setIgnoredDraft({ ignoredUserIds: Array.isArray(lcfg.config.ignoredUserIds) ? lcfg.config.ignoredUserIds.join(", ") : "" });
		setRetentionDraft(String(lcfg.config.retentionDays ?? 180));
	}, [gid, lcfg.config]);
	(0, import_react.useEffect)(() => {
		let active = true;
		const refresh = async () => {
			try {
				const rows = await getGuildAudit({ data: {
					token: getStoredSessionToken(),
					guildId: gid,
					limit: 300
				} });
				if (active) {
					setEvents(rows);
					setError(null);
				}
			} catch (cause) {
				if (active) setError(cause instanceof Error ? cause.message : "Não foi possível ler a auditoria do bot.");
			}
		};
		refresh();
		const timer = window.setInterval(() => void refresh(), 3e4);
		return () => {
			active = false;
			window.clearInterval(timer);
		};
	}, [gid]);
	const cats = (0, import_react.useMemo)(() => ["all", ...Array.from(new Set(events.map((event) => event.category)))], [events]);
	const filtered = events.filter((event) => {
		if (cat !== "all" && event.category !== cat) return false;
		const query = q.toLowerCase();
		return !query || `${event.summary} ${event.eventType} ${event.actorId ?? ""} ${event.targetId ?? ""}`.toLowerCase().includes(query);
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-5xl flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "m-0 text-xl font-semibold tracking-tight",
				children: "Auditoria"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-0 mt-1 text-sm text-muted-foreground",
				children: "Eventos persistidos pelo bot. Atualiza a cada 30 segundos."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "p-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "sr-only",
					children: "Configurações de auditoria"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4",
					children: [
						categories.map(([field, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
								checked: Boolean(lcfg.config[field]),
								onCheckedChange: (value) => updateConfig("logs", { [field]: value })
							})]
						}, field)),
						extendedCategories.map(([field, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
								checked: Boolean(lcfg.config[field]),
								onCheckedChange: (value) => updateConfig("logs", { [field]: value })
							})]
						}, field)),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Ignorar mensagens de bots" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
								checked: Boolean(lcfg.config.ignoreBotMessages),
								onCheckedChange: (value) => updateConfig("logs", { ignoreBotMessages: value })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Formato compacto" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
								checked: Boolean(lcfg.config.compactMode),
								onCheckedChange: (value) => updateConfig("logs", { compactMode: value })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Mencionar equipe em eventos críticos" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
								checked: Boolean(lcfg.config.mentionOnCritical),
								onCheckedChange: (value) => updateConfig("logs", { mentionOnCritical: value })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Incluir horário nos logs" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
								checked: Boolean(lcfg.config.includeTimestamp),
								onCheckedChange: (value) => updateConfig("logs", { includeTimestamp: value })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "sm:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "logs-retention",
								children: "Retenção da auditoria (dias)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "logs-retention",
								type: "number",
								min: 7,
								max: 3650,
								value: retentionDraft,
								onChange: (event) => setRetentionDraft(event.target.value),
								onBlur: () => updateConfig("logs", { retentionDays: Math.max(7, Math.min(3650, Number(retentionDraft) || 7)) })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "sm:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "logs-channel",
								children: "Canal de logs"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
								id: "logs-channel",
								kind: "text",
								value: String(lcfg.config.channelId ?? ""),
								onChange: (channelId) => updateConfig("logs", { channelId }),
								placeholder: "Selecione um canal"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "sm:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "logs-mention-role",
								children: "Cargo mencionado em alertas"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
								id: "logs-mention-role",
								kind: "role",
								value: String(lcfg.config.mentionRoleId ?? ""),
								onChange: (mentionRoleId) => updateConfig("logs", { mentionRoleId }),
								placeholder: "Sem menção de cargo"
							})]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
				className: "rounded-2xl bg-card text-card-foreground shadow-border",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
					className: "flex min-h-14 cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-2xl px-5 py-3 text-sm font-semibold hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Histórico de auditoria" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs font-normal text-muted-foreground",
						children: error ? "Falha ao carregar · abrir detalhes" : `${events.length} eventos · abrir histórico`
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3 border-t border-border p-4",
					children: [
						error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							role: "alert",
							className: "m-0 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive",
							children: error
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-2",
							children: cats.map((category) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setCat(category),
								className: `min-h-9 rounded-full px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${cat === category ? "bg-secondary" : "text-muted-foreground hover:bg-muted"}`,
								children: category === "all" ? "tudo" : category
							}, category))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: q,
							onChange: (event) => setQ(event.target.value),
							placeholder: "Buscar evento, usuário ou alvo"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: filtered.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "m-0 divide-y divide-border p-0",
							children: filtered.map((event) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex flex-col gap-1 px-1 py-3 sm:flex-row sm:items-baseline sm:gap-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
										className: "w-36 shrink-0 font-mono-num text-xs text-muted-foreground",
										dateTime: new Date(event.at).toISOString(),
										children: formatTime(event.at)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "w-24 shrink-0 text-xs uppercase tracking-wide text-muted-foreground",
										children: event.category
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "min-w-0 flex-1 text-sm",
										children: [
											event.actorId ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
												className: "text-primary",
												href: `https://discord.com/users/${event.actorId}`,
												target: "_blank",
												rel: "noreferrer",
												children: "Autor"
											}), " · "] }) : null,
											event.summary,
											event.targetId ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [" · alvo ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: event.targetId })] }) : null,
											event.channelId ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [" · ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
												className: "text-primary",
												href: `https://discord.com/channels/${gid}/${event.channelId}`,
												target: "_blank",
												rel: "noreferrer",
												children: "canal"
											})] }) : null
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: `text-xs ${event.severity === "critical" ? "text-destructive" : event.severity === "warning" ? "text-warn" : "text-muted-foreground"}`,
										children: event.severity
									})
								]
							}, event.id))
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "m-0 p-6 text-center text-sm text-muted-foreground",
							children: error ? "A auditoria não foi carregada." : "Nenhum evento corresponde ao filtro."
						}) })
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "m-0 text-base font-semibold",
						children: "Ignorar eventos"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 text-sm text-muted-foreground",
						children: "Escolha cargos e canais que devem ficar fora da auditoria. Para ignorar uma pessoa, informe o ID do usuário."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 md:grid-cols-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "ignoredUserIds",
								children: "Usuários ignorados (IDs)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "ignoredUserIds",
								value: ignoredDraft.ignoredUserIds,
								onChange: (event) => setIgnoredDraft((current) => ({
									...current,
									ignoredUserIds: event.target.value
								})),
								onBlur: () => updateConfig("logs", { ignoredUserIds: ignoredDraft.ignoredUserIds.split(",").map((id) => id.trim()).filter(Boolean) })
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Cargos ignorados" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordMultiSelect, {
								value: Array.isArray(lcfg.config.ignoredRoleIds) ? lcfg.config.ignoredRoleIds : [],
								onChange: (ignoredRoleIds) => updateConfig("logs", { ignoredRoleIds })
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Canais ignorados" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordMultiSelect, {
								kind: "text",
								value: Array.isArray(lcfg.config.ignoredChannelIds) ? lcfg.config.ignoredChannelIds : [],
								onChange: (ignoredChannelIds) => updateConfig("logs", { ignoredChannelIds })
							})] })
						]
					})
				]
			})
		]
	});
}
//#endregion
export { LogsPage as component };
