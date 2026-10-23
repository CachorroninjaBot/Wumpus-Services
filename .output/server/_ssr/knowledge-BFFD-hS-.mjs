import { i as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { o as getStoredSessionToken } from "./session-token-CaBlZnli.mjs";
import { I as FilePlus2, K as Check, P as History, Y as BookOpenCheck, b as RotateCcw, f as Sparkles, s as Trash2, v as Send, y as Search, z as Clock3 } from "../_libs/lucide-react.mjs";
import { $ as formatRelative, U as scoreKnowledgeArticle, W as searchArticles, X as useModule, Z as useWumpus, _ as Button, b as DiscordSelect, c as Input, d as Textarea, f as Dialog, g as Card, h as DialogTitle, j as getGuildKnowledgeFaqSuggestions, l as Label, m as DialogDesc, p as DialogContent, q as updateGuildKnowledgeFaqSuggestion, s as Switch, u as NativeSelect, v as Badge } from "./router-DlyrBhH9.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/knowledge-BFFD-hS-.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var EMPTY_DRAFT = {
	title: "",
	body: "",
	category: "Geral",
	tags: "",
	examples: ""
};
function statusOf(article) {
	if (article.approved) return "approved";
	return article.reviewRequested ? "review" : "draft";
}
function KnowledgePage() {
	const gid = useWumpus((s) => s.activeGuildId);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KnowledgeWorkspace, { gid }, gid);
}
function KnowledgeWorkspace({ gid }) {
	const user = useWumpus((s) => s.sessionUser);
	const allArticles = useWumpus((s) => s.articles);
	const add = useWumpus((s) => s.addArticle);
	const update = useWumpus((s) => s.updateArticle);
	const remove = useWumpus((s) => s.deleteArticle);
	const kcfg = useModule("knowledge");
	const updateConfig = useWumpus((s) => s.updateConfig);
	const [query, setQuery] = (0, import_react.useState)("");
	const [testQuestion, setTestQuestion] = (0, import_react.useState)("");
	const [statusFilter, setStatusFilter] = (0, import_react.useState)("all");
	const [categoryFilter, setCategoryFilter] = (0, import_react.useState)("all");
	const [editingId, setEditingId] = (0, import_react.useState)(null);
	const [editorOpen, setEditorOpen] = (0, import_react.useState)(false);
	const [saveNotice, setSaveNotice] = (0, import_react.useState)(null);
	const [draft, setDraft] = (0, import_react.useState)(EMPTY_DRAFT);
	const [deleteTarget, setDeleteTarget] = (0, import_react.useState)(null);
	const [faqSuggestionId, setFaqSuggestionId] = (0, import_react.useState)(null);
	const [faqSuggestions, setFaqSuggestions] = (0, import_react.useState)([]);
	const [faqSuggestionsLoading, setFaqSuggestionsLoading] = (0, import_react.useState)(true);
	const [faqSuggestionsError, setFaqSuggestionsError] = (0, import_react.useState)(null);
	const editorRef = (0, import_react.useRef)(null);
	const articles = (0, import_react.useMemo)(() => allArticles.filter((article) => article.guildId === gid), [allArticles, gid]);
	const categoryNames = (0, import_react.useMemo)(() => [...new Set(articles.map((article) => article.category?.trim() || "Geral"))].sort((a, b) => a.localeCompare(b, "pt-BR")), [articles]);
	const visibleArticles = (0, import_react.useMemo)(() => {
		const normalized = query.trim().toLocaleLowerCase("pt-BR");
		return articles.filter((article) => {
			const text = `${article.title} ${article.body} ${article.category ?? "Geral"} ${article.tags.join(" ")} ${(article.exampleQuestions ?? []).join(" ")}`.toLocaleLowerCase("pt-BR");
			return (!normalized || text.includes(normalized)) && (statusFilter === "all" || statusOf(article) === statusFilter) && (categoryFilter === "all" || (article.category?.trim() || "Geral") === categoryFilter);
		}).sort((a, b) => Number(b.approved) - Number(a.approved) || b.updatedAt - a.updatedAt);
	}, [
		articles,
		categoryFilter,
		query,
		statusFilter
	]);
	const minQuestionLength = Number(kcfg.config.minQuestionLength ?? 12);
	const similarityThreshold = Number(kcfg.config.similarityThreshold ?? .6);
	const maxArticlesPerSearch = Number(kcfg.config.maxArticlesPerSearch ?? 5);
	const testHits = (0, import_react.useMemo)(() => testQuestion.trim().length >= minQuestionLength ? searchArticles(testQuestion, articles, Boolean(kcfg.config.requireApprovedArticles), similarityThreshold).slice(0, maxArticlesPerSearch) : [], [
		testQuestion,
		articles,
		kcfg.config.requireApprovedArticles,
		minQuestionLength,
		maxArticlesPerSearch,
		similarityThreshold
	]);
	const counts = (0, import_react.useMemo)(() => ({
		approved: articles.filter((article) => article.approved).length,
		review: articles.filter((article) => !article.approved && article.reviewRequested).length,
		draft: articles.filter((article) => !article.approved && !article.reviewRequested).length
	}), [articles]);
	const refreshFaqSuggestions = (0, import_react.useCallback)(async () => {
		const token = getStoredSessionToken();
		if (!token || !gid) {
			setFaqSuggestions([]);
			setFaqSuggestionsError(gid ? "Sua sessão expirou. Entre novamente para carregar as FAQs sugeridas." : null);
			setFaqSuggestionsLoading(false);
			return;
		}
		try {
			const suggestions = await getGuildKnowledgeFaqSuggestions({ data: {
				token,
				guildId: gid
			} });
			setFaqSuggestions(suggestions);
			setFaqSuggestionsError(null);
		} catch (error) {
			setFaqSuggestionsError(error instanceof Error ? error.message : "Não foi possível carregar as FAQs sugeridas.");
		} finally {
			setFaqSuggestionsLoading(false);
		}
	}, [gid]);
	(0, import_react.useEffect)(() => {
		setFaqSuggestionsLoading(true);
		refreshFaqSuggestions();
		const timer = window.setInterval(() => void refreshFaqSuggestions(), 3e4);
		return () => window.clearInterval(timer);
	}, [refreshFaqSuggestions]);
	(0, import_react.useEffect)(() => {
		if (!editorOpen) return;
		const frame = window.requestAnimationFrame(() => {
			editorRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "start"
			});
			editorRef.current?.querySelector("#article-title")?.focus({ preventScroll: true });
		});
		return () => window.cancelAnimationFrame(frame);
	}, [
		editorOpen,
		editingId,
		faqSuggestionId
	]);
	function startNew() {
		if (editorOpen) return;
		setEditingId(null);
		setFaqSuggestionId(null);
		setDraft(EMPTY_DRAFT);
		setSaveNotice(null);
		setEditorOpen(true);
	}
	function edit(article) {
		setEditingId(article.id);
		setFaqSuggestionId(null);
		setDraft({
			title: article.title,
			body: article.body,
			category: article.category ?? "Geral",
			tags: article.tags.join(", "),
			examples: (article.exampleQuestions ?? []).join("\n")
		});
		setSaveNotice(null);
		setEditorOpen(true);
	}
	function closeEditor() {
		setEditorOpen(false);
		setEditingId(null);
		setFaqSuggestionId(null);
		setDraft(EMPTY_DRAFT);
	}
	function startFromFaq(suggestion) {
		setEditingId(null);
		setFaqSuggestionId(suggestion.id);
		setDraft({
			title: suggestion.title,
			body: "",
			category: suggestion.category || "Geral",
			tags: suggestion.tags.join(", "),
			examples: suggestion.exampleQuestions.join("\n")
		});
		setSaveNotice(`FAQ detectada ${suggestion.occurrenceCount} vezes por ${suggestion.uniqueUserCount} pessoas. Escreva a resposta oficial antes de enviar para revisão.`);
		setEditorOpen(true);
	}
	async function dismissFaqSuggestion(suggestionId) {
		const token = getStoredSessionToken();
		if (!token) {
			setFaqSuggestionsError("Sua sessão expirou. Entre novamente para atualizar esta sugestão.");
			return;
		}
		try {
			await updateGuildKnowledgeFaqSuggestion({ data: {
				token,
				guildId: gid,
				suggestionId,
				status: "dismissed"
			} });
			setFaqSuggestions((current) => current.filter((suggestion) => suggestion.id !== suggestionId));
			setFaqSuggestionsError(null);
		} catch (error) {
			setFaqSuggestionsError(error instanceof Error ? error.message : "Não foi possível descartar a sugestão.");
		}
	}
	function save(mode) {
		const title = draft.title.trim();
		const body = draft.body.trim();
		if (!title || !body) return;
		const tags = [...new Set(draft.tags.split(",").map((tag) => tag.trim().slice(0, 64)).filter(Boolean))].slice(0, 25);
		const exampleQuestions = [...new Set(draft.examples.split("\n").map((question) => question.trim().slice(0, 200)).filter(Boolean))].slice(0, 12);
		const content = {
			title,
			body,
			category: draft.category.trim() || "Geral",
			tags,
			exampleQuestions
		};
		if (editingId) update(editingId, {
			...content,
			approved: false,
			reviewRequested: mode === "review",
			reviewedBy: void 0,
			reviewedAt: void 0
		});
		else add(title, body, tags, {
			category: content.category,
			exampleQuestions,
			approved: false,
			reviewRequested: mode === "review"
		});
		const convertedSuggestionId = faqSuggestionId;
		setSaveNotice(mode === "review" ? "Artigo enviado para revisão." : "Rascunho salvo.");
		closeEditor();
		if (convertedSuggestionId) {
			const token = getStoredSessionToken();
			if (token) updateGuildKnowledgeFaqSuggestion({ data: {
				token,
				guildId: gid,
				suggestionId: convertedSuggestionId,
				status: "converted"
			} }).then(() => {
				setFaqSuggestions((current) => current.filter((suggestion) => suggestion.id !== convertedSuggestionId));
				setFaqSuggestionsError(null);
			}).catch((error) => {
				setFaqSuggestionsError(error instanceof Error ? error.message : "O artigo foi criado, mas a sugestão ainda aparece na lista.");
			});
			else setFaqSuggestionsError("O artigo foi criado, mas sua sessão expirou e a sugestão não foi arquivada.");
		}
	}
	function approve(article) {
		update(article.id, {
			approved: true,
			reviewRequested: false,
			reviewedAt: Date.now(),
			reviewedBy: user.globalName
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-7xl flex-col gap-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap items-start justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mb-1 mt-0 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpenCheck, { className: "size-4" }), "Analisar"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "m-0 text-2xl font-semibold tracking-tight",
						children: "Base de conhecimento"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-0 mt-1 max-w-2xl text-sm text-muted-foreground",
						children: "Respostas confiáveis para apoiar a equipe e a IA nos atendimentos."
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					onClick: startNew,
					disabled: editorOpen,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilePlus2, { className: "size-4" }), editorOpen ? "Editor aberto" : "Novo artigo"]
				})]
			}),
			saveNotice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "m-0 rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok",
				role: "status",
				children: saveNotice
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				"aria-label": "Resumo dos artigos",
				className: "grid gap-3 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SummaryCard, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }),
						label: "Aprovados",
						value: counts.approved,
						detail: "Disponíveis para a IA",
						tone: "ok"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SummaryCard, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock3, { className: "size-4" }),
						label: "Aguardando revisão",
						value: counts.review,
						detail: "Precisam da aprovação da equipe",
						tone: "warn"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SummaryCard, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilePlus2, { className: "size-4" }),
						label: "Rascunhos",
						value: counts.draft,
						detail: "Ainda não entram na revisão"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-4 p-4 sm:p-5",
				"aria-label": "Perguntas frequentes sugeridas pela IA",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "m-0 text-base font-semibold",
						children: "FAQs detectadas"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-0 mt-1 max-w-3xl text-sm text-muted-foreground",
						children: "A IA agrupa perguntas parecidas em todos os canais que o bot consegue ler, inclusive privados. Uma sugestão só aparece após 5 ocorrências de pelo menos 3 pessoas em 30 dias. Amostras recorrentes, sem nomes ou IDs, são enviadas ao provedor de IA para sugerir o tema; a resposta oficial fica com sua equipe."
					})] }),
					faqSuggestionsError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive",
						role: "alert",
						children: faqSuggestionsError
					}) : null,
					faqSuggestionsLoading && !faqSuggestions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 text-sm text-muted-foreground",
						children: "Carregando sugestões…"
					}) : faqSuggestions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "m-0 divide-y divide-border p-0",
						children: faqSuggestions.map((suggestion) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "list-none py-4 first:pt-0 last:pb-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-start justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "m-0 text-sm font-semibold",
												children: suggestion.title
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
												tone: "warn",
												children: "Tema sugerido"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "mb-0 mt-1 text-xs text-muted-foreground",
											children: [
												suggestion.occurrenceCount,
												" ocorrências · ",
												suggestion.uniqueUserCount,
												" pessoas · ",
												suggestion.channelCount,
												" canais · categoria ",
												suggestion.category
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
											className: "mb-0 mt-2 space-y-1 pl-5 text-sm text-muted-foreground",
											children: suggestion.exampleQuestions.slice(0, 3).map((question) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: question }, question))
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex shrink-0 flex-wrap gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										size: "sm",
										onClick: () => startFromFaq(suggestion),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilePlus2, { className: "size-3.5" }), "Completar artigo"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "ghost",
										onClick: () => void dismissFaqSuggestion(suggestion.id),
										children: "Descartar"
									})]
								})]
							})
						}, suggestion.id))
					}) : faqSuggestionsError ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 rounded-lg bg-muted px-3 py-3 text-sm text-muted-foreground",
						children: kcfg.config.autoSuggest ? "Ainda não há perguntas frequentes suficientes para sugerir um artigo." : "Ative a detecção automática abaixo para encontrar FAQs recorrentes."
					})
				]
			}),
			editorOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: editorRef,
				className: "scroll-mt-6",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "space-y-4 p-4 sm:p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-start justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "m-0 text-lg font-semibold",
								children: editingId ? "Editar artigo" : "Criar artigo"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-0 mt-1 text-sm text-muted-foreground",
								children: faqSuggestionId ? "Complete a resposta com as informações oficiais do servidor antes de enviar para revisão." : "Novos artigos começam como rascunho. Envie para revisão para que a equipe possa aprová-los."
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								onClick: closeEditor,
								children: editingId ? "Cancelar edição" : "Fechar"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-4 lg:grid-cols-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorField, {
									id: "article-title",
									label: "Título",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: "article-title",
										maxLength: 200,
										value: draft.title,
										onChange: (event) => setDraft((current) => ({
											...current,
											title: event.target.value
										})),
										placeholder: "Ex.: Como recuperar minha conta?"
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorField, {
									id: "article-category",
									label: "Categoria",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: "article-category",
										maxLength: 80,
										value: draft.category,
										onChange: (event) => setDraft((current) => ({
											...current,
											category: event.target.value
										})),
										placeholder: "Suporte"
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "lg:col-span-2",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(EditorField, {
										id: "article-body",
										label: "Resposta",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
											id: "article-body",
											rows: 5,
											maxLength: 8e3,
											value: draft.body,
											onChange: (event) => setDraft((current) => ({
												...current,
												body: event.target.value
											})),
											placeholder: "Escreva a resposta que a equipe gostaria que o bot usasse. Inclua passos claros e links confiáveis."
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "m-0 text-right text-[11px] text-muted-foreground",
											children: [draft.body.length, "/8000"]
										})]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(EditorField, {
									id: "article-tags",
									label: "Tags",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: "article-tags",
										value: draft.tags,
										onChange: (event) => setDraft((current) => ({
											...current,
											tags: event.target.value
										})),
										placeholder: "conta, acesso, senha"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "m-0 text-xs text-muted-foreground",
										children: "Separe as tags por vírgula."
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(EditorField, {
									id: "article-examples",
									label: "Perguntas relacionadas",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
										id: "article-examples",
										rows: 3,
										value: draft.examples,
										onChange: (event) => setDraft((current) => ({
											...current,
											examples: event.target.value
										})),
										placeholder: "Como recupero meu acesso?\nEsqueci a senha, o que faço?"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "m-0 text-xs text-muted-foreground",
										children: "Uma forma de perguntar por linha ajuda a IA a encontrar este artigo."
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "m-0 text-xs text-muted-foreground",
								children: !draft.title.trim() || !draft.body.trim() ? "Preencha o título e a resposta para salvar." : "Você pode salvar agora ou enviar diretamente para revisão."
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									disabled: !draft.title.trim() || !draft.body.trim(),
									onClick: () => save("draft"),
									children: "Salvar rascunho"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									disabled: !draft.title.trim() || !draft.body.trim(),
									onClick: () => save("review"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "size-4" }), "Enviar para revisão"]
								})]
							})]
						})
					]
				})
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(350px,0.75fr)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "min-w-0 space-y-4 p-4 sm:p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "m-0 text-base font-semibold",
								children: "Artigos do servidor"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "m-0 mt-1 text-xs text-muted-foreground",
								children: [
									articles.length,
									" ",
									articles.length === 1 ? "artigo" : "artigos",
									" no total"
								]
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
									"aria-label": "Filtrar por status",
									value: statusFilter,
									onChange: (event) => setStatusFilter(event.target.value),
									className: "h-9 w-auto min-w-36 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "all",
											children: "Todos os status"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "approved",
											children: "Aprovados"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "review",
											children: "Aguardando revisão"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "draft",
											children: "Rascunhos"
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
									"aria-label": "Filtrar por categoria",
									value: categoryFilter,
									onChange: (event) => setCategoryFilter(event.target.value),
									className: "h-9 w-auto min-w-32 text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "all",
										children: "Todas as categorias"
									}), categoryNames.map((category) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: category,
										children: category
									}, category))]
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
								"aria-hidden": "true",
								className: "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								"aria-label": "Buscar artigos",
								className: "pl-9",
								value: query,
								onChange: (event) => setQuery(event.target.value),
								placeholder: "Buscar por título, resposta, categoria ou tag"
							})]
						}),
						visibleArticles.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "m-0 space-y-3 p-0",
							children: visibleArticles.map((article) => {
								const status = statusOf(article);
								const selected = editingId === article.id;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: `list-none rounded-2xl border p-4 transition-colors ${selected ? "border-primary/50 bg-primary/5" : "border-border bg-background/50"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex flex-wrap items-start gap-3",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "min-w-0 flex-1",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex flex-wrap items-center gap-2",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
															className: "m-0 text-sm font-semibold",
															children: article.title
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: article.category || "Geral" })
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "mb-0 mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground",
													children: article.body
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "mt-3 flex flex-wrap items-center gap-1.5",
													children: [
														article.tags.map((tag) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
															className: "font-normal",
															children: ["#", tag]
														}, tag)),
														article.reviewedBy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "ml-auto text-[11px] text-muted-foreground",
															children: [
																"Revisado por ",
																article.reviewedBy,
																article.reviewedAt ? ` · ${formatRelative(article.reviewedAt)}` : ""
															]
														}) : null,
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-[11px] text-muted-foreground",
															children: ["Atualizado ", formatRelative(article.updatedAt)]
														})
													]
												})
											]
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												size: "sm",
												variant: "outline",
												onClick: () => edit(article),
												children: selected ? "Editando" : "Editar artigo"
											}),
											status === "review" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												size: "sm",
												onClick: () => approve(article),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-3.5" }), "Aprovar"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												size: "sm",
												variant: "outline",
												onClick: () => update(article.id, {
													approved: false,
													reviewRequested: false,
													reviewedBy: void 0,
													reviewedAt: void 0
												}),
												children: "Devolver para rascunho"
											})] }) : status === "approved" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												size: "sm",
												variant: "ghost",
												onClick: () => update(article.id, {
													approved: false,
													reviewRequested: false
												}),
												children: "Voltar para rascunho"
											}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												size: "sm",
												variant: "secondary",
												onClick: () => update(article.id, { reviewRequested: true }),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "size-3.5" }), "Enviar para revisão"]
											}),
											article.history?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
												className: "ml-auto text-xs text-muted-foreground",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
													className: "flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-2 hover:bg-muted",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, { className: "size-3.5" }),
														"Histórico (",
														article.history.length,
														")"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
													className: "mt-2 max-h-64 space-y-2 overflow-y-auto border-t border-border pt-2",
													children: [...article.history].reverse().slice(0, 5).map((revision, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
															className: "cursor-pointer font-medium text-foreground",
															children: [
																revision.title,
																" · ",
																formatRelative(revision.at)
															]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
															className: "mb-1 mt-2 whitespace-pre-wrap leading-5",
															children: revision.body
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
															className: "m-0 text-[11px]",
															children: [revision.category || "Geral", revision.tags.length ? ` · ${revision.tags.map((tag) => `#${tag}`).join(" ")}` : ""]
														}),
														revision.exampleQuestions?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
															className: "mb-2 mt-1 whitespace-pre-wrap text-[11px]",
															children: ["Perguntas: ", revision.exampleQuestions.join(" · ")]
														}) : null,
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
															size: "sm",
															variant: "outline",
															className: "mt-2",
															onClick: () => update(article.id, {
																title: revision.title,
																body: revision.body,
																category: revision.category ?? "Geral",
																tags: [...revision.tags],
																exampleQuestions: [...revision.exampleQuestions ?? []],
																approved: false,
																reviewRequested: false,
																reviewedBy: void 0,
																reviewedAt: void 0
															}),
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-3.5" }), "Restaurar como rascunho"]
														})
													] }) }, `${revision.at}-${index}`))
												})]
											}) : null,
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												size: "icon-sm",
												variant: "ghost",
												className: "text-muted-foreground hover:text-destructive",
												"aria-label": `Remover ${article.title}`,
												onClick: () => setDeleteTarget(article),
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
											})
										]
									})]
								}, article.id);
							})
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-2xl border border-dashed border-border px-5 py-10 text-center",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpenCheck, { className: "mx-auto size-8 text-muted-foreground" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "mb-1 mt-3 text-sm font-semibold",
									children: articles.length ? "Nenhum artigo corresponde" : "Sua base começa aqui"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mx-auto mb-4 mt-0 max-w-md text-sm text-muted-foreground",
									children: articles.length ? "Mude a busca ou os filtros para encontrar outro artigo." : "Adicione respostas aprovadas para perguntas recorrentes, regras e procedimentos do servidor."
								}),
								!articles.length && !editorOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									onClick: startNew,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilePlus2, { className: "size-4" }), "Criar primeiro artigo"]
								}) : null
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "space-y-4 p-4 sm:p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mb-1 mt-0 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5" }), "Teste antes de usar"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "m-0 text-base font-semibold",
									children: "Que resposta o bot encontraria?"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mb-0 mt-1 text-sm text-muted-foreground",
									children: "A busca segue o filtro de aprovação e as regras atuais do servidor."
								})
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								"aria-label": "Pergunta de teste",
								value: testQuestion,
								onChange: (event) => setTestQuestion(event.target.value),
								placeholder: "Ex.: esqueci a senha, como entro?"
							}),
							testQuestion.trim().length < minQuestionLength ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "m-0 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground",
								children: [
									"Digite uma pergunta com pelo menos ",
									minQuestionLength,
									" caracteres, como um membro faria no Discord."
								]
							}) : testHits.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
								className: "m-0 space-y-2 p-0",
								children: testHits.map((article, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "list-none rounded-xl bg-muted/60 p-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap items-center gap-2",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
													tone: index === 0 ? "primary" : "default",
													children: index === 0 ? "Melhor resultado" : `Resultado ${index + 1}`
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: article.category || "Geral" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "ml-auto text-xs text-muted-foreground",
													children: [
														"Correspondência ",
														Math.round(scoreKnowledgeArticle(article, testQuestion) * 100),
														"%"
													]
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mb-1 mt-2 text-sm font-medium",
											children: article.title
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground",
											children: article.body
										})
									]
								}, article.id))
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "m-0 rounded-xl bg-warn/10 px-3 py-2 text-sm text-muted-foreground",
								children: [
									"Nenhum artigo passou pelo limite de correspondência atual (",
									Math.round(similarityThreshold * 100),
									"%). Revise tags, perguntas relacionadas ou conteúdo."
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-4 border-t border-border pt-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "m-0 text-sm font-semibold",
										children: "Como o bot responde"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorField, {
										id: "knowledge-channel",
										label: "Canal de perguntas",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
											id: "knowledge-channel",
											kind: "text",
											value: String(kcfg.config.answerChannelId ?? ""),
											onChange: (answerChannelId) => updateConfig("knowledge", { answerChannelId }),
											placeholder: "Selecione um canal"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start justify-between gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
											htmlFor: "knowledge-ai",
											children: "Respostas com IA ligadas"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 mt-0.5 text-xs text-muted-foreground",
											children: "O bot responde apenas quando encontra material suficiente."
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
											id: "knowledge-ai",
											checked: Boolean(kcfg.config.useAi),
											onCheckedChange: (value) => updateConfig("knowledge", { useAi: value })
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start justify-between gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
											htmlFor: "faq-auto-suggest",
											children: "Detectar perguntas frequentes"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 mt-0.5 text-xs text-muted-foreground",
											children: "Analisa perguntas nos canais acessíveis ao bot e sugere temas para sua equipe. Não cria nem publica respostas automaticamente."
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
											id: "faq-auto-suggest",
											checked: Boolean(kcfg.config.autoSuggest),
											onCheckedChange: (value) => updateConfig("knowledge", { autoSuggest: value })
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start justify-between gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
											htmlFor: "approved-only",
											children: "Exigir artigos aprovados"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 mt-0.5 text-xs text-muted-foreground",
											children: "Recomendado para respostas consistentes."
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
											id: "approved-only",
											checked: Boolean(kcfg.config.requireApprovedArticles),
											onCheckedChange: (value) => updateConfig("knowledge", { requireApprovedArticles: value })
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start justify-between gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
											htmlFor: "mention-required",
											children: "Exigir menção no canal de perguntas"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 mt-0.5 text-xs text-muted-foreground",
											children: "Sem isso, o bot responde perguntas enviadas diretamente no canal escolhido."
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
											id: "mention-required",
											checked: Boolean(kcfg.config.mentionRequired),
											onCheckedChange: (value) => updateConfig("knowledge", { mentionRequired: value })
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start justify-between gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
											htmlFor: "all-channels",
											children: "Aceitar menções em outros canais"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 mt-0.5 text-xs text-muted-foreground",
											children: "Permite que a IA responda quando alguém mencionar o bot fora do canal escolhido."
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
											id: "all-channels",
											checked: Boolean(kcfg.config.suggestInAllChannels),
											onCheckedChange: (value) => updateConfig("knowledge", { suggestInAllChannels: value })
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start justify-between gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
											htmlFor: "respond-all-channels",
											children: "Responder perguntas em qualquer canal"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 mt-0.5 text-xs text-muted-foreground",
											children: "Quando ativado, responde sem menção em qualquer canal legível pelo bot, inclusive canais privados, se encontrar conteúdo relevante conforme o filtro de aprovação configurado."
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
											id: "respond-all-channels",
											checked: Boolean(kcfg.config.respondInAllChannels),
											onCheckedChange: (value) => updateConfig("knowledge", { respondInAllChannels: value })
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorField, {
											id: "minimum-length",
											label: "Tamanho mínimo da pergunta",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												id: "minimum-length",
												type: "number",
												min: 1,
												max: 2e3,
												defaultValue: minQuestionLength,
												onBlur: (event) => updateConfig("knowledge", { minQuestionLength: Math.max(1, Math.min(2e3, Number(event.target.value) || 1)) })
											})
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorField, {
											id: "knowledge-similarity",
											label: "Correspondência mínima (%)",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												id: "knowledge-similarity",
												type: "number",
												min: 10,
												max: 100,
												step: 5,
												defaultValue: Math.round(similarityThreshold * 100),
												onBlur: (event) => updateConfig("knowledge", { similarityThreshold: Math.max(.1, Math.min(1, (Number(event.target.value) || 60) / 100)) })
											})
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorField, {
										id: "max-articles",
										label: "Artigos de contexto por resposta",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											id: "max-articles",
											type: "number",
											min: 1,
											max: 10,
											defaultValue: maxArticlesPerSearch,
											onBlur: (event) => updateConfig("knowledge", { maxArticlesPerSearch: Math.max(1, Math.min(10, Number(event.target.value) || 1)) })
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorField, {
										id: "knowledge-cooldown",
										label: "Intervalo entre respostas (segundos)",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
											id: "knowledge-cooldown",
											type: "number",
											min: 0,
											max: 3600,
											defaultValue: Number(kcfg.config.cooldownSeconds ?? 20),
											onBlur: (event) => updateConfig("knowledge", { cooldownSeconds: Math.max(0, Math.min(3600, Number(event.target.value) || 0)) })
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start justify-between gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
											htmlFor: "knowledge-logs",
											children: "Registrar buscas na auditoria"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 mt-0.5 text-xs text-muted-foreground",
											children: "Inclui o texto da pergunta e os artigos usados nos logs."
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
											id: "knowledge-logs",
											checked: Boolean(kcfg.config.logSearches),
											onCheckedChange: (value) => updateConfig("knowledge", { logSearches: value })
										})]
									})
								]
							})
						]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: Boolean(deleteTarget),
				onOpenChange: (open) => {
					if (!open) setDeleteTarget(null);
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Remover artigo?" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDesc, { children: [
						"“",
						deleteTarget?.title,
						"” deixará de aparecer para a equipe e para a IA."
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 flex justify-end gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "outline",
							onClick: () => setDeleteTarget(null),
							children: "Cancelar"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "destructive",
							onClick: () => {
								if (deleteTarget) remove(deleteTarget.id);
								setDeleteTarget(null);
							},
							children: "Remover artigo"
						})]
					})
				] })
			})
		]
	});
}
function SummaryCard({ icon, label, value, detail, tone = "default" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "flex items-center gap-3 p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: `grid size-10 shrink-0 place-items-center rounded-xl ${tone === "ok" ? "bg-ok/10 text-ok" : tone === "warn" ? "bg-warn/10 text-warn" : "bg-muted text-muted-foreground"}`,
			children: icon
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 text-xs text-muted-foreground",
					children: label
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-0 mt-0.5 text-2xl font-semibold",
					children: value
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 truncate text-[11px] text-muted-foreground",
					children: detail
				})
			]
		})]
	});
}
function StatusBadge({ status }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		tone: {
			approved: "ok",
			review: "warn",
			draft: "default"
		}[status],
		children: {
			approved: "Aprovado",
			review: "Em revisão",
			draft: "Rascunho"
		}[status]
	});
}
function EditorField({ id, label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
			htmlFor: id,
			children: label
		}), children]
	});
}
//#endregion
export { KnowledgePage as component };
