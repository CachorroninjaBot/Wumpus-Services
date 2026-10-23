import type { AutomodVerdict, Member, RecentMessage, Ticket } from "./types";
import { moduleDefaults, type ModuleKey, type PresetId, presets } from "./defaults";
export { monthlyOcrLimit, planAllows } from "./plan-features";
export type { PlanFeature } from "./plan-features";

const INVITE_RE = /(?:discord\.gg|discord\.com\/invite)\/[a-z0-9-]+/i;
const URL_RE = /https?:\/\/[^\s]+/i;
const DOMAIN_RE = /https?:\/\/(?:www\.)?([^/\s]+)/i;

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function asBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function asList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function mergeConfig(module: ModuleKey, patch?: Record<string, unknown>): Record<string, unknown> {
  return { ...moduleDefaults[module], ...(patch ?? {}) };
}

export function applyPresetTo(current: Record<ModuleKey, Record<string, unknown>>, preset: PresetId) {
  const next = { ...current };
  const patch = presets[preset].patch;
  for (const key of Object.keys(patch) as ModuleKey[]) {
    next[key] = { ...next[key], ...patch[key] };
  }
  return next;
}

export function scanMessage(
  config: Record<string, unknown>,
  text: string,
  author: Pick<Member, "roleIds" | "username">,
): AutomodVerdict {
  const ignoredRoles = asList(config.ignoredRoleIds);
  if (author.roleIds.some((id) => ignoredRoles.includes(id))) {
    return { ok: true, detail: "Autor ignorado (cargo da equipe)." };
  }

  const trimmed = text.trim();
  const minLen = asNumber(config.minLength, 0);
  const maxLen = asNumber(config.maxLength, 0);
  if (minLen > 0 && trimmed.length < minLen) {
    return fail("tamanho mínimo", `Mensagem com ${trimmed.length} caracteres (mínimo ${minLen}).`);
  }
  if (maxLen > 0 && trimmed.length > maxLen) {
    return fail("tamanho máximo", `Mensagem com ${trimmed.length} caracteres (máximo ${maxLen}).`);
  }

  if (asBool(config.blockInvites, true) && INVITE_RE.test(text)) {
    return fail("convite", "Convite de outro servidor detectado.");
  }

  const blockedTerms = asList(config.blockedTerms).map((t) => t.toLowerCase()).filter(Boolean);
  const lower = text.toLowerCase();
  const hitTerm = blockedTerms.find((t) => lower.includes(t));
  if (hitTerm) {
    return fail("termo bloqueado", `Contém “${hitTerm}”.`);
  }

  const urlMatch = text.match(DOMAIN_RE);
  if (urlMatch) {
    const domain = urlMatch[1]!.toLowerCase();
    const blockedDomains = asList(config.blockedDomains).map((d) => d.toLowerCase());
    if (blockedDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
      return fail("domínio bloqueado", domain);
    }
    if (asBool(config.blockLinks, false)) {
      const allowed = asList(config.allowedDomains).map((d) => d.toLowerCase());
      const ok = allowed.some((d) => domain === d || domain.endsWith(`.${d}`));
      if (!ok) {
        return fail("link", `Link para ${domain} não está na lista permitida.`);
      }
    }
  } else if (asBool(config.blockLinks, false) && URL_RE.test(text)) {
    return fail("link", "Link detectado.");
  }

  const mentionLimit = asNumber(config.mentionLimit, 8);
  const mentions = (text.match(/@\w+/g) ?? []).length;
  if (mentionLimit > 0 && mentions > mentionLimit) {
    return fail("menções", `${mentions} menções (limite ${mentionLimit}).`);
  }

  const capsPct = asNumber(config.capsThresholdPercent, 80);
  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (capsPct > 0 && capsPct < 100 && letters.length >= 8) {
    const upper = letters.replace(/[^A-ZÁÉÍÓÚÃÕÂÊÔÇ]/g, "").length;
    const pct = Math.round((upper / letters.length) * 100);
    if (pct >= capsPct) {
      return fail("caps", `${pct}% em maiúsculas (limite ${capsPct}%).`);
    }
  }

  if (asBool(config.antiGhostPing, true)) {
    const mentions = text.match(/@[\w.]+/g) ?? [];
    const stripped = text.replace(/@[\w.]+/g, "").trim();
    if (mentions.length > 0 && stripped.length === 0) {
      return fail("ghost ping", "Mensagem só com menções.");
    }
  }

  return { ok: true };

  function fail(rule: string, detail: string): AutomodVerdict {
    return {
      ok: false,
      rule,
      action: asString(config.action, "delete"),
      detail,
    };
  }
}

