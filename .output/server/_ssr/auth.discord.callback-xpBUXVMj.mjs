import { i as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { x as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as getStoredSessionToken } from "./session-token-CaBlZnli.mjs";
import { at as resolveAccess, n as Route, ot as startSession } from "./router-DjtjaZqs.mjs";
import { t as buildWorkspace } from "./owner-workspace-BUL-zI7j.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auth.discord.callback-xpBUXVMj.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var KEY = "wumpus-demo-v2";
function CallbackPage() {
	const { code, state, error } = Route.useSearch();
	const navigate = useNavigate();
	const [msg, setMsg] = (0, import_react.useState)("Falando com o Discord…");
	(0, import_react.useEffect)(() => {
		if (error) {
			setMsg("Login cancelado no Discord.");
			return;
		}
		if (!state || !code) {
			setMsg("A validação do login expirou. Volte ao início e tente novamente.");
			return;
		}
		(async () => {
			const started = await startSession({ data: {
				code,
				state
			} });
			if (!started.ok) {
				setMsg(started.error);
				return;
			}
			setMsg("Verificando assinatura e servidores…");
			const access = await resolveAccess({ data: { token: getStoredSessionToken() } });
			if (!access.ok) {
				setMsg(access.error);
				return;
			}
			const slice = buildWorkspace({
				id: access.session.id,
				username: access.session.username,
				globalName: access.session.globalName,
				avatar: access.session.avatar
			}, access.guilds, access.entitlements);
			localStorage.setItem(KEY, JSON.stringify(slice));
			localStorage.removeItem("wumpus-demo-v1");
			navigate({ to: "/app" });
		})().catch((cause) => {
			console.error("Falha ao concluir o login do Discord.", cause);
			setMsg(cause instanceof Error ? `Não foi possível concluir o login: ${cause.message}` : "Não foi possível concluir o login. Volte ao início e tente novamente.");
		});
	}, [
		code,
		error,
		navigate,
		state
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "grid min-h-dvh place-items-center bg-muted-foreground",
		children: msg
	});
}
//#endregion
export { CallbackPage as component };
