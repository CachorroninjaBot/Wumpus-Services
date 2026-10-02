import { i as __toESM } from "../_runtime.mjs";
import { t as isPlatformOwner } from "./owner-GgaIkPvQ.mjs";
import { t as cn } from "./utils-H16dNBFI.mjs";
import { o as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as GuildBadge, t as BrandMark } from "./brand-9-bk6ia6.mjs";
import { t as Button } from "./button-BUiFN9VL.mjs";
import { t as Card } from "./card-DaYenTQt.mjs";
import { b as Link, g as Outlet, p as useRouterState } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as DialogOverlay, n as DialogClose, o as DialogPortal, r as DialogContent, t as Dialog } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { m as useWumpus } from "./store-B26y7m0l.mjs";
import { n as groupLabels, r as navItems, t as brand } from "./brand-C09g-ihP.mjs";
import { a as Sun, c as Moon, l as Menu, o as Shield, s as Plus, t as X, u as LogOut } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app-CSbqkT1H.js
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
function NavList({ onNavigate }) {
	const active = useActiveNav();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		className: "flex flex-col gap-4 pb-8",
		children: [
			"home",
			"attend",
			"protect",
			"team",
			"intel"
		].map((g) => {
			const items = navItems.filter((n) => n.group === g);
			if (!items.length) return null;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [g !== "home" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-1.5 px-3 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase",
				children: groupLabels[g]
			}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-col gap-0.5",
				children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: item.path,
					onClick: onNavigate,
					className: cn("flex min-h-11 items-center rounded-xl px-3 text-sm transition-colors duration-150", active === item.id ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"),
					children: item.label
				}, item.id))
			})] }, g);
		})
	});
}
function DashboardShell({ children }) {
	const hydrate = useWumpus((s) => s.hydrate);
	const hydrated = useWumpus((s) => s.hydrated);
	const guilds = useWumpus((s) => s.guilds);
	const activeId = useWumpus((s) => s.activeGuildId);
	const setActive = useWumpus((s) => s.setActiveGuild);
	const theme = useWumpus((s) => s.theme);
	const setTheme = useWumpus((s) => s.setTheme);
	const user = useWumpus((s) => s.sessionUser);
	const guild = guilds.find((g) => g.id === activeId) ?? guilds[0];
	const [open, setOpen] = (0, import_react.useState)(false);
	const active = useActiveNav();
	const isOwner = isPlatformOwner(user.id);
	(0, import_react.useEffect)(() => {
		hydrate();
	}, [hydrate]);
	const title = (0, import_react.useMemo)(() => navItems.find((n) => n.id === active)?.label ?? "Painel", [active]);
	if (!hydrated) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid min-h-dvh place-items-center bg-background text-muted-foreground",
		children: "Carregando o Wumpus…"
	});
	if (!user.signedIn) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid min-h-dvh place-items-center bg-background px-4 text-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "w-full max-w-md space-y-4 p-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "m-0 text-xl font-semibold",
					children: "Entre para continuar"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "O painel mostra os servidores onde o Wumpus está instalado e que você administra, com o plano que você assinou."
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/entrar",
					className: "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground",
					children: "Entrar com Discord"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "block text-center text-sm text-muted-foreground",
					children: "Ver os planos"
				})
			]
		})
	});
	if (!guilds.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid min-h-dvh place-items-center bg-background px-4 text-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "w-full max-w-md space-y-4 p-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "m-0 text-xl font-semibold",
					children: "Nenhum servidor disponível"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "O painel mostra apenas servidores onde o Wumpus está instalado e que você administra — e dentro do limite do seu plano."
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
					href: brand.invite,
					target: "_blank",
					rel: "noreferrer",
					className: "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground",
					children: "Adicionar o Wumpus a um servidor"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "block text-center text-sm text-muted-foreground",
					children: "Ver os planos"
				})
			]
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-dvh bg-background text-foreground",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "hidden w-[72px] shrink-0 flex-col items-center gap-3 border-r border-border py-4 lg:flex",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						"aria-label": "Wumpus",
						className: "grid place-items-center",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, { size: 40 })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px w-8 bg-border" }),
					guilds.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						title: g.name,
						onClick: () => setActive(g.id),
						className: "grid place-items-center",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuildBadge, {
							tag: g.tag,
							iconUrl: g.iconUrl,
							active: g.id === activeId
						})
					}, g.id)),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: brand.invite,
						target: "_blank",
						rel: "noreferrer",
						className: "mt-auto grid size-11 place-items-center rounded-[14px] border border-dashed border-border text-muted-foreground hover:text-foreground",
						title: "Adicionar a outro servidor",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "hidden w-60 shrink-0 flex-col border-r border-border bg-card/40 lg:flex",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
						className: "flex items-center gap-3 border-b border-border px-4 py-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuildBadge, {
							tag: guild?.tag ?? "W",
							iconUrl: guild?.iconUrl,
							size: 38
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "m-0 truncate text-sm font-semibold",
								children: guild?.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "m-0 truncate text-xs text-muted-foreground",
								children: [
									guild?.online,
									" online · plano ",
									guild?.plan
								]
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex-1 overflow-y-auto px-2 pt-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavList, {})
					}),
					isOwner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "border-t border-border p-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/admin",
							className: "flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "size-4" }), " Admin"]
						})
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 flex-1 flex-col",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex h-14 items-center gap-2 border-b border-border px-3 sm:px-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Sheet, {
							open,
							onOpenChange: setOpen,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "icon-sm",
								className: "lg:hidden",
								onClick: () => setOpen(true),
								"aria-label": "Menu",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
								side: "left",
								className: "flex flex-col gap-4 overflow-y-auto",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-6 flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, { size: 32 }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Wumpus" })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex gap-2",
										children: guilds.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setActive(g.id),
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GuildBadge, {
												tag: g.tag,
												iconUrl: g.iconUrl,
												size: 40,
												active: g.id === activeId
											})
										}, g.id))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavList, { onNavigate: () => setOpen(false) })
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "m-0 truncate text-sm font-semibold",
								children: title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "m-0 hidden truncate text-xs text-muted-foreground sm:block",
								children: navItems.find((n) => n.id === active)?.hint
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon-sm",
							"aria-label": "Alternar tema",
							onClick: () => setTheme(theme === "dark" ? "light" : "dark"),
							children: theme === "dark" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "hidden items-center gap-2 text-sm text-muted-foreground sm:flex",
							children: user.globalName
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/",
							className: "grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted",
							"aria-label": "Sair",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "size-4" })
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					className: "flex-1 overflow-x-hidden p-4 sm:p-6",
					children
				})]
			})
		]
	});
}
function AppLayout() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) });
}
//#endregion
export { AppLayout as component };
