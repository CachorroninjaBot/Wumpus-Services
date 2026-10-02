/**
 * AutoMod — filtro de mensagem.
 *
 * O bot antigo so olhava convite e termo bloqueado, e apenas se o modulo
 * estivesse publicado (nunca estava). Aqui os filtros que o painel oferece
 * sao todos lidos: convite, termo, dominio, link, mencao em massa, caps,
 * tamanho, repeticao e flood.
 *
 * As listas de ignore guardam NOMES ("ch_staff"), entao passam pelo resolvedor
 * — no bot antigo `ignoredChannelIds.includes(message.channelId)` comparava
 * nome com snowflake e nunca dava match, ou seja: o ignore nunca funcionou.
 */
import type { Message, PartialMessage } from "discord.js";
import { bool, isEnabled, list, moduleConfig, num, str } from "./config.ts";
import { auditAndLog } from "./logs.ts";
import type { Logger } from "./logger.ts";
import { extractTextFromAttachments } from "./ocr.ts";
import { asSendable, resolveChannel, resolveRoles } from "./resolve.ts";

export type AutomodHit = { rule: string; action: string };

const INVITE_RE = /(?:discord\.(?:gg|com\/invite|me)\/)[a-z0-9-]+/i;
const URL_RE = /https?:\/\/[^\s<>]+/i;

/** Janela deslizante por canal+usuario: flood e repeticao. */
const recent = new Map<string, { at: number; content: string }[]>();
const MAX_TRACKED = 2_000;

function track(key: string, content: string, windowMs: number): { count: number; duplicates: number } {
  const now = Date.now();
  const entries = (recent.get(key) ?? []).filter((entry) => now - entry.at <= windowMs);
  entries.push({ at: now, content });

  // Poda global: sem isso o mapa cresce indefinidamente num servidor movimentado.
  if (recent.size > MAX_TRACKED) {
    for (const [k, v] of recent) {
      if (!v.length || now - v[v.length - 1].at > windowMs) recent.delete(k);
    }
  }

  recent.set(key, entries);
  const duplicates = entries.filter((entry) => entry.content === content).length;
  return { count: entries.length, duplicates };
}

function capsRatio(text: string): number {
  const letters = text.replace(/[^a-zA-ZÀ-ÿ]/g, "");
  if (letters.length < 10) return 0;
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, "").length;
  return upper / letters.length;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function domainAllowed(domain: string, allowed: string[]): boolean {
  return allowed.some((entry) => {
    const clean = entry.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    return clean && (domain === clean || domain.endsWith(`.${clean}`));
  });
}

/**
 * Avalia uma mensagem e devolve a primeira regra violada.
 * Devolve `null` quando esta tudo certo — o caso comum.
 */
export function scanMessage(input: {
  content: string;
  config: Record<string, unknown> | null;
  windowMs: number;
  floodCount: number;
  duplicateCount: number;
}): AutomodHit | null {
  const { content, config, windowMs, floodCount, duplicateCount } = input;
  const action = str(config, "action", "delete");
  const text = content ?? "";
  const lower = text.toLowerCase();

  if (bool(config, "blockInvites", true) && INVITE_RE.test(text)) {
    return { rule: "convite", action };
  }

  const terms = list(config, "blockedTerms").map((term) => term.toLowerCase());
  const hitTerm = terms.find((term) => term && lower.includes(term));
  if (hitTerm) return { rule: `termo:${hitTerm}`, action };

  const urls = text.match(new RegExp(URL_RE.source, "gi")) ?? [];
  const blockedDomains = list(config, "blockedDomains");
  const allowedDomains = list(config, "allowedDomains");

  for (const url of urls) {
    const domain = domainOf(url);
    if (!domain) continue;
    if (blockedDomains.some((entry) => domain === entry.toLowerCase() || domain.endsWith(`.${entry.toLowerCase()}`))) {
      return { rule: `dominio:${domain}`, action };
    }
    if (bool(config, "blockLinks", false) && !domainAllowed(domain, allowedDomains)) {
      return { rule: `link:${domain}`, action };
    }
  }

  const minLength = Math.trunc(num(config, "minLength", 0));
  const maxLength = Math.trunc(num(config, "maxLength", 0));
  if (minLength > 0 && text.trim().length < minLength) return { rule: "muito-curto", action };
  if (maxLength > 0 && text.length > maxLength) return { rule: "muito-longo", action };

  const capsThreshold = Math.trunc(num(config, "capsThresholdPercent", 70));
  if (capsThreshold < 100 && capsRatio(text) * 100 >= capsThreshold) return { rule: "caps", action };

  const mentionLimit = Math.trunc(num(config, "mentionLimit", 8));
  const mentions = (text.match(/<@!?\d+>/g) ?? []).length;
  if (mentionLimit > 0 && mentions >= mentionLimit) return { rule: "mencao-em-massa", action };

  const duplicateLimit = Math.trunc(num(config, "duplicateLimit", 3));
  if (duplicateLimit > 0 && duplicateCount >= duplicateLimit) return { rule: "repeticao", action };

  if (windowMs > 0 && floodCount >= Math.trunc(num(config, "messageLimit", 6))) {
    return { rule: "flood", action };
  }

  return null;
}

