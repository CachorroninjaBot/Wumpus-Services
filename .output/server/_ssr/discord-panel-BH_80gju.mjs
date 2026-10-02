import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as BrandMark } from "./brand-9-bk6ia6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/discord-panel-BH_80gju.js
var import_jsx_runtime = require_jsx_runtime();
function DiscordPanel({ channel = "abrir-ticket", title, description, accent = "#7c5cff", buttons, format = "v2" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "discord-window",
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
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-10 rounded-[14px] bg-[#313338]" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-10 rounded-[14px] bg-[#313338]" })
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "discord-channel",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "m-0 text-[13px] font-semibold text-[#f2f3f5]",
						children: ["#", channel]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 mb-0 text-[12px] text-[#949ba4]",
						children: "Painel publicado pelo Wumpus"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, { size: 38 }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "m-0 text-[13px] font-semibold text-white",
								children: ["Wumpus ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "ml-1 rounded-[3px] bg-[#5865f2] px-1 py-px text-[9px] font-bold uppercase",
									children: "bot"
								})]
							}), format === "v2" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "discord-v2",
								style: { borderColor: accent },
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
										className: "mt-1.5 mb-0 text-[13px] leading-relaxed text-[#dbdee1]",
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
										className: "mt-1.5 mb-0 text-[13px] leading-relaxed text-[#dbdee1]",
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
		className: "rounded-2xl bg-[#313338] p-4 text-[#dbdee1] shadow-border",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "m-0 text-[11px] font-semibold tracking-[0.14em] text-[#949ba4] uppercase",
				children: "Modal do Discord"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 mb-3 text-[16px] font-semibold text-white",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-3",
				children: questions.slice(0, 5).map((q) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#b5bac1]",
					children: q
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-9 rounded-md bg-[#1e1f22]" })] }, q))
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
//#endregion
export { DiscordPanel as n, DiscordModalPreview as t };
