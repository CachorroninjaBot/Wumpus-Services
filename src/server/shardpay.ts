import crypto from "node:crypto";

/**
 * Integração ShardPay — webhook + limites por plano.
 *
 * O ShardPay envia webhooks quando faturas e assinaturas mudam de estado.
 * Este módulo:
 *  1. Valida o segredo do webhook (X-Shard-Webhook-Secret).
 *  2. Processa os eventos e atualiza a tabela `licenses` no banco.
 *  3. Fornece limites por plano para o bot e a dashboard consultarem.
 *
 * Planos ShardPay (product IDs):
 *   Essencial  → 01a09c50-6e8f-743f-8d2b-7c2d91226abc  (2 servidores, sem IA)
 *   Pro        → 01a09c5a-d344-78fa-9ead-77fbd322c4f5  (5 servidores, Knowledge IA + 500 OCR/mês)
 *   Escala     → 01a09c5b-c086-7eff-989b-7c6516d93785  (ilimitado)
 *   Vitalício  → 01a09c61-e028-7e49-974c-8b225ab3057b  (ilimitado, pagamento único)
 */

// ─── Product ID → Plan mapping ─────────────────────────────────────

const PRODUCT_TO_PLAN: Record<string, { plan: string; maxServers: number; aiEnabled: boolean; ocrMonthlyLimit: number; features: Record<string, boolean> }> = {
  // Essencial
  "01a09c50-6e8f-743f-8d2b-7c2d91226abc": {
    plan: "standard",
    maxServers: 2,
    aiEnabled: false,
    ocrMonthlyLimit: 0,
    features: {
      automod: true,
      security: true,
      moderation: true,
      logs: true,
      tickets: true,
      forms: true,
      statistics: true,
      servers: true,
      roles: false,
      automations: true,
      integrations: true,
      knowledge: false,
      ocr: false,
      aiAnalysis: false,
      ticketTranscripts: false
    }
  },
  // Pro
  "01a09c5a-d344-78fa-9ead-77fbd322c4f5": {
    plan: "professional",
    maxServers: 5,
    aiEnabled: true,
    ocrMonthlyLimit: 500,
    features: {
      automod: true,
      security: true,
      moderation: true,
      logs: true,
      tickets: true,
      forms: true,
      statistics: true,
      servers: true,
      roles: true,
      automations: true,
      integrations: true,
      knowledge: true,
      ocr: true,
      aiAnalysis: true,
      ticketTranscripts: true
    }
  },
  // Escala
  "01a09c5b-c086-7eff-989b-7c6516d93785": {
    plan: "enterprise",
    maxServers: 999,
    aiEnabled: true,
    ocrMonthlyLimit: 999999,
    features: {
      automod: true,
      security: true,
      moderation: true,
      logs: true,
      tickets: true,
      forms: true,
      statistics: true,
      servers: true,
      roles: true,
      automations: true,
      integrations: true,
      knowledge: true,
      ocr: true,
      aiAnalysis: true,
      ticketTranscripts: true
    }
  },
  // Vitalício
  "01a09c61-e028-7e49-974c-8b225ab3057b": {
    plan: "enterprise",
    maxServers: 999,
    aiEnabled: true,
    ocrMonthlyLimit: 999999,
    features: {
      automod: true,
      security: true,
      moderation: true,
      logs: true,
      tickets: true,
      forms: true,
      statistics: true,
      servers: true,
      roles: true,
      automations: true,
      integrations: true,
      knowledge: true,
      ocr: true,
      aiAnalysis: true,
      ticketTranscripts: true
    }
  }
};

// ─── Plan limits (readable by bot and dashboard) ───────────────────

export type PlanLimits = {
  plan: string;
  maxServers: number;
  aiEnabled: boolean;
  ocrMonthlyLimit: number;
  features: Record<string, boolean>;
};

const DEFAULT_LIMITS: PlanLimits = {
  plan: "starter",
  maxServers: 1,
  aiEnabled: false,
  ocrMonthlyLimit: 0,
  features: {
    automod: true,
    security: true,
    moderation: false,
    logs: false,
    tickets: true,
    forms: false,
    statistics: false,
    servers: true,
    roles: false,
    automations: false,
    integrations: false,
    knowledge: false,
    ocr: false,
    aiAnalysis: false,
    ticketTranscripts: false
  }
};

export function getPlanLimits(plan: string): PlanLimits {
  // Plans stored in licenses table: starter, standard, professional, enterprise
  const planLimitsMap: Record<string, PlanLimits> = {
    starter: DEFAULT_LIMITS,
    standard: PRODUCT_TO_PLAN["01a09c50-6e8f-743f-8d2b-7c2d91226abc"],
    professional: PRODUCT_TO_PLAN["01a09c5a-d344-78fa-9ead-77fbd322c4f5"],
    enterprise: PRODUCT_TO_PLAN["01a09c5b-c086-7eff-989b-7c6516d93785"]
  };
  return planLimitsMap[plan] ?? DEFAULT_LIMITS;
}

export function getPlanLimitsFromProductId(productId: string): PlanLimits {
  return PRODUCT_TO_PLAN[productId] ?? DEFAULT_LIMITS;
}

// ─── Webhook secret verification ───────────────────────────────────

export function verifyWebhookSecret(received: string | undefined): boolean {
  const expected = process.env.SHARDPAY_WEBHOOK_SECRET?.trim();
  if (!expected || !received) return false;
  // Constant-time comparison
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─── Webhook event types ───────────────────────────────────────────

export type ShardPayEvent = {
  id: string;
  type: "invoice.created" | "invoice.paid" | "invoice.refunded" | "subscription.pending" | "subscription.created" | "subscription.cancelled";
  created_at: string;
  data: Record<string, unknown>;
};

export type InvoiceData = {
  invoice_id: string;
  store_id: string;
  product_id: string;
  quantity: number;
  amount_cents: number;
  product_name: string;
  discord_user_id?: string;
  discord_username?: string;
  email?: string;
  subscription_id?: string;
};

export type SubscriptionCreatedData = {
  subscription_id: string;
  store_id: string;
  product_id: string;
  discord_user_id?: string;
  email?: string;
};

export type SubscriptionPendingData = {
  cart_id: string;
  store_id: string;
  product_id: string;
  gateway_subscription_id: string;
  amount_cents: number;
  billing_cycle: string;
  discord_user_id?: string;
  email?: string;
};

export function isShardPayEvent(value: unknown): value is ShardPayEvent {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.id === "string" && typeof obj.type === "string" && typeof obj.created_at === "string" && typeof obj.data === "object";
}