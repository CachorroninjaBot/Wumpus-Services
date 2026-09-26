import { Routes, type Client, type Message } from "discord.js";
import { getPool, recordAuditEvent, resolveModuleConfig } from "../server/db/index.js";
import { extractText, isImage, type OcrConfig } from "./ocr.js";
import { buildLogPayload } from "./panels.js";
import { applyTimeout } from "./security.js";

/**
 * AutoMod: spam, repeticao, convites, termos e dominios bloqueados.
 *
 * Duas camadas, de proposito:
 *  1. Varredura de mensagens (aqui). Cobre repeticao e velocidade, que a API
 *     nativa do Discord NAO cobre. Depende da intent de conteudo.
 *  2. Regra nativa de termos bloqueados. Filtra no lado do Discord, funciona
 *     mesmo sem a intent de conteudo e sem o bot estar online.
 *
 * Toda punicao respeita quem tem Gerenciar Mensagens: nunca se aplica a
 * moderadores nem a administradores.
 */

type Logger = {
  info: (message: string, extra?: Record<string, unknown>) => void;
  error: (message: string, extra?: Record<string, unknown>) => void;
};

/** Convites do Discord: discord.gg/x, discord.com/invite/x, discord.me/x. */
const INVITE_PATTERN = /discord(?:app)?\.(?:gg|com\/invite|me)\/[a-zA-Z0-9-]+/i;

const NATIVE_RULE_NAME = "Wumpus · termos bloqueados";

type Hit = { at: number; key: string };

/** Janelas por usuario: spam (velocidade) e repeticao (conteudo igual). */
const rateHits = new Map<string, Hit[]>();
const repeatHits = new Map<string, Hit[]>();
const lastAction = new Map<string, number>();

/** Uma punicao por usuario a cada 30s: sem isso, 40 mensagens = 40 punicoes. */
const ACTION_COOLDOWN_MS = 30_000;
const MAX_DELETIONS = 15;
const MAX_TERMS = 50;

