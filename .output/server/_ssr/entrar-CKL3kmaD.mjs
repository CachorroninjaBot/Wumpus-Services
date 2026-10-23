import { i as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { b as Link, x as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as getStoredSessionToken } from "./session-token-CaBlZnli.mjs";
import { _ as Button, at as resolveAccess, g as Card, x as Route$11 } from "./router-DlyrBhH9.mjs";
import { t as BrandMark } from "./brand-E6aTdQpB.mjs";
import { t as buildWorkspace } from "./owner-workspace-BUL-zI7j.mjs";
import { n as getDiscordLoginUrl } from "./oauth-r8HMGInj.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/entrar-CKL3kmaD.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var KEY = "wumpus-demo-v2";
function EntrarPage() {
	const { reconectar } = Route$11.useSearch();
	const navigate = useNavigate();
	const [error, setError] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [checkingSession, setCheckingSession] = (0, import_react.useState)(!reconectar);
	const [sessionExpired, setSessionExpired] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setSessionExpired(new URLSearchParams(window.location.search).get("motivo") === "sessao-expirada");
		if (reconectar) {
			setCheckingSession(false);
			return;
		}
		let cancelled = false;
		resolveAccess({ data: { token: getStoredSessionToken() } }).then((access) => {
			if (cancelled) return;
			if (!access.ok) {
				setCheckingSession(false);
				return;
			}
			const workspace = buildWorkspace({
				id: access.session.id,
				username: access.session.username,
				globalName: access.session.globalName,
				avatar: access.session.avatar
			}, access.guilds, access.entitlements);
			localStorage.setItem(KEY, JSON.stringify(workspace));
			localStorage.removeItem("wumpus-demo-v1");
			navigate({ to: "/app" });
		}).catch((cause) => {
			console.error("Não foi possível restaurar a sessão existente.", cause);
			if (!cancelled) setCheckingSession(false);
		});
		return () => {
			cancelled = true;
		};
	}, [navigate, reconectar]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "grid min-h-dvh place-items-center bg-background px-4 text-foreground",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "w-full max-w-sm space-y-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "m-0 text-xl font-semibold",
					children: "Entrar no painel"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "Login oficial com a tua conta Discord. Só servidores que tu administra aparecem."
				})] }),
				checkingSession ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					role: "status",
					className: "m-0 text-sm text-muted-foreground",
					children: "Verificando sua sessão…"
				}) : null,
				sessionExpired ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					role: "status",
					className: "m-0 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground",
					children: "Sua sessão encerrou após um período sem atividade. Entre novamente para continuar."
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "w-full",
					disabled: busy || checkingSession,
					onClick: () => {
						setBusy(true);
						getDiscordLoginUrl().then((res) => {
							if (!res.ok) {
								setError(res.error);
								setBusy(false);
								return;
							}
							sessionStorage.setItem("wumpus-discord-oauth-state", res.state);
							window.location.href = res.url;
						});
					},
					children: "Entrar com Discord"
				}),
				error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 text-sm text-destructive",
					children: error
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "text-sm text-muted-foreground",
					children: "Voltar"
				})
			]
		})
	});
}
//#endregion
export { EntrarPage as component };
