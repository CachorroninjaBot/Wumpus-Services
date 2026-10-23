import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { G as ChevronDown } from "../_libs/lucide-react.mjs";
import { t as BrandMark } from "./brand-E6aTdQpB.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/discord-panel-B_4DZK8m.js
var import_jsx_runtime = require_jsx_runtime();
function DiscordPanel({ channel = "abrir-ticket", title, description, accent = "#28655b", buttons, format = "v2" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "discord-window",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "discord-top",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "discord-dot" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "discord-dot" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "discord-dot" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ml-2 truncate",
					children: "Aurora Store — Discord"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "discord-body",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "discord-rail",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, { size: 42 }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-10 rounded-[14px] bg-discord-surface" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-10 rounded-[14px] bg-discord-surface" })
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "discord-channel",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "m-0 text-[13px] font-semibold text-discord-text",
						children: ["#", channel]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 mb-0 text-[12px] text-discord-muted",
						children: "Prévia visual do painel"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, { size: 38 }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "m-0 text-[13px] font-semibold text-white",
								children: ["Wumpus ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-1 rounded-[3px] bg-discord px-1 py-px text-[9px] font-bold uppercase",
									children: "bot"
								})]
							}), format === "v2" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "discord-v2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "discord-kicker",
										children: "Components V2"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "m-0 mt-2 text-[15px] font-semibold text-white",
										children: title
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1.5 mb-0 text-[13px] leading-relaxed text-discord-text",
										children: description
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "discord-sep" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex flex-wrap gap-2",
										children: buttons.map((label) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "discord-btn primary",
											children: label
										}, label))
									})
								]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "discord-embed",
								style: { borderLeftColor: accent },
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "m-0 text-[15px] font-semibold text-white",
										children: title
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1.5 mb-0 text-[13px] leading-relaxed text-discord-text",
										children: description
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-3 flex flex-wrap gap-2",
										children: buttons.map((label) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "discord-btn primary",
											children: label
										}, label))
									})
								]
							})]
						})]
					})
				]
			})]
		})]
	});
}
function DiscordModalPreview({ title, questions }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl bg-discord-surface p-4 text-discord-text shadow-border",
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "m-0 text-[11px] font-semibold tracking-[0.14em] text-discord-muted uppercase",
				children: "Modal do Discord"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 mb-3 text-[16px] font-semibold text-white",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-3",
				children: questions.slice(0, 5).map((q) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 mb-1 text-[11px] font-semibold uppercase tracking-wide text-discord-label",
					children: q
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-9 rounded-md bg-discord-surface-deep" })] }, q))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 flex justify-end gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "discord-btn",
					children: "Cancelar"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "discord-btn primary",
					children: "Enviar"
				})]
			})
		]
	});
}
function DiscordFormPreview({ title, description, buttonLabel, fields }) {
	const selects = fields.filter((field) => field.type === "select").slice(0, 5);
	const textFields = fields.filter((field) => field.type !== "select").slice(0, 5);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "discord-window",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "discord-top",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "discord-dot" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "discord-dot" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "discord-dot" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ml-2 truncate",
					children: "Aurora Store — Discord"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "discord-body",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "discord-rail",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, { size: 42 }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-10 rounded-[14px] bg-discord-surface" })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "discord-channel",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 text-[13px] font-semibold text-discord-text",
						children: "#formularios"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 mb-0 text-[12px] text-discord-muted",
						children: "Prévia visual do formulário"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, { size: 38 }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "m-0 text-[13px] font-semibold text-white",
									children: ["Wumpus ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "ml-1 rounded-[3px] bg-discord px-1 py-px text-[9px] font-bold uppercase",
										children: "bot"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "discord-v2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 mt-1 text-[15px] font-semibold text-white",
											children: title || "Formulário"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-1.5 mb-0 text-[13px] leading-relaxed text-discord-text",
											children: description || "Preencha as perguntas abaixo para enviar sua resposta."
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "discord-sep" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "discord-btn primary",
											children: buttonLabel || "Preencher formulário"
										})
									]
								}),
								selects.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 rounded-lg bg-discord-surface px-3 py-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 text-[11px] font-semibold uppercase tracking-wide text-discord-muted",
											children: "Etapa 1 · escolhas"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mb-0 mt-1 text-[12px] text-discord-text",
											children: "Escolha uma opção para continuar"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mt-3 space-y-2",
											children: selects.map((field) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "rounded-md border border-white/10 bg-discord-surface-deep px-3 py-2.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "flex items-center justify-between gap-2 text-xs text-discord-text",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "truncate",
														children: [field.label || "Escolha uma opção", field.required ? " *" : ""]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, {
														"aria-hidden": "true",
														className: "size-3.5 shrink-0 text-discord-muted"
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "mt-1 block truncate text-[10px] text-discord-muted",
													children: field.options.slice(0, 4).join(" · ") || "Adicione opções no editor"
												})]
											}, field.id))
										})
									]
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 rounded-lg bg-discord-surface px-3 py-3",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "m-0 text-[11px] font-semibold uppercase tracking-wide text-discord-muted",
											children: selects.length ? "Etapa 2 · perguntas" : "Formulário"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mb-3 mt-1 text-[15px] font-semibold text-white",
											children: title || "Formulário"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "space-y-3",
											children: textFields.length ? textFields.map((field) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "m-0 mb-1 text-[11px] font-semibold text-discord-label",
												children: [field.label || "Pergunta", field.required ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "ml-1 text-red-300",
													children: "*"
												}) : null]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "flex min-h-9 items-center rounded-md bg-discord-surface-deep px-2.5 text-[11px] text-discord-muted",
												children: field.placeholder || "Sua resposta…"
											})] }, field.id)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "m-0 text-xs text-discord-muted",
												children: "Adicione uma pergunta de texto ou escolha."
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-4 flex justify-end gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "discord-btn",
												children: "Cancelar"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "discord-btn primary",
												children: "Enviar"
											})]
										})
									]
								})
							]
						})]
					})
				]
			})]
		})]
	});
}
//#endregion
export { DiscordModalPreview as n, DiscordPanel as r, DiscordFormPreview as t };
