import { i as __toESM } from "../_runtime.mjs";
import { t as isPlatformOwner } from "./owner-GgaIkPvQ.mjs";
import { o as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as Badge } from "./badge-C2mxnvvX.mjs";
import { t as Button } from "./button-BUiFN9VL.mjs";
import { t as Card } from "./card-DaYenTQt.mjs";
import { i as Textarea, n as Label, r as NativeSelect, t as Input } from "./input-Cyzc7r1j.mjs";
import { a as planById, c as serverLimit, s as plans } from "./catalog-Bwk5qXYL.mjs";
import { d as useActiveGuild, f as useGuildMembers, m as useWumpus, n as asString, p as useModule, s as renderTemplate } from "./store-B26y7m0l.mjs";
import { t as Switch } from "./switch-C8XyncjG.mjs";
import { t as useBilling } from "./use-billing-CbM63Gq5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-DfVdoEQY.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SettingsPage() {
	const guild = useActiveGuild();
	const gid = useWumpus((s) => s.activeGuildId);
	const servers = useModule("servers");
	const rolesMod = useModule("roles");
	const logsMod = useModule("logs");
	const updateConfig = useWumpus((s) => s.updateConfig);
	const setEnabled = useWumpus((s) => s.setModuleEnabled);
	const channelMap = useWumpus((s) => s.channels);
	const roleMap = useWumpus((s) => s.roles);
	const channels = channelMap[gid] ?? [];
	const roles = roleMap[gid] ?? [];
	const members = useGuildMembers();
	const posts = useWumpus((s) => s.posts).filter((p) => p.guildId === gid);
	const setPlan = useWumpus((s) => s.setPlan);
	const sessionUser = useWumpus((s) => s.sessionUser);
	const isOwner = isPlatformOwner(sessionUser.id);
	const simulateJoin = useWumpus((s) => s.simulateJoin);
	const sample = members[0];
	const preview = renderTemplate(asString(servers.config.joinMessage), { user: sample?.displayName ?? "membro" });
	const [username, setUsername] = (0, import_react.useState)("nova");
	const [age, setAge] = (0, import_react.useState)(2);
	const [joinNote, setJoinNote] = (0, import_react.useState)(null);
	const billing = useBilling();
	const catalog = billing.data?.plans?.length ? billing.data.plans : plans;
	const current = catalog.find((p) => p.id === guild.plan) ?? planById(guild.plan);
	const cap = serverLimit(guild.plan);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-3xl flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "m-0 text-xl font-semibold tracking-tight",
				children: "Servidor"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-sm text-muted-foreground",
				children: [
					guild.name,
					" · ",
					guild.memberCount.toLocaleString("pt-BR"),
					" membros · ",
					guild.region
				]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "m-0 text-base font-semibold",
							children: "Licença WumPlus"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: "primary",
							children: current.name
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "m-0 text-sm text-muted-foreground",
						children: [
							"A cobrança é da ",
							billing.data?.storeName ?? "Hub Express",
							" na ShardPay. Este servidor está em ",
							current.price,
							".",
							" ",
							cap === null ? "Servidores ilimitados." : `Até ${cap} servidores.`,
							billing.loading ? " Lendo a loja…" : billing.data?.error ? ` ${billing.data.error}` : ""
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid gap-2",
						children: catalog.map((plan) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2 rounded-xl bg-muted px-3 py-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "m-0 text-sm font-medium",
										children: plan.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "m-0 text-xs text-muted-foreground",
										children: plan.price
									})]
								}),
								guild.plan === plan.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: "ok",
									children: "deste servidor"
								}) : null,
								isOwner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: "outline",
									onClick: () => setPlan(plan.id),
									children: "Aplicar"
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: plan.checkoutUrl,
									target: "_blank",
									rel: "noreferrer",
									className: "text-sm text-primary",
									children: "Assinar"
								})
							]
						}, plan.id))
					}),
					!isOwner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 text-xs text-muted-foreground",
						children: "O plano deste servidor acompanha a sua assinatura na ShardPay. Para mudar, assine outro plano — a liberação é automática."
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 text-sm font-medium",
						children: "Assinaturas na loja"
					}), billing.data?.subscriptions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 m-0 space-y-1 p-0 text-sm",
						children: billing.data.subscriptions.map((sub) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
							sub.productName,
							" · ",
							sub.status,
							sub.discordUsername ? ` · ${sub.discordUsername}` : ""
						] }, sub.id))
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 mb-0 text-sm text-muted-foreground",
						children: "Nenhuma assinatura ativa agora. Quem paga aparece aqui e o plano do servidor segue o produto."
					})] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 font-medium",
						children: "Modo manutenção"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 text-sm text-muted-foreground",
						children: "O bot responde só com a mensagem abaixo."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
						checked: Boolean(servers.config.maintenanceMode),
						onCheckedChange: (v) => updateConfig("servers", { maintenanceMode: v })
					})]
				}), Boolean(servers.config.maintenanceMode) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
					defaultValue: asString(servers.config.maintenanceMessage),
					onBlur: (e) => updateConfig("servers", { maintenanceMessage: e.target.value })
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-0 text-base font-semibold",
						children: "Boas-vindas"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Canal" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NativeSelect, {
						className: "mt-1",
						defaultValue: asString(servers.config.announceJoinChannelId),
						onChange: (e) => updateConfig("servers", { announceJoinChannelId: e.target.value }),
						children: channels.filter((c) => c.type === "text").map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
							value: c.id,
							children: ["#", c.name]
						}, c.id))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, { children: ["Mensagem · use ", "{user}"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						className: "mt-1",
						defaultValue: asString(servers.config.joinMessage),
						onBlur: (e) => updateConfig("servers", { joinMessage: e.target.value })
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl bg-muted px-3 py-2 text-sm",
						children: ["Preview: ", preview]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Simular entrada" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							className: "mt-1",
							value: username,
							onChange: (e) => setUsername(e.target.value)
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Idade da conta (horas)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							className: "mt-1",
							type: "number",
							value: age,
							onChange: (e) => setAge(Number(e.target.value) || 0)
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						onClick: () => setJoinNote(simulateJoin({
							username,
							accountAgeHours: age
						})),
						children: "Fazer o membro entrar"
					}),
					joinNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 text-sm",
						children: joinNote
					}) : null,
					posts.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "m-0 space-y-2 p-0",
						children: posts.slice(0, 4).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-xl bg-muted px-3 py-2 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-muted-foreground",
								children: [
									"#",
									p.channelId.replace("ch_", ""),
									" · "
								]
							}), p.content]
						}, p.id))
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-0 text-base font-semibold",
					children: "Cargos na entrada"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-2",
					children: roles.map((r) => {
						const selected = (rolesMod.config.defaultRoleIds ?? []).includes(r.id);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								const cur = new Set(rolesMod.config.defaultRoleIds ?? []);
								if (cur.has(r.id)) cur.delete(r.id);
								else cur.add(r.id);
								updateConfig("roles", { defaultRoleIds: Array.from(cur) });
							},
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: selected ? "primary" : "default",
								children: r.name
							})
						}, r.id);
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 font-medium",
					children: "Logs de servidor"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 text-sm text-muted-foreground",
					children: "Entradas, cargos e bans."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
					checked: logsMod.enabled,
					onCheckedChange: (v) => setEnabled("logs", v)
				})]
			})
		]
	});
}
//#endregion
export { SettingsPage as component };
