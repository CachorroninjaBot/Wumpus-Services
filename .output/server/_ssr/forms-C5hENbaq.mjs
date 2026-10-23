import { i as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { l as planAllows, o as getStoredSessionToken } from "./session-token-CaBlZnli.mjs";
import { I as FilePlus2, K as Check, L as Eye, N as Inbox, R as Copy, S as Plus, V as ClipboardCheck, W as ChevronRight, Z as ArrowUp, et as ArrowDown, f as Sparkles, j as LoaderCircle, s as Trash2, v as Send, y as Search } from "../_libs/lucide-react.mjs";
import { $ as formatRelative, A as getGuildFormSubmissions, D as getFormReviewStatus, J as useActiveGuild, X as useModule, Y as useGuildMembers, Z as useWumpus, _ as Button, a as TabsList, b as DiscordSelect, c as Input, d as Textarea, i as TabsContent, l as Label, nt as uid, o as TabsTrigger, r as Tabs, s as Switch, u as NativeSelect, v as Badge, w as asString, y as DiscordMultiSelect, z as requestFormReview } from "./router-DjtjaZqs.mjs";
import { t as DiscordFormPreview } from "./discord-panel-B_4DZK8m.mjs";
import { n as publishPanelAndWait, r as publishResultMessage, t as analyzeWithGrok } from "./publish-panel-y-14JnXC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/forms-C5hENbaq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var STATUS = {
	pending: {
		label: "Aguardando",
		tone: "warn"
	},
	approved: {
		label: "Aprovado",
		tone: "ok"
	},
	rejected: {
		label: "Recusado",
		tone: "danger"
	}
};
var templates = [
	{
		id: "support",
		title: "Pedido de suporte",
		description: "Conte o que aconteceu para a equipe direcionar sua solicitação.",
		name: "Atendimento",
		fields: [
			{
				label: "Qual é o assunto?",
				type: "select",
				options: [
					"Dúvida",
					"Problema",
					"Sugestão"
				],
				placeholder: "Escolha uma opção"
			},
			{
				label: "Qual é o assunto em uma frase?",
				type: "short",
				placeholder: "Ex.: não consigo acessar minha conta"
			},
			{
				label: "Conte o que aconteceu",
				type: "paragraph",
				placeholder: "Inclua o que você já tentou e qualquer detalhe útil"
			}
		]
	},
	{
		id: "team",
		title: "Inscrição para a equipe",
		description: "Conheça a pessoa e a área em que ela gostaria de ajudar.",
		name: "Inscrição para a equipe",
		fields: [
			{
				label: "Como devemos chamar você?",
				type: "short",
				placeholder: "Seu nome ou apelido"
			},
			{
				label: "Em qual área quer ajudar?",
				type: "select",
				options: [
					"Moderação",
					"Suporte",
					"Eventos"
				],
				placeholder: "Escolha uma área"
			},
			{
				label: "Por que quer participar?",
				type: "paragraph",
				placeholder: "Conte o que motiva você"
			}
		]
	},
	{
		id: "report",
		title: "Denúncia",
		description: "Reúna as informações necessárias para a equipe analisar o relato.",
		name: "Denúncia",
		fields: [
			{
				label: "O que você quer denunciar?",
				type: "select",
				options: [
					"Spam",
					"Assédio",
					"Golpe",
					"Outro"
				],
				placeholder: "Escolha uma categoria"
			},
			{
				label: "Quem está envolvido?",
				type: "short",
				placeholder: "Nome de usuário ou link do perfil"
			},
			{
				label: "Descreva o que aconteceu",
				type: "paragraph",
				placeholder: "Inclua datas, contexto e provas disponíveis"
			}
		]
	}
];
function labelForStatus(status) {
	return STATUS[status]?.label ?? status;
}
function makeFields(template) {
	return template.fields.map((field) => ({
		id: uid("field"),
		label: field.label,
		type: field.type,
		required: true,
		options: field.options ?? [],
		maxLength: field.type === "short" ? 100 : 1e3,
		minLength: 0,
		placeholder: field.placeholder
	}));
}
function FormsPage() {
	const gid = useWumpus((state) => state.activeGuildId);
	const legacyQuestions = useWumpus((state) => state.formQuestions)[gid] ?? [];
	const members = useGuildMembers();
	const user = useWumpus((state) => state.sessionUser);
	const channels = useWumpus((state) => state.channels[state.activeGuildId] ?? []);
	const guild = useActiveGuild();
	const fcfg = useModule("forms");
	const updateConfig = useWumpus((state) => state.updateConfig);
	const setEnabled = useWumpus((state) => state.setModuleEnabled);
	const setFieldsInStore = useWumpus((state) => state.setFormFields);
	const formsAllowed = planAllows(guild.plan, "forms");
	const aiAllowed = planAllows(guild.plan, "ai") && Boolean(fcfg.config.useAiPreReview);
	const savedFields = Array.isArray(fcfg.config.fields) ? fcfg.config.fields : [];
	const fields = savedFields.length ? savedFields : legacyQuestions.map((question) => ({
		id: question.id,
		label: question.label,
		type: "paragraph",
		required: question.required,
		options: [],
		maxLength: 1e3,
		minLength: 0,
		placeholder: ""
	}));
	const [tab, setTab] = (0, import_react.useState)("inbox");
	const [submissions, setSubmissions] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [loadError, setLoadError] = (0, import_react.useState)(null);
	const [selectedId, setSelectedId] = (0, import_react.useState)(null);
	const [filter, setFilter] = (0, import_react.useState)("pending");
	const [query, setQuery] = (0, import_react.useState)("");
	const [reason, setReason] = (0, import_react.useState)("");
	const [reviewBusy, setReviewBusy] = (0, import_react.useState)(false);
	const [reviewNotice, setReviewNotice] = (0, import_react.useState)(null);
	const [aiBusy, setAiBusy] = (0, import_react.useState)(false);
	const [aiNotes, setAiNotes] = (0, import_react.useState)({});
	const [publishBusy, setPublishBusy] = (0, import_react.useState)(false);
	const [publishNotice, setPublishNotice] = (0, import_react.useState)(null);
	const [builderNotice, setBuilderNotice] = (0, import_react.useState)(null);
	async function refreshSubmissions(showLoading = false) {
		const token = getStoredSessionToken();
		if (!token || !gid) {
			setSubmissions([]);
			setLoadError("Entre com Discord para receber as respostas deste servidor.");
			setLoading(false);
			return;
		}
		if (showLoading) setLoading(true);
		try {
			const rows = await getGuildFormSubmissions({ data: {
				token,
				guildId: gid
			} });
			setSubmissions(rows);
			setLoadError(null);
		} catch (error) {
			setLoadError(error instanceof Error ? error.message : "Não foi possível carregar as respostas do bot.");
		} finally {
			setLoading(false);
		}
	}
	(0, import_react.useEffect)(() => {
		let active = true;
		const refresh = async () => {
			const token = getStoredSessionToken();
			if (!token || !gid) {
				if (active) {
					setSubmissions([]);
					setLoadError("Entre com Discord para receber as respostas deste servidor.");
					setLoading(false);
				}
				return;
			}
			try {
				const rows = await getGuildFormSubmissions({ data: {
					token,
					guildId: gid
				} });
				if (active) {
					setSubmissions(rows);
					setLoadError(null);
					setLoading(false);
				}
			} catch (error) {
				if (active) {
					setLoadError(error instanceof Error ? error.message : "Não foi possível carregar as respostas do bot.");
					setLoading(false);
				}
			}
		};
		setLoading(true);
		setSubmissions([]);
		refresh();
		const timer = window.setInterval(() => void refresh(), 1e4);
		return () => {
			active = false;
			window.clearInterval(timer);
		};
	}, [gid]);
	const visibleSubmissions = (0, import_react.useMemo)(() => submissions.filter((submission) => filter === "all" || submission.status === filter).filter((submission) => {
		return `${members.find((member) => member.id === submission.userId)?.displayName ?? submission.userId} ${Object.entries(submission.answers).map(([question, answer]) => `${question} ${answer}`).join(" ")}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"));
	}), [
		filter,
		members,
		query,
		submissions
	]);
	const selected = submissions.find((submission) => submission.id === selectedId) ?? visibleSubmissions[0] ?? null;
	const pendingCount = submissions.filter((submission) => submission.status === "pending").length;
	const textCount = fields.filter((field) => field.type !== "select").length;
	const selectCount = fields.filter((field) => field.type === "select").length;
	const canAddText = fields.length < 10 && textCount < 5;
	const canAddSelect = fields.length < 10 && selectCount < 5;
	(0, import_react.useEffect)(() => {
		if (selectedId && visibleSubmissions.some((submission) => submission.id === selectedId)) return;
		const next = visibleSubmissions[0] ?? null;
		setSelectedId(next?.id ?? null);
		setReason(next?.reason ?? "");
	}, [
		selectedId,
		submissions,
		visibleSubmissions
	]);
	const setFields = (next) => {
		setBuilderNotice(null);
		setFieldsInStore(next);
	};
	const patchField = (id, patch) => setFields(fields.map((field) => field.id === id ? {
		...field,
		...patch
	} : field));
	const moveField = (id, direction) => {
		const index = fields.findIndex((field) => field.id === id);
		const nextIndex = index + direction;
		if (index < 0 || nextIndex < 0 || nextIndex >= fields.length) return;
		const next = [...fields];
		[next[index], next[nextIndex]] = [next[nextIndex], next[index]];
		setFields(next);
	};
	const addField = (type) => {
		if (fields.length >= 10 || (type === "select" ? selectCount >= 5 : textCount >= 5)) {
			setBuilderNotice(type === "select" ? "O Discord permite até cinco perguntas de escolha." : "O modal do Discord permite até cinco perguntas de texto.");
			return;
		}
		setFields([...fields, {
			id: uid("field"),
			label: "Nova pergunta",
			type,
			required: true,
			options: type === "select" ? ["Opção 1", "Opção 2"] : [],
			maxLength: type === "short" ? 100 : 1e3,
			minLength: 0,
			placeholder: ""
		}]);
	};
	const duplicateField = (field) => {
		if (fields.length >= 10 || (field.type === "select" ? selectCount >= 5 : textCount >= 5)) {
			setBuilderNotice("O Discord permite até cinco perguntas de texto e cinco escolhas por formulário.");
			return;
		}
		const index = fields.findIndex((item) => item.id === field.id);
		const next = [...fields];
		next.splice(index + 1, 0, {
			...field,
			id: uid("field"),
			label: `${field.label} (cópia)`
		});
		setFields(next);
	};
	const applyTemplate = (template) => {
		setFields(makeFields(template));
		updateConfig("forms", {
			panelTitle: template.name,
			panelDescription: template.description
		});
	};
	async function reviewSubmission(decision) {
		if (!selected) return;
		if (decision === "rejected" && Boolean(fcfg.config.requireReasonOnReject) && !reason.trim()) {
			setReviewNotice("Escreva um motivo para que a pessoa entenda a decisão.");
			return;
		}
		const token = getStoredSessionToken();
		if (!token) {
			setReviewNotice("Entre novamente com Discord antes de revisar.");
			return;
		}
		setReviewBusy(true);
		setReviewNotice(null);
		try {
			const { jobId } = await requestFormReview({ data: {
				token,
				guildId: gid,
				formId: Number(selected.id),
				actorId: user.id,
				decision,
				...reason.trim() ? { reason: reason.trim() } : {}
			} });
			for (let attempt = 0; attempt < 24; attempt++) {
				await new Promise((resolve) => window.setTimeout(resolve, 750));
				const result = await getFormReviewStatus({ data: {
					token,
					guildId: gid,
					jobId
				} });
				if (result.status === "done" || result.status === "failed") {
					setReviewNotice(result.detail ?? (result.status === "done" ? "Decisão registrada." : "O bot não conseguiu registrar a decisão."));
					if (result.status === "done") {
						await refreshSubmissions();
						setReason("");
					}
					return;
				}
			}
			setReviewNotice("O bot ainda está processando. A caixa será atualizada automaticamente.");
		} catch (error) {
			setReviewNotice(error instanceof Error ? error.message : "Não foi possível enviar a decisão ao bot.");
		} finally {
			setReviewBusy(false);
		}
	}
	async function runAiReview() {
		if (!selected) return;
		const token = getStoredSessionToken();
		if (!token) {
			setAiNotes((current) => ({
				...current,
				[selected.id]: "Entre novamente com Discord para usar a análise por IA."
			}));
			return;
		}
		setAiBusy(true);
		try {
			const body = Object.entries(selected.answers).map(([question, answer]) => `${question}: ${answer}`).join("\n");
			const result = await analyzeWithGrok({ data: {
				token,
				guildId: gid,
				kind: "form",
				title: asString(fcfg.config.panelTitle, "Formulário"),
				body
			} });
			setAiNotes((current) => ({
				...current,
				[selected.id]: result.ok ? result.text : result.error
			}));
		} catch (error) {
			setAiNotes((current) => ({
				...current,
				[selected.id]: error instanceof Error ? error.message : "A análise não ficou disponível."
			}));
		} finally {
			setAiBusy(false);
		}
	}
	async function publishFormPanel() {
		const channelRef = asString(fcfg.config.panelChannelId).trim();
		if (!channelRef) {
			setPublishNotice("Escolha o canal onde o painel deve aparecer.");
			return;
		}
		setPublishBusy(true);
		setPublishNotice(null);
		try {
			const result = await publishPanelAndWait({
				guildId: gid,
				target: "forms",
				channelRef
			});
			setPublishNotice(publishResultMessage(result));
		} catch (error) {
			setPublishNotice(error instanceof Error ? error.message : "Não foi possível pedir a publicação ao bot.");
		} finally {
			setPublishBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-[1440px] flex-col gap-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "m-0 text-2xl font-semibold tracking-[-0.03em]",
						children: "Formulários"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-0 mt-1 text-sm text-muted-foreground",
						children: "Crie perguntas claras para a comunidade e acompanhe cada resposta da equipe."
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					onClick: () => setTab("builder"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilePlus2, { className: "size-4" }), " Criar formulário"]
				})]
			}),
			!formsAllowed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				role: "note",
				className: "rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground",
				children: "O plano atual não inclui formulários. Atualize o plano para publicar um formulário neste servidor."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
				value: tab,
				onValueChange: setTab,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, {
						className: "h-auto gap-1 rounded-none border-b border-border bg-transparent p-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsTrigger, {
							value: "inbox",
							className: "h-11 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Inbox, { className: "mr-2 size-4" }),
								" Respostas ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-2 rounded-full bg-muted px-2 py-0.5 text-xs",
									children: pendingCount
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsTrigger, {
							value: "builder",
							className: "h-11 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClipboardCheck, { className: "mr-2 size-4" }), " Criador de formulário"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
						value: "inbox",
						className: "mt-5",
						children: [
							loadError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								role: "alert",
								className: "mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive",
								children: loadError
							}) : null,
							reviewNotice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								role: "status",
								className: "mb-4 rounded-lg bg-muted px-4 py-3 text-sm",
								children: reviewNotice
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid min-w-0 gap-5 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
									className: "min-w-0",
									"aria-label": "Caixa de respostas",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mb-3 flex flex-wrap items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
											"aria-label": "Filtrar respostas",
											value: filter,
											onChange: (event) => setFilter(event.target.value),
											className: "h-10 w-auto min-w-40 bg-card",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
													value: "pending",
													children: [
														"Aguardando (",
														pendingCount,
														")"
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "all",
													children: "Todas as respostas"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "approved",
													children: "Aprovadas"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "rejected",
													children: "Recusadas"
												})
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "relative min-w-40 flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
												"aria-hidden": "true",
												className: "absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												value: query,
												onChange: (event) => setQuery(event.target.value),
												placeholder: "Buscar respostas",
												className: "h-10 pl-9",
												"aria-label": "Buscar respostas"
											})]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "overflow-hidden rounded-xl border border-border bg-card",
										children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "m-0 flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }), " Carregando respostas do bot…"]
										}) : visibleSubmissions.length ? visibleSubmissions.map((submission) => {
											const memberName = members.find((member) => member.id === submission.userId)?.displayName ?? `Membro ${submission.userId.slice(-4)}`;
											const status = STATUS[submission.status];
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												onClick: () => {
													setSelectedId(submission.id);
													setReason(submission.reason);
													setReviewNotice(null);
												},
												"aria-pressed": selected?.id === submission.id,
												className: `flex min-h-[74px] w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-0 ${selected?.id === submission.id ? "bg-secondary/75" : "hover:bg-muted/60"}`,
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-foreground",
														children: memberName.slice(0, 1).toUpperCase()
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "min-w-0 flex-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "flex items-center gap-2",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "truncate text-sm font-semibold",
																children: memberName
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
																tone: status.tone,
																children: status.label
															})]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "mt-1 block truncate text-xs text-muted-foreground",
															children: Object.values(submission.answers).find(Boolean) || "Sem resposta em texto"
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "shrink-0 text-right text-[11px] text-muted-foreground",
														children: formatRelative(submission.createdAt)
													})
												]
											}, submission.id);
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "px-5 py-10",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Inbox, { className: "mb-3 size-5 text-primary" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
													className: "m-0 text-base font-semibold",
													children: submissions.length ? "Nenhuma resposta nesta lista" : "A caixa está pronta"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "mb-4 mt-1 max-w-[34ch] text-sm leading-6 text-muted-foreground",
													children: submissions.length ? "Mude o filtro ou a busca para encontrar outra resposta." : "Publique seu primeiro formulário e as respostas aparecerão aqui para revisão."
												}),
												!submissions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
													variant: "outline",
													size: "sm",
													onClick: () => setTab("builder"),
													children: ["Configurar formulário ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })]
												}) : null
											]
										})
									})]
								}), selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
									className: "min-w-0 rounded-xl border border-border bg-card",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
										className: "flex flex-wrap items-start gap-3 border-b border-border px-5 py-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "min-w-0 flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
												className: "m-0 truncate text-lg font-semibold",
												children: members.find((member) => member.id === selected.userId)?.displayName ?? `Membro ${selected.userId.slice(-4)}`
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "mb-0 mt-1 text-xs text-muted-foreground",
												children: [
													"Enviado ",
													formatRelative(selected.createdAt),
													" · resposta #",
													selected.id
												]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											tone: STATUS[selected.status].tone,
											children: labelForStatus(selected.status)
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-5 px-5 py-5",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
												className: "m-0 divide-y divide-border",
												children: Object.entries(selected.answers).map(([question, answer]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "grid gap-1 py-4 first:pt-0 sm:grid-cols-[minmax(150px,0.38fr)_minmax(0,1fr)] sm:gap-5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
														className: "text-sm font-medium text-muted-foreground",
														children: question
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
														className: "m-0 whitespace-pre-wrap text-sm leading-6",
														children: answer || /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-muted-foreground",
															children: "Sem resposta"
														})
													})]
												}, question))
											}),
											aiNotes[selected.id] ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "rounded-lg bg-secondary/70 px-4 py-3 text-sm leading-6",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
													className: "mb-1 mt-0 font-semibold",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "mr-1 inline size-4" }), " Nota de apoio da IA"]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "m-0 whitespace-pre-wrap",
													children: aiNotes[selected.id]
												})]
											}) : null,
											selected.status === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "border-t border-border pt-5",
												children: [
													fcfg.config.requireReasonOnReject ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "mb-4 space-y-1.5",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, {
															htmlFor: "review-reason",
															children: ["Motivo da decisão ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "font-normal text-muted-foreground",
																children: "(exigido ao recusar)"
															})]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
															id: "review-reason",
															value: reason,
															onChange: (event) => setReason(event.target.value),
															maxLength: 500,
															placeholder: "Escreva uma explicação útil para a pessoa…"
														})]
													}) : null,
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex flex-wrap gap-2",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
																disabled: reviewBusy,
																onClick: () => void reviewSubmission("approved"),
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }), " Aprovar"]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
																variant: "destructive",
																disabled: reviewBusy || Boolean(fcfg.config.requireReasonOnReject) && !reason.trim(),
																onClick: () => void reviewSubmission("rejected"),
																children: "Recusar"
															}),
															aiAllowed ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
																variant: "outline",
																disabled: aiBusy,
																onClick: () => void runAiReview(),
																children: [aiBusy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4" }), " Apoio da IA"]
															}) : null
														]
													}),
													reviewBusy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														role: "status",
														className: "mb-0 mt-3 text-xs text-muted-foreground",
														children: "Enviando a decisão ao bot…"
													}) : null
												]
											}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "m-0 border-t border-border pt-4 text-sm text-muted-foreground",
												children: [selected.status === "approved" ? "Esta resposta foi aprovada." : `Recusado${selected.reason ? `: ${selected.reason}` : "."}`, selected.reviewerId ? ` · por ${members.find((member) => member.id === selected.reviewerId)?.displayName ?? "um atendente"}` : ""]
											})
										]
									})]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "grid min-h-64 place-items-center rounded-xl border border-dashed border-border bg-card/50 px-6 text-center",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "mx-auto mb-3 size-5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "m-0 text-sm text-muted-foreground",
										children: "Selecione uma resposta para ler e revisar."
									})] })
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
						value: "builder",
						className: "mt-5",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.85fr)]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
								className: "min-w-0 space-y-6",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap items-start gap-4 border-b border-border pb-5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "min-w-0 flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
												className: "m-0 text-lg font-semibold",
												children: "Monte seu formulário"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "mb-0 mt-1 max-w-[58ch] text-sm leading-6 text-muted-foreground",
												children: "Comece por um modelo ou escreva suas próprias perguntas. As mudanças aparecem na prévia ao lado."
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "flex min-h-10 items-center gap-3 rounded-lg border border-border bg-card px-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-sm font-medium",
												children: "Formulário ativo"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
												checked: fcfg.enabled,
												onCheckedChange: (value) => setEnabled("forms", value),
												"aria-label": "Ativar formulários"
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
										"aria-labelledby": "template-title",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mb-3 flex items-end justify-between gap-3",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												id: "template-title",
												className: "m-0 text-sm font-semibold",
												children: "Comece com um modelo"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "mb-0 mt-1 text-xs text-muted-foreground",
												children: "Você pode editar cada pergunta depois."
											})] })
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "grid gap-2 sm:grid-cols-3",
											children: templates.map((template) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												onClick: () => applyTemplate(template),
												className: "group min-h-[92px] rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary/40",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "flex items-center gap-2 text-sm font-semibold",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilePlus2, { className: "size-4 text-primary" }), template.title]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "mt-1.5 block text-xs leading-5 text-muted-foreground",
													children: [template.fields.length, " perguntas · texto e escolhas"]
												})]
											}, template.id))
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
										"aria-labelledby": "questions-title",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "mb-3 flex flex-wrap items-end justify-between gap-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													id: "questions-title",
													className: "m-0 text-sm font-semibold",
													children: "Perguntas"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "mb-0 mt-1 text-xs text-muted-foreground",
													children: "Escolhas aparecem antes das perguntas de texto no Discord."
												})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-xs tabular-nums text-muted-foreground",
													children: [
														textCount,
														"/5 texto · ",
														selectCount,
														"/5 escolhas"
													]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
												className: "mb-4 rounded-xl border border-border bg-card px-4 py-3 2xl:hidden",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
														className: "cursor-pointer text-sm font-semibold",
														children: "Ver prévia atualizada no Discord"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "mb-3 mt-2 text-xs text-muted-foreground",
														children: "A prévia acompanha as alterações. Publique quando estiver pronto para enviar ao servidor."
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordFormPreview, {
														title: asString(fcfg.config.panelTitle, "Formulário"),
														description: asString(fcfg.config.panelDescription),
														buttonLabel: asString(fcfg.config.panelButtonLabel, "Preencher formulário"),
														fields
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "space-y-3",
												children: fields.map((field, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
													className: "rounded-xl border border-border bg-card p-4 sm:p-5",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "mb-4 flex items-center gap-3",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "grid size-7 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground",
																	children: index + 1
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "text-xs font-semibold text-muted-foreground",
																	children: field.type === "select" ? "ESCOLHA" : field.type === "short" ? "TEXTO CURTO" : "TEXTO LONGO"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "ml-auto flex items-center",
																	children: [
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
																			type: "button",
																			variant: "ghost",
																			size: "icon-sm",
																			onClick: () => moveField(field.id, -1),
																			disabled: index === 0,
																			"aria-label": `Mover pergunta ${index + 1} para cima`,
																			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "size-4" })
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
																			type: "button",
																			variant: "ghost",
																			size: "icon-sm",
																			onClick: () => moveField(field.id, 1),
																			disabled: index === fields.length - 1,
																			"aria-label": `Mover pergunta ${index + 1} para baixo`,
																			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, { className: "size-4" })
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
																			type: "button",
																			variant: "ghost",
																			size: "icon-sm",
																			onClick: () => duplicateField(field),
																			"aria-label": `Duplicar pergunta ${index + 1}`,
																			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4" })
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
																			type: "button",
																			variant: "ghost",
																			size: "icon-sm",
																			onClick: () => setFields(fields.filter((item) => item.id !== field.id)),
																			disabled: fields.length <= 1,
																			"aria-label": `Remover pergunta ${index + 1}`,
																			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
																		})
																	]
																})
															]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "grid gap-4 sm:grid-cols-[minmax(0,1fr)_190px]",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "space-y-1.5",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
																		htmlFor: `label-${field.id}`,
																		children: "Pergunta para a comunidade"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
																		id: `label-${field.id}`,
																		value: field.label,
																		maxLength: 45,
																		onChange: (event) => patchField(field.id, { label: event.target.value }),
																		placeholder: "Ex.: O que você precisa resolver?"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
																		className: "m-0 text-right text-[11px] tabular-nums text-muted-foreground",
																		children: [field.label.length, "/45"]
																	})
																]
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "space-y-1.5",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
																	htmlFor: `type-${field.id}`,
																	children: "Tipo de resposta"
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
																	id: `type-${field.id}`,
																	value: field.type,
																	onChange: (event) => {
																		const type = event.target.value;
																		const nextCount = type === "select" ? selectCount : textCount;
																		if (type !== field.type && nextCount >= 5) {
																			setBuilderNotice(type === "select" ? "O Discord permite até cinco escolhas por formulário." : "O Discord permite até cinco perguntas de texto por formulário.");
																			return;
																		}
																		patchField(field.id, {
																			type,
																			options: type === "select" ? field.options.length >= 2 ? field.options : ["Opção 1", "Opção 2"] : []
																		});
																	},
																	children: [
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "short",
																			children: "Texto curto"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "paragraph",
																			children: "Texto longo"
																		}),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																			value: "select",
																			children: "Escolher uma opção"
																		})
																	]
																})]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "mt-4 flex flex-wrap items-center gap-4",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
																className: "flex min-h-9 items-center gap-2 text-sm",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
																	checked: field.required,
																	onCheckedChange: (required) => patchField(field.id, { required })
																}), "Obrigatória"]
															}), field.type !== "select" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "text-xs text-muted-foreground",
																children: [
																	"Resposta de ",
																	field.minLength || 0,
																	" a ",
																	field.maxLength,
																	" caracteres"
																]
															}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-xs text-muted-foreground",
																children: "Até 25 opções"
															})]
														}),
														field.type === "select" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "mt-4 space-y-1.5",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
																	htmlFor: `options-${field.id}`,
																	children: "Opções · uma por linha"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
																	id: `options-${field.id}`,
																	rows: Math.min(Math.max(field.options.length, 2), 6),
																	value: field.options.join("\n"),
																	onChange: (event) => {
																		const values = event.target.value.split("\n").map((value) => value.trim().slice(0, 100)).filter(Boolean);
																		patchField(field.id, { options: values.slice(0, 25) });
																	},
																	placeholder: "Dúvida\nProblema\nSugestão"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
																	className: "m-0 text-right text-[11px] tabular-nums text-muted-foreground",
																	children: [field.options.length, "/25 opções"]
																})
															]
														}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px_120px]",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "space-y-1.5",
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
																		htmlFor: `placeholder-${field.id}`,
																		children: "Exemplo de resposta"
																	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
																		id: `placeholder-${field.id}`,
																		value: field.placeholder,
																		maxLength: 100,
																		onChange: (event) => patchField(field.id, { placeholder: event.target.value }),
																		placeholder: "Ex.: explique o que aconteceu"
																	})]
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "space-y-1.5",
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
																		htmlFor: `min-${field.id}`,
																		children: "Mínimo"
																	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
																		id: `min-${field.id}`,
																		type: "number",
																		min: 0,
																		max: 4e3,
																		value: field.minLength,
																		onChange: (event) => patchField(field.id, { minLength: Math.min(Number(field.maxLength) || 1e3, Math.max(0, Number(event.target.value) || 0)) })
																	})]
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "space-y-1.5",
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
																		htmlFor: `max-${field.id}`,
																		children: "Máximo"
																	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
																		id: `max-${field.id}`,
																		type: "number",
																		min: 1,
																		max: 4e3,
																		value: field.maxLength,
																		onChange: (event) => {
																			const maxLength = Math.min(4e3, Math.max(1, Number(event.target.value) || 1));
																			patchField(field.id, {
																				maxLength,
																				minLength: Math.min(field.minLength, maxLength)
																			});
																		}
																	})]
																})
															]
														})
													]
												}, field.id))
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "mt-3 flex flex-wrap gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
													type: "button",
													variant: "outline",
													size: "sm",
													onClick: () => addField("short"),
													disabled: !canAddText,
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Pergunta de texto"]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
													type: "button",
													variant: "outline",
													size: "sm",
													onClick: () => addField("select"),
													disabled: !canAddSelect,
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Pergunta de escolha"]
												})]
											}),
											builderNotice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												role: "status",
												className: "mb-0 mt-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn",
												children: builderNotice
											}) : null
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
										"aria-labelledby": "delivery-title",
										className: "border-t border-border pt-6",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												id: "delivery-title",
												className: "m-0 text-base font-semibold",
												children: "Onde o formulário aparece"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "mb-4 mt-1 text-sm text-muted-foreground",
												children: "O painel é a mensagem que a comunidade encontra no Discord."
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid gap-4 sm:grid-cols-2",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "space-y-1.5",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
															htmlFor: "form-channel",
															children: "Canal do painel"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
															id: "form-channel",
															kind: "text",
															value: asString(fcfg.config.panelChannelId),
															onChange: (panelChannelId) => updateConfig("forms", { panelChannelId }),
															placeholder: "Selecione um canal"
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "space-y-1.5",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
															htmlFor: "form-review-channel",
															children: "Canal para revisar respostas"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordSelect, {
															id: "form-review-channel",
															kind: "text",
															value: asString(fcfg.config.reviewChannelId),
															onChange: (reviewChannelId) => updateConfig("forms", { reviewChannelId }),
															placeholder: "Selecione um canal"
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("datalist", {
														id: "form-text-channels",
														children: channels.filter((channel) => channel.type === "text").flatMap((channel) => [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: channel.name }, channel.id),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: `#${channel.name}` }, `${channel.id}-hash`),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: channel.id }, `${channel.id}-id`)
														])
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "space-y-1.5",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
															htmlFor: "form-title",
															children: "Título do painel"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
															id: "form-title",
															value: asString(fcfg.config.panelTitle),
															maxLength: 256,
															onChange: (event) => updateConfig("forms", { panelTitle: event.target.value })
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "space-y-1.5",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
															htmlFor: "form-button",
															children: "Texto do botão"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
															id: "form-button",
															value: asString(fcfg.config.panelButtonLabel, "Preencher formulário"),
															maxLength: 80,
															onChange: (event) => updateConfig("forms", { panelButtonLabel: event.target.value })
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "space-y-1.5 sm:col-span-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
															htmlFor: "form-description",
															children: "Explicação para quem vai responder"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
															id: "form-description",
															value: asString(fcfg.config.panelDescription),
															maxLength: 3e3,
															onChange: (event) => updateConfig("forms", { panelDescription: event.target.value }),
															rows: 3,
															placeholder: "Explique o que a pessoa precisa preparar antes de começar."
														})]
													})
												]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
										"aria-labelledby": "review-settings-title",
										className: "border-t border-border pt-6",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												id: "review-settings-title",
												className: "m-0 text-base font-semibold",
												children: "Como a equipe recebe e revisa"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "mb-4 mt-1 text-sm text-muted-foreground",
												children: "Essas regras são aplicadas pelo bot quando uma pessoa envia o formulário."
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "grid gap-x-8 gap-y-4 sm:grid-cols-2",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
														className: "flex min-h-10 items-center justify-between gap-4 text-sm",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Avisar cargos revisores" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
															checked: Boolean(fcfg.config.notifyReviewers),
															onCheckedChange: (value) => updateConfig("forms", { notifyReviewers: value })
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
														className: "flex min-h-10 items-center justify-between gap-4 text-sm",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Exigir motivo ao recusar" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
															checked: Boolean(fcfg.config.requireReasonOnReject),
															onCheckedChange: (value) => updateConfig("forms", { requireReasonOnReject: value })
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "space-y-1.5",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
															htmlFor: "form-cooldown",
															children: "Intervalo entre envios (horas)"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
															id: "form-cooldown",
															type: "number",
															min: 0,
															max: 8760,
															value: Number(fcfg.config.cooldownHours ?? 24),
															onChange: (event) => updateConfig("forms", { cooldownHours: Math.max(0, Number(event.target.value) || 0) })
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "space-y-1.5",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
															htmlFor: "form-limit",
															children: "Envios por pessoa"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
															id: "form-limit",
															type: "number",
															min: 1,
															max: 100,
															value: Number(fcfg.config.maxSubmissionsPerUser ?? 3),
															onChange: (event) => updateConfig("forms", { maxSubmissionsPerUser: Math.max(1, Number(event.target.value) || 1) })
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "space-y-1.5",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
															htmlFor: "form-account-age",
															children: "Idade mínima da conta (dias)"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
															id: "form-account-age",
															type: "number",
															min: 0,
															max: 3650,
															value: Number(fcfg.config.minAccountAgeDays ?? 0),
															onChange: (event) => updateConfig("forms", { minAccountAgeDays: Math.max(0, Number(event.target.value) || 0) })
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "space-y-1.5 sm:col-span-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
															htmlFor: "form-reviewers",
															children: "Cargos que revisam"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordMultiSelect, {
															value: Array.isArray(fcfg.config.reviewerRoleIds) ? fcfg.config.reviewerRoleIds : [],
															onChange: (reviewerRoleIds) => updateConfig("forms", { reviewerRoleIds })
														})]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
														className: "flex min-h-10 items-center justify-between gap-4 text-sm",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Pré-análise com IA" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
															checked: Boolean(fcfg.config.useAiPreReview),
															onCheckedChange: (value) => updateConfig("forms", { useAiPreReview: value }),
															disabled: !planAllows(guild.plan, "ai")
														})]
													})
												]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap items-center gap-3 border-t border-border pt-5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											onClick: () => void publishFormPanel(),
											disabled: publishBusy || !formsAllowed,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "size-4" }), publishBusy ? "Aguardando o bot…" : "Publicar painel no Discord"]
										}), publishNotice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											role: "status",
											className: "m-0 text-sm text-muted-foreground",
											children: publishNotice
										}) : null]
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
								className: "hidden min-w-0 2xl:sticky 2xl:top-24 2xl:block 2xl:self-start",
								"aria-label": "Prévia do formulário no Discord",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mb-3 flex items-center gap-2 text-sm font-semibold",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "size-4 text-primary" }),
											" Prévia no Discord ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "ml-auto text-xs font-normal text-muted-foreground",
												children: "rascunho · não publicado"
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordFormPreview, {
										title: asString(fcfg.config.panelTitle, "Formulário"),
										description: asString(fcfg.config.panelDescription),
										buttonLabel: asString(fcfg.config.panelButtonLabel, "Preencher formulário"),
										fields
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-4 rounded-lg border border-border bg-card px-4 py-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "m-0 flex items-center gap-2 text-sm font-semibold",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4 text-primary" }), " Limites do Discord"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mb-0 mt-1 text-xs leading-5 text-muted-foreground",
											children: "Até 5 perguntas de texto no modal e 5 escolhas na etapa anterior. Cada escolha aceita até 25 opções."
										})]
									})
								]
							})]
						})
					})
				]
			})
		]
	}, gid);
}
//#endregion
export { FormsPage as component };