function num(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

/** Compara conteudo ignorando caixa e espacos: "OI  oi" == "oi oi". */
function normalize(content: string): string {
  return content.toLowerCase().replace(/\s+/g, " ").trim();
}

function record(map: Map<string, Hit[]>, key: string, value: string, now: number, windowMs: number): Hit[] {
  const list = (map.get(key) ?? []).filter((hit) => now - hit.at < windowMs);
  list.push({ at: now, key: value });
  map.set(key, list);
  return list;
}

function onCooldown(key: string): boolean {
  return Date.now() - (lastAction.get(key) ?? 0) < ACTION_COOLDOWN_MS;
}

type Violation = { kind: string; label: string; detail: string };

function detect(message: Message, config: Record<string, unknown>, now: number): Violation | null {
  const guildId = message.guild!.id;
  const userId = message.author.id;
  const raw = message.content ?? "";
  const content = normalize(raw);
  const found: Violation[] = [];

  // 1. Conteudo proibido: imediato e independente de janela.
  if (config.blockInvites !== false && INVITE_PATTERN.test(raw)) {
    found.push({ kind: "invite", label: "Convite de outro servidor", detail: "mensagem com convite" });
  }

  const terms = asList(config.blockedTerms).map(normalize).filter(Boolean);
  const term = terms.find((entry) => content.includes(entry));
  if (term) {
    found.push({ kind: "term", label: "Termo bloqueado", detail: `termo: ${term}` });
  }

  const domains = asList(config.blockedDomains).map((entry) => entry.toLowerCase().trim()).filter(Boolean);
  const domain = domains.find((entry) => content.includes(entry));
  if (domain) {
    found.push({ kind: "domain", label: "Domínio bloqueado", detail: `domínio: ${domain}` });
  }

  // 2. Repeticao: a mesma mensagem varias vezes na janela.
  const duplicateLimit = num(config.duplicateLimit, 3);
  const windowMs = num(config.windowSeconds, 10) * 1000;
  const repeats = record(repeatHits, `${guildId}:${userId}`, content, now, windowMs);
  const same = repeats.filter((hit) => hit.key === content).length;
  if (same >= duplicateLimit) {
    found.push({
      kind: "duplicate",
      label: "Mensagens repetidas",
      detail: `${same}x a mesma mensagem em ${windowMs / 1000}s`
    });
  }

  // 3. Velocidade: muitas mensagens na janela.
  const messageLimit = num(config.messageLimit, 8);
  const rate = record(rateHits, `${guildId}:${userId}`, content, now, windowMs);
  if (rate.length >= messageLimit) {
    found.push({
      kind: "spam",
      label: "Envio em excesso",
      detail: `${rate.length} mensagens em ${windowMs / 1000}s`
    });
  }

  if (!found.length) return null;

  // Prioridade: conteudo proibido > repeticao > velocidade.
  const order = ["invite", "term", "domain", "duplicate", "spam"];
  found.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return found[0];
}

/** Apaga a mensagem infratora e, em spam, tambem as vizinhas recentes do autor. */
async function removeMessages(message: Message, violation: Violation, log: Logger): Promise<number> {
  let removed = 0;

  try {
    await message.delete();
    removed += 1;
  } catch {
    // Sem Gerenciar Mensagens: seguimos com o alerta em vez de falhar tudo.
  }

  if (violation.kind === "spam" || violation.kind === "duplicate") {
    try {
      const recent = await message.channel.messages.fetch({ limit: 50 });
      const mine = [...recent.values()]
        .filter((entry) => entry.author.id === message.author.id)
        .slice(0, MAX_DELETIONS);
      for (const entry of mine) {
        if (entry.id === message.id) continue;
        await entry.delete().catch(() => undefined);
        removed += 1;
      }
    } catch {
      /* sem historico: mantem o que ja foi apagado */
    }
  }

  return removed;
}

/** Avisa o autor por DM: nao polui o canal e nao expõe a moderacao. */
async function warn(client: Client, message: Message, violation: Violation): Promise<boolean> {
  try {
    const dm = await client.users.createDM(message.author.id);
    await client.rest.post(Routes.channelMessages(dm.id), {
      body: {
        content: [
          `Seu envio em **${message.guild?.name ?? "servidor"}** foi removido.`,
          `Motivo: ${violation.label} — ${violation.detail}.`,
          "Se acredita que foi um engano, fale com a equipe."
        ].join("\n")
      }
    });
    return true;
  } catch {
    // DM fechada e o caso comum; nao e falha da moderacao.
    return false;
  }
}

export async function handleMessage(client: Client, message: Message, log: Logger): Promise<void> {
  if (!message.guild || message.author.bot || message.system) return;
  // Mensagem de DM ou parcial (sem conteudo) nao e avaliada.
  if (!message.content) return;

  const guildId = message.guild.id;
  const config = await resolveModuleConfig(guildId, "automod");
  if (!config.enabled) return;

  // Quem modera nao e moderado: sem isso o proprio staff levaria timeout.
  const member = message.member;
  if (member?.permissions.has("ManageMessages")) return;

  const now = Date.now();
  const violation = detect(message, config.config, now);
  if (!violation) return;

  const actionKey = `${guildId}:${message.author.id}`;
  if (onCooldown(actionKey)) return;
  lastAction.set(actionKey, now);

  const action = asString(config.config.action) || "delete";
  const timeoutMinutes = num(config.config.timeoutMinutes, 10);

  let removed = 0;
  let timedOut = false;

  if (action === "delete" || action === "timeout") {
    removed = await removeMessages(message, violation, log);
  }
  if (action === "warn") {
    await warn(client, message, violation);
  }
  if (action === "timeout") {
    timedOut = await applyTimeout(client, guildId, message.author.id, timeoutMinutes);
  }

  const incident = await getPool()
    .query<{ id: number }>(
      `insert into incidents (guild_id, incident_type, severity, actor_id, details)
       values ($1, 'automod', $2, $3, $4::jsonb) returning id`,
      [
        guildId,
        violation.kind === "invite" || violation.kind === "term" ? "high" : "medium",
        message.author.id,
        JSON.stringify({
          kind: violation.kind,
          detail: violation.detail,
          channelId: message.channelId,
          action,
          removed,
          timedOut
        })
      ]
    )
    .then((result) => result.rows[0]?.id ?? null)
    .catch(() => null);

  await recordAuditEvent({
    guildId,
    module: "automod",
    eventType: "automod_triggered",
    actorId: message.author.id,
    channelId: message.channelId,
    severity: "warning",
    data: { kind: violation.kind, detail: violation.detail, action, removed, timedOut, incidentId: incident }
  }).catch(() => undefined);

  const logChannelId = asString(config.config.logChannelId);
  if (logChannelId) {
    const actionLabel =
      action === "delete"
        ? `Mensagem apagada (${removed})`
        : action === "warn"
          ? "Autor avisado"
          : action === "timeout"
            ? `Timeout de ${timeoutMinutes} min${timedOut ? "" : " — não aplicado (permissão?)"}`
            : "Enviado para revisão";

    await client.rest
      .post(Routes.channelMessages(logChannelId), {
        body: buildLogPayload({
          title: `AutoMod · ${violation.label}`,
          description: `<@${message.author.id}> em <#${message.channelId}> — ${violation.detail}.`,
          accentColor: "#f5a524",
          fields: [
            { name: "Ação", value: actionLabel, inline: true },
            { name: "Mensagem apagada", value: String(removed), inline: true },
            {
              name: "O que fazer agora",
              value: "Se foi engano, ajuste os termos ou domínios bloqueados na dashboard.",
              inline: false
            }
          ]
        })
      })
      .catch((error) => log.error("falha ao publicar o log do automod", { error: String(error) }));
  }

  log.info("automod agiu", {
    guildId,
    userId: message.author.id,
    kind: violation.kind,
    action,
    removed,
    timedOut
  });
}

/** Deteccao por conteudo estatico: convites, termos e dominios. */
export function detectStatic(text: string, config: Record<string, unknown>): Violation | null {
  const raw = text ?? "";
  const content = normalize(raw);
  const found: Violation[] = [];

  if (config.blockInvites !== false && INVITE_PATTERN.test(raw)) {
    found.push({ kind: "invite", label: "Convite de outro servidor", detail: "convite em imagem" });
  }

  const terms = asList(config.blockedTerms).map(normalize).filter(Boolean);
  const term = terms.find((entry) => content.includes(entry));
  if (term) {
    found.push({ kind: "term", label: "Termo bloqueado", detail: `termo em imagem: ${term}` });
  }

  const domains = asList(config.blockedDomains).map((entry) => entry.toLowerCase().trim()).filter(Boolean);
  const domain = domains.find((entry) => content.includes(entry));
  if (domain) {
    found.push({ kind: "domain", label: "Domínio bloqueado", detail: `domínio em imagem: ${domain}` });
  }

  if (!found.length) return null;

  const order = ["invite", "term", "domain"];
  found.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return found[0];
}

/** Teto de imagens lidas por mensagem: OCR custa tempo e dinheiro. */
const MAX_IMAGES_PER_MESSAGE = 2;

/**
 * Le imagens e aplica a MESMA deteccao do AutoMod ao texto encontrado.
 *
 * E aqui que a moderacao cobre o ponto cego: um convite ou link impresso numa
 * imagem nao passa pelo filtro de texto. Lemos a imagem, procuramos os mesmos
 * termos e agimos igual.
 *
 * Limites conscientes: no maximo 2 imagens por mensagem, uma acao por
 * mensagem, e nenhuma leitura quando o autor modera o servidor.
 */
export async function handleImageContent(client: Client, message: Message, log: Logger): Promise<void> {
  if (!message.guild || message.author.bot) return;

  const images = [...message.attachments.values()].filter((item) => isImage(item.contentType, item.name));
  if (!images.length) return;

  const guildId = message.guild.id;
  const automod = await resolveModuleConfig(guildId, "automod");
  if (!automod.enabled) return;

  // Quem modera nao e moderado — mesma regra da varredura de texto.
  if (message.member?.permissions.has("ManageMessages")) return;

  const ocrModule = await resolveModuleConfig(guildId, "ocr").catch(() => null);
  if (ocrModule && !ocrModule.enabled) return;
  const settings = (ocrModule?.config ?? {}) as OcrConfig;

  for (const image of images.slice(0, MAX_IMAGES_PER_MESSAGE)) {
    const result = await extractText(client, image.url, image.size, settings);
    if (!result) continue;

    const violation = detectStatic(result.text, automod.config);
    if (!violation) continue;

    const actionKey = `${guildId}:img:${message.author.id}`;
    if (onCooldown(actionKey)) continue;
    lastAction.set(actionKey, Date.now());

    const action = asString(automod.config.action) || "delete";
    const timeoutMinutes = num(automod.config.timeoutMinutes, 10);

    let removed = 0;
    let timedOut = false;
    if (action === "delete" || action === "timeout") {
      removed = await removeMessages(message, violation, log);
    }
    if (action === "timeout") {
      timedOut = await applyTimeout(client, guildId, message.author.id, timeoutMinutes);
    }

    // O texto lido so e guardado se o cliente pediu: por padrao, privacidade.
    const incident = await getPool()
      .query<{ id: number }>(
        `insert into incidents (guild_id, incident_type, severity, actor_id, details)
         values ($1, 'automod', 'high', $2, $3::jsonb) returning id`,
        [
          guildId,
          message.author.id,
          JSON.stringify({
            kind: violation.kind,
            detail: violation.detail,
            channelId: message.channelId,
            source: "ocr",
            provider: result.provider,
            action,
            removed,
            timedOut,
            ...(settings.retainExtractedText ? { text: result.text.slice(0, 1_000) } : {})
          })
        ]
      )
      .then((row) => row.rows[0]?.id ?? null)
      .catch(() => null);

    await recordAuditEvent({
      guildId,
      module: "ocr",
      eventType: "ocr_violation_found",
      actorId: message.author.id,
      channelId: message.channelId,
      severity: "warning",
      data: {
        kind: violation.kind,
        provider: result.provider,
        action,
        removed,
        timedOut,
        incidentId: incident,
        textLength: result.text.length
      }
    }).catch(() => undefined);

    const logChannelId = asString(automod.config.logChannelId);
    if (logChannelId) {
      await client.rest
        .post(Routes.channelMessages(logChannelId), {
          body: buildLogPayload({
            title: `OCR · ${violation.label}`,
            description: `<@${message.author.id}> em <#${message.channelId}> — ${violation.detail}.`,
            accentColor: "#ff8a3d",
            fields: [
              { name: "Onde", value: "conteúdo dentro de uma imagem", inline: true },
              { name: "Ação", value: action === "timeout" ? `Timeout de ${timeoutMinutes} min` : action, inline: true },
              { name: "Imagem removida", value: removed ? "sim" : "não", inline: true },
              {
                name: "O que fazer agora",
                value:
                  "O texto foi lido de uma imagem. Se foi engano, ajuste os termos bloqueados; " +
                  "para guardar o texto lido no histórico, ative essa opção em OCR.",
                inline: false
              }
            ]
          })
        })
        .catch((error) => log.error("falha ao publicar o log do OCR", { error: String(error) }));
    }

    log.info("ocr encontrou conteudo proibido", {
      guildId,
      userId: message.author.id,
      kind: violation.kind,
      provider: result.provider,
      action,
      removed,
      timedOut
    });

    // Uma acao por mensagem basta: as demais imagens seriam redundantes.
    return;
  }
}

/**
 * Espelha os termos bloqueados numa regra nativa do Discord.
 *
 * Vantagem: filtra no servidor, sem depender da intent de conteudo nem do bot
 * estar conectado. Se a regra nao puder ser criada (falta de permissao), apenas
 * registramos — a varredura por mensagem continua cobrindo.
 */
export async function syncNativeKeywordRule(
  client: Client,
  guildId: string,
  config: Record<string, unknown>,
  log: Logger
): Promise<void> {
  const terms = asList(config.blockedTerms)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && term.length <= 60)
    .slice(0, MAX_TERMS);

  try {
    const rules = (await client.rest.get(Routes.guildAutoModerationRules(guildId))) as Array<{
      id: string;
      name: string;
    }>;
    const existing = Array.isArray(rules) ? rules.find((rule) => rule.name === NATIVE_RULE_NAME) : undefined;

    if (!terms.length) {
      if (existing) await client.rest.delete(Routes.guildAutoModerationRule(guildId, existing.id));
      return;
    }

    const body = {
      name: NATIVE_RULE_NAME,
      event_type: 1,
      trigger_type: 1,
      trigger_metadata: { keyword_filter: terms },
      actions: [
        {
          type: 1,
          metadata: { custom_message: "Esta mensagem contém um termo bloqueado neste servidor." }
        }
      ],
      enabled: true
    };

    if (existing) {
      await client.rest.patch(Routes.guildAutoModerationRule(guildId, existing.id), { body });
    } else {
      await client.rest.post(Routes.guildAutoModerationRules(guildId), { body });
    }

    log.info("regra nativa de termos sincronizada", { guildId, terms: terms.length });
  } catch (error) {
    log.info("regra nativa de termos nao aplicada (permissao?)", {
      guildId,
      error: String(error).slice(0, 200)
    });
  }
}
