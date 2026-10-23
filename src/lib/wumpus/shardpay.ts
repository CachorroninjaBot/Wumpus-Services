import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { configuredLifetimeSubscriptions } from "./entitlements";
import { listDashboardGrants } from "./admin-store.server";
import { loadBilling, type BillingSnapshot } from "./shardpay.server";
import { verifySignedSession } from "./session-access.server";
import { setResponseHeaders } from "@tanstack/react-start/server";
import { enforceRequestLimit } from "./request-limits.server";

export type { BillingSnapshot, BillingSubscription } from "./shardpay.server";

function noStore(): void {
  setResponseHeaders(new Headers({ "Cache-Control": "private, no-store", Vary: "Cookie" }));
}

/** Vitrine pública, sem nomes, IDs ou estados de assinatura de compradores. */
export const getBilling = createServerFn({ method: "GET" }).handler(async (): Promise<BillingSnapshot> => {
  enforceRequestLimit("public-billing", 60, 60_000);
  const snapshot = await loadBilling();
  noStore();
  return {
    ...snapshot,
    ...(snapshot.ok ? {} : { error: "Não foi possível carregar os planos no momento." }),
    subscriptions: [],
  };
});

/** Cada cliente só recebe os contratos vinculados à própria conta Discord. */
export const getMyBilling = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({}).strict().parse(input))
  .handler(async (): Promise<BillingSnapshot> => {
    const user = await verifySignedSession("");
    enforceRequestLimit("account-billing", 30, 60_000, user.userId);
    const [snapshot, grants] = await Promise.all([loadBilling(), listDashboardGrants()]);
    // Username is mutable and can be reused; it is not safe as an identity key
    // for exposing private billing information. Only trust the Discord snowflake.
    const subscriptions = snapshot.subscriptions.filter((subscription) => subscription.discordUserId === user.userId);
    subscriptions.push(...grants
      .filter((grant) => grant.userId === user.userId && !grant.revokedAt && grant.expiresAt > Date.now())
      .map((grant) => ({
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
        priceCents: 0,
      })));
    if (configuredLifetimeSubscriptions().some((row) => row.discordUserId === user.userId)) {
      subscriptions.push({
        id: `lifetime-${user.userId}`,
        status: "active",
        productName: "WumPlus Vitalício",
        planId: "vitalicio",
        discordUsername: user.username,
        discordUserId: user.userId,
        billingCycle: "pagamento único",
        nextBillingDate: "",
        priceCents: 0,
      });
    }
    noStore();
    return { ...snapshot, subscriptions };
  });
