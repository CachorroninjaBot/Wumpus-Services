import { i as __toESM } from "../_runtime.mjs";
import { s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { r as createServerFn } from "./ssr.mjs";
import { o as object } from "../_libs/zod.mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-billing-DZGU8iJ8.js
var import_react = /* @__PURE__ */ __toESM(require_react());
/** Vitrine pública, sem nomes, IDs ou estados de assinatura de compradores. */
var getBilling = createServerFn({ method: "GET" }).handler(createSsrRpc("d478b4fac09a04b4fe2c698c93b9e5f8a6a72ed12aa41f680be20557554c9132"));
/** Cada cliente só recebe os contratos vinculados à própria conta Discord. */
var getMyBilling = createServerFn({ method: "POST" }).validator((input) => object({}).strict().parse(input)).handler(createSsrRpc("b9b8e846fa3145d26239c5638788555f03fae8c509bab04f90a095db8d75760c"));
function useBilling(privateAccount = false) {
	const [data, setData] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		let alive = true;
		(privateAccount ? getMyBilling({ data: {} }) : getBilling()).then((snapshot) => {
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
	}, [privateAccount]);
	return {
		data,
		loading
	};
}
//#endregion
export { useBilling as t };
