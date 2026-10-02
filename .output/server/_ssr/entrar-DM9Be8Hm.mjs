import { i as __toESM } from "../_runtime.mjs";
import { o as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as BrandMark } from "./brand-9-bk6ia6.mjs";
import { t as Button } from "./button-BUiFN9VL.mjs";
import { t as Card } from "./card-DaYenTQt.mjs";
import { b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as getDiscordLoginUrl } from "./oauth-BRux7pAC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/entrar-DM9Be8Hm.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function EntrarPage() {
	const [error, setError] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					className: "w-full",
					disabled: busy,
					onClick: () => {
						setBusy(true);
						getDiscordLoginUrl().then((res) => {
							if (!res.ok) {
								setError(res.error);
								setBusy(false);
								return;
							}
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