export function scanBurst(
  config: Record<string, unknown>,
  history: RecentMessage[],
  userId: string,
  text: string,
  now = Date.now(),
): AutomodVerdict | null {
  const windowMs = Math.max(1, asNumber(config.windowSeconds, 10)) * 1000;
  const mine = history.filter((m) => m.userId === userId && now - m.at <= windowMs);
  const limit = asNumber(config.messageLimit, 6);
  if (limit > 0 && mine.length + 1 > limit) {
    return {
      ok: false,
      rule: "flood",
      action: asString(config.action, "delete"),
      detail: `${mine.length + 1} mensagens em ${asNumber(config.windowSeconds, 10)}s (limite ${limit}).`,
    };
  }
  const dupLimit = asNumber(config.duplicateLimit, 3);
  const same = mine.filter((m) => m.content.trim().toLowerCase() === text.trim().toLowerCase()).length;
  if (dupLimit > 0 && same + 1 > dupLimit) {
    return {
      ok: false,
      rule: "duplicata",
      action: asString(config.action, "delete"),
      detail: `A mesma mensagem ${same + 1} vezes (limite ${dupLimit}).`,
    };
  }
  return null;
}

export function evaluateRaid(
  joins: number,
  config: Record<string, unknown>,
): { triggered: boolean; lockdown: boolean; detail: string } {
  const mode = asString(config.raidMode, "smart");
  const threshold = Math.max(2, asNumber(config.raidJoinThreshold, 12));
  const windowSec = asNumber(config.raidWindowSeconds, 60);
  if (joins < threshold) {
    return { triggered: false, lockdown: false, detail: `${joins} entradas em ${windowSec}s. O limiar é ${threshold}.` };
  }
  if (mode === "passive") {
    return { triggered: true, lockdown: false, detail: `${joins} entradas. Modo passivo: só alerta, sem lockdown.` };
  }
  const lockdown = mode === "strict" || joins >= Math.ceil(threshold * 1.5);
  return {
    triggered: true,
    lockdown,
    detail: lockdown
      ? `${joins} entradas em ${windowSec}s. Lockdown aplicado.`
      : `${joins} entradas em ${windowSec}s. Alerta enviado, sem lockdown (modo inteligente).`,
  };
}

export function evaluateNuke(
  actions: number,
  config: Record<string, unknown>,
  antiNuke: boolean,
): { triggered: boolean; lockdown: boolean; detail: string } {
  const threshold = Math.max(2, asNumber(config.nukeActionThreshold, 5));
  const windowSec = asNumber(config.nukeWindowSeconds, 30);
  if (actions < threshold) {
    return { triggered: false, lockdown: false, detail: `${actions} ações em ${windowSec}s. O limiar é ${threshold}.` };
  }
  if (!antiNuke) {
    return {
      triggered: true,
      lockdown: false,
      detail: `Limiar de nuke estourou, mas este plano só registra o alerta.`,
    };
  }
  return {
    triggered: true,
    lockdown: true,
    detail: `${actions} ações destrutivas em ${windowSec}s. Lockdown e incidente abertos.`,
  };
}

export function lastActivity(ticket: Ticket): number {
  return ticket.messages.reduce((max, message) => Math.max(max, message.at), ticket.createdAt);
}

export function shouldAutoClose(ticket: Ticket, config: Record<string, unknown>, now = Date.now()): boolean {
  if (ticket.status !== "open" && ticket.status !== "claimed") return false;
  const hours = asNumber(config.autoCloseInactiveHours, 0);
  if (hours <= 0) return false;
  return now - lastActivity(ticket) >= hours * 3_600_000;
}

