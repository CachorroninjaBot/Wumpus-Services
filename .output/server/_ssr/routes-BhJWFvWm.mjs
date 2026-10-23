import { i as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as createServerFn } from "./ssr.mjs";
import { f as plans, i as SHARD_STORE } from "./session-token-CaBlZnli.mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
import { $ as ArrowRight, K as Check } from "../_libs/lucide-react.mjs";
import { $ as formatRelative, _ as Button } from "./router-DjtjaZqs.mjs";
import { t as BrandMark } from "./brand-E6aTdQpB.mjs";
import { t as brand } from "./brand-DwQ5LAOF.mjs";
import { n as DiscordModalPreview, r as DiscordPanel } from "./discord-panel-B_4DZK8m.mjs";
import { t as useBilling } from "./use-billing-DZGU8iJ8.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BhJWFvWm.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var getPublicBotHealth = createServerFn({ method: "GET" }).handler(createSsrRpc("a3cf4b1c0e81389dd1f5eee5a0b6f2b16d615eb7afdaa62f92c4fb55b3e5a056"));
var faqs = [
	{
		q: "O bot realmente lê o que eu configuro?",
		a: "As configurações publicadas passam por validação no servidor antes de chegar ao bot. Os recursos divulgados aqui correspondem aos fluxos integrados; campos sem integração não são anunciados como concluídos."
	},
	{
		q: "A IA fala com o cliente?",
		a: "Não. A IA só sugere para a equipe — análise de ticket e pré-review de candidatura. Nada é enviado sozinho no canal."
	},
	{
		q: "Preciso decorar comandos?",
		a: "Não. Os painéis publicados no Discord abrem tickets e formulários. A equipe acompanha os tickets reais na dashboard, enquanto o bot mantém as ações sincronizadas com os canais do servidor."
	},
	{
		q: "Como eu entro no MEU painel?",
		a: "Botão Entrar com Discord. OAuth com identify + guilds. Só servidores que tu administra aparecem."
	}
];
function Home() {
	const billing = useBilling();
	const [health, setHealth] = (0, import_react.useState)(null);
	const [healthError, setHealthError] = (0, import_react.useState)(false);
	const plans$1 = billing.data?.plans?.length ? billing.data.plans : plans;
	const discounts = billing.data?.discounts ?? [
		{
			label: "trimestral",
			discount: 5
		},
		{
			label: "semestral",
			discount: 10
		},
		{
			label: "anual",
			discount: 18
		}
	];
	(0, import_react.useEffect)(() => {
		let active = true;
		const refresh = () => {
			getPublicBotHealth().then((result) => {
				if (active) {
					setHealth(result);
					setHealthError(false);
				}
			}).catch(() => {
				if (active) setHealthError(true);
			});
		};
		refresh();
		const timer = window.setInterval(refresh, 3e4);
		return () => {
			active = false;
			window.clearInterval(timer);
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-background text-foreground",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: "sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-md",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex h-14 max-w-6xl items-center gap-3 px-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, { size: 28 }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-semibold tracking-tight",
							children: "Wumpus"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
							className: "ml-auto hidden items-center gap-6 text-sm text-muted-foreground sm:flex",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: "#modulos",
									className: "hover:text-foreground",
									children: "Módulos"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: "#planos",
									className: "hover:text-foreground",
									children: "Planos"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: "#faq",
									className: "hover:text-foreground",
									children: "FAQ"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/entrar",
							className: "ml-auto sm:ml-4",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								children: "Entrar com Discord"
							})
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "relative overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "noise pointer-events-none absolute inset-0 opacity-60" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "m-0 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase",
							children: "Discord · atendimento · proteção"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-3 mb-4 max-w-xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl",
							children: brand.tagline
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "m-0 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg",
							children: brand.description
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-7 flex flex-col gap-3 sm:flex-row",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/entrar",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "lg",
									className: "w-full sm:w-auto",
									children: ["Entrar com Discord", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" })]
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
								href: brand.invite,
								target: "_blank",
								rel: "noreferrer",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									size: "lg",
									className: "w-full sm:w-auto",
									children: "Adicionar ao Discord"
								})
							})]
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordPanel, {
						title: "Central de atendimento",
						description: "Escolha o departamento. Um canal privado é criado só para você e a equipe.",
						buttons: [
							"Compras",
							"Suporte",
							"Reembolso"
						]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				id: "modulos",
				className: "border-t border-border",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto max-w-6xl px-4 py-16",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "m-0 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase",
							children: "O que o Wumpus fecha"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-2 mb-8 max-w-xl text-3xl font-semibold tracking-tight",
							children: "Painel por resultado. Avançado fica escondido."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-x-8 lg:grid-cols-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Feature, {
									title: "Tickets de verdade",
									body: "Departamentos, SLA, prioridade, transcrição no encerramento, feedback e métricas por atendente.",
									preview: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordPanel, {
										channel: "abrir-atendimento",
										title: "Central de atendimento",
										description: "Escolha um departamento para falar com a equipe.",
										buttons: [
											"Suporte",
											"Compras",
											"Denúncias"
										]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Feature, {
									title: "Candidaturas com modal",
									body: "Formulário no Discord, cooldown e aprovação ou recusa com um motivo visível.",
									preview: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordModalPreview, {
										title: "Candidatura à equipe",
										questions: [
											"Nome ou apelido",
											"Por que quer entrar?",
											"Experiência relevante"
										]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Feature, {
									title: "Moderação com histórico",
									body: "Advertências, silenciamento, expulsão e banimento registrados para a equipe.",
									preview: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordPanel, {
										channel: "moderação",
										title: "Ação registrada",
										description: "O histórico acompanha o motivo, a evidência e as medidas anteriores.",
										buttons: [
											"Advertir",
											"Silenciar",
											"Revisar caso"
										]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Feature, {
									title: "Proteção configurável",
									body: "AutoMod e resposta a raids com níveis graduais; sem tomar ações destrutivas sem autorização.",
									preview: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordPanel, {
										channel: "segurança",
										title: "Proteção da comunidade",
										description: "Revise alertas e escolha a resposta adequada para o seu servidor.",
										buttons: ["Ver alertas", "Lockdown"]
									})
								})
							]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				id: "planos",
				className: "border-t border-border",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto max-w-6xl px-4 py-16",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-0 mb-2 text-3xl font-semibold tracking-tight",
							children: "WumPlus, cobrado na ShardPay"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mb-8 max-w-2xl text-sm text-muted-foreground",
							children: [
								"Loja ",
								billing.data?.storeName ?? SHARD_STORE.name,
								". Nos planos mensais,",
								" ",
								discounts.map((d) => `${d.label} −${d.discount}%`).join(", "),
								"."
							]
						}),
						billing.data && !billing.data.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							role: "status",
							className: "mb-5 text-sm text-warn",
							children: "A ShardPay está indisponível. Estes valores são a referência salva; confirme o preço atual no checkout."
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid gap-4 md:grid-cols-2",
							children: plans$1.map((plan) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
								className: `rounded-2xl p-5 shadow-border ${plan.highlight ? "bg-card ring-1 ring-primary/40" : "bg-card/60"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "m-0 text-sm text-muted-foreground",
										children: plan.name
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 mb-2 text-2xl font-semibold",
										children: plan.price
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-0 text-sm text-muted-foreground",
										children: plan.blurb
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
										className: "mt-4 space-y-2 text-sm",
										children: plan.features.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "flex gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "mt-0.5 size-4 shrink-0 text-ok" }), f]
										}, f))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-5 flex flex-col gap-2",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
											href: plan.checkoutUrl,
											target: "_blank",
											rel: "noreferrer",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												variant: plan.highlight ? "default" : "outline",
												className: "w-full",
												children: "Assinar na ShardPay"
											})
										})
									})
								]
							}, plan.id))
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				"aria-labelledby": "bot-status-title",
				className: "border-t border-border",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `size-2.5 shrink-0 rounded-full ${health?.status === "online" ? "bg-ok" : health?.status === "offline" ? "bg-destructive" : "bg-muted-foreground"}` }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								id: "bot-status-title",
								className: "m-0 text-base font-semibold",
								children: "Status do Wumpus"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "m-0 text-sm text-muted-foreground",
								children: healthError ? "Não foi possível consultar o monitor de saúde." : health?.status === "online" ? `Online · ${health.guildCount ?? "—"} servidores conectados · atualizado ${health.lastSeenAt ? formatRelative(health.lastSeenAt) : "agora"}` : health?.status === "offline" ? `Sem heartbeat recente${health.lastSeenAt ? ` · visto ${formatRelative(health.lastSeenAt)}` : ""}` : "Status ainda não disponível."
							})]
						}),
						health?.pingMs !== null && health?.pingMs !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-sm text-muted-foreground",
							children: [
								"latência ",
								health.pingMs,
								" ms"
							]
						}) : null
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				id: "faq",
				className: "border-t border-border",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto max-w-3xl px-4 py-16",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-0 mb-6 text-3xl font-semibold tracking-tight",
						children: "Perguntas diretas"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "divide-y divide-border rounded-2xl bg-card shadow-border",
						children: faqs.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
							className: "group px-5 py-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
								className: "cursor-pointer list-none text-sm font-medium [&::-webkit-details-marker]:hidden",
								children: item.q
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 mb-1 text-sm text-muted-foreground",
								children: item.a
							})]
						}, item.q))
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "border-t border-border",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						brand.name,
						" · ",
						brand.legal
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/entrar",
						className: "sm:ml-auto text-foreground",
						children: "Entrar com Discord"
					})]
				})
			})
		]
	});
}
function Feature({ title, body, preview }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "grid min-w-0 gap-4 border-t border-border py-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
			className: "mt-0 mb-2 text-lg font-semibold",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "m-0 max-w-[42ch] text-sm leading-relaxed text-muted-foreground",
			children: body
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "min-w-0 overflow-hidden rounded-xl",
			children: preview
		})]
	});
}
//#endregion
export { Home as component };