/** Aplica a acao configurada. `delete` e o padrao; `warn` deixa a mensagem. */
export async function handleMessage(message: Message, log: Logger): Promise<void> {
  if (!message.guild || message.author.bot) return;
  if (!message.content) return;

  const guild = message.guild;
  const config = await moduleConfig(guild.id, "automod");
  if (!isEnabled(config)) return;

  const ignoredChannels = list(config, "ignoredChannelIds")
    .map((ref) => resolveChannel(guild, ref)?.id)
    .filter((value): value is string => Boolean(value));
  if (ignoredChannels.includes(message.channelId)) return;

  const ignoredRoles = resolveRoles(guild, list(config, "ignoredRoleIds")).map((role) => role.id);
  const member = message.member;
  if (member && ignoredRoles.length) {
    const hasIgnored = member.roles.cache.some((role) => ignoredRoles.includes(role.id));
    if (hasIgnored) return;
  }

  const windowMs = Math.max(1, Math.trunc(num(config, "windowSeconds", 10))) * 1000;
  const { count, duplicates } = track(`${message.channelId}:${message.author.id}`, message.content, windowMs);

  const hit = scanMessage({
    content: message.content,
    config,
    windowMs,
    floodCount: count,
    duplicateCount: duplicates
  });
  if (!hit) return;

  const warnMessage = str(config, "warnMessage", "Sua mensagem foi removida pelo filtro automatico.");

  try {
    if (hit.action !== "warn") {
      await message.delete().catch(() => undefined);
    }

    if (hit.action === "timeout" || hit.action === "mute") {
      const minutes = Math.max(1, Math.trunc(num(config, "timeoutMinutes", 10)));
      await member?.timeout(minutes * 60_000, `automod:${hit.rule}`).catch(() => undefined);
    }

    if (hit.action === "warn" && member) {
      const channel = asSendable(message.channel);
      const warning = channel
        ? await channel.send(`<@${message.author.id}> ${warnMessage}`).catch(() => null)
        : null;
      // Aviso some sozinho para nao poluir o canal.
      if (warning) setTimeout(() => void warning.delete().catch(() => undefined), 8_000);
    }
  } catch (error) {
    log.warn("falha ao aplicar automod", { guildId: guild.id, rule: hit.rule, error: String(error) });
  }

  await auditAndLog(
    guild,
    {
      module: "automod",
      category: "automod",
      eventType: `automod_${hit.rule.split(":")[0]}`,
      targetId: message.author.id,
      channelId: message.channelId,
      severity: hit.action === "timeout" || hit.action === "mute" ? "warning" : "info",
      title: `AUTOMOD · ${hit.rule}`,
      description: `<@${message.author.id}> em <#${message.channelId}>`,
      accentColor: "#f5a524",
      fields: [
        { name: "Regra", value: hit.rule },
        { name: "Acao", value: hit.action },
        { name: "Mensagem", value: message.content.slice(0, 1000) }
      ],
      data: { rule: hit.rule, action: hit.action }
    },
    log
  );

  log.info("automod aplicado", { guildId: guild.id, userId: message.author.id, rule: hit.rule, action: hit.action });
}

/**
 * Anti-ghost-ping: avisa quando alguem apaga a mensagem logo depois de marcar
 * outra pessoa — o mencionado nao ve notificacao nenhuma e fica sem contexto.
 */
