import { i as __toESM } from "../_runtime.mjs";
import { o as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as getBilling } from "./shardpay-eAlUbe5F.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-billing-CbM63Gq5.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function useBilling() {
	const [data, setData] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		let alive = true;
		getBilling().then((snapshot) => {
			if (!alive) return;
			if (snapshot && typeof snapshot === "object" && Array.isArray(snapshot.plans)) setData(snapshot);
		}).catch(() => {
			if (alive) setData(null);
		}).finally(() => {
			if (alive) setLoading(false);
		});
		return () => {
			alive = false;
		};
	}, []);
	return {
		data,
		loading
	};
}
//#endregion
export { useBilling as t };
