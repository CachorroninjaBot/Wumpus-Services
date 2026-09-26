import { getPool } from "./db/index.js";
import type { ModuleId } from "../core/brand.js";

/**
 * Verificação de plano — impõe limites reais.
 *
 * Chamado antes de ações que dependem do plano:
 * - Criar/abrir módulos configurados
 * - Usar IA
 * - Usar OCR
 * - Abrir tickets em servidores acima do limite
 */

export type PlanCheck = {
  allowed: boolean;
  plan: string;
  reason?: string;
};

// Módulos disponíveis por plano
const PLAN_MODULES: Record<string, Set<ModuleId>> = {
  starter: new Set(["servers", "statistics", "automod", "security", "tickets"]),
  standard: new Set([
    "servers", "statistics", "automod", "security", "tickets",
    "moderation", "logs", "forms", "automations", "integrations", "staff"
  ]),
  professional: new Set([
    "servers", "statistics", "automod", "security", "tickets",
    "moderation", "logs", "forms", "automations", "integrations", "staff",
    "knowledge", "ocr", "roles"
  ]),
  enterprise: new Set([
    "servers", "statistics", "automod", "security", "tickets",
    "moderation", "logs", "forms", "automations", "integrations", "staff",
    "knowledge", "ocr", "roles"
  ])
};

const PLAN_MAX_SERVERS: Record<string, number> = {
  starter: 1,
  standard: 2,
  professional: 5,
  enterprise: 999
};

const PLAN_AI: Record<string, boolean> = {
  starter: false,
  standard: false,
  professional: true,
  enterprise: true
};

const PLAN_OCR_LIMIT: Record<string, number> = {
  starter: 0,
  standard: 0,
  professional: 500,
  enterprise: 999999
};

async function getUserPlan(discordUserId: string): Promise<string> {
  try {
    const result = await getPool().query(
      `select plan from licenses where discord_user_id = $1 and status = 'active'`,
      [discordUserId]
    );
    return result.rows[0]?.plan ?? "starter";
  } catch {
    return "starter";
  }
}

/**
 * Verifica se um usuário pode usar um módulo específico.
 */
export async function canUseModule(discordUserId: string, module: ModuleId): Promise<PlanCheck> {
  const plan = await getUserPlan(discordUserId);
  const allowed = PLAN_MODULES[plan]?.has(module) ?? false;
  return {
    allowed,
    plan,
    reason: allowed ? undefined : `O módulo "${module}" não está disponível no plano ${plan}. Faça upgrade para acessar.`
  };
}

/**
 * Verifica se um usuário pode usar IA.
 */
export async function canUseAI(discordUserId: string): Promise<PlanCheck> {
  const plan = await getUserPlan(discordUserId);
  const allowed = PLAN_AI[plan] ?? false;
  return {
    allowed,
    plan,
    reason: allowed ? undefined : "IA não disponível no seu plano. Faça upgrade para Pro ou Escala."
  };
}

/**
 * Verifica se um usuário pode usar OCR.
 */
export async function canUseOCR(discordUserId: string): Promise<PlanCheck> {
  const plan = await getUserPlan(discordUserId);
  const limit = PLAN_OCR_LIMIT[plan] ?? 0;
  if (limit === 0) {
    return { allowed: false, plan, reason: "OCR não disponível no seu plano. Faça upgrade para Pro ou Escala." };
  }

  // Conta uso mensal
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const usage = await getPool().query(
    `select count(*)::integer as cnt from audit_events
     where module = 'ocr' and event_type = 'ocr_violation_found'
     and occurred_at >= $1`,
    [monthStart]
  );
  const used = usage.rows[0]?.cnt ?? 0;
  if (used >= limit) {
    return { allowed: false, plan, reason: `Limite de OCR atingido (${used}/${limit} este mês). Faça upgrade ou aguarde o próximo mês.` };
  }

  return { allowed: true, plan };
}

/**
 * Verifica se um usuário pode adicionar mais servidores.
 */
export async function canAddServer(discordUserId: string, currentCount: number): Promise<PlanCheck> {
  const plan = await getUserPlan(discordUserId);
  const maxServers = PLAN_MAX_SERVERS[plan] ?? 1;
  const allowed = currentCount < maxServers;
  return {
    allowed,
    plan,
    reason: allowed ? undefined : `Limite de ${maxServers} servidor(es) atingido no plano ${plan}. Faça upgrade para adicionar mais.`
  };
}

/**
 * Retorna os limites completos do plano de um usuário.
 */
export async function getFullPlanLimits(discordUserId: string) {
  const plan = await getUserPlan(discordUserId);
  return {
    plan,
    maxServers: PLAN_MAX_SERVERS[plan] ?? 1,
    aiEnabled: PLAN_AI[plan] ?? false,
    ocrMonthlyLimit: PLAN_OCR_LIMIT[plan] ?? 0,
    modules: [...(PLAN_MODULES[plan] ?? PLAN_MODULES.starter)]
  };
}

export { PLAN_MODULES, PLAN_MAX_SERVERS, PLAN_AI, PLAN_OCR_LIMIT };