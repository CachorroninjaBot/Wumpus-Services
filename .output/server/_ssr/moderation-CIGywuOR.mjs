import { i as __toESM } from "../_runtime.mjs";
import { n as formatRelative } from "./utils-H16dNBFI.mjs";
import { o as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { r as MemberAvatar } from "./brand-9-bk6ia6.mjs";
import { t as Badge } from "./badge-C2mxnvvX.mjs";
import { t as Button } from "./button-BUiFN9VL.mjs";
import { t as Card } from "./card-DaYenTQt.mjs";
import { i as Textarea, n as Label, t as Input } from "./input-Cyzc7r1j.mjs";
import { a as nextModerationAction, f as useGuildMembers, m as useWumpus, p as useModule, r as effectiveStrikes } from "./store-B26y7m0l.mjs";
import { t as Switch } from "./switch-C8XyncjG.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/moderation-CIGywuOR.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var actions = [
	{
		id: "warn",
		label: "Advertir"
	},
	{
		id: "timeout",
		label: "Silenciar"
	},
	{
		id: "kick",
		label: "Expulsar"
	},
	{
		id: "ban",
		label: "Banir"
	},
	{
		id: "pardon",
		label: "Perdoar"
	}
];
function ModerationPage() {
	const gid = useWumpus((s) => s.activeGuildId);
	const members = useGuildMembers();
	const cases = useWumpus((s) => s.cases).filter((c) => c.guildId === gid);
	const mcfg = useModule("moderation");
	const punish = useWumpus((s) => s.punish);
	const user = useWumpus((s) => s.sessionUser);
	const updateConfig = useWumpus((s) => s.updateConfig);
	const setEnabled = useWumpus((s) => s.setModuleEnabled);
	const [q, setQ] = (0, import_react.useState)("");
	const [targetId, setTargetId] = (0, import_react.useState)(members.find((m) => m.strikes > 0)?.id ?? members[0]?.id ?? "");
	const [action, setAction] = (0, import_react.useState)("warn");
	const [reason, setReason] = (0, import_react.useState)("");
	const [evidence, setEvidence] = (0, import_react.useState)("");
	const [note, setNote] = (0, import_react.useState)(null);
	const filtered = (0, import_react.useMemo)(() => {
		const s = q.trim().toLowerCase();
		return members.filter((m) => !s || m.displayName.toLowerCase().includes(s) || m.username.includes(s));
	}, [members, q]);
	const target = members.find((m) => m.id === targetId);
	const liveStrikes = target ? effectiveStrikes(target.strikes, cases, target.id, Number(mcfg.config.strikeExpiryDays ?? 0)) : 0;
	const preview = target ? nextModerationAction(liveStrikes, mcfg.config) : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_320px]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "m-0 text-xl font-semibold tracking-tight",
					children: "Moderação"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-end gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-40 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Buscar membro" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							className: "mt-1",
							value: q,
							onChange: (e) => setQ(e.target.value),
							placeholder: "nome"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Módulo ligado" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							checked: mcfg.enabled,
							onCheckedChange: (v) => setEnabled("moderation", v)
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-4 m-0 max-h-64 space-y-1 overflow-y-auto p-0",
					children: filtered.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setTargetId(m.id),
						className: `flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left ${targetId === m.id ? "bg-muted" : "hover:bg-muted/50"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemberAvatar, {
								name: m.displayName,
								hue: m.hue,
								size: 32
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-sm font-medium",
									children: m.displayName
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-xs text-muted-foreground",
									children: ["@", m.username]
								})]
							}),
							m.banned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: "danger",
								children: "ban"
							}) : null,
							m.timedOutUntil && m.timedOutUntil > Date.now() ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: "warn",
								children: "timeout"
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, { children: [m.strikes, " strikes"] })
						]
					}) }, m.id))
				})] }),
				target ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: "mt-0 text-base font-semibold",
						children: ["Ação em ", target.displayName]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted-foreground",
						children: [
							liveStrikes,
							" advertências na janela. Próximo passo se advertir: ",
							preview?.action,
							" — ",
							preview?.note
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: actions.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setAction(a.id),
							className: `h-9 rounded-full px-3 text-sm ${action === a.id ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`,
							children: a.label
						}, a.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 space-y-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Motivo" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								className: "mt-1",
								value: reason,
								onChange: (e) => setReason(e.target.value)
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Evidência" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
								value: evidence,
								onChange: (e) => setEvidence(e.target.value)
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								onClick: () => {
									const r = punish({
										targetId: target.id,
										actorId: user.id,
										action,
										reason,
										evidence,
										durationMinutes: action === "timeout" ? Number(mcfg.config.defaultTimeoutMinutes ?? 60) : void 0
									});
									setNote(r.ok ? r.note : r.error);
									if (r.ok) {
										setReason("");
										setEvidence("");
									}
								},
								children: "Aplicar"
							}),
							note ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "m-0 text-sm text-muted-foreground",
								children: note
							}) : null
						]
					})
				] }) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-0 mb-3 text-base font-semibold",
					children: "Histórico"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "m-0 space-y-2 p-0",
					children: cases.slice(0, 12).map((c) => {
						const t = members.find((m) => m.id === c.targetId);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex justify-between gap-3 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: c.action
								}),
								" · ",
								t?.displayName,
								" — ",
								c.reason
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "shrink-0 text-muted-foreground",
								children: formatRelative(c.createdAt)
							})]
						}, c.id);
					})
				})] })
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "h-fit space-y-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-0 text-base font-semibold",
					children: "Regras"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Timeout padrão (min)",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "number",
						defaultValue: Number(mcfg.config.defaultTimeoutMinutes ?? 60),
						onBlur: (e) => updateConfig("moderation", { defaultTimeoutMinutes: Number(e.target.value) || 1 })
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Advertências até timeout",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "number",
						defaultValue: Number(mcfg.config.escalateAfterStrikes ?? 3),
						onBlur: (e) => updateConfig("moderation", { escalateAfterStrikes: Number(e.target.value) || 1 })
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Advertências até ban",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "number",
						defaultValue: Number(mcfg.config.maxStrikesBeforeBan ?? 5),
						onBlur: (e) => updateConfig("moderation", { maxStrikesBeforeBan: Number(e.target.value) || 1 })
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "Advertências expiram em (dias, 0 = nunca)",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "number",
						defaultValue: Number(mcfg.config.strikeExpiryDays ?? 30),
						onBlur: (e) => updateConfig("moderation", { strikeExpiryDays: Number(e.target.value) || 0 })
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Exigir evidência" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
						checked: Boolean(mcfg.config.requireEvidence),
						onCheckedChange: (v) => updateConfig("moderation", { requireEvidence: v })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Permitir perdão" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
						checked: Boolean(mcfg.config.pardonsEnabled),
						onCheckedChange: (v) => updateConfig("moderation", { pardonsEnabled: v })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Avisar em privado" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
						checked: Boolean(mcfg.config.dmOnPunish),
						onCheckedChange: (v) => updateConfig("moderation", { dmOnPunish: v })
					})]
				})
			]
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
export { ModerationPage as component };
