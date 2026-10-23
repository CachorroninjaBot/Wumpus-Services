import { d as setResponseHeaders, r as createServerFn } from "./ssr.mjs";
import { n as enforceRequestLimit, t as createServerRpc } from "./request-limits.server-D3WMs2Xr.mjs";
import { o as object } from "../_libs/zod.mjs";
import { b as verifySignedSession, c as loadBilling, n as configuredLifetimeSubscriptions, s as listDashboardGrants } from "./session-access.server-BEsHDisY.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/shardpay-BiXaDHTg.js
function noStore() {
	setResponseHeaders(new Headers({
		"Cache-Control": "private, no-store",
		Vary: "Cookie"
	}));
}
/** Vitrine pública, sem nomes, IDs ou estados de assinatura de compradores. */
var getBilling_createServerFn_handler = createServerRpc({
	id: "d478b4fac09a04b4fe2c698c93b9e5f8a6a72ed12aa41f680be20557554c9132",
	name: "getBilling",
	filename: "src/lib/wumpus/shardpay.ts"
}, (opts) => getBilling.__executeServer(opts));
var getBilling = createServerFn({ method: "GET" }).handler(getBilling_createServerFn_handler, async () => {
	enforceRequestLimit("public-billing", 60, 6e4);
	const snapshot = await loadBilling();
	noStore();
	return {
		...snapshot,
		...snapshot.ok ? {} : { error: "Não foi possível carregar os planos no momento." },
		subscriptions: []
	};
});
var getMyBilling_createServerFn_handler = createServerRpc({
	id: "b9b8e846fa3145d26239c5638788555f03fae8c509bab04f90a095db8d75760c",
	name: "getMyBilling",
	filename: "src/lib/wumpus/shardpay.ts"
}, (opts) => getMyBilling.__executeServer(opts));
var getMyBilling = createServerFn({ method: "POST" }).validator((input) => object({}).strict().parse(input)).handler(getMyBilling_createServerFn_handler, async () => {
	const user = await verifySignedSession("");
	enforceRequestLimit("account-billing", 30, 6e4, user.userId);
	const [snapshot, grants] = await Promise.all([loadBilling(), listDashboardGrants()]);
	const subscriptions = snapshot.subscriptions.filter((subscription) => subscription.discordUserId === user.userId);
	subscriptions.push(...grants.filter((grant) => grant.userId === user.userId && !grant.revokedAt && grant.expiresAt > Date.now()).map((grant) => ({
		id: grant.id,
		status: "active",
		productName: `Acesso temporário · ${grant.planId}`,
		planId: grant.planId,
		discordUsername: grant.username,
		discordUserId: grant.userId,
		billingCycle: "concessão administrativa",
		nextBillingDate: "",
		startedAt: new Date(grant.createdAt).toISOString(),
		periodEndsAt: new Date(grant.expiresAt).toISOString(),
		priceCents: 0
	})));
	if (configuredLifetimeSubscriptions().some((row) => row.discordUserId === user.userId)) subscriptions.push({
		id: `lifetime-${user.userId}`,
		status: "active",
		productName: "WumPlus Vitalício",
		planId: "vitalicio",
		discordUsername: user.username,
		discordUserId: user.userId,
		billingCycle: "pagamento único",
		nextBillingDate: "",
		priceCents: 0
	});
	noStore();
	return {
		...snapshot,
		subscriptions
	};
});
//#endregion
export { getBilling_createServerFn_handler, getMyBilling_createServerFn_handler };
