import { createServerFn } from "@tanstack/react-start";
import {
  CYCLE_DISCOUNTS,
  planIdFromName,
  plans as fallbackPlans,
  SHARD_STORE,
  checkoutUrl,
  type CatalogPlan,
  type PlanId,
} from "./catalog";

export type BillingSubscription = {
  id: string;
  status: string;
  productName: string;
  planId: PlanId | null;
  discordUsername: string | null;
  billingCycle: string;
  nextBillingDate: string;
  priceCents: number;
};

export type BillingSnapshot = {
  ok: boolean;
  error?: string;
  storeName: string;
  storeUrl: string;
  plans: CatalogPlan[];
  subscriptions: BillingSubscription[];
  discounts: { label: string; discount: number }[];
};

const ENDPOINT = "https://shardpay.app/api/mcp";

async function apiKey() {
  return process.env.SHARDPAY_API_KEY?.trim() ?? "";
}

function brl(cents: number, recurring: boolean) {
  const value = (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return recurring ? `${value}/mês` : value;
}

async function mcpCall(key: string, session: string | null, body: unknown) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (session) headers["mcp-session-id"] = session;
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  const next = res.headers.get("mcp-session-id") ?? session;
  if (!res.ok && res.status !== 202) {
    throw new Error(`ShardPay respondeu ${res.status}.`);
  }
  const text = await res.text();
  const json = text ? (JSON.parse(text) as { result?: unknown; error?: { message?: string } }) : null;
  if (json?.error) throw new Error(json.error.message || "Erro na ShardPay.");
  return { session: next, json };
}

function structured(result: unknown): unknown {
  if (!result || typeof result !== "object") return null;
  const row = result as { structuredContent?: unknown; content?: Array<{ text?: string }> };
  if (row.structuredContent !== undefined) return row.structuredContent;
  const text = row.content?.[0]?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function offline(): BillingSnapshot {
  return {
    ok: false,
    error: "ShardPay indisponível. Mostrando a vitrine WumPlus salva.",
    storeName: SHARD_STORE.name,
    storeUrl: SHARD_STORE.url,
    plans: fallbackPlans,
    subscriptions: [],
    discounts: CYCLE_DISCOUNTS.map((c) => ({ label: c.label, discount: c.discount })),
  };
}

/**
 * Le assinaturas e planos da ShardPay. Funcao plana para que o handler de
 * sessao possa chamar sem aninhar `createServerFn`.
 */
export async function loadBilling(): Promise<BillingSnapshot> {
  const key = await apiKey();
  if (!key) return { ...offline(), error: "Chave da ShardPay não configurada neste ambiente." };
  try {
    let { session } = await mcpCall(key, null, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "wumpus", version: "2.0.0" },
      },
    });
    await mcpCall(key, session, { jsonrpc: "2.0", method: "notifications/initialized" });

    const call = async (name: string, args: Record<string, string>, id: number) => {
      const next = await mcpCall(key, session, {
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: args },
      });
      session = next.session;
      return structured(next.json?.result);
    };

    const productsRaw = await call("list_products", { store_id: SHARD_STORE.id }, 2);
    const plansRaw = await call("list_recurring_plans", { store_id: SHARD_STORE.id }, 3);
    const subsRaw = await call("list_recurring_subscriptions", { store_id: SHARD_STORE.id }, 4);

    const products = Array.isArray((productsRaw as { products?: unknown })?.products)
      ? ((productsRaw as { products: Array<Record<string, unknown>> }).products)
      : [];
    const live = new Map<PlanId, CatalogPlan>();
    for (const product of products) {
      const name = typeof product.name === "string" ? product.name : "";
      const id = planIdFromName(name);
      if (!id || typeof product.id !== "string") continue;
      const cents = typeof product.price_cents === "number" ? product.price_cents : 0;
      const base = fallbackPlans.find((p) => p.id === id);
      const recurring = Boolean(product.recurring_plan_id) || id !== "vitalicio";
      live.set(id, {
        id,
        productId: product.id,
        name: base?.name ?? name,
        priceCents: cents,
        recurring,
        price: brl(cents, recurring),
        blurb: base?.blurb ?? "",
        features: base?.features ?? [],
        highlight: base?.highlight,
        checkoutUrl: checkoutUrl(product.id),
      });
    }

    const merged = fallbackPlans.map((plan) => live.get(plan.id) ?? plan);

    const cycles = Array.isArray(plansRaw) ? (plansRaw as Array<{ cycles?: Array<{ billing_cycle?: string; discount_percentage?: number }> }>) : [];
    const discounts = CYCLE_DISCOUNTS.map((cycle) => {
      const found = cycles.flatMap((p) => p.cycles ?? []).find((c) => c.billing_cycle === cycle.id);
      return { label: cycle.label, discount: found?.discount_percentage ?? cycle.discount };
    });

    const list = (subsRaw as { subscriptions?: Array<Record<string, unknown>> } | null)?.subscriptions ?? [];
    const subscriptions: BillingSubscription[] = list.map((sub) => {
      const product = (sub.product ?? {}) as { name?: string };
      const productName = product.name ?? "Plano";
      return {
        id: String(sub.id ?? ""),
        status: String(sub.status ?? ""),
        productName,
        planId: planIdFromName(productName),
        discordUsername: typeof sub.discord_username === "string" ? sub.discord_username : null,
        billingCycle: String(sub.billing_cycle ?? ""),
        nextBillingDate: String(sub.next_billing_date ?? ""),
        priceCents: typeof sub.price_cents === "number" ? sub.price_cents : 0,
      };
    });

    return {
      ok: true,
      storeName: SHARD_STORE.name,
      storeUrl: SHARD_STORE.url,
      plans: merged,
      subscriptions,
      discounts,
    };
  } catch (error) {
    return { ...offline(), error: error instanceof Error ? error.message : "Falha ao falar com a ShardPay." };
  }
}

/** Porta de entrada do cliente. */
export const getBilling = createServerFn({ method: "GET" }).handler(async () => loadBilling());
