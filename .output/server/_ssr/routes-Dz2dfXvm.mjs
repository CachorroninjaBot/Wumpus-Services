import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as BrandMark } from "./brand-9-bk6ia6.mjs";
import { t as Button } from "./button-BUiFN9VL.mjs";
import { b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as SHARD_STORE, s as plans } from "./catalog-Bwk5qXYL.mjs";
import { t as brand } from "./brand-C09g-ihP.mjs";
import { d as Cpu, h as ArrowRight, i as Ticket, m as Check, o as Shield, p as ClipboardList } from "../_libs/lucide-react.mjs";
import { n as DiscordPanel } from "./discord-panel-BH_80gju.mjs";
import { t as useBilling } from "./use-billing-CbM63Gq5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-Dz2dfXvm.js
var import_jsx_runtime = require_jsx_runtime();
var faqs = [
	{
		q: "O bot realmente lê o que eu configuro?",
		a: "Sim. Cada campo do painel entra no contrato do bot: SLA, cargos, termos bloqueados, perguntas do modal. Se não for usado, não aparece."
	},
	{
		q: "A IA fala com o cliente?",
		a: "Não. A IA só sugere para a equipe — análise de ticket e pré-review de candidatura. Nada é enviado sozinho no canal."
	},
	{
		q: "Preciso decorar comandos?",
		a: "Não. Painéis no Discord abrem ticket e formulário. A equipe trabalha daqui: assumir, encerrar, advertir, aprovar."
	},
	{
		q: "Como eu entro no MEU painel?",
		a: "Botão Entrar com Discord. OAuth com identify + guilds. Só servidores que tu administra aparecem."
	}
];
function Home() {
	const billing = useBilling();
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
							className: "grid gap-4 sm:grid-cols-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Feature, {
									icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ticket, { className: "size-5" }),
									title: "Tickets de verdade",
									body: "Departamentos, SLA, prioridade, tags, transcrição no encerramento, feedback com comentário e métrica por staff."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Feature, {
									icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClipboardList, { className: "size-5" }),
									title: "Candidaturas com modal",
									body: "Perguntas configuráveis, cooldown, idade mínima da conta, aprovar ou recusar com motivo."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Feature, {
									icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "size-5" }),
									title: "Moderação com entrada",
									body: "Advertir, silenciar, expulsar, banir. Strikes acumulam e o bot escala no limiar que você definiu."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Feature, {
									icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, { className: "size-5" }),
									title: "Presets, não 40 knobs",
									body: "Comunidade, loja ou RP. Um pacote coerente de AutoMod e anti-raid."
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
function Feature({ icon, title, body }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "rounded-2xl bg-card p-5 shadow-border",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid size-10 place-items-center rounded-xl bg-muted text-foreground",
				children: icon
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "mt-4 mb-1 text-lg font-semibold",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "m-0 text-sm leading-relaxed text-muted-foreground",
				children: body
			})
		]
	});
}
//#endregion
export { Home as component };
