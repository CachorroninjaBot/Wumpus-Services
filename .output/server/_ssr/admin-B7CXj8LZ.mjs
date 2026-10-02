import { i as __toESM } from "../_runtime.mjs";
import { t as isPlatformOwner } from "./owner-GgaIkPvQ.mjs";
import { n as formatRelative } from "./utils-H16dNBFI.mjs";
import { o as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as BrandMark } from "./brand-9-bk6ia6.mjs";
import { t as Badge } from "./badge-C2mxnvvX.mjs";
import { t as Button } from "./button-BUiFN9VL.mjs";
import { t as Card } from "./card-DaYenTQt.mjs";
import { r as NativeSelect, t as Input } from "./input-Cyzc7r1j.mjs";
import { b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { m as useWumpus } from "./store-B26y7m0l.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-B7CXj8LZ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AdminPage() {
	const hydrate = useWumpus((s) => s.hydrate);
	const hydrated = useWumpus((s) => s.hydrated);
	const user = useWumpus((s) => s.sessionUser);
	const members = useWumpus((s) => s.dashboardMembers);
	const licenses = useWumpus((s) => s.licenses);
	const addMember = useWumpus((s) => s.addDashboardMember);
	const removeMember = useWumpus((s) => s.removeDashboardMember);
	const resetDemo = useWumpus((s) => s.resetDemo);
	const logs = useWumpus((s) => s.logs).slice(0, 8);
	const guilds = useWumpus((s) => s.guilds);
	const queue = useWumpus((s) => s.publishQueue);
	const processQueue = useWumpus((s) => s.processQueue);
	const pending = queue.filter((j) => j.status === "queued").length;
	const [queueNote, setQueueNote] = (0, import_react.useState)(null);
	const [newUser, setNewUser] = (0, import_react.useState)("");
	const [newRole, setNewRole] = (0, import_react.useState)("viewer");
	(0, import_react.useEffect)(() => {
		hydrate();
	}, [hydrate]);
	if (!hydrated) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid min-h-dvh place-items-center text-muted-foreground",
		children: "Carregando…"
	});
	if (!(Boolean(user.signedIn) && isPlatformOwner(user.id))) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
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
					children: "Esta área é exclusiva do dono da plataforma. Entre com a conta do Discord autorizada."
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-background text-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex h-14 items-center gap-3 border-b border-border px-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, { size: 28 }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Admin" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: "primary",
					children: "dono"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/app",
					className: "ml-auto text-sm text-muted-foreground hover:text-foreground",
					children: "Painel"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "text-sm text-muted-foreground hover:text-foreground",
					children: "Sair"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto grid max-w-5xl gap-4 p-4 sm:p-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-3 sm:grid-cols-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							className: "p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 text-xs text-muted-foreground",
									children: "Bot"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 mb-0 text-lg font-semibold",
									children: "Online"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 text-xs text-muted-foreground",
									children: "processo ativo · 6 servidores"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							className: "p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 text-xs text-muted-foreground",
									children: "Fila de publicação"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 mb-0 text-lg font-semibold",
									children: pending
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 text-xs text-muted-foreground",
									children: "painéis esperando sync"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
							className: "p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 text-xs text-muted-foreground",
									children: "Servidores seus"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 mb-0 text-lg font-semibold",
									children: guilds.length
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 text-xs text-muted-foreground",
									children: "com o Wumpus instalado"
								})
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-0 text-base font-semibold",
						children: "Membros da dashboard"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "m-0 space-y-2 p-0",
						children: members.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center gap-3 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex-1",
									children: [
										m.username,
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: m.role })
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted-foreground",
									children: formatRelative(m.addedAt)
								}),
								m.role !== "owner" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: "ghost",
									onClick: () => removeMember(m.id),
									children: "Remover"
								}) : null
							]
						}, m.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						className: "mt-4 flex flex-col gap-2 sm:flex-row",
						onSubmit: (e) => {
							e.preventDefault();
							if (!newUser.trim()) return;
							addMember(newUser.trim(), newRole);
							setNewUser("");
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: newUser,
								onChange: (e) => setNewUser(e.target.value),
								placeholder: "discord id ou user"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
								value: newRole,
								onChange: (e) => setNewRole(e.target.value),
								className: "sm:w-36",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "admin",
									children: "admin"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "viewer",
									children: "viewer"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "submit",
								children: "Adicionar"
							})
						]
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-0 mr-auto mb-0 text-base font-semibold",
							children: "Fila de publicação"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							onClick: () => {
								const n = processQueue();
								setQueueNote(n > 0 ? `${n} painel(is) publicado(s) nos canais.` : "Fila vazia.");
							},
							children: "Processar fila"
						})]
					}),
					queueNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted-foreground",
						children: queueNote
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "mt-3 m-0 space-y-2 p-0",
						children: [queue.slice(0, 8).map((j) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center gap-2 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex-1",
									children: [
										j.kind,
										" · ",
										j.detail
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: j.status === "queued" ? "warn" : "ok",
									children: j.status === "queued" ? "na fila" : "publicado"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted-foreground",
									children: formatRelative(j.at)
								})
							]
						}, j.id)), queue.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "text-sm text-muted-foreground",
							children: "Nenhum painel enfileirado."
						}) : null]
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-0 text-base font-semibold",
					children: "Licenças"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "m-0 space-y-2 p-0",
					children: [licenses.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex flex-wrap items-center gap-2 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "flex-1",
								children: l.guildName
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: "primary",
								children: l.plan
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-muted-foreground",
								children: [l.seats, " seats"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-muted-foreground",
								children: ["até ", l.expires]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: l.status === "active" ? "ok" : "warn",
								children: l.status
							})
						]
					}, l.id)), licenses.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "text-sm text-muted-foreground",
						children: "Nenhum servidor com o bot instalado."
					}) : null]
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-0 text-base font-semibold",
					children: "Eventos"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "m-0 space-y-2 p-0 text-sm",
					children: logs.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-muted-foreground",
						children: [l.actor, " · "]
					}), l.summary] }, l.id))
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "flex flex-col gap-3 sm:flex-row sm:items-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "m-0 font-medium",
							children: "Force resync"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "m-0 text-sm text-muted-foreground",
							children: "Restaura a demo ao estado inicial."
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "destructive",
						onClick: () => resetDemo(),
						children: "Restaurar demo"
					})]
				})
			]
		})]
	});
}
//#endregion
export { AdminPage as component };