export async function handleGhostPing(message: Message | PartialMessage, log: Logger): Promise<void> {
  const guild = message.guild;
  if (!guild) return;

  const mentioned = [...(message.mentions?.users?.values() ?? [])].filter((user) => !user.bot);
  if (!mentioned.length) return;

  const config = await moduleConfig(guild.id, "automod");
  if (!isEnabled(config) || !bool(config, "antiGhostPing", true)) return;

  const ignoredChannels = list(config, "ignoredChannelIds")
    .map((ref) => resolveChannel(guild, ref)?.id)
    .filter((value): value is string => Boolean(value));
  if (ignoredChannels.includes(message.channelId)) return;

  const target = asSendable(message.channel);
  if (!target) return;

  try {
    await target.send(
      `👻 <@${message.author?.id}> marcou ${mentioned.map((user) => `<@${user.id}>`).join(", ")} e apagou a mensagem.`
    );
  } catch {
    // Sem permissao para falar: nao ha o que fazer.
  }

  log.info("ghost ping detectado", { guildId: guild.id, authorId: message.author?.id });
}

/**
 * Varredura de imagens: o painel tem `scanImages` ligado por padrao, mas o bot
 * nunca leu imagem — print com "free nitro" ou QR de golpe passava direto.
 *
 * So roda quando a mensagem tem anexo de imagem e o modulo permite. O texto
 * lido entra no MESMO scanner do texto, entao as regras valem igual.
 */
export async function handleImageContent(message: Message, log: Logger): Promise<void> {
  const guild = message.guild;
  if (!guild || message.author.bot) return;

  const config = await moduleConfig(guild.id, "automod");
  if (!isEnabled(config) || !bool(config, "scanImages", true)) return;

  const images = [...message.attachments.values()]
    .filter((attachment) => (attachment.contentType ?? "").startsWith("image/"))
    .map((attachment) => ({ url: attachment.url, size: attachment.size }));

  if (!images.length) return;

  const ignoredChannels = list(config, "ignoredChannelIds")
    .map((ref) => resolveChannel(guild, ref)?.id)
    .filter((value): value is string => Boolean(value));
  if (ignoredChannels.includes(message.channelId)) return;

  const text = await extractTextFromAttachments(guild.id, images, log);
  if (!text.trim()) return;

  const hit = scanMessage({
    content: text,
    config,
    windowMs: 0,
    floodCount: 0,
    duplicateCount: 0
  });
  if (!hit) return;

  const member = message.member;
  const warnMessage = str(config, "warnMessage", "Sua mensagem foi removida pelo filtro automatico.");

  try {
    if (hit.action !== "warn") await message.delete().catch(() => undefined);

    if (hit.action === "timeout" || hit.action === "mute") {
      const minutes = Math.max(1, Math.trunc(num(config, "timeoutMinutes", 10)));
      await member?.timeout(minutes * 60_000, `automod-imagem:${hit.rule}`).catch(() => undefined);
    }

    if (hit.action === "warn") {
      const channel = asSendable(message.channel);
      const warning = channel
        ? await channel.send(`<@${message.author.id}> ${warnMessage}`).catch(() => null)
        : null;
      if (warning) setTimeout(() => void warning.delete().catch(() => undefined), 8_000);
    }
  } catch (error) {
    log.warn("falha ao aplicar automod em imagem", { guildId: guild.id, rule: hit.rule, error: String(error) });
  }

  await auditAndLog(
    guild,
    {
      module: "automod",
      category: "automod",
      eventType: `automod_imagem_${hit.rule.split(":")[0]}`,
      targetId: message.author.id,
      channelId: message.channelId,
      severity: "warning",
      title: `AUTOMOD (IMAGEM) · ${hit.rule}`,
      description: `<@${message.author.id}> em <#${message.channelId}>`,
      accentColor: "#f5a524",
      fields: [
        { name: "Regra", value: hit.rule },
        { name: "Acao", value: hit.action },
        { name: "Texto lido", value: text.slice(0, 1000) }
      ],
      data: { rule: hit.rule, action: hit.action, source: "ocr" }
    },
    log
  );

  log.info("automod aplicado em imagem", {
    guildId: guild.id,
    userId: message.author.id,
    rule: hit.rule,
    action: hit.action
  });
}
