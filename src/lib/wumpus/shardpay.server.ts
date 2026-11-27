import {
  CYCLE_DISCOUNTS,
  planIdFromName,
  planIdFromProductId,
  plans as fallbackPlans,
  SHARD_STORE,
  checkoutUrl,
  type CatalogPlan,
  type PlanId,
} from "./catalog";
import { isDatabaseConfigured, readPersistentState, writePersistentState } from "./database.server";

export type BillingSubscription = {
  id: string;
  status: string;
  productName: string;
  productId: string | null;
  planId: PlanId | null;
  discordUsername: string | null;
  discordUserId: string | null;
  billingCycle: string;
  nextBillingDate: string;
  startedAt?: string;
  periodEndsAt?: string;
  canceledAt?: string;
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
const CACHE_TTL_MS = 60_000;
const LAST_GOOD_KEY = "billing-snapshot";

let cache: { snapshot: BillingSnapshot; at: number } | null = null;
let inFlight: Promise<BillingSnapshot> | null = null;

async function apiKey() {
  return process.env.SHARDPAY_API_KEY?.trim() ?? "";
}

function brl(cents: number, recurring: boolean) {
  const value = (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return recurring ? `${value}/mês` : value;
}

function dateString(value: unknown): string | undefined {
  const milliseconds = typeof value === "number"
    ? (value < 10_000_000_000 ? value * 1000 : value)
    : typeof value === "string" && value.trim()
      ? Date.parse(value)
      : Number.NaN;
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : undefined;
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

function sanitizeSubscription(value: unknown): BillingSubscription | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<BillingSubscription>;
  if (typeof row.id !== "string" || typeof row.status !== "string") return null;
  const productName = typeof row.productName === "string" ? row.productName : "Plano";
  const productId = typeof row.productId === "string" ? row.productId : null;
  const planId: PlanId | null =
    row.planId === "gratuito" || row.planId === "pro" || row.planId === "vitalicio"
      ? row.planId
      : planIdFromName(productName) ?? planIdFromProductId(productId);
  return {
    id: row.id,
    status: row.status,
    productName,
    productId,
    planId,
    discordUsername: typeof row.discordUsername === "string" ? row.discordUsername : null,
    discordUserId: typeof row.discordUserId === "string" ? row.discordUserId : null,
    billingCycle: typeof row.billingCycle === "string" ? row.billingCycle : "",
    nextBillingDate: typeof row.nextBillingDate === "string" ? row.nextBillingDate : "",
    ...(typeof row.startedAt === "string" ? { startedAt: row.startedAt } : {}),
    ...(typeof row.periodEndsAt === "string" ? { periodEndsAt: row.periodEndsAt } : {}),
    ...(typeof row.canceledAt === "string" ? { canceledAt: row.canceledAt } : {}),
    priceCents: typeof row.priceCents === "number" ? row.priceCents : 0,
  };
}

function sanitizeSnapshot(value: unknown): BillingSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<BillingSnapshot>;
  if (!Array.isArray(row.plans) || !Array.isArray(row.subscriptions)) return null;
  const plans = row.plans.filter(
    (plan): plan is CatalogPlan =>
      Boolean(plan) && typeof plan === "object" && typeof (plan as CatalogPlan).id === "string",
  );
  if (!plans.length) return null;
  return {
    ok: true,
    storeName: SHARD_STORE.name,
    storeUrl: SHARD_STORE.url,
    plans,
    subscriptions: row.subscriptions.flatMap((sub) => {
      const sanitized = sanitizeSubscription(sub);
      return sanitized ? [sanitized] : [];
    }),
    discounts: CYCLE_DISCOUNTS.map((cycle) => {
      const found = Array.isArray(row.discounts)
        ? row.discounts.find((item) => item && item.label === cycle.label && typeof item.discount === "number")
        : undefined;
      return { label: cycle.label, discount: found?.discount ?? cycle.discount };
    }),
  };
}

/**
 * Ultimo retrato bom da ShardPay, gravado quando a API respondeu.
 * Serve para nao rebaixar assinantes pagos a Gratuito durante uma queda.
 */
async function readLastGood(): Promise<BillingSnapshot | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    return sanitizeSnapshot(await readPersistentState<unknown>(LAST_GOOD_KEY));
  } catch {
    return null;
  }
}

async function persistLastGood(snapshot: BillingSnapshot): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await writePersistentState(LAST_GOOD_KEY, snapshot);
  } catch {
    // Melhor esforco: o fallback e uma rede de seguranca, nao um requisito.
  }
}

/**
 * Le assinaturas e planos da ShardPay. Funcao plana para que o handler de
 * sessao possa chamar sem aninhar `createServerFn`.
 */
export async function loadBilling(force = false): Promise<BillingSnapshot> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.snapshot;
  if (!force && inFlight) return inFlight;

  const pending = fetchBilling()
    .then((snapshot) => {
      // Falhas tambem entram no cache curto: com a ShardPay fora do ar,
      // cada checagem de acesso nao pode esperar o timeout de 12 s de novo.
      cache = { snapshot, at: Date.now() };
      if (snapshot.ok) void persistLastGood(snapshot);
      return snapshot;
    })
    .finally(() => {
      if (inFlight === pending) inFlight = null;
    });
  if (!force) inFlight = pending;
  return pending;
}

async function fetchBilling(): Promise<BillingSnapshot> {
  const key = await apiKey();
  if (!key) {
    const error = "Chave da ShardPay não configurada neste ambiente.";
    const lastGood = await readLastGood();
    return lastGood ? { ...lastGood, ok: false, error } : { ...offline(), error };
  }
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
      if (typeof product.id !== "string") continue;
      const id = planIdFromName(name) ?? planIdFromProductId(product.id);
      if (!id) continue;
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
      const product = (sub.product ?? {}) as { name?: string; id?: string };
      const productName = product.name ?? "Plano";
      const productId =
        typeof product.id === "string" ? product.id
          : typeof sub.product_id === "string" ? sub.product_id
            : typeof sub.productId === "string" ? sub.productId
              : null;
      return {
        id: String(sub.id ?? ""),
        status: String(sub.status ?? ""),
        productName,
        productId,
        planId: planIdFromName(productName) ?? planIdFromProductId(productId),
        discordUsername: typeof sub.discord_username === "string" ? sub.discord_username : null,
        discordUserId: typeof sub.discord_user_id === "string" ? sub.discord_user_id : typeof sub.discordUserId === "string" ? sub.discordUserId : null,
        billingCycle: String(sub.billing_cycle ?? ""),
        nextBillingDate: String(sub.next_billing_date ?? ""),
        startedAt: dateString(sub.started_at ?? sub.start_date ?? sub.created_at ?? sub.createdAt),
        periodEndsAt: dateString(sub.current_period_end ?? sub.period_ends_at ?? sub.ends_at ?? sub.end_date),
        canceledAt: dateString(sub.canceled_at ?? sub.cancelled_at),
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
    const message = error instanceof Error ? error.message : "Falha ao falar com a ShardPay.";
    const lastGood = await readLastGood();
    if (lastGood) {
      return {
        ...lastGood,
        ok: false,
        error: `${message} Usando o último estado conhecido das assinaturas.`,
      };
    }
    return { ...offline(), error: message };
  }
}

