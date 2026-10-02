import { i as __toESM } from "../_runtime.mjs";
import { n as formatRelative, s as uid } from "./utils-H16dNBFI.mjs";
import { o as require_react, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as Badge } from "./badge-C2mxnvvX.mjs";
import { t as Button } from "./button-BUiFN9VL.mjs";
import { t as Card } from "./card-DaYenTQt.mjs";
import { i as Textarea, n as Label, r as NativeSelect, t as Input } from "./input-Cyzc7r1j.mjs";
import { d as useActiveGuild, f as useGuildMembers, m as useWumpus, n as asString, o as planAllows, p as useModule } from "./store-B26y7m0l.mjs";
import { r as Trash2, s as Plus } from "../_libs/lucide-react.mjs";
import { n as DiscordPanel, t as DiscordModalPreview } from "./discord-panel-BH_80gju.mjs";
import { a as analyzeWithGrok, i as DialogTitle, n as DialogContent, r as DialogDesc, t as Dialog } from "./analyze-B-MSwHFT.mjs";
import { t as Switch } from "./switch-C8XyncjG.mjs";
import { i as TabsTrigger, n as TabsContent, r as TabsList, t as Tabs } from "./tabs-B9Iu4s2v.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/forms-DSRC9DGh.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function FormsPage() {
	const gid = useWumpus((s) => s.activeGuildId);
	const questions = useWumpus((s) => s.formQuestions)[gid] ?? [];
	useWumpus((s) => s.setQuestions);
	const submissions = useWumpus((s) => s.submissions).filter((x) => x.guildId === gid);
	const members = useGuildMembers();
	const fcfg = useModule("forms");
	const updateConfig = useWumpus((s) => s.updateConfig);
	const setEnabled = useWumpus((s) => s.setModuleEnabled);
	const submitForm = useWumpus((s) => s.submitForm);
	const reviewForm = useWumpus((s) => s.reviewForm);
	const setAiNote = useWumpus((s) => s.setSubmissionAiNote);
	const user = useWumpus((s) => s.sessionUser);
	const guild = useActiveGuild();
	const publishPanel = useWumpus((s) => s.publishPanel);
	const formsAllowed = planAllows(guild.plan, "forms");
	const aiAllowed = planAllows(guild.plan, "ai") && Boolean(fcfg.config.useAiPreReview);
	const storedFields = Array.isArray(fcfg.config.fields) ? fcfg.config.fields : [];
	const fields = storedFields.length ? storedFields : questions.map((q) => ({
		id: q.id,
		label: q.label,
		type: "paragraph",
		required: q.required,
		options: [],
		maxLength: 500
	}));
	const setFields = useWumpus((s) => s.setFormFields);
	const patchField = (id, patch) => setFields(fields.map((field) => field.id === id ? {
		...field,
		...patch
	} : field));
	const removeField = (id) => setFields(fields.filter((field) => field.id !== id));
	const addField = () => setFields([...fields, {
		id: uid("f"),
		label: "Nova pergunta",
		type: "paragraph",
		required: true,
		options: [],
		maxLength: 500
	}]);
	const [selected, setSelected] = (0, import_react.useState)(submissions.find((s) => s.status === "pending")?.id ?? submissions[0]?.id);
	const [reason, setReason] = (0, import_react.useState)("");
	const [sim, setSim] = (0, import_react.useState)(false);
	const [aiBusy, setAiBusy] = (0, import_react.useState)(false);
	const sub = submissions.find((s) => s.id === selected) ?? null;
	const pending = submissions.filter((s) => s.status === "pending").length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto flex max-w-6xl flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mr-auto m-0 text-xl font-semibold tracking-tight",
						children: "Candidaturas"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
						tone: "warn",
						children: [pending, " na fila"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						onClick: () => setSim(true),
						disabled: !formsAllowed,
						children: "Simular envio"
					})
				]
			}),
			!formsAllowed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "m-0 rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn",
				children: "Plano Essencial inclui candidatura. Se o envio falhar, a ShardPay é quem trava a licença."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
				defaultValue: "inbox",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "inbox",
						children: "Caixa"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "form",
						children: "Formulário"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
						value: "inbox",
						className: "mt-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
								className: "p-2",
								children: [submissions.map((s) => {
									const who = members.find((m) => m.id === s.userId);
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => {
											setSelected(s.id);
											setReason(s.reason);
										},
										className: `flex w-full flex-col rounded-xl px-3 py-2.5 text-left ${sub?.id === s.id ? "bg-muted" : "hover:bg-muted/50"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sm font-medium",
											children: who?.displayName ?? s.userId
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-xs text-muted-foreground",
											children: [
												formatRelative(s.createdAt),
												" · ",
												s.status
											]
										})]
									}, s.id);
								}), submissions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "p-4 text-sm text-muted-foreground",
									children: "Nenhuma candidatura ainda."
								}) : null]
							}), sub ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "m-0 text-lg font-semibold",
										children: members.find((m) => m.id === sub.userId)?.displayName
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone: sub.status === "approved" ? "ok" : sub.status === "rejected" ? "danger" : "warn",
										children: sub.status
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
									className: "mt-4 space-y-3",
									children: questions.map((q) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-xs text-muted-foreground",
										children: q.label
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "m-0 text-sm",
										children: sub.answers[q.id] || "—"
									})] }, q.id))
								}),
								sub.aiNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-4 rounded-xl bg-primary/10 px-3 py-2 text-sm whitespace-pre-wrap",
									children: sub.aiNote
								}) : null,
								sub.status === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 space-y-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Motivo (obrigatório na recusa)" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
											value: reason,
											onChange: (e) => setReason(e.target.value)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap gap-2",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
													onClick: () => {
														const r = reviewForm(sub.id, "approved", reason, user.id);
														if (!r.ok) alert(r.error);
													},
													children: "Aprovar"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
													variant: "destructive",
													onClick: () => {
														const r = reviewForm(sub.id, "rejected", reason, user.id);
														if (!r.ok) alert(r.error);
													},
													children: "Recusar"
												}),
												aiAllowed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
													variant: "outline",
													disabled: aiBusy,
													onClick: async () => {
														setAiBusy(true);
														const body = questions.map((q) => `${q.label}: ${sub.answers[q.id] ?? ""}`).join("\n");
														const res = await analyzeWithGrok({ data: {
															kind: "form",
															title: "Candidatura",
															body
														} });
														setAiBusy(false);
														setAiNote(sub.id, res.ok ? res.text : res.error);
													},
													children: aiBusy ? "Revisando…" : "Pré-review com IA"
												}) : null
											]
										})
									]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-4 text-sm text-muted-foreground",
									children: sub.reason || "Sem motivo registrado."
								})
							] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
								className: "grid min-h-48 place-items-center text-sm text-muted-foreground",
								children: "Selecione uma candidatura."
							})]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
						value: "form",
						className: "mt-4 grid gap-4 lg:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-4 flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "m-0 text-base font-semibold",
									children: "Perguntas do formulário"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: fcfg.enabled,
									onCheckedChange: (v) => setEnabled("forms", v)
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-0 mb-3 text-xs text-muted-foreground",
								children: "O Discord aceita até 5 campos de texto no modal. Campos de escolha são menus e ficam fora desse limite."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-3",
								children: [fields.map((field) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-2 rounded-xl bg-muted/40 p-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
												value: field.label,
												onChange: (e) => patchField(field.id, { label: e.target.value }),
												placeholder: "Pergunta"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												variant: "ghost",
												size: "icon-sm",
												"aria-label": "Remover",
												onClick: () => removeField(field.id),
												disabled: fields.length <= 1,
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap items-center gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(NativeSelect, {
												value: field.type,
												onChange: (e) => patchField(field.id, { type: e.target.value }),
												className: "w-44",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "short",
														children: "Resposta curta"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "paragraph",
														children: "Texto longo"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "select",
														children: "Escolha única"
													})
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "flex items-center gap-2 text-xs text-muted-foreground",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
													checked: field.required,
													onCheckedChange: (v) => patchField(field.id, { required: v })
												}), "Obrigatória"]
											})]
										}),
										field.type === "select" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
											className: "text-xs",
											children: "Opções (uma por linha)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
											className: "mt-1",
											value: field.options.join("\n"),
											onChange: (e) => patchField(field.id, { options: e.target.value.split("\n").map((line) => line.trim()).filter(Boolean) }),
											placeholder: "Dúvida\nDenúncia\nParceria"
										})] }) : null
									]
								}, field.id)), fields.length < 10 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "outline",
									size: "sm",
									onClick: addField,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Pergunta"]
								}) : null]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-5 space-y-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Exigir motivo na recusa" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
											checked: Boolean(fcfg.config.requireReasonOnReject),
											onCheckedChange: (v) => updateConfig("forms", { requireReasonOnReject: v })
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Pré-review com IA" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
											checked: Boolean(fcfg.config.useAiPreReview),
											onCheckedChange: (v) => updateConfig("forms", { useAiPreReview: v })
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Cooldown (horas)" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										className: "mt-1",
										type: "number",
										defaultValue: Number(fcfg.config.cooldownHours ?? 24),
										onBlur: (e) => updateConfig("forms", { cooldownHours: Number(e.target.value) || 0 })
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Título do painel" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										className: "mt-1",
										defaultValue: asString(fcfg.config.panelTitle),
										onBlur: (e) => updateConfig("forms", { panelTitle: e.target.value })
									})] })
								]
							})
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordPanel, {
									channel: "candidaturas",
									title: asString(fcfg.config.panelTitle),
									description: asString(fcfg.config.panelDescription),
									buttons: ["Candidatar-se"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									onClick: () => publishPanel("forms"),
									children: "Publicar painel na fila"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DiscordModalPreview, {
									title: asString(fcfg.config.panelTitle),
									questions: questions.map((q) => q.label)
								})
							]
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
				open: sim,
				onOpenChange: setSim,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Enviar candidatura" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDesc, { children: "Respeita cooldown, idade da conta e limite por pessoa." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SimForm, {
						members,
						questions,
						onSubmit: (userId, answers) => {
							const r = submitForm(userId, answers);
							if (!r.ok) alert(r.error);
							else setSim(false);
						}
					})
				] })
			})
		]
	});
}
function SimForm({ members, questions, onSubmit }) {
	const [userId, setUserId] = (0, import_react.useState)(members[0]?.id ?? "");
	const [answers, setAnswers] = (0, import_react.useState)({});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "mt-4 space-y-3",
		onSubmit: (e) => {
			e.preventDefault();
			onSubmit(userId, answers);
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Membro" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NativeSelect, {
				value: userId,
				onChange: (e) => setUserId(e.target.value),
				children: members.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
					value: m.id,
					children: m.displayName
				}, m.id))
			}),
			questions.map((q) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: q.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
				className: "mt-1",
				value: answers[q.id] ?? "",
				onChange: (e) => setAnswers({
					...answers,
					[q.id]: e.target.value
				}),
				required: true
			})] }, q.id)),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				type: "submit",
				className: "w-full",
				children: "Enviar"
			})
		]
	});
}
//#endregion
export { FormsPage as component };
