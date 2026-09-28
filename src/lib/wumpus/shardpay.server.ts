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

offline function wait I made a typo - I cannot fix inside the call. Let me not send a broken file.
