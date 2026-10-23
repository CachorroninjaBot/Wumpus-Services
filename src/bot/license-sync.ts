import { planIdFromName, serverLimit, type PlanId } from "../lib/wumpus/catalog.ts";
import { configuredLifetimeSubscriptions, planForUser, type SubscriptionLite } from "../lib/wumpus/entitlements.ts";
import { listDashboardGrants } from "../lib/wumpus/admin-store.server.ts";
import { isPlatformOwner } from "../lib/wumpus/owner.ts";
import { mutateGuildLicenses, readGuildLicenses, type GuildLicense } from "../lib/wumpus/license-store.server.ts";
import type { Logger } from "./logger.ts";

const ENDPOINT = "https://shardpay.app/api/mcp";
const STORE_ID = "01a09384-95b0-707d-8fc7-d82191e14827";

type Subscription = SubscriptionLite & { productName: string };

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function structured(value: unknown): unknown {
  const result = asObject(value)?.result;
  const row = asObject(result);
  if (!row) return null;
  if (row.structuredContent !== undefined) return row.structuredContent;
  const content = Array.isArray(row.content) ? row.content : [];
  for (const block of content) {
    const text = asObject(block)?.text;
    if (typeof text !== "string") continue;
    try { return JSON.parse(text); } catch { /* try next content block */ }
  }
  return null;
}

async function mcpCall(key: string, session: string | null, body: unknown) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (session) headers["mcp-session-id"] = session;
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok && response.status !== 202) throw new Error(`ShardPay respondeu ${response.status}.`);
  const text = await response.text();
  return {
    session: response.headers.get("mcp-session-id") ?? session,
    json: text ? JSON.parse(text) as unknown : null,
  };
}

async function loadSubscriptions(): Promise<Subscription[] | null> {
  const key = process.env.SHARDPAY_API_KEY?.trim();
  if (!key) return null;
  const { session } = await mcpCall(key, null, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "wumpus-bot", version: "1.0.0" } },
  });
  await mcpCall(key, session, { jsonrpc: "2.0", method: "notifications/initialized" });
  const result = await mcpCall(key, session, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "list_recurring_subscriptions", arguments: { store_id: STORE_ID } },
  });
  const payload = asObject(structured(result.json));
  if (!Array.isArray(payload?.subscriptions)) return null;
  const rows = payload.subscriptions;
  const manualGrants = (await listDashboardGrants())
    .filter((grant) => !grant.revokedAt && grant.expiresAt > Date.now())
    .map((grant) => ({
      status: "active",
      planId: grant.planId,
      discordUsername: grant.username,
      discordUserId: grant.userId,
      expiresAt: grant.expiresAt,
      productName: `Acesso administrativo · ${grant.planId}`,
    }));
  return [
    ...rows.flatMap((raw): Subscription[] => {
    const row = asObject(raw);
    const productName = String(asObject(row?.product)?.name ?? "");
    const planId = planIdFromName(productName);
    if (!row || !planId) return [];
    return [{
      status: String(row.status ?? ""),
      planId,
      discordUsername: typeof row.discord_username === "string" ? row.discord_username : null,
      discordUserId: typeof row.discord_user_id === "string" ? row.discord_user_id : typeof row.discordUserId === "string" ? row.discordUserId : null,
      productName,
    }];
    }),
    ...manualGrants,
    ...configuredLifetimeSubscriptions().map((sub) => ({ ...sub, productName: "Wumpus Vitalício" })),
  ];
}

function accountPlan(records: GuildLicense[], subscriptions: Subscription[]): PlanId | null {
  const identity = [...records].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (!identity) return null;
  if (isPlatformOwner(identity.accountId)) return "escala";
  return planForUser(subscriptions, identity.accountId, identity.discordUsername)?.plan ?? null;
}

/** Revalida pagamentos periodicamente para que cancelamento/upgrade chegue ao bot sem login novo. */
export async function syncBotPlanLicenses(log: Logger): Promise<void> {
  try {
    const snapshot = await readGuildLicenses();
    const accounts = new Map<string, Array<{ guildId: string; license: GuildLicense }>>();
    for (const [guildId, license] of Object.entries(snapshot.byGuild)) {
      const rows = accounts.get(license.accountId) ?? [];
      rows.push({ guildId, license });
      accounts.set(license.accountId, rows);
    }
    if (!accounts.size) return;

    const subscriptions = await loadSubscriptions();
    // Uma falha temporária na ShardPay não encerra servidores pagos por engano.
    if (!subscriptions) return;

    let changed = false;
    await mutateGuildLicenses((current) => {
      const now = Date.now();
      for (const entries of accounts.values()) {
        const plan = accountPlan(entries.map((entry) => entry.license), subscriptions);
        const ordered = entries.sort((a, b) => a.license.priority - b.license.priority);
        const limit = plan ? serverLimit(plan) : 0;
        ordered.forEach(({ guildId, license }, index) => {
          const active = Boolean(plan) && (limit === null || index < limit);
          const previous = current.byGuild[guildId] ?? license;
          if (previous.status !== (active ? "active" : "inactive") || previous.planId !== plan) changed = true;
          current.byGuild[guildId] = {
            ...license,
            status: active ? "active" : "inactive",
            planId: plan,
            updatedAt: previous?.status === (active ? "active" : "inactive") && previous.planId === plan ? previous.updatedAt : now,
            ...(active ? { reason: undefined } : { reason: plan ? "server_limit" : "no_subscription" }),
          };
        });
      }
      current.updatedAt = now;
      return current;
    });
    if (changed) log.info("licenças de plano atualizadas", { contas: accounts.size });
  } catch (error) {
    log.warn("não foi possível atualizar as licenças com a ShardPay; mantendo o último estado conhecido", { error: String(error).slice(0, 250) });
  }
}
