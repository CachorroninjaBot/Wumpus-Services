import { i as __toESM } from "../_runtime.mjs";
import { n as formatRelative } from "./utils-H16dNBFI.mjs";
import { o as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as Badge } from "./badge-C2mxnvvX.mjs";
import { t as Button } from "./button-BUiFN9VL.mjs";
import { t as Card } from "./card-DaYenTQt.mjs";
import { i as Textarea, n as Label, r as NativeSelect, t as Input } from "./input-Cyzc7r1j.mjs";
import { r as presets } from "./defaults-B5nsBQ51.mjs";
import { d as useActiveGuild, f as useGuildMembers, m as useWumpus, n as asString, p as useModule, t as asList } from "./store-B26y7m0l.mjs";
import { t as Switch } from "./switch-C8XyncjG.mjs";
import { i as TabsTrigger, n as TabsContent, r as TabsList, t as Tabs } from "./tabs-B9Iu4s2v.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/protect-pUCKumdi.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ProtectPage() {
	const guild = useActiveGuild();
	const gid = useWumpus((s) => s.activeGuildId);
	const automod = useModule("automod");
	const security = useModule("security");
	const updateConfig = useWumpus((s) => s.updateConfig);
	const applyPreset = useWumpus((s) => s.applyPreset);
	const testAutomod = useWumpus((s) => s.testAutomod);
	const toggleLockdown = useWumpus((s) => s.toggleLockdown);
	const closeIncident = useWumpus((s) => s.closeIncident);
	const simulateRaid = useWumpus((s) => s.simulateRaid);
	const simulateNuke = useWumpus((s) => s.simulateNuke);
	const members = useGuildMembers();
	const allHits = useWumpus((s) => s.automodHits);
	const allIncidents = useWumpus((s) => s.incidents);
	const hits = allHits.filter((h) => h.guildId === gid);
	const incidents = allIncidents.filter((i) => i.guildId === gid);
	const [text, setText] = (0, import_react.useState)("entra no meu server discord.gg/nitrofree");
	const [userId, setUserId] = (0, import_react.useState)(members.find((m) => !m.roleIds.includes("role_staff"))?.id ?? members[0]?.id ?? "");
	const [verdict, setVerdict] = (0, import_react.useState)(null);
	const [joins, setJoins] = (0, import_react.useState)(14);
	const [nukes, setNukes] = (0, import_react.useState)(6);
	const [raidNote, setRaidNote] = (0, import_react.useState)(null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-6xl flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "m-0 text-xl font-semibold tracking-tight",
				children: "Proteção"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-3 md:grid-cols-3",
				children: Object.keys(presets).map((id) => {
					const p = presets[id];
					const active = guild.preset === id;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => applyPreset(id),
						className: `rounded-2xl bg-card p-4 text-left shadow-border ${active ? "ring-1 ring-primary" : ""}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "m-0 text-sm font-semibold",
								children: p.label
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 mb-0 text-sm text-muted-foreground",
								children: p.blurb
							}),
							active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: "primary",
								className: "mt-2",
								children: "ativo"
							}) : null
						]
					}, id);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
				defaultValue: "automod",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "automod",
						children: "AutoMod"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "raid",
						children: "Anti-raid"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
						value: "automod",
						className: "mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "mt-0 text-base font-semibold",
								children: "Tester ao vivo"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted-foreground",
								children: "A mensagem passa pelo mesmo filtro do bot, com os cargos do autor."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 space-y-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Autor" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NativeSelect, {
										className: "mt-1",
										value: userId,
										onChange: (e) => setUserId(e.target.value),
										children: members.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: m.id,
											children: m.displayName
										}, m.id))
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
										value: text,
										onChange: (e) => setText(e.target.value),
										rows: 4
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										onClick: () => setVerdict(testAutomod(userId, text)),
										children: "Testar"
									}),
									verdict ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: `rounded-xl px-3 py-2 text-sm ${verdict.ok ? "bg-ok/15 text-ok" : "bg-destructive/15 text-destructive"}`,
										children: verdict.ok ? verdict.detail || "Mensagem passa." : `${verdict.action} · ${verdict.rule} — ${verdict.detail}`
									}) : null
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-5 space-y-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
										label: "Bloquear convites",
										checked: Boolean(automod.config.blockInvites),
										onChange: (v) => updateConfig("automod", { blockInvites: v })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
										label: "Bloquear links (exceto lista)",
										checked: Boolean(automod.config.blockLinks),
										onChange: (v) => updateConfig("automod", { blockLinks: v })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
										label: "Detectar ghost ping",
										checked: Boolean(automod.config.antiGhostPing),
										onChange: (v) => updateConfig("automod", { antiGhostPing: v })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Ação",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
											defaultValue: asString(automod.config.action, "delete"),
											onChange: (e) => updateConfig("automod", { action: e.target.value }),
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "delete",
													children: "Apagar"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "warn",
													children: "Avisar"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "timeout",
													children: "Timeout"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "review",
													children: "Revisão"
												})
											]
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Termos bloqueados",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											defaultValue: asList(automod.config.blockedTerms).join(", "),
											onBlur: (e) => updateConfig("automod", { blockedTerms: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Domínios permitidos",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											defaultValue: asList(automod.config.allowedDomains).join(", "),
											onBlur: (e) => updateConfig("automod", { allowedDomains: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Limite de menções",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											type: "number",
											defaultValue: Number(automod.config.mentionLimit ?? 8),
											onBlur: (e) => updateConfig("automod", { mentionLimit: Number(e.target.value) || 0 })
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Caps (%)",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											type: "number",
											defaultValue: Number(automod.config.capsThresholdPercent ?? 80),
											onBlur: (e) => updateConfig("automod", { capsThresholdPercent: Number(e.target.value) || 0 })
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Mensagens na janela",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											type: "number",
											defaultValue: Number(automod.config.messageLimit ?? 6),
											onBlur: (e) => updateConfig("automod", { messageLimit: Number(e.target.value) || 0 })
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
										label: "Janela (segundos)",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											type: "number",
											defaultValue: Number(automod.config.windowSeconds ?? 10),
											onBlur: (e) => updateConfig("automod", { windowSeconds: Number(e.target.value) || 1 })
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "m-0 text-xs text-muted-foreground",
										children: "Envie a mesma frase várias vezes no tester: flood e duplicata usam essa janela."
									})
								]
							})
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-0 text-base font-semibold",
							children: "Últimos hits"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
							className: "m-0 space-y-3 p-0",
							children: [hits.slice(0, 10).map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-muted-foreground",
									children: [
										formatRelative(h.at),
										" · ",
										h.rule
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 truncate",
									children: h.content
								})]
							}, h.id)), hits.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted-foreground",
								children: "Nenhum hit ainda."
							}) : null]
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
						value: "raid",
						className: "mt-4 grid gap-4 lg:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							className: "space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "m-0 text-base font-semibold",
										children: "Anti-raid"
									}), Boolean(security.config.lockdown) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone: "danger",
										children: "lockdown"
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone: "ok",
										children: "normal"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Modo",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
										defaultValue: asString(security.config.raidMode, "smart"),
										onChange: (e) => updateConfig("security", { raidMode: e.target.value }),
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "smart",
												children: "Inteligente"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "strict",
												children: "Estrito"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "passive",
												children: "Passivo"
											})
										]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Entradas para raid",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										type: "number",
										defaultValue: Number(security.config.raidJoinThreshold ?? 12),
										onBlur: (e) => updateConfig("security", { raidJoinThreshold: Number(e.target.value) || 3 })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Idade mínima da conta (h)",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										type: "number",
										defaultValue: Number(security.config.minAccountAgeHours ?? 24),
										onBlur: (e) => updateConfig("security", { minAccountAgeHours: Number(e.target.value) || 0 })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
									label: "Isolar contas novas",
									checked: Boolean(security.config.quarantineNewMembers),
									onChange: (v) => updateConfig("security", { quarantineNewMembers: v })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Mensagem de lockdown",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
										defaultValue: asString(security.config.lockdownMessage),
										onBlur: (e) => updateConfig("security", { lockdownMessage: e.target.value })
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: security.config.lockdown ? "secondary" : "destructive",
									onClick: () => toggleLockdown(),
									children: security.config.lockdown ? "Encerrar lockdown" : "Ligar lockdown"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Simular entradas agora",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										type: "number",
										value: joins,
										onChange: (e) => setJoins(Number(e.target.value) || 0)
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									onClick: () => setRaidNote(simulateRaid(joins)),
									children: "Rodar anti-raid"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
									label: "Simular ações destrutivas (nuke)",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										type: "number",
										value: nukes,
										onChange: (e) => setNukes(Number(e.target.value) || 0)
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									onClick: () => setRaidNote(simulateNuke(nukes)),
									children: "Rodar anti-nuke"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 text-xs text-muted-foreground",
									children: "Anti-nuke faz parte de todos os WumPlus, do Essencial ao Escala."
								}),
								raidNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 rounded-xl bg-muted px-3 py-2 text-sm",
									children: raidNote
								}) : null
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-0 text-base font-semibold",
							children: "Incidentes"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "m-0 space-y-3 p-0",
							children: incidents.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "rounded-xl bg-muted px-3 py-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sm font-medium",
											children: i.title
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											tone: i.status === "closed" ? "ok" : "warn",
											children: i.status
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "m-0 text-sm text-muted-foreground",
										children: i.detail
									}),
									i.status !== "closed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "ghost",
										className: "mt-1",
										onClick: () => closeIncident(i.id),
										children: "Encerrar"
									}) : null
								]
							}, i.id))
						})] })]
					})
				]
			})
		]
	});
}
function Toggle({ label, checked, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
			checked,
			onCheckedChange: onChange
		})]
	});
}
function Field({ label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }), children]
	});
}
//#endregion
export { ProtectPage as component };