export function effectiveStrikes(
  stored: number,
  cases: Array<{ targetId: string; action: string; createdAt: number }>,
  targetId: string,
  expiryDays: number,
  now = Date.now(),
): number {
  if (expiryDays <= 0) return stored;
  const cutoff = now - expiryDays * 86_400_000;
  const expired = cases.filter(
    (c) => c.targetId === targetId && c.createdAt < cutoff && (c.action === "warn" || c.action === "timeout"),
  ).length;
  return Math.max(0, stored - expired);
}

export type SlaState = "ok" | "warning" | "breach";

export function ticketSla(ticket: Ticket, config: Record<string, unknown>, now = Date.now()): SlaState {
  if (ticket.status === "closed" || ticket.status === "archived") return "ok";
  const minutes = asNumber(config.slaWarningMinutes, 60);
  if (minutes <= 0) return "ok";
  const elapsed = (now - ticket.createdAt) / 60_000;
  if (ticket.firstResponseAt) {
    const responseMin = (ticket.firstResponseAt - ticket.createdAt) / 60_000;
    if (responseMin > minutes * 2) return "breach";
    if (responseMin > minutes) return "warning";
    return "ok";
  }
  if (elapsed > minutes * 2) return "breach";
  if (elapsed > minutes) return "warning";
  return "ok";
}

export function nextModerationAction(
  strikes: number,
  config: Record<string, unknown>,
): { action: "warn" | "timeout" | "ban"; note: string } {
  const escalate = asNumber(config.escalateAfterStrikes, 3);
  const banAt = asNumber(config.maxStrikesBeforeBan, 5);
  if (strikes + 1 >= banAt) {
    return { action: "ban", note: `Após ${banAt} advertências o membro é banido.` };
  }
  if (strikes + 1 >= escalate) {
    return {
      action: "timeout",
      note: `Após ${escalate} advertências aplica-se timeout de ${asNumber(config.defaultTimeoutMinutes, 60)} min.`,
    };
  }
  return { action: "warn", note: "Ainda abaixo do limiar de escalonamento." };
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

export function channelNameFor(pattern: string, username: string): string {
  const raw = (pattern || "atendimento-{user}").replace(/\{user\}/g, username.toLowerCase());
  return raw.slice(0, 90).replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
}

const knowledgeStopwords = new Set(["a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "um", "uma", "para", "por", "com", "que", "como", "se", "no", "na", "nos", "nas", "ao", "aos", "the", "of", "is", "it", "to", "and", "my", "me", "eu", "meu", "minha", "tem", "voce", "voces", "posso", "quero", "fazer", "onde", "qual", "quais"]);
const normalizeKnowledgeText = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ");
const knowledgeTokens = (value: string) => normalizeKnowledgeText(value).split(/\s+/).filter((word) => word.length > 2 && !knowledgeStopwords.has(word));

export function scoreKnowledgeArticle(article: { title: string; body: string; tags: string[]; category?: string; exampleQuestions?: string[] }, query: string): number {
  const words = knowledgeTokens(query);
  if (!words.length) return 0;
  const title = new Set(knowledgeTokens(article.title));
  const tags = new Set(article.tags.flatMap(knowledgeTokens));
  const examples = new Set((article.exampleQuestions ?? []).flatMap(knowledgeTokens));
  const category = new Set(knowledgeTokens(article.category ?? ""));
  const body = new Set(knowledgeTokens(article.body));
  const points = words.reduce((total, word) => total + (title.has(word) ? 3 : tags.has(word) || examples.has(word) || category.has(word) ? 2 : body.has(word) ? 1 : 0), 0);
  return points / (words.length * 3);
}

export function searchArticles<T extends { title: string; body: string; tags: string[]; category?: string; exampleQuestions?: string[]; approved: boolean }>(
  query: string,
  articles: T[],
  requireApproved: boolean,
  minScore = 0.25,
): T[] {
  if (normalizeKnowledgeText(query.trim()).length < 2) return [];
  return articles
    .filter((article) => !requireApproved || article.approved)
    .map((article) => ({ article, score: scoreKnowledgeArticle(article, query) }))
    .filter((result) => result.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map((result) => result.article);
}

export function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  if (typeof value === "string") {
    return value
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export { asString, asNumber, asBool, asList };
