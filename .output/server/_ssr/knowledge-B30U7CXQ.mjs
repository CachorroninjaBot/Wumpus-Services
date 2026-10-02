import { i as __toESM } from "../_runtime.mjs";
import { o as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as Badge } from "./badge-C2mxnvvX.mjs";
import { t as Button } from "./button-BUiFN9VL.mjs";
import { t as Card } from "./card-DaYenTQt.mjs";
import { i as Textarea, n as Label, t as Input } from "./input-Cyzc7r1j.mjs";
import { c as searchArticles, m as useWumpus, p as useModule } from "./store-B26y7m0l.mjs";
import { t as Switch } from "./switch-C8XyncjG.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/knowledge-B30U7CXQ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function KnowledgePage() {
	const gid = useWumpus((s) => s.activeGuildId);
	const articles = useWumpus((s) => s.articles).filter((a) => a.guildId === gid);
	const add = useWumpus((s) => s.addArticle);
	const update = useWumpus((s) => s.updateArticle);
	const remove = useWumpus((s) => s.deleteArticle);
	const kcfg = useModule("knowledge");
	const updateConfig = useWumpus((s) => s.updateConfig);
	const [q, setQ] = (0, import_react.useState)("");
	const [title, setTitle] = (0, import_react.useState)("");
	const [body, setBody] = (0, import_react.useState)("");
	const hits = (0, import_react.useMemo)(() => searchArticles(q, articles, Boolean(kcfg.config.requireApprovedArticles)), [
		q,
		articles,
		kcfg.config.requireApprovedArticles
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_320px]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "m-0 text-xl font-semibold tracking-tight",
					children: "Inteligência"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Perguntar à base" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "mt-1",
						value: q,
						onChange: (e) => setQ(e.target.value),
						placeholder: "Como recebo o produto?"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 m-0 space-y-2 p-0",
						children: (q ? hits : articles).map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-xl bg-muted px-3 py-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "m-0 text-sm font-medium",
										children: a.title
									}), a.approved ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone: "ok",
										children: "aprovado"
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: "rascunho" })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "m-0 text-sm text-muted-foreground",
									children: a.body
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-2 flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "ghost",
										onClick: () => update(a.id, { approved: !a.approved }),
										children: a.approved ? "Desaprovar" : "Aprovar"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "ghost",
										onClick: () => remove(a.id),
										children: "Remover"
									})]
								})
							]
						}, a.id))
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-0 text-base font-semibold",
							children: "Novo artigo"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: title,
							onChange: (e) => setTitle(e.target.value),
							placeholder: "Título"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							value: body,
							onChange: (e) => setBody(e.target.value),
							placeholder: "Resposta aprovada"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							onClick: () => {
								if (!title.trim() || !body.trim()) return;
								add(title.trim(), body.trim(), []);
								setTitle("");
								setBody("");
							},
							children: "Publicar"
						})
					]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "h-fit space-y-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-0 text-base font-semibold",
					children: "Regras da base"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 text-sm text-muted-foreground",
					children: "A IA de ticket usa só artigos aprovados. Nunca responde sozinha no canal do cliente."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Só artigos aprovados" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
						checked: Boolean(kcfg.config.requireApprovedArticles),
						onCheckedChange: (v) => updateConfig("knowledge", { requireApprovedArticles: v })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Sugerir no chat" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
						checked: Boolean(kcfg.config.autoSuggest),
						onCheckedChange: (v) => updateConfig("knowledge", { autoSuggest: v })
					})]
				})
			]
		})]
	});
}
//#endregion
export { KnowledgePage as component };
