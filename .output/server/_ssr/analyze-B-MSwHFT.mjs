import { t as cn } from "./utils-H16dNBFI.mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { a as DialogOverlay, i as DialogDescription, n as DialogClose, o as DialogPortal, r as DialogContent$1, s as DialogTitle$1, t as Dialog$1 } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { t as createServerFn } from "./ssr.mjs";
import { t as createSsrRpc } from "./createSsrRpc-C1p7zOu_.mjs";
import { t as X } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/analyze-B-MSwHFT.js
var import_jsx_runtime = require_jsx_runtime();
var Dialog = Dialog$1;
function DialogContent({ className, children, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, { className: "fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
		className: cn("fixed top-1/2 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-5 text-card-foreground shadow-border outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95", className),
		...props,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
			className: "absolute top-3 right-3 grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sr-only",
				children: "Fechar"
			})]
		})]
	})] });
}
function DialogTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
		className: cn("text-lg font-semibold tracking-tight", className),
		...props
	});
}
function DialogDesc({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, {
		className: cn("mt-1 text-sm text-muted-foreground", className),
		...props
	});
}
/**
* Analise de IA do painel — Groq (endpoint compativel com OpenAI).
*
* Antes isto procurava `XAI_API_KEY`, que nao existe neste ambiente: o painel
* respondia "IA indisponivel" em toda analise. As credenciais reais do projeto
* sao do Groq (`WUMPUS_GROQ_API_KEY` / `WUMPUS_GROQ_MODEL`).
*
* O bot usa o mesmo provedor em `src/bot/ai.ts`, para as duas pontas darem a
* mesma resposta sobre o mesmo material.
*/
var analyzeWithGrok = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("f34dffdf3ceb3926a04d3a357b73c5534a46b6db3875e1f151de016d002ca894"));
//#endregion
export { analyzeWithGrok as a, DialogTitle as i, DialogContent as n, DialogDesc as r, Dialog as t };
