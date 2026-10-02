import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/utils-H16dNBFI.js
function cn(...inputs) {
	return twMerge(inputs.filter(Boolean).join(" "));
}
function formatRelative(ts, now = Date.now()) {
	const diff = Math.max(0, now - ts);
	const min = Math.floor(diff / 6e4);
	if (min < 1) return "agora";
	if (min < 60) return `há ${min} min`;
	const h = Math.floor(min / 60);
	if (h < 24) return `há ${h}h`;
	const d = Math.floor(h / 24);
	if (d < 7) return `há ${d}d`;
	return new Date(ts).toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "short"
	});
}
function formatTime(ts) {
	return new Date(ts).toLocaleString("pt-BR", {
		day: "2-digit",
		month: "short",
		hour: "2-digit",
		minute: "2-digit"
	});
}
function uid(prefix = "id") {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
	return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
function hoursAgo(hours, from = Date.now()) {
	return from - hours * 36e5;
}
function minutesAgo(minutes, from = Date.now()) {
	return from - minutes * 6e4;
}
function initials(name) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "W";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
//#endregion
export { initials as a, hoursAgo as i, formatRelative as n, minutesAgo as o, formatTime as r, uid as s, cn as t };
