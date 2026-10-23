import { i as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as createServerFn } from "./ssr.mjs";
import { o as getStoredSessionToken, r as SESSION_TOKEN_MAX_LENGTH } from "./session-token-CaBlZnli.mjs";
import { a as number, c as string, o as object, t as _enum } from "../_libs/zod.mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
import { a as UserRound, m as Shield, n as Wallet, nt as Activity, o as TriangleAlert, r as Users, x as RefreshCw, y as Search } from "../_libs/lucide-react.mjs";
import { $ as formatRelative, Z as useWumpus, _ as Button, g as Card, v as Badge } from "./router-DjtjaZqs.mjs";
import { t as BrandMark } from "./brand-E6aTdQpB.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-CHgtxskx.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var tokenSchema = object({ token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH) }).strict();
var resyncSchema = object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/)
}).strict();
var userActionSchema = object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	userId: string().regex(/^\d{17,20}$/),
	action: _enum([
		"suspend",
		"restore",
		"revoke-sessions",
		"save-notes"
	]),
	reason: string().trim().max(300).optional(),
	notes: string().max(2e3).optional()
}).strict();
var grantSchema = object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	userId: string().regex(/^\d{17,20}$/),
	username: string().trim().min(1).max(100),
	planId: _enum([
		"essencial",
		"pro",
		"escala"
	]),
	durationDays: number().int().min(1).max(3650),
	reason: string().trim().min(3).max(500)
}).strict();
var revokeGrantSchema = object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	grantId: string().uuid()
}).strict();
var getAdminOverview = createServerFn({ method: "POST" }).validator((input) => tokenSchema.parse(input)).handler(createSsrRpc("204c6d0dc498913bd12eb3699ddf923772258e293049e5fa66d53e02bee5510f"));
var grantAdminAccess = createServerFn({ method: "POST" }).validator((input) => grantSchema.parse(input)).handler(createSsrRpc("6e3b4cddbcf99ad6643c7d95b374042c0a891354d1914fe1511e5756ba2d9357"));
var revokeAdminGrant = createServerFn({ method: "POST" }).validator((input) => revokeGrantSchema.parse(input)).handler(createSsrRpc("782f207f17185c8a85a3eee61e959861cbd0af9c8d1f46f99261b97a2340a731"));
var manageAdminUser = createServerFn({ method: "POST" }).validator((input) => userActionSchema.parse(input)).handler(createSsrRpc("4253c6f610e625fb4ebed05a04c5eedcbc5074c7d3aea9bdf9a7de23a0e152e5"));
var forceGuildResync = createServerFn({ method: "POST" }).validator((input) => resyncSchema.parse(input)).handler(createSsrRpc("24de73364d1f308dec510650818dea2701f12eeeded6485f0ecfb911fff1b468"));
var tabs = [
	{
		id: "overview",
		label: "Visão geral",
		icon: Activity
	},
	{
		id: "users",
		label: "Usuários",
		icon: Users
	},
	{
		id: "subscriptions",
		label: "Assinaturas",
		icon: Wallet
	},
	{
		id: "security",
		label: "Segurança",
		icon: Shield
	}
];
function errorMessage(error) {
	return error instanceof Error ? error.message : "Não foi possível carregar a administração.";
}
function dateTime(value) {
	if (value == null || value === "") return "—";
	const date = new Date(typeof value === "number" ? value : value);
	return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR", {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(date);
}
function duration(start, end) {
	const minutes = Math.max(0, Math.floor((end - start) / 6e4));
	if (minutes < 1) return "menos de 1 min";
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const remaining = minutes % 60;
	return remaining ? `${hours} h ${remaining} min` : `${hours} h`;
}
function AdminPage() {
	const hydrate = useWumpus((s) => s.hydrate);
	const hydrated = useWumpus((s) => s.hydrated);
	const user = useWumpus((s) => s.sessionUser);
	const [overview, setOverview] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(null);
	const [notice, setNotice] = (0, import_react.useState)(null);
	const [tab, setTab] = (0, import_react.useState)("overview");
	const [search, setSearch] = (0, import_react.useState)("");
	const [selectedId, setSelectedId] = (0, import_react.useState)(null);
	const [notes, setNotes] = (0, import_react.useState)("");
	const [grantPlan, setGrantPlan] = (0, import_react.useState)("essencial");
	const [grantDays, setGrantDays] = (0, import_react.useState)("30");
	const [grantReason, setGrantReason] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		hydrate();
	}, [hydrate]);
	async function refresh() {
		setError(null);
		try {
			setOverview(await getAdminOverview({ data: { token: getStoredSessionToken() } }));
		} catch (cause) {
			setError(errorMessage(cause));
		}
	}
	(0, import_react.useEffect)(() => {
		if (hydrated && user.signedIn && user.isAdmin) refresh();
	}, [
		hydrated,
		user.isAdmin,
		user.signedIn
	]);
	const selectedMember = overview?.members.find((member) => member.id === selectedId) ?? null;
	(0, import_react.useEffect)(() => {
		setNotes(selectedMember?.notes ?? "");
	}, [selectedMember?.id, selectedMember?.notes]);
	const filteredMembers = (0, import_react.useMemo)(() => {
		const query = search.trim().toLowerCase();
		if (!query) return overview?.members ?? [];
		return (overview?.members ?? []).filter((member) => member.username.toLowerCase().includes(query) || member.id.includes(query));
	}, [overview?.members, search]);
	async function manage(member, action) {
		const label = action === "suspend" ? "suspend" : action === "restore" ? "restaurar" : action === "revoke-sessions" ? "encerrar as sessões de" : "atualizar os dados de";
		if (action !== "save-notes" && !window.confirm(`Deseja ${label} ${member.username}?`)) return;
		setBusy(`${action}:${member.id}`);
		setNotice(null);
		try {
			await manageAdminUser({ data: {
				token: getStoredSessionToken(),
				userId: member.id,
				action,
				...action === "save-notes" ? { notes } : {},
				...action === "suspend" ? { reason: "Acesso suspenso pelo administrador." } : {}
			} });
			setNotice(action === "suspend" ? "Conta suspensa e sessões encerradas." : action === "restore" ? "Acesso restaurado." : action === "revoke-sessions" ? "Sessões encerradas." : "Nota salva.");
			await refresh();
		} catch (cause) {
			setNotice(errorMessage(cause));
		} finally {
			setBusy(null);
		}
	}
	async function resync(guildId, guildName) {
		setBusy(guildId);
		setNotice(null);
		try {
			const result = await forceGuildResync({ data: {
				token: getStoredSessionToken(),
				guildId
			} });
			setNotice(`${result.queued.length} painel(is) enviados para republicação em ${guildName}.`);
			await refresh();
		} catch (cause) {
			setNotice(errorMessage(cause));
		} finally {
			setBusy(null);
		}
	}
	async function grantAccess(member) {
		setBusy(`grant:${member.id}`);
		setNotice(null);
		try {
			const result = await grantAdminAccess({ data: {
				token: getStoredSessionToken(),
				userId: member.id,
				username: member.username,
				planId: grantPlan,
				durationDays: Number(grantDays),
				reason: grantReason
			} });
			setNotice(`Acesso ${grantPlan} concedido até ${dateTime(result.expiresAt)}.`);
			setGrantReason("");
			await refresh();
		} catch (cause) {
			setNotice(errorMessage(cause));
		} finally {
			setBusy(null);
		}
	}
	async function revokeGrant(grantId) {
		if (!window.confirm("Revogar esta concessão manual agora?")) return;
		setBusy(`grant-revoke:${grantId}`);
		setNotice(null);
		try {
			await revokeAdminGrant({ data: {
				token: getStoredSessionToken(),
				grantId
			} });
			setNotice("Concessão manual revogada.");
			await refresh();
		} catch (cause) {
			setNotice(errorMessage(cause));
		} finally {
			setBusy(null);
		}
	}
	if (!hydrated) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid min-h-dvh place-items-center text-muted-foreground",
		children: "Carregando…"
	});
	if (!user.signedIn || !user.isAdmin) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "grid min-h-dvh place-items-center bg-background px-4 text-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "w-full max-w-sm space-y-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "m-0 text-xl font-semibold",
					children: "Área restrita"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "Entre com a conta Discord autorizada para acessar a administração da plataforma."
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/entrar",
					className: "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground",
					children: "Entrar com Discord"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "block text-center text-sm text-muted-foreground",
					children: "Voltar ao site"
				})
			]
		})
	});
	const activeSessions = overview?.sessions.filter((session) => !session.endedAt && !session.revokedAt && Date.now() - session.lastSeenAt < 12e4).length ?? 0;
	const activeSubscriptions = overview?.subscriptions.filter((sub) => [
		"active",
		"trialing",
		"paid",
		"authorized",
		"succeeded"
	].includes(sub.status.toLowerCase())).length ?? 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-background text-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex h-14 items-center gap-3 border-b border-border px-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, { size: 28 }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Administração" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: "primary",
					children: "somente dono"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/app",
					className: "ml-auto text-sm text-muted-foreground hover:text-foreground",
					children: "Painel"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "text-sm text-muted-foreground hover:text-foreground",
					children: "Site"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "mx-auto grid max-w-6xl gap-6 p-4 sm:p-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-end gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "m-0 text-2xl font-semibold tracking-tight",
							children: "Centro de administração"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mb-0 mt-2 text-sm text-muted-foreground",
							children: "Acessos, assinaturas e segurança da plataforma em um só lugar."
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						variant: "outline",
						onClick: () => void refresh(),
						disabled: busy === "refresh",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "mr-2 size-4" }), "Atualizar dados"]
					})]
				}),
				notice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					role: "status",
					className: "p-3 text-sm",
					children: notice
				}) : null,
				error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "border-destructive/40 bg-destructive/5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "m-0 text-lg font-semibold",
							children: "Acesso administrativo indisponível"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mb-0 mt-2 text-sm text-muted-foreground",
							children: error
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mb-0 mt-2 text-sm text-muted-foreground",
							children: "A administração exige login pela conta proprietária e autenticação de dois fatores ativa no Discord."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "mt-4",
							variant: "outline",
							onClick: () => void refresh(),
							children: "Tentar novamente"
						})
					]
				}) : null,
				!overview && !error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					role: "status",
					className: "text-sm text-muted-foreground",
					children: "Carregando dados administrativos…"
				}) : null,
				overview ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						"aria-label": "Seções administrativas",
						role: "tablist",
						className: "flex gap-1 overflow-x-auto border-b border-border",
						children: tabs.map(({ id, label, icon: Icon }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							id: `admin-tab-${id}`,
							type: "button",
							"aria-controls": `admin-panel-${id}`,
							"aria-selected": tab === id,
							role: "tab",
							onClick: () => setTab(id),
							className: `inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${tab === id ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" }), label]
						}, id))
					}),
					tab === "overview" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						id: "admin-panel-overview",
						"aria-labelledby": "admin-tab-overview",
						role: "tabpanel",
						className: "grid gap-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
										icon: UserRound,
										label: "Contas registradas",
										value: overview.members.length,
										detail: `${overview.members.filter((member) => member.suspended).length} suspensas`
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
										icon: Activity,
										label: "Sessões recentes",
										value: activeSessions,
										detail: "atividade nos últimos 2 minutos"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
										icon: Wallet,
										label: "Assinaturas ativas",
										value: activeSubscriptions,
										detail: overview.billingAvailable ? "dados atuais da ShardPay" : "ShardPay indisponível"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
										icon: Shield,
										label: "Bot Discord",
										value: overview.health.status === "online" ? "Online" : "Offline",
										detail: `${overview.health.guildCount} servidores · ${overview.health.pingMs ?? "—"} ms`
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-6 lg:grid-cols-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-start justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "m-0 text-base font-semibold",
										children: "Acessos recentes"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mb-0 mt-1 text-sm text-muted-foreground",
										children: "Últimas contas que entraram na dashboard."
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "ghost",
										onClick: () => setTab("users"),
										children: "Ver usuários"
									})]
								}), overview.sessions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "m-0 mt-4 divide-y divide-border p-0",
									children: overview.sessions.slice(0, 6).map((session) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "flex flex-wrap items-center gap-2 py-3 text-sm",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "min-w-0 flex-1 truncate font-medium",
												children: session.username
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-muted-foreground",
												children: formatRelative(session.startedAt)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
												tone: !session.endedAt && !session.revokedAt && Date.now() - session.lastSeenAt < 12e4 ? "ok" : "default",
												children: !session.endedAt && !session.revokedAt && Date.now() - session.lastSeenAt < 12e4 ? "Ativa" : "Encerrada"
											})
										]
									}, session.id))
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "Nenhum acesso registrado ainda." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "m-0 text-base font-semibold",
									children: "Atividade administrativa"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mb-0 mt-1 text-sm text-muted-foreground",
									children: "Ações feitas nesta área ficam registradas."
								})] }), overview.events.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "m-0 mt-4 divide-y divide-border p-0",
									children: overview.events.slice(0, 6).map((event) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "py-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 text-sm font-medium",
											children: event.summary
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "mb-0 mt-1 text-xs text-muted-foreground",
											children: [
												event.action,
												" · ",
												formatRelative(event.at),
												" · alvo ",
												event.targetId
											]
										})]
									}, event.id))
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "As ações administrativas aparecerão aqui." })] })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-start gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "m-0 text-base font-semibold",
										children: "Servidores do bot"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mb-0 mt-1 text-sm text-muted-foreground",
										children: "Republique os painéis quando uma configuração não chegar ao Discord."
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: overview.health.status === "online" ? "ok" : "warn",
									children: overview.health.status === "online" ? "Bot conectado" : "Bot sem heartbeat"
								})]
							}), overview.guilds.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "m-0 mt-3 divide-y divide-border p-0",
								children: overview.guilds.map((guild) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex flex-wrap items-center gap-3 py-3 text-sm",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "min-w-0 flex-1 font-medium",
											children: guild.name
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs text-muted-foreground",
											children: [guild.hasTicketsPanel && "Tickets", guild.hasFormsPanel && "Formulários"].filter(Boolean).join(" · ") || "sem painel"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											size: "sm",
											variant: "outline",
											disabled: busy === guild.id || !guild.hasTicketsPanel && !guild.hasFormsPanel,
											onClick: () => void resync(guild.id, guild.name),
											children: busy === guild.id ? "Enviando…" : "Republicar painéis"
										})
									]
								}, guild.id))
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "O bot não retornou servidores ativos." })] })
						]
					}) : null,
					tab === "users" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						id: "admin-panel-users",
						"aria-labelledby": "admin-tab-users",
						role: "tabpanel",
						className: "grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "m-0 text-base font-semibold",
										children: "Contas Discord"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mb-0 mt-1 text-sm text-muted-foreground",
										children: [overview.members.length, " contas · primeira e última atividade registradas."]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "relative w-full sm:w-64",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "sr-only",
											children: "Buscar por nome ou ID"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											value: search,
											onChange: (event) => setSearch(event.target.value),
											placeholder: "Nome ou ID Discord",
											className: "min-h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
										})
									]
								})]
							}), filteredMembers.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-4 overflow-x-auto",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
									className: "w-full min-w-[600px] text-left text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
										className: "text-xs text-muted-foreground",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "pb-2 font-medium",
												children: "Usuário"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "pb-2 font-medium",
												children: "Acessos"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "pb-2 font-medium",
												children: "Última atividade"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "pb-2 font-medium",
												children: "Estado"
											})
										] })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: filteredMembers.map((member) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
										onClick: () => setSelectedId(member.id),
										className: `cursor-pointer border-t border-border ${selectedId === member.id ? "bg-muted/60" : "hover:bg-muted/30"}`,
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
												className: "py-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "block font-medium",
													children: member.username
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
													className: "text-xs text-muted-foreground",
													children: member.id
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-3",
												children: member.loginCount
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-3 text-muted-foreground",
												children: formatRelative(member.lastSeenAt)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-3",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
													tone: member.suspended ? "warn" : "ok",
													children: member.suspended ? "Suspensa" : "Liberada"
												})
											})
										]
									}, member.id)) })]
								})
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "Nenhuma conta corresponde à busca." })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							className: "h-fit",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "m-0 text-base font-semibold",
								children: selectedMember?.username ?? "Detalhes da conta"
							}), selectedMember ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "mt-1 block text-xs text-muted-foreground",
									children: selectedMember.id
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
									className: "mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-sm",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
											className: "text-muted-foreground",
											children: "Primeiro acesso"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
											className: "m-0 text-right",
											children: dateTime(selectedMember.firstSeenAt)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
											className: "text-muted-foreground",
											children: "Última atividade"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
											className: "m-0 text-right",
											children: dateTime(selectedMember.lastSeenAt)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
											className: "text-muted-foreground",
											children: "Total de logins"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
											className: "m-0 text-right",
											children: selectedMember.loginCount
										})
									]
								}),
								selectedMember.suspensionReason ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-3 rounded-lg bg-warn/10 p-3 text-sm",
									children: selectedMember.suspensionReason
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "mt-4 block text-sm font-medium",
									children: ["Nota interna", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
										value: notes,
										onChange: (event) => setNotes(event.target.value),
										maxLength: 2e3,
										rows: 4,
										placeholder: "Contexto para futuras ações administrativas",
										className: "mt-2 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									className: "mt-2 w-full",
									variant: "outline",
									disabled: busy === `save-notes:${selectedMember.id}`,
									onClick: () => void manage(selectedMember, "save-notes"),
									children: busy === `save-notes:${selectedMember.id}` ? "Salvando…" : "Salvar nota"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-5 border-t border-border pt-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "m-0 text-sm font-semibold",
											children: "Conceder acesso temporário"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mb-0 mt-1 text-xs text-muted-foreground",
											children: "Acesso manual sem cobrança; expira automaticamente."
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "mt-3 block text-xs font-medium",
											children: ["Plano", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												value: grantPlan,
												onChange: (event) => setGrantPlan(event.target.value),
												className: "mt-1 min-h-10 w-full rounded-lg border border-input bg-background px-3 text-sm",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "essencial",
														children: "Essencial"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "pro",
														children: "Pro"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "escala",
														children: "Escala"
													})
												]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "mt-3 block text-xs font-medium",
											children: ["Duração em dias", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "number",
												min: 1,
												max: 3650,
												value: grantDays,
												onChange: (event) => setGrantDays(event.target.value),
												className: "mt-1 min-h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "mt-3 block text-xs font-medium",
											children: ["Motivo obrigatório", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												value: grantReason,
												onChange: (event) => setGrantReason(event.target.value),
												maxLength: 500,
												placeholder: "Ex.: cortesia aprovada",
												className: "mt-1 min-h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											className: "mt-3 w-full",
											disabled: Boolean(busy) || Number(grantDays) < 1 || Number(grantDays) > 3650 || grantReason.trim().length < 3,
											onClick: () => void grantAccess(selectedMember),
											children: busy === `grant:${selectedMember.id}` ? "Concedendo…" : "Conceder plano"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 grid gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: selectedMember.suspended ? "default" : "outline",
										disabled: Boolean(busy),
										onClick: () => void manage(selectedMember, selectedMember.suspended ? "restore" : "suspend"),
										children: selectedMember.suspended ? "Restaurar acesso" : "Suspender conta"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "outline",
										disabled: Boolean(busy),
										onClick: () => void manage(selectedMember, "revoke-sessions"),
										children: "Encerrar todas as sessões"
									})]
								})
							] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-0 mt-2 text-sm text-muted-foreground",
								children: "Selecione uma conta para ver os acessos, adicionar uma nota ou gerenciar o acesso."
							})]
						})]
					}) : null,
					tab === "subscriptions" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
						id: "admin-panel-subscriptions",
						"aria-labelledby": "admin-tab-subscriptions",
						role: "tabpanel",
						className: "grid gap-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-start gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "m-0 text-base font-semibold",
										children: "Assinaturas ShardPay"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mb-0 mt-1 text-sm text-muted-foreground",
										children: "Estado, plano, valor e período que o provedor informa."
									})]
								}), overview.billingStoreUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: overview.billingStoreUrl,
									target: "_blank",
									rel: "noreferrer",
									className: "text-sm font-medium text-primary underline underline-offset-4",
									children: "Abrir painel ShardPay"
								}) : null]
							}),
							!overview.billingAvailable ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								role: "status",
								className: "mt-4 rounded-lg bg-warn/10 p-3 text-sm",
								children: overview.billingError
							}) : null,
							overview.subscriptions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-4 overflow-x-auto",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
									className: "w-full min-w-[850px] text-left text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
										className: "text-xs text-muted-foreground",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "pb-2 font-medium",
												children: "Assinante"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "pb-2 font-medium",
												children: "Plano"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "pb-2 font-medium",
												children: "Estado"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "pb-2 font-medium",
												children: "Valor"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "pb-2 font-medium",
												children: "Início"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "pb-2 font-medium",
												children: "Fim / próxima cobrança"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "pb-2 font-medium",
												children: "Ação"
											})
										] })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: overview.subscriptions.map((sub) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
										className: "border-t border-border",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
												className: "py-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "block font-medium",
													children: sub.username
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
													className: "text-xs text-muted-foreground",
													children: sub.discordUserId ?? "ID não vinculado"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
												className: "py-3",
												children: [
													sub.productName,
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "block text-xs text-muted-foreground",
														children: sub.billingCycle || "ciclo não informado"
													}),
													sub.manual && sub.reason ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "block max-w-48 text-xs text-muted-foreground",
														children: sub.reason
													}) : null
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-3",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
													tone: [
														"active",
														"trialing",
														"paid",
														"authorized",
														"succeeded"
													].includes(sub.status.toLowerCase()) ? "ok" : "warn",
													children: sub.status
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-3",
												children: sub.manual ? "cortesia" : (sub.priceCents / 100).toLocaleString("pt-BR", {
													style: "currency",
													currency: "BRL"
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-3",
												children: dateTime(sub.startedAt)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-3",
												children: dateTime(sub.manual ? sub.periodEndsAt : sub.periodEndsAt ?? sub.nextBillingDate)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-3",
												children: sub.manual && sub.status === "active" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
													size: "sm",
													variant: "outline",
													disabled: Boolean(busy),
													onClick: () => void revokeGrant(sub.id),
													children: busy === `grant-revoke:${sub.id}` ? "Revogando…" : "Revogar"
												}) : sub.manual ? "—" : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
													href: overview.billingStoreUrl,
													target: "_blank",
													rel: "noreferrer",
													className: "text-xs font-medium text-primary underline underline-offset-4",
													children: "Gerenciar na ShardPay"
												})
											})
										]
									}, sub.id)) })]
								})
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "Nenhuma assinatura ou concessão foi registrada." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-0 mt-4 text-xs text-muted-foreground",
								children: "Alterações de cobrança e cancelamentos devem ser feitos no painel do provedor para manter o estado financeiro sincronizado."
							})
						] })
					}) : null,
					tab === "security" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						id: "admin-panel-security",
						"aria-labelledby": "admin-tab-security",
						role: "tabpanel",
						className: "grid gap-4 lg:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "m-0 text-base font-semibold",
									children: "Configuração segura"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mb-0 mt-1 text-sm text-muted-foreground",
									children: "Apenas o estado de configuração aparece aqui. Segredos e tokens nunca são exibidos."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "m-0 mt-4 space-y-3 p-0",
									children: [
										["Segredo de sessão (32+ caracteres)", overview.security.sessionSecretConfigured],
										["Chave privada ShardPay", overview.security.shardPayKeyConfigured],
										["Segredo OAuth Discord", overview.security.discordClientSecretConfigured],
										["ID do dono da plataforma", overview.security.ownerIdConfigured]
									].map(([label, configured]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "flex items-center gap-3 border-t border-border pt-3 text-sm",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "min-w-0 flex-1",
											children: label
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											tone: configured ? "ok" : "warn",
											children: configured ? "Configurado" : "Ausente"
										})]
									}, String(label)))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "mr-2 inline size-4" }), "Mantenha tokens no gerenciador de segredos do ambiente e faça rotação imediata se algum for exposto."]
								})
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "m-0 text-base font-semibold",
									children: "Sessões e logins"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mb-0 mt-1 text-sm text-muted-foreground",
									children: "Duração aproximada pela atividade da dashboard; sessões sem atividade recente são marcadas como encerradas."
								}),
								overview.sessions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "m-0 mt-4 max-h-[520px] divide-y divide-border overflow-auto p-0",
									children: overview.sessions.slice(0, 100).map((session) => {
										const recent = !session.endedAt && !session.revokedAt && Date.now() - session.lastSeenAt < 12e4;
										const end = session.endedAt ?? session.lastSeenAt;
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "py-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "min-w-0 flex-1 truncate text-sm font-medium",
													children: session.username
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
													tone: recent ? "ok" : session.revokedAt ? "warn" : "default",
													children: recent ? "Ativa" : session.revokedAt ? "Revogada" : "Inativa"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "mb-0 mt-1 text-xs text-muted-foreground",
												children: [
													"Entrou ",
													dateTime(session.startedAt),
													" · atividade ",
													formatRelative(session.lastSeenAt),
													" · ",
													duration(session.startedAt, end),
													" estimados"
												]
											})]
										}, session.id);
									})
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "Nenhuma sessão registrada." })
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
								className: "lg:col-span-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "m-0 text-base font-semibold",
									children: "Registro de ações"
								}), overview.events.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "m-0 mt-3 divide-y divide-border p-0",
									children: overview.events.slice(0, 100).map((event) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "flex flex-wrap gap-x-3 gap-y-1 py-3 text-sm",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "min-w-0 flex-1",
												children: event.summary
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
												className: "text-xs text-muted-foreground",
												children: [
													event.action,
													" · por ",
													event.actorId,
													" · alvo ",
													event.targetId
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
												className: "text-xs text-muted-foreground",
												children: dateTime(event.at)
											})
										]
									}, event.id))
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Empty, { children: "Nenhuma ação administrativa registrada." })]
							})
						]
					}) : null
				] }) : null
			]
		})]
	});
}
function Metric({ icon: Icon, label, value, detail }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs",
					children: label
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-0 mt-3 text-2xl font-semibold tabular-nums",
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-0 mt-1 text-xs text-muted-foreground",
				children: detail
			})
		]
	});
}
function Empty({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mb-0 mt-4 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground",
		children
	});
}
//#endregion
export { AdminPage as component };
