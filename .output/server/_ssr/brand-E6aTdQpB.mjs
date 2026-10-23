import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { Q as cn, tt as initials } from "./router-DlyrBhH9.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/brand-E6aTdQpB.js
var import_jsx_runtime = require_jsx_runtime();
function BrandMark({ size = 36, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("grid place-items-center rounded-[10px] bg-primary text-primary-foreground", className),
		style: {
			width: size,
			height: size
		},
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
			viewBox: "0 0 24 24",
			width: size * .64,
			height: size * .64,
			fill: "none",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M4 7.2 8.1 17l3.9-7.4 3.9 7.4L20 7.2",
				stroke: "currentColor",
				strokeWidth: "2.2",
				strokeLinecap: "round",
				strokeLinejoin: "round"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M5 19.2h14",
				stroke: "currentColor",
				strokeWidth: "1.6",
				strokeLinecap: "round",
				opacity: ".78"
			})]
		})
	});
}
function MemberAvatar({ name, hue, size = 36, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("grid shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white", className),
		style: {
			width: size,
			height: size,
			background: `hsl(${hue} 42% 38%)`
		},
		"aria-hidden": true,
		children: initials(name)
	});
}
function GuildBadge({ tag, size = 44, active, iconUrl }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("grid place-items-center overflow-hidden rounded-[14px] bg-muted text-[12px] font-semibold tracking-wide transition-transform duration-150", active && "ring-2 ring-primary"),
		style: {
			width: size,
			height: size
		},
		children: iconUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src: iconUrl,
			alt: "",
			width: size,
			height: size,
			className: "size-full object-cover"
		}) : tag
	});
}
//#endregion
export { GuildBadge as n, MemberAvatar as r, BrandMark as t };
