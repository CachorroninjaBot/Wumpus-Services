import { i as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { b as Link, g as Outlet, p as useRouterState } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as DialogOverlay, n as DialogClose, o as DialogPortal, r as DialogContent, t as Dialog } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { r as createServerFn } from "./ssr.mjs";
import { n as SESSION_TOKEN_KEY, o as getStoredSessionToken, r as SESSION_TOKEN_MAX_LENGTH } from "./session-token-CaBlZnli.mjs";
import { c as string, o as object } from "../_libs/zod.mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
import { C as Moon, D as MessageCircle, F as FileText, J as BookOpen, M as LayoutDashboard, O as Menu, S as Plus, V as ClipboardCheck, _ as Settings, d as Sun, f as Sparkles, g as ShieldAlert, j as LoaderCircle, k as LogOut, l as Ticket, m as Shield, q as ChartNoAxesColumn, r as Users, t as X, v as Send, w as Monitor } from "../_libs/lucide-react.mjs";
import { Q as cn, S as SearchSelect, Z as useWumpus, _ as Button, it as logoutDashboardSession, rt as getOwnerGuildDiagnostics } from "./router-DlyrBhH9.mjs";
import { n as GuildBadge, t as BrandMark } from "./brand-E6aTdQpB.mjs";
import { n as groupLabels, r as navItems, t as brand } from "./brand-DwQ5LAOF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app-Bmgoi5no.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Sheet = Dialog;
function SheetContent({ className, children, side = "left", ...props }) {
	const pos = side === "left" ? "inset-y-0 left-0 w-[min(20rem,90vw)] data-[state=open]:slide-in-from-left" : side === "right" ? "inset-y-0 right-0 w-[min(22rem,90vw)] data-[state=open]:slide-in-from-right" : "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl data-[state=open]:slide-in-from-bottom";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, { className: "fixed inset-0 z-50 bg-black/55 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
		className: cn("fixed z-50 bg-card p-4 text-card-foreground shadow-border outline-none data-[state=open]:animate-in", pos, className),
		...props,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogClose, {
			className: "absolute top-3 right-3 grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
		})]
	})] });
}
var askWumpusAssistant = createServerFn({ method: "POST" }).validator((input) => object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	page: string().trim().min(1).max(100),
	question: string().trim().min(1).max(2e3),
	context: string().max(7e3)
}).strict().parse(input)).handler(createSsrRpc("438f9a3eddb494a18f3b6a3fe5e9030fb10aaccb65bb641a0680cb4fe57a1f79"));
var moduleContext = {
	tickets: ["tickets"],
	forms: ["forms"],
	staff: ["staff", "tickets"],
	moderation: ["moderation"],
	protect: ["security", "automod"],
	knowledge: ["knowledge"],
	stats: ["statistics"],
	logs: ["logs"],
	settings: [
		"servers",
		"roles",
		"logs"
	],
	overview: [
		"tickets",
		"forms",
		"staff"
	]
};
function redact(value) {
	if (Array.isArray(value)) return value.map(redact);
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /secret|token|password|webhook|api.?key/i.test(key) ? "[oculto]" : redact(item)]));
}
function ModuleAssistant() {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const guild = useWumpus((state) => state.guilds.find((item) => item.id === state.activeGuildId));
	const guildId = useWumpus((state) => state.activeGuildId);
	const modules = useWumpus((state) => state.modules[guildId]);
	const page = navItems.find((item) => pathname === item.path || item.path !== "/app" && pathname.startsWith(`${item.path}/`)) ?? navItems[0];
	const [open, setOpen] = (0, import_react.useState)(false);
	const [question, setQuestion] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [messages, setMessages] = (0, import_react.useState)([]);
	const [error, setError] = (0, import_react.useState)("");
	const endRef = (0, import_react.useRef)(null);
	const inputRef = (0, import_react.useRef)(null);
	const context = (0, import_react.useMemo)(() => {
		const relevant = Object.fromEntries((moduleContext[page.id] ?? []).flatMap((key) => modules?.[key] ? [[key, redact(modules[key])]] : []));
		return `Seção: ${page.label}. ${page.hint}\nConfiguração ativa (JSON): ${JSON.stringify(relevant).slice(0, 5600) || "Ainda sem configuração publicada."}`;
	}, [modules, page]);
	(0, import_react.useEffect)(() => {
		setMessages([]);
		setError("");
	}, [pathname, guildId]);
	(0, import_react.useEffect)(() => {
		if (open) inputRef.current?.focus();
	}, [open]);
	(0, import_react.useEffect)(() => {
		endRef.current?.scrollIntoView({
			block: "end",
			behavior: "smooth"
		});
	}, [messages, busy]);
	const send = async (event) => {
		event.preventDefault();
		const text = question.trim();
		const token = getStoredSessionToken();
		if (!text || busy) return;
		if (!token || !guildId) {
			setError("Entre com Discord e selecione um servidor para pedir ajuda.");
			return;
		}
		setQuestion("");
		setError("");
		setMessages((items) => [...items, {
			role: "user",
			content: text
		}]);
		setBusy(true);
		try {
			const conversation = messages.slice(-8).map((message) => `${message.role === "user" ? "Pessoa" : "Wumpus"}: ${message.content}`).join("\n");
			const contextualHistory = conversation ? `\n\nConversa de ajuda anterior:\n${conversation}` : "";
			const answer = await askWumpusAssistant({ data: {
				token,
				guildId,
				page: page.label,
				question: text,
				context: `${context}${contextualHistory}`.slice(0, 7e3)
			} });
			setMessages((items) => [...items, {
				role: "assistant",
				content: answer.ok ? answer.text : answer.error
			}]);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Não foi possível enviar a pergunta.");
		} finally {
			setBusy(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-label": "Ajuda do Wumpus",
		className: "fixed bottom-[5.5rem] right-4 z-40 flex h-[min(70vh,36rem)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-[0_18px_60px_-18px_rgb(0_0_0/0.65)] sm:bottom-24 sm:right-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center gap-3 border-b border-border px-4 py-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "m-0 text-sm font-semibold",
							children: "Ajuda do Wumpus"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "m-0 truncate text-xs text-muted-foreground",
							children: [
								page.label,
								" · ",
								guild?.name ?? "seu servidor"
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setOpen(false),
						className: "grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
						"aria-label": "Fechar ajuda",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-h-0 flex-1 space-y-3 overflow-y-auto p-4",
				"aria-live": "polite",
				children: [
					!messages.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "m-0 text-sm leading-6",
							children: [
								"Posso explicar esta tela e ajudar com as configurações de ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: page.label.toLocaleLowerCase("pt-BR") }),
								". Já tenho o contexto do servidor e desta seção."
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap gap-2",
							children: [
								"O que devo configurar primeiro?",
								"Explique essas opções",
								"Como resolvo um problema aqui?"
							].map((suggestion) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setQuestion(suggestion),
								className: "rounded-xl border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
								children: suggestion
							}, suggestion))
						})]
					}) : messages.map((message, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2.5 text-sm leading-6 ${message.role === "user" ? "ml-auto rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground"}`,
						children: message.content
					}, `${index}-${message.role}`)),
					busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "m-0 flex items-center gap-2 text-sm text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }), "Entendendo o contexto…"]
					}) : null,
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						role: "alert",
						className: "m-0 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive",
						children: error
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { ref: endRef })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: (event) => void send(event),
				className: "border-t border-border p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-end gap-2 rounded-xl border border-input bg-background p-2 focus-within:ring-2 focus-within:ring-ring",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						ref: inputRef,
						value: question,
						onChange: (event) => setQuestion(event.target.value),
						onKeyDown: (event) => {
							if (event.key === "Enter" && !event.shiftKey) {
								event.preventDefault();
								event.currentTarget.form?.requestSubmit();
							}
						},
						rows: 2,
						maxLength: 2e3,
						"aria-label": "Sua pergunta",
						placeholder: "Descreva o que você quer fazer…",
						className: "max-h-28 min-h-10 min-w-0 flex-1 resize-y bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						size: "icon",
						"aria-label": "Enviar pergunta",
						disabled: !question.trim() || busy,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "size-4" })
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-0 mt-2 text-[11px] text-muted-foreground",
					children: "A IA orienta usando a seção e as configurações atuais. Ela não altera nada."
				})]
			})
		]
	}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: () => setOpen((value) => !value),
		"aria-expanded": open,
		"aria-label": open ? "Fechar ajuda do Wumpus" : "Pedir ajuda à IA",
		title: "Pedir ajuda à IA",
		className: "fixed bottom-4 right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_8px_28px_-10px_rgb(0_0_0/0.65)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:bottom-6 sm:right-6",
		children: [open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageCircle, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: open ? "Fechar" : "Ajuda com IA" })]
	})] });
}
var iconByNav = {
	overview: LayoutDashboard,
	tickets: Ticket,
	forms: ClipboardCheck,
	staff: Users,
	moderation: ShieldAlert,
	protect: Shield,
	knowledge: BookOpen,
	stats: ChartNoAxesColumn,
	logs: FileText,
	settings: Settings
};
function useActiveNav() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	if (pathname.startsWith("/app/tickets")) return "tickets";
	if (pathname.startsWith("/app/forms")) return "forms";
	if (pathname.startsWith("/app/staff")) return "staff";
	if (pathname.startsWith("/app/moderation")) return "moderation";
	if (pathname.startsWith("/app/protect")) return "protect";
	if (pathname.startsWith("/app/knowledge")) return "knowledge";
	if (pathname.startsWith("/app/stats")) return "stats";
	if (pathname.startsWith("/app/logs")) return "logs";
	if (pathname.startsWith("/app/settings")) return "settings";
	return "overview";
}
function GuildPicker({ onChange, compact = false, id }) {
	const guilds = useWumpus((s) => s.guilds);
	const activeId = useWumpus((s) => s.activeGuildId);
	const setActive = useWumpus((s) => s.setActiveGuild);
	const guild = guilds.find((item) => item.id === activeId) ?? guilds[0];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchSelect, {
		id: id ?? "guild-picker",
		value: guild?.id ?? "",
		eyebrow: compact ? "Servidor ativo" : "Servidor Discord",
		placeholder: "Selecione um servidor",
		onChange: (nextId) => {
			setActive(nextId);
			onChange?.();
		},
		className: compact ? "min-h-11 rounded-xl px-2.5" : "min-h-[58px] rounded-2xl px-3",
		options: guilds.map((item) => ({
			id: item.id,
			label: item.name,
			description: compact ? void 0 : `Plano ${item.plan}`,
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuildBadge, {
				tag: item.tag ?? "W",
				iconUrl: item.iconUrl,
				size: compact ? 26 : 34
			})
		}))
	});
}
function NavList({ onNavigate }) {
	const active = useActiveNav();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		"aria-label": "Navegação principal",
		className: "flex flex-col gap-6 pb-6",
		children: [
			"home",
			"attend",
			"protect",
			"team",
			"intel"
		].map((group) => {
			const items = navItems.filter((item) => item.group === group);
			if (!items.length) return null;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [group !== "home" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-2 px-3 text-[11px] font-semibold text-muted-foreground",
				children: groupLabels[group]
			}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-col gap-1",
				children: items.map((item) => {
					const Icon = iconByNav[item.id];
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: item.path,
						onClick: onNavigate,
						"aria-current": active === item.id ? "page" : void 0,
						className: cn("flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors", active === item.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
							"aria-hidden": "true",
							className: "size-[17px] shrink-0",
							strokeWidth: 1.8
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.label })]
					}, item.id);
				})
			})] }, group);
		})
	});
}
function DashboardShell({ children }) {
	const hydrate = useWumpus((s) => s.hydrate);
	const hydrated = useWumpus((s) => s.hydrated);
	const guilds = useWumpus((s) => s.guilds);
	const theme = useWumpus((s) => s.theme);
	const setTheme = useWumpus((s) => s.setTheme);
	const runtimeSyncStatus = useWumpus((s) => s.runtimeSyncStatus);
	const runtimeSyncError = useWumpus((s) => s.runtimeSyncError);
	const user = useWumpus((s) => s.sessionUser);
	const [menuOpen, setMenuOpen] = (0, import_react.useState)(false);
	const [diagnostics, setDiagnostics] = (0, import_react.useState)(null);
	const [diagnosticsLoading, setDiagnosticsLoading] = (0, import_react.useState)(false);
	const [diagnosticsError, setDiagnosticsError] = (0, import_react.useState)(null);
	const active = useActiveNav();
	const nextTheme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
	const isOwner = user.isAdmin;
	(0, import_react.useEffect)(() => {
		hydrate();
	}, [hydrate]);
	const title = (0, import_react.useMemo)(() => navItems.find((item) => item.id === active)?.label ?? "Painel", [active]);
	const hint = (0, import_react.useMemo)(() => navItems.find((item) => item.id === active)?.hint, [active]);
	const inspectGuildConnection = (0, import_react.useCallback)(async () => {
		setDiagnosticsLoading(true);
		setDiagnosticsError(null);
		try {
			setDiagnostics(await getOwnerGuildDiagnostics({ data: {} }));
		} catch (cause) {
			console.error("Não foi possível carregar o diagnóstico da conexão do Wumpus.", cause);
			setDiagnosticsError(cause instanceof Error ? cause.message : "Não foi possível consultar o diagnóstico.");
		} finally {
			setDiagnosticsLoading(false);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		if (hydrated && isOwner && guilds.length === 0) inspectGuildConnection();
	}, [
		guilds.length,
		hydrated,
		inspectGuildConnection,
		isOwner
	]);
	if (!hydrated) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid min-h-dvh place-items-center bg-background text-muted-foreground",
		children: "Carregando o Wumpus…"
	});
	if (!user.signedIn) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid min-h-dvh place-items-center bg-background px-4 text-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "w-full max-w-md rounded-2xl bg-card p-7 shadow-border",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, { size: 46 }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mb-2 mt-6 text-2xl font-semibold",
					children: "Entre para continuar"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-6 mt-0 text-sm leading-6 text-muted-foreground",
					children: "Configure o atendimento do seu servidor e acompanhe a equipe em um só lugar."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/entrar",
					className: "inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground",
					children: "Entrar com Discord"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "mt-4 block text-center text-sm text-muted-foreground hover:text-foreground",
					children: "Conhecer o Wumpus"
				})
			]
		})
	});
	if (!guilds.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid min-h-dvh place-items-center bg-background px-4 text-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "w-full max-w-lg rounded-2xl bg-card p-7 shadow-border",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, { size: 46 }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mb-2 mt-6 text-2xl font-semibold",
					children: "Vamos preparar seu servidor"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-6 mt-0 text-sm leading-6 text-muted-foreground",
					children: isOwner ? "Seu acesso de dono da plataforma está ativo. O Wumpus precisa estar online em um servidor que sua conta administra e enviar um heartbeat recente (até 90 segundos). Se ele já está online, confira se o bot e o painel compartilham o volume de saúde (WUMPUS_HEALTH_PATH); depois atualize a conexão com o Discord." : "Instale o Wumpus em um servidor que você administra e conecte seu plano para começar a configurar."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					href: brand.invite,
					target: "_blank",
					rel: "noreferrer",
					className: "inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground",
					children: "Adicionar o Wumpus ao Discord"
				}),
				isOwner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					href: "/entrar?reconectar=1",
					className: "mt-4 block text-center text-sm font-medium text-primary hover:underline",
					children: "Atualizar conexão com o Discord"
				}) : null,
				isOwner ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					"aria-labelledby": "connection-diagnostics-title",
					className: "mt-6 rounded-xl border border-border bg-muted/35 p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								id: "connection-diagnostics-title",
								className: "m-0 text-sm font-semibold",
								children: "Diagnóstico da conexão"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "outline",
								size: "sm",
								disabled: diagnosticsLoading,
								onClick: () => void inspectGuildConnection(),
								children: diagnosticsLoading ? "Verificando…" : diagnostics ? "Verificar novamente" : "Verificar conexão"
							})]
						}),
						diagnosticsLoading && !diagnostics ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							role: "status",
							className: "mb-0 mt-3 text-sm text-muted-foreground",
							children: "Consultando sessão Discord e heartbeat do bot…"
						}) : null,
						diagnosticsError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							role: "alert",
							className: "mb-0 mt-3 text-sm text-destructive",
							children: diagnosticsError
						}) : null,
						diagnostics ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
								className: "mb-0 mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-muted-foreground",
										children: "Servidores administráveis"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "m-0 text-right font-medium",
										children: diagnostics.manageableGuildCount
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-muted-foreground",
										children: "Arquivo de saúde"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "m-0 text-right font-medium",
										children: diagnostics.healthState === "available" ? "Encontrado e válido" : diagnostics.healthState === "missing" ? "Não encontrado" : diagnostics.healthState === "invalid" ? "Inválido" : "Sem permissão de leitura"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-muted-foreground",
										children: "Origem do caminho"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "m-0 text-right font-medium",
										children: diagnostics.healthPathSource === "configured" ? "WUMPUS_HEALTH_PATH" : "Padrão"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-muted-foreground",
										children: "Estado do bot"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "m-0 text-right font-medium",
										children: diagnostics.healthStatus === "online" ? "Online" : diagnostics.healthStatus === "offline" ? "Offline" : "Sem registro"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-muted-foreground",
										children: "Último heartbeat"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "m-0 text-right font-medium",
										children: diagnostics.healthAgeSeconds === null ? "Indisponível" : `há ${diagnostics.healthAgeSeconds}s`
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-muted-foreground",
										children: "Servidores do bot"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "m-0 text-right font-medium",
										children: diagnostics.healthGuildCount
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-muted-foreground",
										children: "Servidores em comum"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "m-0 text-right font-medium",
										children: diagnostics.matchingGuildCount
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mb-0 mt-4 break-all rounded-lg bg-background/70 px-3 py-2 text-xs text-muted-foreground",
								children: ["Arquivo lido pelo painel: ", diagnostics.healthPath]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mb-0 mt-2 text-xs text-muted-foreground",
								children: ["Identificador: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: diagnostics.issue })]
							}),
							diagnostics.errorCode ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mb-0 mt-2 text-xs text-destructive",
								children: ["Código técnico: ", diagnostics.errorCode]
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-0 mt-3 text-sm leading-6",
								children: diagnostics.recommendation
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mb-0 mt-2 text-xs text-muted-foreground",
								children: [
									"Consulta registrada nos logs do servidor em ",
									new Date(diagnostics.checkedAt).toLocaleTimeString("pt-BR"),
									"."
								]
							})
						] }) : null
					]
				}) : null,
				!isOwner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "mt-4 block text-center text-sm text-muted-foreground hover:text-foreground",
					children: "Ver planos e recursos"
				}) : null
			]
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "app-shell flex min-h-dvh bg-background text-foreground",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "app-sidebar hidden w-[17rem] shrink-0 flex-col border-r border-border bg-card lg:flex",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/",
						"aria-label": "Wumpus, início",
						className: "flex h-[4.5rem] items-center gap-3 border-b border-border px-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, { size: 34 }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[17px] font-bold tracking-[-0.03em]",
							children: "Wumpus"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-3 pb-4 pt-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuildPicker, { id: "guild-picker-sidebar" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "min-h-0 flex-1 overflow-y-auto px-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavList, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border-t border-border p-3",
						children: [isOwner ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/admin",
							className: "mb-2 flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "size-[17px]" }), " Administração Wumpus"]
						}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3 rounded-lg px-3 py-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground",
									children: user.globalName.slice(0, 1).toUpperCase()
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "m-0 truncate text-sm font-semibold",
										children: user.globalName
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "m-0 truncate text-xs text-muted-foreground",
										children: user.username
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: "/",
									"aria-label": "Sair",
									title: "Sair",
									onClick: (event) => {
										event.preventDefault();
										logoutDashboardSession({ data: {} }).catch(() => void 0).finally(() => {
											localStorage.removeItem(SESSION_TOKEN_KEY);
											localStorage.removeItem("wumpus-demo-v2");
											window.location.assign("/");
										});
									},
									className: "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "size-4" })
								})
							]
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 flex-1 flex-col",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
						className: "app-bar sticky top-0 z-20 flex min-h-[4.5rem] flex-wrap items-center gap-3 border-b border-border px-4 sm:px-7",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Sheet, {
								open: menuOpen,
								onOpenChange: setMenuOpen,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									size: "icon-sm",
									className: "lg:hidden",
									onClick: () => setMenuOpen(true),
									"aria-label": "Abrir navegação",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-4" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
									side: "left",
									className: "app-surface flex flex-col gap-0 overflow-y-auto border-0 bg-card p-0",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex h-[4.5rem] items-center gap-3 border-b border-border px-5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, { size: 34 }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
												className: "text-[17px]",
												children: "Wumpus"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "px-3 py-4",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuildPicker, {
												id: "guild-picker-menu",
												onChange: () => setMenuOpen(false)
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "px-3",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavList, { onNavigate: () => setMenuOpen(false) })
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
									className: "m-0 truncate text-lg font-semibold tracking-[-0.02em]",
									children: title
								}), hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 hidden truncate text-xs text-muted-foreground sm:block",
									children: hint
								}) : null]
							}),
							runtimeSyncStatus !== "idle" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: cn("hidden items-center gap-2 text-xs sm:flex", runtimeSyncStatus === "failed" ? "text-destructive" : "text-muted-foreground"),
								role: "status",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-2 rounded-full", runtimeSyncStatus === "failed" ? "bg-destructive" : runtimeSyncStatus === "syncing" ? "animate-pulse bg-warn" : "bg-ok") }), runtimeSyncStatus === "syncing" ? "Salvando configuração" : runtimeSyncStatus === "failed" ? "Falha ao sincronizar" : "Configuração atualizada"]
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "icon-sm",
								"aria-label": `Tema atual ${theme}; mudar para ${nextTheme}`,
								title: `Tema ${theme}`,
								onClick: () => setTheme(nextTheme),
								children: theme === "dark" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "size-4" }) : theme === "light" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Monitor, { className: "size-4" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: brand.invite,
								target: "_blank",
								rel: "noreferrer",
								className: "hidden min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted sm:inline-flex",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Adicionar a outro servidor"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "order-last w-full pb-3 lg:hidden",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuildPicker, {
									id: "guild-picker-mobile-header",
									compact: true
								})
							})
						]
					}),
					runtimeSyncError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						role: "alert",
						className: "mx-4 mb-0 mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive sm:mx-7",
						children: runtimeSyncError
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
						className: "app-page w-full flex-1 px-4 py-6 sm:px-7 sm:py-8",
						children
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModuleAssistant, {})
		]
	});
}
function AppLayout() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) });
}
//#endregion
export { AppLayout as component };
