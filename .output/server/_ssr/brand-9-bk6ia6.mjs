import { a as initials, t as cn } from "./utils-H16dNBFI.mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/brand-9-bk6ia6.js
var import_jsx_runtime = require_jsx_runtime();
function BrandMark({ size = 36, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("grid place-items-center rounded-[10px] bg-primary text-white", className),
		style: {
			width: size,
			height: size
		},
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
			viewBox: "0 0 24 24",
			width: size * .58,
			height: size * .58,
			fill: "none",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M4 5.5h4.2l3.8 10.2L15.8 5.5H20L13.7 20h-3.4L4 5.5Z",
				fill: "currentColor"
			})
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
