import {
  ActionRowBuilder,
  AuditLogEvent,
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  ComponentType,
  EmbedBuilder,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type AutoModerationActionOptions,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type Message,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type TopLevelComponentData,
  TextChannel
} from "discord.js";
import {
  createLogger,
  groqRoleDraftSchema,
  isEnabled,
  optionalEnv,
  requiredEnv,
  type WumpusModule
} from "@huborder/core";
import { createDatabase, type JsonObject, type WumpusPanelPublication } from "@huborder/database";

const logger = createLogger("wumpus");
const config = {
  token: requiredEnv("WUMPUS_DISCORD_TOKEN"),
  applicationId: requiredEnv("WUMPUS_APPLICATION_ID"),
  databaseUrl: requiredEnv("DATABASE_URL"),
  dashboardUrl: optionalEnv("WUMPUS_DASHBOARD_URL") ?? "http://localhost:3000/wumpus",
  groqApiKey: optionalEnv("WUMPUS_GROQ_API_KEY"),
  groqModel: optionalEnv("WUMPUS_GROQ_MODEL") ?? "openai/gpt-oss-120b",
  groqVisionModel: optionalEnv("WUMPUS_GROQ_VISION_MODEL") ?? "qwen/qwen3.6-27b",
  haizOcrUrl: optionalEnv("WUMPUS_HAIZ_OCR_URL") ?? "https://haizapi.vercel.app/api/discord/ocr"
};

const database = createDatabase(config.databaseUrl);
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const moduleCache = new Map<string, { expiresAt: number; config: JsonObject }>();
const joinWindows = new Map<string, number[]>();
const nukeWindows = new Map<string, number[]>();
const messageWindows = new Map<string, Array<{ at: number; fingerprint: string }>>();
const metricBuffer = new Map<string, number>();
const alertCooldowns = new Map<string, number>();
const haizRequestTimestamps: number[] = [];

function booleanValue(value: JsonObject, key: string, fallback: boolean) {
  return typeof value[key] === "boolean" ? value[key] as boolean : fallback;
}

function numberValue(value: JsonObject, key: string, fallback: number) {
  return typeof value[key] === "number" && Number.isFinite(value[key]) ? value[key] as number : fallback;
}

function stringValue(value: JsonObject, key: string, fallback = "") {
  return typeof value[key] === "string" ? value[key] as string : fallback;
}

function stringList(value: JsonObject, key: string) {
  return Array.isArray(value[key]) ? (value[key] as unknown[]).filter((item): item is string => typeof item === "string") : [];
}

async function moduleConfig(guildId: string, module: WumpusModule): Promise<JsonObject> {
  const cacheKey = guildId + ":" + module;
  const cached = moduleCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.config;
  const saved = await database.getWumpusConfigOrDefault(guildId, module);
  // Group membership and exceptions take effect on the next event without a bot restart.
  moduleCache.set(cacheKey, { config: saved, expiresAt: Date.now() + 3_000 });
  return saved;
}

function bufferMetric(guildId: string, metric: "joins" | "leaves" | "messages" | "moderationActions") {
  const key = guildId + ":" + metric;
  metricBuffer.set(key, (metricBuffer.get(key) ?? 0) + 1);
}

async function flushMetrics() {
  const work = [...metricBuffer.entries()];
  metricBuffer.clear();
  await Promise.all(work.map(async ([key, amount]) => {
    const split = key.split(":");
    const guildId = split[0];
    const metric = split[1] as "joins" | "leaves" | "messages" | "moderationActions";
    if (guildId && metric) await database.incrementWumpusDailyMetric(guildId, metric, amount);
  }));
}

function addToWindow(store: Map<string, number[]>, key: string, windowMs: number) {
  const now = Date.now();
  const current = (store.get(key) ?? []).filter((stamp) => now - stamp <= windowMs);
  current.push(now);
  store.set(key, current);
  return current.length;
}

function canAlert(key: string, durationMs: number) {
  const until = alertCooldowns.get(key) ?? 0;
  if (until > Date.now()) return false;
  alertCooldowns.set(key, Date.now() + durationMs);
  return true;
}

/** Haiz is rate-limited per host, so all guilds share a conservative request budget. */
function takeHaizRequestSlot(configuredLimit: number) {
  const now = Date.now();
  const windowStart = now - 60_000;
  while (haizRequestTimestamps[0] !== undefined && haizRequestTimestamps[0] < windowStart) haizRequestTimestamps.shift();
  if (haizRequestTimestamps.length >= Math.min(configuredLimit, 50)) return false;
  haizRequestTimestamps.push(now);
  return true;
}

function normalize(content: string) {
  return content.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f\u200b-\u200d\ufeff]/g, "").replace(/\s+/g, " ").trim();
}

async function syncRoles(guild: Guild) {
  await database.upsertWumpusRoleSnapshots(guild.id, guild.roles.cache.map((role) => ({
    roleId: role.id,
    name: role.name,
    color: role.color,
    position: role.position,
    permissions: role.permissions.bitfield.toString(),
    managed: role.managed,
    mentionable: role.mentionable
  })));
}

async function syncChannels(guild: Guild) {
  const channels = [...guild.channels.cache.values()]
    .filter((channel) => channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement || channel.type === ChannelType.GuildCategory)
    .map((channel) => ({ channelId: channel.id, name: channel.name, type: channel.type, parentId: channel.parentId, position: channel.rawPosition ?? 0 }));
  await database.upsertWumpusChannelSnapshots(guild.id, channels);
}

async function syncGuild(guild: Guild) {
  await database.upsertWumpusGuild({
    guildId: guild.id,
    name: guild.name,
    iconUrl: guild.iconURL({ extension: "png", size: 128 }),
    ownerId: guild.ownerId,
    memberCount: guild.memberCount,
    botPermissions: guild.members.me?.permissions.bitfield.toString() ?? "0"
  });
  await syncRoles(guild);
  await syncChannels(guild);
}

async function sendToChannel(guild: Guild, channelId: string, embed: EmbedBuilder) {
  if (!/^\d{15,22}$/.test(channelId)) return;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  await channel.send({ embeds: [embed] }).catch((error) => logger.warn("Unable to send Wumpus alert", { guildId: guild.id, error: String(error) }));
}

async function moduleAlert(guild: Guild, module: WumpusModule, title: string, description: string, color = 0xff7b95) {
  const settings = await moduleConfig(guild.id, module);
  const channelKey = module === "security" ? "alertChannelId" : module === "ocr" ? "reviewChannelId" : "logChannelId";
  const channelId = stringValue(settings, channelKey);
  if (!channelId) return;
  await sendToChannel(guild, channelId, new EmbedBuilder().setColor(color).setTitle("Wumpus · " + title).setDescription(description).setTimestamp());
}

async function containSuspect(guild: Guild, userId: string, settings: JsonObject, reason: string) {
  if (stringValue(settings, "response", "lockdown_review") !== "timeout_suspect") return false;
  if (userId === guild.ownerId || userId === client.user?.id) return false;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member?.moderatable) return false;
  const trusted = new Set(stringList(settings, "trustedRoleIds"));
  if (member.roles.cache.some((role) => trusted.has(role.id))) return false;
  const duration = numberValue(settings, "timeoutMinutes", 60) * 60_000;
  const applied = await member.timeout(duration, reason).then(() => true).catch(() => false);
  return applied;
}

async function handleRaid(member: GuildMember) {
  const settings = await moduleConfig(member.guild.id, "security");
  if (!isEnabled(settings)) return;
  const threshold = numberValue(settings, "raidJoinThreshold", 12);
  const windowSeconds = numberValue(settings, "raidWindowSeconds", 60);
  const joins = addToWindow(joinWindows, member.guild.id, windowSeconds * 1000);
  if (joins < threshold || !canAlert(member.guild.id + ":raid", windowSeconds * 1000)) return;
  const contained = await containSuspect(member.guild, member.id, settings, "Wumpus anti-raid containment");
  await database.addSecurityIncident({
    guildId: member.guild.id,
    incidentType: "raid",
    severity: joins >= threshold * 2 ? "critical" : "high",
    status: contained ? "contained" : "open",
    actorId: member.id,
    details: { joins, threshold, windowSeconds, response: stringValue(settings, "response"), contained }
  });
  await database.recordWumpusEvent({ guildId: member.guild.id, module: "security", eventType: "raid_detected", actorId: member.id, targetId: null, channelId: null, data: { joins, threshold, contained } });
  const action = contained ? "O último membro suspeito recebeu timeout preventivo." : "Revisão humana e lockdown manual recomendados.";
  await moduleAlert(member.guild, "security", "possível raid detectada", "Foram detectadas **" + joins + " entradas** em " + windowSeconds + "s. " + action);
}

async function handleNuke(guild: Guild, executorId: string | null, action: number) {
  if (!executorId || executorId === guild.ownerId || executorId === client.user?.id) return;
  const settings = await moduleConfig(guild.id, "security");
  if (!isEnabled(settings)) return;
  const member = await guild.members.fetch(executorId).catch(() => null);
  const trusted = new Set(stringList(settings, "trustedRoleIds"));
  if (member?.roles.cache.some((role) => trusted.has(role.id))) return;
  const windowSeconds = numberValue(settings, "nukeWindowSeconds", 30);
  const threshold = numberValue(settings, "nukeActionThreshold", 5);
  const count = addToWindow(nukeWindows, guild.id + ":" + executorId, windowSeconds * 1000);
  if (count < threshold || !canAlert(guild.id + ":nuke:" + executorId, windowSeconds * 1000)) return;
  const contained = await containSuspect(guild, executorId, settings, "Wumpus anti-nuke containment");
  await database.addSecurityIncident({
    guildId: guild.id,
    incidentType: "nuke",
    severity: count >= threshold * 2 ? "critical" : "high",
    status: contained ? "contained" : "open",
    actorId: executorId,
    details: { actions: count, threshold, windowSeconds, auditAction: action, contained }
  });
  await database.recordWumpusEvent({ guildId: guild.id, module: "security", eventType: "nuke_pattern_detected", actorId: executorId, targetId: null, channelId: null, data: { count, threshold, contained } });
  const actionText = contained ? "A conta recebeu timeout preventivo." : "O Wumpus solicitou revisão imediata.";
  await moduleAlert(guild, "security", "possível nuke detectado", "<@" + executorId + "> realizou **" + count + " ações destrutivas** em " + windowSeconds + "s. " + actionText);
}

async function groqStructured(prompt: string, schema: Record<string, unknown>, model: string, imageUrl?: string) {
  if (!config.groqApiKey) throw new Error("Groq is not configured.");
  const content: unknown = imageUrl ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageUrl } }] : prompt;
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: "Bearer " + config.groqApiKey, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: "Você trabalha para a segurança de comunidades Discord. Responda apenas no schema JSON fornecido. Nunca recomende punições automáticas sem revisão humana." },
        { role: "user", content }
      ],
      response_format: { type: "json_schema", json_schema: { name: "wumpus_result", strict: true, schema } }
    }),
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error("Groq returned " + response.status + ".");
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const result = body.choices?.[0]?.message?.content;
  if (!result) throw new Error("Groq returned no content.");
  return JSON.parse(result) as unknown;
}

type OcrRisk = "none" | "low" | "medium" | "high";

type HaizOcrResult = {
  text: string;
  provider: string;
  lines: string[];
  urls: string[];
  emails: string[];
  phoneNumbers: string[];
  wordCount: number;
  requestId: string | null;
};

type GroqImageReview = {
  summary: string;
  urls: string[];
  risk: OcrRisk;
  needsReview: boolean;
  transcriptionAgreement: "match" | "partial" | "mismatch" | "unavailable";
};

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function limitedStrings(value: unknown, limit: number, maximumLength = 2_000) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))]
    .map((item) => item.slice(0, maximumLength))
    .slice(0, limit);
}

function riskValue(value: unknown): OcrRisk {
  return value === "low" || value === "medium" || value === "high" ? value : "none";
}

async function readWithHaiz(imageUrl: string, language: string): Promise<HaizOcrResult> {
  const response = await fetch(config.haizOcrUrl, {
    method: "POST",
    headers: { authorization: "Bot " + config.token, "content-type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, language, preprocess: true }),
    signal: AbortSignal.timeout(40_000)
  });
  const body = await response.json().catch(() => null) as unknown;
  const result = objectValue(body);
  if (!response.ok || result.success !== true) {
    const message = typeof result.message === "string" ? result.message : typeof result.error === "string" ? result.error : "unknown error";
    throw new Error("Haiz OCR returned " + response.status + ": " + message);
  }
  const metadata = objectValue(result.metadata);
  const extracted = objectValue(result.extracted_data);
  return {
    text: typeof result.text === "string" ? result.text.slice(0, 12_000) : "",
    provider: typeof result.provider === "string" ? result.provider : "haiz",
    lines: limitedStrings(result.lines, 250, 1_000),
    urls: limitedStrings(extracted.urls, 20),
    emails: limitedStrings(extracted.emails, 20),
    phoneNumbers: limitedStrings(extracted.phone_numbers, 20),
    wordCount: typeof metadata.word_count === "number" && Number.isFinite(metadata.word_count) ? metadata.word_count : 0,
    requestId: typeof result.request_id === "string" ? result.request_id : null
  };
}

async function reviewImageWithGroq(imageUrl: string, extractedText: string, model: string): Promise<GroqImageReview> {
  const sourceText = extractedText
    ? "A transcrição abaixo veio do OCR especializado Haiz. Compare-a com a imagem; não invente texto que não esteja visível.\n\n--- transcrição Haiz ---\n" + extractedText.slice(0, 8_000) + "\n--- fim ---"
    : "O OCR especializado não conseguiu retornar uma transcrição. Leia a imagem diretamente, sem inventar conteúdo.";
  const result = await groqStructured(
    sourceText + "\n\nIdentifique URLs, convites, golpes, phishing ou conteúdo que exija revisão humana. A IA nunca deve recomendar punição automática.",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string", maxLength: 600 },
        urls: { type: "array", items: { type: "string" }, maxItems: 20 },
        risk: { type: "string", enum: ["none", "low", "medium", "high"] },
        needsReview: { type: "boolean" },
        transcriptionAgreement: { type: "string", enum: ["match", "partial", "mismatch", "unavailable"] }
      },
      required: ["summary", "urls", "risk", "needsReview", "transcriptionAgreement"]
    },
    model,
    imageUrl
  );
  const review = objectValue(result);
  const agreement = review.transcriptionAgreement;
  return {
    summary: typeof review.summary === "string" ? review.summary.slice(0, 600) : "",
    urls: limitedStrings(review.urls, 20),
    risk: riskValue(review.risk),
    needsReview: review.needsReview === true,
    transcriptionAgreement: agreement === "match" || agreement === "partial" || agreement === "mismatch" ? agreement : "unavailable"
  };
}

async function inspectImage(message: Message) {
  if (!message.guild) return;
  const attachment = message.attachments.find((item) => item.contentType?.startsWith("image/"));
  if (!attachment) return;
  const settings = await moduleConfig(message.guild.id, "ocr");
  if (!isEnabled(settings)) return;
  const provider = stringValue(settings, "provider", "hybrid");
  const useHaiz = provider !== "groq";
  const useGroq = provider !== "haiz" && Boolean(config.groqApiKey) && attachment.size <= 20 * 1024 * 1024;
  let haiz: HaizOcrResult | null = null;
  let groq: GroqImageReview | null = null;
  const failures: string[] = [];

  if (useHaiz) {
    if (takeHaizRequestSlot(numberValue(settings, "haizRequestsPerMinute", 30))) {
      try {
        haiz = await readWithHaiz(attachment.url, stringValue(settings, "language", "pt"));
      } catch (error) {
        failures.push("Haiz: " + (error instanceof Error ? error.message : String(error)));
      }
    } else if (canAlert("haiz-rate-limit", 60_000)) {
      logger.warn("Haiz OCR rate budget exhausted", { guildId: message.guild.id });
    }
  }

  if (useGroq) {
    try {
      groq = await reviewImageWithGroq(attachment.url, haiz?.text ?? "", stringValue(settings, "model", config.groqVisionModel));
    } catch (error) {
      failures.push("Groq: " + (error instanceof Error ? error.message : String(error)));
    }
  } else if (provider !== "haiz" && config.groqApiKey && attachment.size > 20 * 1024 * 1024) {
    failures.push("Groq: image exceeds 20 MB input limit");
  }

  if (!haiz && !groq) {
    logger.warn("OCR analysis failed", { guildId: message.guild.id, provider, error: failures.join(" | ") || "no OCR provider configured" });
    return;
  }
  if (failures.length) logger.warn("OCR provider fallback used", { guildId: message.guild.id, provider, error: failures.join(" | ") });

  const urls = limitedStrings([...(haiz?.urls ?? []), ...(groq?.urls ?? [])], 20);
  const risk = groq?.risk ?? "none";
  const needsReview = groq?.needsReview === true || groq?.transcriptionAgreement === "mismatch";
  const source = haiz && groq ? "haiz+groq" : haiz ? "haiz" : "groq";
  const data: JsonObject = {
    source,
    risk,
    urls,
    needsReview,
    haiz: haiz ? { provider: haiz.provider, characters: haiz.text.length, lines: haiz.lines.length, words: haiz.wordCount, emails: haiz.emails.length, phoneNumbers: haiz.phoneNumbers.length } : { available: false },
    groq: groq ? { reviewed: true, transcriptionAgreement: groq.transcriptionAgreement } : { reviewed: false }
  };
  if (booleanValue(settings, "retainExtractedText", false)) {
    if (haiz?.text) data.extractedText = haiz.text;
    if (groq?.summary) data.summary = groq.summary;
  }
  await database.recordWumpusEvent({ guildId: message.guild.id, module: "ocr", eventType: "image_ocr_complete", actorId: message.author.id, targetId: null, channelId: message.channel.id, data });
  if (needsReview || risk === "high") {
    await database.addSecurityIncident({ guildId: message.guild.id, incidentType: "automod", severity: risk === "high" ? "high" : "medium", status: "open", actorId: message.author.id, details: { source, risk, imageUrl: attachment.url, urls, transcriptionAgreement: groq?.transcriptionAgreement ?? "unavailable" } });
    await moduleAlert(message.guild, "ocr", "imagem precisa de revisão", "Uma imagem enviada por <@" + message.author.id + "> foi analisada por **" + source + "** e marcada para revisão" + (risk !== "none" ? " com risco **" + risk + "**." : "."), 0xffcb6b);
  }
}

async function handleAutoMod(message: Message) {
  if (!message.guild || message.author.bot) return;
  bufferMetric(message.guild.id, "messages");
  void inspectImage(message);
  if (!message.content) return;
  const settings = await moduleConfig(message.guild.id, "automod");
  if (!isEnabled(settings)) return;
  const now = Date.now();
  const key = message.guild.id + ":" + message.author.id;
  const windowMs = numberValue(settings, "windowSeconds", 10) * 1000;
  const records = (messageWindows.get(key) ?? []).filter((entry) => now - entry.at <= windowMs);
  const fingerprint = normalize(message.content);
  records.push({ at: now, fingerprint });
  messageWindows.set(key, records);
  const blockedTerm = stringList(settings, "blockedTerms").find((term) => fingerprint.includes(normalize(term)));
  const blockedDomain = stringList(settings, "blockedDomains").find((domain) => fingerprint.includes(domain.toLowerCase()));
  const invite = booleanValue(settings, "blockInvites", true) && /(?:discord(?:app)?\.com\/invite|discord\.gg)\/[\w-]+/i.test(message.content);
  const duplicates = records.filter((item) => item.fingerprint === fingerprint).length;
  const flood = records.length >= numberValue(settings, "messageLimit", 6);
  const repeated = duplicates >= numberValue(settings, "duplicateLimit", 3);
  const score = (flood ? 2 : 0) + (repeated ? 3 : 0) + (blockedTerm ? 4 : 0) + (blockedDomain ? 4 : 0) + (invite ? 2 : 0);
  if (score < 2) return;
  const reason = blockedTerm ? "termo bloqueado" : blockedDomain ? "domínio bloqueado" : invite ? "convite bloqueado" : repeated ? "mensagens repetidas" : "flood";
  const action = stringValue(settings, "action", "delete");
  const deleted = await message.delete().then(() => true).catch(() => false);
  let timedOut = false;
  if (action === "timeout") {
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (member?.moderatable) timedOut = await member.timeout(numberValue(settings, "timeoutMinutes", 10) * 60_000, "Wumpus AutoMod: " + reason).then(() => true).catch(() => false);
  }
  if (action === "warn") await message.author.send("O AutoMod de **" + message.guild.name + "** identificou " + reason + " em sua mensagem. Revise as regras antes de continuar.").catch(() => undefined);
  const incident = await database.addSecurityIncident({
    guildId: message.guild.id,
    incidentType: "automod",
    severity: score >= 6 ? "high" : "medium",
    status: action === "review" ? "open" : "contained",
    actorId: message.author.id,
    details: { reason, action, score, deleted, timedOut, channelId: message.channel.id }
  });
  await database.recordWumpusEvent({ guildId: message.guild.id, module: "automod", eventType: "content_risk_detected", actorId: message.author.id, targetId: null, channelId: message.channel.id, data: { incidentId: incident.id, reason, action, score } });
  bufferMetric(message.guild.id, "moderationActions");
  await moduleAlert(message.guild, "automod", "AutoMod agiu", "<@" + message.author.id + "> · **" + reason + "** · ação: " + action + (timedOut ? " · timeout aplicado" : ""), 0xffcb6b);
}

async function syncNativeAutoMod(guild: Guild) {
  const settings = await moduleConfig(guild.id, "automod");
  if (!isEnabled(settings) || !guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) return;
  const blocked = [...stringList(settings, "blockedTerms"), ...stringList(settings, "blockedDomains").map((domain) => "*" + domain + "*")];
  if (booleanValue(settings, "blockInvites", true)) blocked.push("*discord.gg/*", "*discord.com/invite/*");
  const keywordFilter = [...new Set(blocked.map((item) => item.trim()).filter(Boolean))].slice(0, 1_000);
  const rules = await guild.autoModerationRules.fetch();
  const existing = rules.find((rule) => rule.name === "Wumpus · proteção combinada");
  if (!keywordFilter.length) {
    if (existing?.enabled) await existing.edit({ enabled: false, reason: "Wumpus AutoMod sem palavras ou links configurados" });
    return;
  }
  const actions: AutoModerationActionOptions[] = [{ type: AutoModerationActionType.BlockMessage, metadata: { customMessage: "Esta mensagem foi bloqueada pelas regras de segurança do servidor." } }];
  const logChannelId = stringValue(settings, "logChannelId");
  if (logChannelId) actions.push({ type: AutoModerationActionType.SendAlertMessage, metadata: { channel: logChannelId } });
  const data = {
    eventType: AutoModerationRuleEventType.MessageSend,
    triggerType: AutoModerationRuleTriggerType.Keyword,
    triggerMetadata: { keywordFilter },
    actions,
    enabled: true,
    reason: "Sincronização segura do AutoMod nativo pelo Wumpus"
  };
  if (existing) await existing.edit(data);
  else await guild.autoModerationRules.create({ name: "Wumpus · proteção combinada", ...data });
}

async function syncAllNativeAutoMod() {
  for (const guild of client.guilds.cache.values()) {
    await syncNativeAutoMod(guild).catch((error) => logger.warn("Native AutoMod sync failed", { guildId: guild.id, error: String(error) }));
  }
}

async function staffAllowed(member: GuildMember, module: "moderation" | "tickets") {
  const settings = await moduleConfig(member.guild.id, module);
  const roles = new Set(stringList(settings, "staffRoleIds"));
  if (roles.size) return member.roles.cache.some((role) => roles.has(role.id));
  return member.permissions.has(PermissionFlagsBits.ModerateMembers) || member.permissions.has(PermissionFlagsBits.ManageGuild);
}

async function beginTicket(interaction: ButtonInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Este atendimento só funciona dentro de um servidor.", ephemeral: true });
  const departments = (await database.listWumpusTicketDepartments(interaction.guild.id)).filter((department) => department.isActive);
  if (!departments.length) return openTicket(interaction);
  const select = new StringSelectMenuBuilder().setCustomId("wumpus:ticket:department").setPlaceholder("Escolha o assunto do atendimento").addOptions(departments.slice(0, 25).map((department) => ({
    label: department.name.slice(0, 100),
    description: department.description.slice(0, 100) || "Atendimento com a equipe",
    value: String(department.id),
    emoji: department.emoji || undefined
  })));
  return interaction.reply({ content: "Qual atendimento você precisa?", components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)], ephemeral: true });
}

async function openTicket(interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: "Este atendimento só funciona dentro de um servidor.", ephemeral: true });
  const settings = await moduleConfig(guild.id, "tickets");
  if (!isEnabled(settings)) return interaction.reply({ content: "O atendimento ainda não está ativo neste servidor.", ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  const departmentId = interaction.isStringSelectMenu() ? Number(interaction.values[0]) : null;
  const department = departmentId ? (await database.listWumpusTicketDepartments(guild.id)).find((item) => item.id === departmentId && item.isActive) : null;
  if (departmentId && !department) return interaction.editReply({ content: "Esse departamento não está mais disponível. Abra o painel novamente." });
  const existing = await database.pool.query<{ channel_id: string }>("SELECT channel_id FROM wumpus_tickets WHERE guild_id = $1 AND opener_id = $2 AND status IN ('open', 'claimed') AND channel_id IS NOT NULL LIMIT 1", [guild.id, interaction.user.id]);
  if (existing.rows[0]?.channel_id) return interaction.editReply({ content: "Você já possui um atendimento aberto em <#" + existing.rows[0].channel_id + ">." });
  const staffRoles = [...new Set([...stringList(settings, "staffRoleIds"), ...(department?.staffRoleIds ?? [])])];
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ...staffRoles.map((id) => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] }))
  ];
  const name = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 42) || interaction.user.id;
  const channel = await guild.channels.create({ name: "atendimento-" + name, type: ChannelType.GuildText, parent: department?.categoryId || stringValue(settings, "categoryId") || undefined, topic: "Atendimento Wumpus · cliente " + interaction.user.id + (department ? " · " + department.name : ""), permissionOverwrites: overwrites });
  const ticket = await database.createWumpusTicket({ guildId: guild.id, channelId: channel.id, openerId: interaction.user.id, department: department?.name ?? null });
  const close = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("wumpus:ticket:close").setLabel("Encerrar atendimento").setStyle(ButtonStyle.Danger).setEmoji("🔒"));
  await (channel as TextChannel).send({ content: "<@" + interaction.user.id + ">" + staffRoles.map((id) => " <@&" + id + ">").join(""), embeds: [new EmbedBuilder().setColor(0x8b7dff).setTitle("Atendimento #" + ticket.id + (department ? " · " + department.name : "")).setDescription("Explique o que você precisa. A equipe poderá assumir o atendimento e uma transcrição será salva ao encerrar.")], components: [close] });
  await database.recordWumpusEvent({ guildId: guild.id, module: "tickets", eventType: "ticket_opened", actorId: interaction.user.id, targetId: null, channelId: channel.id, data: { ticketId: ticket.id } });
  return interaction.editReply({ content: "Seu atendimento foi aberto em <#" + channel.id + ">." });
}

async function closeTicket(interaction: ButtonInteraction) {
  if (!interaction.guild || !interaction.channel?.isTextBased()) return interaction.reply({ content: "Canal inválido.", ephemeral: true });
  const ticket = await database.getWumpusTicketByChannel(interaction.channel.id);
  if (!ticket || ticket.status === "closed") return interaction.reply({ content: "Este não é um atendimento aberto.", ephemeral: true });
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (ticket.openerId !== interaction.user.id && !await staffAllowed(member, "tickets")) return interaction.reply({ content: "Apenas o cliente ou a equipe pode encerrar este atendimento.", ephemeral: true });
  await interaction.reply({ content: "Encerrando atendimento e salvando a transcrição…", ephemeral: true });
  const settings = await moduleConfig(interaction.guild.id, "tickets");
  const transcriptId = stringValue(settings, "transcriptChannelId");
  if (transcriptId && interaction.channel instanceof TextChannel) {
    const transcript = await client.channels.fetch(transcriptId).catch(() => null);
    if (transcript?.isTextBased() && "send" in transcript) {
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const content = [...messages.values()].reverse().map((item) => "[" + item.createdAt.toISOString() + "] " + item.author.tag + ": " + (item.content || "[sem texto]")).join("\n");
      await transcript.send({ content: "Transcrição do atendimento #" + ticket.id, files: [{ attachment: Buffer.from(content, "utf8"), name: "atendimento-" + ticket.id + ".txt" }] }).catch(() => undefined);
    }
  }
  await database.closeWumpusTicket(ticket.id);
  await database.recordWumpusEvent({ guildId: interaction.guild.id, module: "tickets", eventType: "ticket_closed", actorId: interaction.user.id, targetId: ticket.openerId, channelId: interaction.channel.id, data: { ticketId: ticket.id } });
  await (interaction.channel as TextChannel).delete("Wumpus ticket " + ticket.id + " closed");
}

function reportModal(guildId: string, targetId: string) {
  return new ModalBuilder().setCustomId("wumpus:report:" + guildId + ":" + targetId).setTitle("Enviar denúncia").addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("O que aconteceu?").setStyle(TextInputStyle.Paragraph).setMinLength(15).setMaxLength(1500).setRequired(true)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("evidence").setLabel("Evidências ou contexto").setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(false))
  );
}

function appealModal(guildId: string) {
  return new ModalBuilder().setCustomId("wumpus:appeal:" + guildId + ":self").setTitle("Enviar apelação").addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("Explique por que a decisão deve ser revista").setStyle(TextInputStyle.Paragraph).setMinLength(15).setMaxLength(1500).setRequired(true)));
}

function applicationModal(guildId: string) {
  return new ModalBuilder().setCustomId("wumpus:application:" + guildId + ":self").setTitle("Enviar candidatura").addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("application").setLabel("Conte por que você é uma boa escolha").setStyle(TextInputStyle.Paragraph).setMinLength(30).setMaxLength(1800).setRequired(true)));
}

function dynamicFormModal(guildId: string, form: { id: number; name: string; fields: JsonObject[] }) {
  const modal = new ModalBuilder().setCustomId("wumpus:form:" + guildId + ":" + form.id).setTitle(form.name.slice(0, 45));
  const fields = form.fields.slice(0, 5);
  for (const [index, field] of fields.entries()) {
    const label = typeof field.label === "string" ? field.label : "Pergunta " + (index + 1);
    const input = new TextInputBuilder().setCustomId("field" + index).setLabel(label.slice(0, 45)).setStyle(field.type === "short" ? TextInputStyle.Short : TextInputStyle.Paragraph).setRequired(field.required !== false).setMaxLength(typeof field.maxLength === "number" ? Math.min(4000, Math.max(1, field.maxLength)) : 1000);
    if (typeof field.placeholder === "string") input.setPlaceholder(field.placeholder.slice(0, 100));
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  }
  return modal;
}

async function beginApplication(interaction: ButtonInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: "Este formulário só funciona em um servidor.", ephemeral: true });
  const forms = (await database.listWumpusForms(interaction.guildId)).filter((form) => form.isActive);
  if (!forms.length) return interaction.showModal(applicationModal(interaction.guildId));
  if (forms.length === 1 && forms[0]) return interaction.showModal(dynamicFormModal(interaction.guildId, forms[0]));
  const select = new StringSelectMenuBuilder().setCustomId("wumpus:form:select").setPlaceholder("Escolha o formulário").addOptions(forms.slice(0, 25).map((form) => ({ label: form.name.slice(0, 100), description: form.description.slice(0, 100) || "Abrir formulário", value: String(form.id), emoji: "📝" })));
  return interaction.reply({ content: "Qual formulário você quer preencher?", components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)], ephemeral: true });
}

async function selectApplication(interaction: StringSelectMenuInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: "Este formulário só funciona em um servidor.", ephemeral: true });
  const formId = Number(interaction.values[0]);
  const form = (await database.listWumpusForms(interaction.guildId)).find((item) => item.id === formId && item.isActive);
  if (!form) return interaction.reply({ content: "Esse formulário não está mais disponível.", ephemeral: true });
  return interaction.showModal(dynamicFormModal(interaction.guildId, form));
}

async function handleModal(interaction: ModalSubmitInteraction) {
  const parts = interaction.customId.split(":");
  if (parts[0] !== "wumpus" || !parts[1] || !parts[2] || interaction.guildId !== parts[2]) return;
  const action = parts[1];
  const guildId = parts[2];
  if (action === "report") {
    const settings = await moduleConfig(guildId, "reports");
    if (!isEnabled(settings)) return interaction.reply({ content: "A central de denúncias está desativada.", ephemeral: true });
    const caseItem = await database.createWumpusCase({ guildId, caseType: "report", status: "open", reporterId: interaction.user.id, targetId: parts[3] || null, assignedTo: null, reason: interaction.fields.getTextInputValue("reason"), evidence: { evidence: interaction.fields.getTextInputValue("evidence") } });
    await database.recordWumpusEvent({ guildId, module: "reports", eventType: "report_opened", actorId: interaction.user.id, targetId: parts[3] || null, channelId: interaction.channelId, data: { caseId: caseItem.id } });
    await interaction.reply({ content: "Sua denúncia foi registrada como caso **#" + caseItem.id + "**.", ephemeral: true });
    if (interaction.guild) await moduleAlert(interaction.guild, "reports", "nova denúncia", "Caso **#" + caseItem.id + "** aguarda análise.", 0xffcb6b);
    return;
  }
  if (action === "appeal") {
    const caseItem = await database.createWumpusCase({ guildId, caseType: "appeal", status: "open", reporterId: interaction.user.id, targetId: interaction.user.id, assignedTo: null, reason: interaction.fields.getTextInputValue("reason"), evidence: {} });
    await database.recordWumpusEvent({ guildId, module: "reports", eventType: "appeal_opened", actorId: interaction.user.id, targetId: interaction.user.id, channelId: interaction.channelId, data: { caseId: caseItem.id } });
    return interaction.reply({ content: "Sua apelação foi registrada como caso **#" + caseItem.id + "**.", ephemeral: true });
  }
  if (action === "application") {
    const settings = await moduleConfig(guildId, "forms");
    if (!isEnabled(settings)) return interaction.reply({ content: "As candidaturas estão desativadas.", ephemeral: true });
    const submissionId = await database.createWumpusApplication({ guildId, submitterId: interaction.user.id, answers: { application: interaction.fields.getTextInputValue("application") } });
    await database.recordWumpusEvent({ guildId, module: "forms", eventType: "application_submitted", actorId: interaction.user.id, targetId: null, channelId: interaction.channelId, data: { submissionId } });
    await interaction.reply({ content: "Candidatura **#" + submissionId + "** enviada com sucesso.", ephemeral: true });
    if (interaction.guild) await moduleAlert(interaction.guild, "forms", "nova candidatura", "A candidatura **#" + submissionId + "** foi enviada por <@" + interaction.user.id + ">.", 0x8b7dff);
  }
  if (action === "form") {
    const formId = Number(parts[3]);
    const form = (await database.listWumpusForms(guildId)).find((item) => item.id === formId && item.isActive);
    if (!form) return interaction.reply({ content: "Esse formulário não está mais disponível.", ephemeral: true });
    const answers: JsonObject = {};
    form.fields.slice(0, 5).forEach((field, index) => {
      const key = typeof field.key === "string" ? field.key : "field" + index;
      answers[key] = interaction.fields.getTextInputValue("field" + index);
    });
    const submissionId = await database.createWumpusFormSubmission({ formId, guildId, submitterId: interaction.user.id, answers });
    if (!submissionId) return interaction.reply({ content: "Não foi possível registrar este envio.", ephemeral: true });
    await database.recordWumpusEvent({ guildId, module: "forms", eventType: "form_submitted", actorId: interaction.user.id, targetId: null, channelId: interaction.channelId, data: { formId, submissionId } });
    await interaction.reply({ content: "Formulário **#" + submissionId + "** enviado com sucesso.", ephemeral: true });
    if (interaction.guild) await moduleAlert(interaction.guild, "forms", "novo formulário enviado", "**" + form.name + "** · envio **#" + submissionId + "** por <@" + interaction.user.id + ">.", 0x8b7dff);
  }
}

async function createRoleDraft(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Este comando só funciona em um servidor.", ephemeral: true });
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.permissions.has(PermissionFlagsBits.ManageRoles)) return interaction.reply({ content: "Você precisa de Gerenciar Cargos.", ephemeral: true });
  const settings = await moduleConfig(interaction.guild.id, "roles");
  if (!isEnabled(settings) || !booleanValue(settings, "allowAiDrafts", true)) return interaction.reply({ content: "Os rascunhos por IA estão desativados.", ephemeral: true });
  if (!config.groqApiKey) return interaction.reply({ content: "A IA ainda não foi configurada pela administração.", ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  try {
    const request = interaction.options.getString("pedido", true);
    const draft = groqRoleDraftSchema.parse(await groqStructured(
      "Crie rascunhos de cargos para o servidor " + interaction.guild.name + " a partir deste pedido: " + request + ". Nunca sugira Administrator, ManageGuild, BanMembers, KickMembers ou ManageRoles. Use nomes em português.",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          roles: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, color: { type: "string" }, permissions: { type: "array", items: { type: "string" } }, hoist: { type: "boolean" }, mentionable: { type: "boolean" }, rationale: { type: "string" } }, required: ["name", "color", "permissions", "hoist", "mentionable", "rationale"] } },
          warnings: { type: "array", items: { type: "string" } }
        },
        required: ["roles", "warnings"]
      },
      config.groqModel
    ));
    const lines = draft.roles.map((role) => "**" + role.name + "** · " + role.color + "\n" + role.rationale + "\nPermissões: " + (role.permissions.join(", ") || "nenhuma")).join("\n\n").slice(0, 3500);
    const saved = await database.createWumpusRoleDraft({ guildId: interaction.guild.id, createdBy: interaction.user.id, request, draft: { roles: draft.roles, warnings: draft.warnings } });
    await database.recordWumpusEvent({ guildId: interaction.guild.id, module: "roles", eventType: "ai_role_draft_created", actorId: interaction.user.id, targetId: null, channelId: interaction.channelId, data: { draftId: saved.id, roles: draft.roles.length } });
    const review = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("wumpus:roles:apply:" + saved.id).setLabel("Revisado · criar cargos").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("wumpus:roles:reject:" + saved.id).setLabel("Descartar rascunho").setStyle(ButtonStyle.Secondary)
    );
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x8b7dff).setTitle("Rascunho #" + saved.id + " · revisão obrigatória").setDescription(lines + "\n\n**Avisos:** " + (draft.warnings.join(" · ") || "Revise a hierarquia antes de aplicar.")).setFooter({ text: "Nada será alterado até uma pessoa com Gerenciar Cargos aprovar." })], components: [review] });
  } catch (error) {
    logger.warn("Role draft failed", { guildId: interaction.guild.id, error: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ content: "Não foi possível gerar o rascunho agora. Tente novamente em instantes." });
  }
}

const safeRolePermissions: Record<string, bigint> = {
  viewchannel: PermissionFlagsBits.ViewChannel,
  sendmessages: PermissionFlagsBits.SendMessages,
  readmessagehistory: PermissionFlagsBits.ReadMessageHistory,
  addreactions: PermissionFlagsBits.AddReactions,
  attachfiles: PermissionFlagsBits.AttachFiles,
  embedlinks: PermissionFlagsBits.EmbedLinks,
  connect: PermissionFlagsBits.Connect,
  speak: PermissionFlagsBits.Speak,
  stream: PermissionFlagsBits.Stream,
  useapplicationcommands: PermissionFlagsBits.UseApplicationCommands,
  managechannels: PermissionFlagsBits.ManageChannels,
  managemessages: PermissionFlagsBits.ManageMessages,
  moderatemembers: PermissionFlagsBits.ModerateMembers,
  managenicknames: PermissionFlagsBits.ManageNicknames,
  kickmembers: PermissionFlagsBits.KickMembers,
  banmembers: PermissionFlagsBits.BanMembers
};

async function reviewRoleDraft(interaction: ButtonInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Este rascunho só funciona no servidor original.", ephemeral: true });
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.permissions.has(PermissionFlagsBits.ManageRoles)) return interaction.reply({ content: "Você precisa de Gerenciar Cargos para revisar este rascunho.", ephemeral: true });
  const parts = interaction.customId.split(":");
  const decision = parts[2];
  const draftId = Number(parts[3]);
  const saved = await database.getWumpusRoleDraft(draftId, interaction.guild.id);
  if (!saved || saved.status !== "pending") return interaction.reply({ content: "Este rascunho já foi revisado ou não existe.", ephemeral: true });
  if (decision === "reject") {
    await database.finishWumpusRoleDraft({ id: draftId, guildId: interaction.guild.id, status: "rejected", reviewedBy: interaction.user.id });
    await interaction.update({ components: [] });
    return interaction.followUp({ content: "Rascunho descartado. Nenhum cargo foi alterado.", ephemeral: true });
  }
  const roles = Array.isArray(saved.draft.roles) ? saved.draft.roles.filter((role): role is JsonObject => role !== null && typeof role === "object" && !Array.isArray(role)) : [];
  if (!roles.length) return interaction.reply({ content: "O rascunho não contém cargos válidos.", ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  try {
    const created: string[] = [];
    for (const role of roles.slice(0, 30)) {
      const name = typeof role.name === "string" ? role.name.slice(0, 100) : "Novo cargo";
      const color = typeof role.color === "string" && /^#[0-9a-f]{6}$/i.test(role.color) ? Number.parseInt(role.color.slice(1), 16) : 0;
      const permissions = Array.isArray(role.permissions) ? role.permissions.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase().replace(/[^a-z]/g, "")).map((item) => safeRolePermissions[item]).filter((item): item is bigint => typeof item === "bigint") : [];
      const createdRole = await interaction.guild.roles.create({ name, color, permissions, hoist: role.hoist === true, mentionable: role.mentionable === true, reason: "Rascunho Wumpus #" + draftId + " aprovado por " + interaction.user.tag });
      created.push(createdRole.id);
    }
    await database.finishWumpusRoleDraft({ id: draftId, guildId: interaction.guild.id, status: "applied", reviewedBy: interaction.user.id });
    await database.recordWumpusEvent({ guildId: interaction.guild.id, module: "roles", eventType: "ai_role_draft_applied", actorId: interaction.user.id, targetId: null, channelId: interaction.channelId, data: { draftId, roleIds: created } });
    await interaction.editReply({ content: "Rascunho **#" + draftId + "** aplicado com revisão: **" + created.length + " cargos** criados." });
    await interaction.message.edit({ components: [] }).catch(() => undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await database.finishWumpusRoleDraft({ id: draftId, guildId: interaction.guild.id, status: "failed", reviewedBy: interaction.user.id, error: message.slice(0, 500) });
    await interaction.editReply({ content: "Não foi possível concluir a criação. Verifique a hierarquia e as permissões do Wumpus." });
  }
}

async function answerKnowledge(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Este comando só funciona em um servidor.", ephemeral: true });
  const settings = await moduleConfig(interaction.guild.id, "knowledge");
  if (!isEnabled(settings)) return interaction.reply({ content: "A base de conhecimento está desativada.", ephemeral: true });
  const question = interaction.options.getString("pergunta", true);
  const articles = await database.searchWumpusKnowledge(interaction.guild.id, question);
  if (!articles.length) return interaction.reply({ content: "Não encontrei uma resposta aprovada na base deste servidor.", ephemeral: true });
  let answer = articles.map((article) => "• **" + article.title + "** — " + article.content.slice(0, 220) + (article.content.length > 220 ? "…" : "")).join("\n");
  if (booleanValue(settings, "useGroq", false) && config.groqApiKey) {
    try {
      const context = articles.map((article) => "# " + article.title + "\n" + article.content).join("\n\n").slice(0, 12000);
      const result = await groqStructured("Responda à pergunta " + question + " usando somente este conteúdo aprovado. Se ele não for suficiente, diga isso.\n\n" + context, { type: "object", additionalProperties: false, properties: { answer: { type: "string", maxLength: 1800 }, sources: { type: "array", items: { type: "string" }, maxItems: 5 } }, required: ["answer", "sources"] }, config.groqModel) as { answer: string; sources: string[] };
      answer = result.answer + "\n\n*Fontes: " + result.sources.join(", ") + "*";
    } catch (error) {
      logger.warn("Knowledge answer failed", { guildId: interaction.guild.id, error: String(error) });
    }
  }
  return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x65e5ac).setTitle("Base de conhecimento").setDescription(answer.slice(0, 4096))], ephemeral: true });
}

async function moderate(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Este comando só funciona em um servidor.", ephemeral: true });
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!await staffAllowed(member, "moderation")) return interaction.reply({ content: "Sua função não tem acesso à moderação Wumpus.", ephemeral: true });
  const target = await interaction.guild.members.fetch(interaction.options.getUser("membro", true).id).catch(() => null);
  if (!target) return interaction.reply({ content: "Não consegui encontrar este membro.", ephemeral: true });
  const action = interaction.options.getSubcommand();
  const reason = interaction.options.getString("motivo", true);
  let timeout = false;
  if (action === "timeout") {
    if (!target.moderatable) return interaction.reply({ content: "Não posso aplicar timeout neste membro por causa da hierarquia de cargos.", ephemeral: true });
    await target.timeout(interaction.options.getInteger("minutos", true) * 60_000, reason);
    timeout = true;
  }
  const caseItem = await database.createWumpusCase({ guildId: interaction.guild.id, caseType: "moderation", status: "resolved", reporterId: interaction.user.id, targetId: target.id, assignedTo: interaction.user.id, reason, evidence: { action, timeout } });
  await database.recordWumpusEvent({ guildId: interaction.guild.id, module: "moderation", eventType: "moderation_" + action, actorId: interaction.user.id, targetId: target.id, channelId: interaction.channelId, data: { caseId: caseItem.id, reason, timeout } });
  bufferMetric(interaction.guild.id, "moderationActions");
  return interaction.reply({ content: "Caso **#" + caseItem.id + "** registrado. " + (timeout ? "Timeout aplicado." : "Advertência registrada."), ephemeral: true });
}

function punishmentEvidence(interaction: ChatInputCommandInteraction) {
  return [1, 2, 3, 4, 5].map((index) => interaction.options.getAttachment("evidencia" + index)).filter((attachment) => attachment !== null).map((attachment) => ({
    id: attachment.id,
    name: attachment.name,
    url: attachment.url,
    contentType: attachment.contentType ?? null,
    size: attachment.size
  }));
}

function progressivePunishment(strikeNumber: number) {
  if (strikeNumber === 1) return { timeoutMinutes: 60, reviewAction: null as "kick" | "ban" | null };
  if (strikeNumber === 2) return { timeoutMinutes: 180, reviewAction: null as "kick" | "ban" | null };
  if (strikeNumber === 3) return { timeoutMinutes: 1_440, reviewAction: "kick" as const };
  return { timeoutMinutes: Math.min(40_320, 10_080 * (strikeNumber - 3)), reviewAction: "ban" as const };
}

async function punish(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: "Este comando só funciona em um servidor.", ephemeral: true });
  const staff = await interaction.guild.members.fetch(interaction.user.id);
  if (!await staffAllowed(staff, "moderation")) return interaction.reply({ content: "Sua função não tem acesso às punições do Wumpus.", ephemeral: true });
  const target = await interaction.guild.members.fetch(interaction.options.getUser("membro", true).id).catch(() => null);
  if (!target) return interaction.reply({ content: "Não consegui encontrar esse membro no servidor.", ephemeral: true });
  if (target.id === interaction.user.id || target.user.bot) return interaction.reply({ content: "Essa punição não pode ser aplicada a esse membro.", ephemeral: true });
  const reason = interaction.options.getString("motivo", true).trim();
  const requestedAction = interaction.options.getString("acao", true) as "warn" | "timeout" | "kick" | "ban";
  const strikeNumber = await database.countWumpusOccurrences(interaction.guild.id, target.id) + 1;
  const ladder = progressivePunishment(strikeNumber);
  const evidence = punishmentEvidence(interaction);
  let timeoutApplied = false;

  if (target.moderatable) {
    await target.timeout(ladder.timeoutMinutes * 60_000, "Ocorrência Wumpus #" + strikeNumber + ": " + reason);
    timeoutApplied = true;
  }
  await target.send("Você recebeu a ocorrência **#" + strikeNumber + "** em **" + interaction.guild.name + "**.\nMotivo: " + reason + "\nMedida imediata: advertência" + (timeoutApplied ? " e castigo de " + ladder.timeoutMinutes + " minutos." : ".")).catch(() => undefined);

  const reviewAction = ladder.reviewAction;
  const occurrence = await database.createWumpusOccurrence({
    guildId: interaction.guild.id,
    targetId: target.id,
    staffId: interaction.user.id,
    requestedAction,
    reason,
    evidence,
    strikeNumber,
    timeoutMinutes: timeoutApplied ? ladder.timeoutMinutes : null,
    status: reviewAction ? "pending" : "applied",
    appliedAction: reviewAction ? (timeoutApplied ? "warn+timeout" : "warn") : (timeoutApplied ? "warn+timeout" : "warn")
  });
  const caseItem = await database.createWumpusCase({ guildId: interaction.guild.id, caseType: "moderation", status: reviewAction ? "in_review" : "resolved", reporterId: interaction.user.id, targetId: target.id, assignedTo: interaction.user.id, reason, evidence: { occurrenceId: occurrence.id, requestedAction, evidence, strikeNumber, timeoutMinutes: timeoutApplied ? ladder.timeoutMinutes : null, reviewAction } });
  await database.recordWumpusEvent({ guildId: interaction.guild.id, module: "moderation", eventType: reviewAction ? "punishment_review_requested" : "punishment_applied", actorId: interaction.user.id, targetId: target.id, channelId: interaction.channelId, data: { occurrenceId: occurrence.id, caseId: caseItem.id, strikeNumber, requestedAction, reviewAction, timeoutApplied } });
  bufferMetric(interaction.guild.id, "moderationActions");

  if (reviewAction) {
    await moduleAlert(interaction.guild, "moderation", "ocorrência aguardando aprovação", "Ocorrência **#" + occurrence.id + "** · <@" + target.id + "> · nível **" + strikeNumber + "**\nAção sugerida: **" + (reviewAction === "kick" ? "expulsão" : "banimento") + "**. Revise no painel privado antes da execução.", 0xffcb6b);
  }
  return interaction.reply({
    content: "Ocorrência **#" + occurrence.id + "** registrada. Advertência" + (timeoutApplied ? " e castigo aplicados" : " registrada; o castigo não pôde ser aplicado por hierarquia") + (reviewAction ? ". A " + (reviewAction === "kick" ? "expulsão" : "banimento") + " aguarda aprovação no painel." : "."),
    ephemeral: true
  });
}

function commandDefinitions() {
  return [
    new SlashCommandBuilder().setName("wumpus").setDescription("Abre a central de gestão do Wumpus."),
    new SlashCommandBuilder().setName("diagnostico").setDescription("Verifica permissões e conexão do Wumpus.").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder().setName("punir").setDescription("Registra uma ocorrência e aplica a escala progressiva de punições.")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((option) => option.setName("membro").setDescription("Membro que receberá a ocorrência").setRequired(true))
      .addStringOption((option) => option.setName("motivo").setDescription("Explique de forma objetiva o motivo").setMinLength(3).setMaxLength(1000).setRequired(true))
      .addStringOption((option) => option.setName("acao").setDescription("Ação solicitada; a escala e a aprovação continuam obrigatórias").setRequired(true).addChoices(
        { name: "Advertência", value: "warn" }, { name: "Castigo", value: "timeout" }, { name: "Expulsão", value: "kick" }, { name: "Banimento", value: "ban" }
      ))
      .addAttachmentOption((option) => option.setName("evidencia1").setDescription("Imagem ou arquivo de evidência"))
      .addAttachmentOption((option) => option.setName("evidencia2").setDescription("Evidência adicional"))
      .addAttachmentOption((option) => option.setName("evidencia3").setDescription("Evidência adicional"))
      .addAttachmentOption((option) => option.setName("evidencia4").setDescription("Evidência adicional"))
      .addAttachmentOption((option) => option.setName("evidencia5").setDescription("Evidência adicional")),
    new SlashCommandBuilder().setName("moderar").setDescription("Aplica uma ação manual de moderação.").setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addSubcommand((subcommand) => subcommand.setName("advertir").setDescription("Registra uma advertência").addUserOption((option) => option.setName("membro").setDescription("Membro").setRequired(true)).addStringOption((option) => option.setName("motivo").setDescription("Motivo").setRequired(true)))
      .addSubcommand((subcommand) => subcommand.setName("timeout").setDescription("Aplica um castigo temporário").addUserOption((option) => option.setName("membro").setDescription("Membro").setRequired(true)).addStringOption((option) => option.setName("motivo").setDescription("Motivo").setRequired(true)).addIntegerOption((option) => option.setName("minutos").setDescription("Duração em minutos").setMinValue(1).setMaxValue(40_320).setRequired(true))),
    new SlashCommandBuilder().setName("rascunho-cargos").setDescription("Cria uma proposta de cargos com IA para revisão.").setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addStringOption((option) => option.setName("pedido").setDescription("Descreva a estrutura de cargos desejada").setMinLength(10).setMaxLength(1200).setRequired(true)),
    new SlashCommandBuilder().setName("perguntar").setDescription("Consulta a base de conhecimento aprovada do servidor.")
      .addStringOption((option) => option.setName("pergunta").setDescription("O que você quer saber?").setMinLength(3).setMaxLength(500).setRequired(true)),
    new SlashCommandBuilder().setName("painel").setDescription("Publica um painel para os membros.").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((subcommand) => subcommand.setName("atendimento").setDescription("Publica o botão de atendimento"))
      .addSubcommand((subcommand) => subcommand.setName("candidatura").setDescription("Publica o formulário de candidatura")),
    new SlashCommandBuilder().setName("denunciar").setDescription("Envia uma denúncia privada para a equipe.")
      .addUserOption((option) => option.setName("membro").setDescription("Membro denunciado").setRequired(true)),
    new SlashCommandBuilder().setName("apelar").setDescription("Solicita a revisão de uma punição.")
  ];
}

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(config.token);
  await rest.put(Routes.applicationCommands(config.applicationId), { body: commandDefinitions().map((command) => command.toJSON()) });
}

async function publishPanel(interaction: ChatInputCommandInteraction) {
  if (interaction.options.getSubcommand() === "atendimento") {
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x8b7dff).setTitle("Central de atendimento").setDescription("Precisa falar com a equipe? Abra um atendimento privado.")], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("wumpus:ticket:open").setLabel("Abrir atendimento").setStyle(ButtonStyle.Primary).setEmoji("💬"))] });
  }
  return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x8b7dff).setTitle("Candidaturas").setDescription("Envie sua candidatura pelo formulário seguro.")], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("wumpus:application:open").setLabel("Enviar candidatura").setStyle(ButtonStyle.Primary).setEmoji("📝"))] });
}

function publicationValue(publication: WumpusPanelPublication, key: string, fallback = "") {
  return typeof publication.payload[key] === "string" ? publication.payload[key] as string : fallback;
}

function publicationColor(publication: WumpusPanelPublication) {
  const value = publicationValue(publication, "accentColor", "#8175FF");
  return /^#[0-9a-f]{6}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : 0x8175ff;
}

function memberPanelPublication(publication: WumpusPanelPublication): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } | { flags: MessageFlags.IsComponentsV2; components: TopLevelComponentData[] } {
  const isTicket = publication.module === "tickets";
  const action = new ButtonBuilder()
    .setCustomId(isTicket ? "wumpus:ticket:open" : "wumpus:application:open")
    .setLabel(isTicket ? "Abrir atendimento" : "Enviar candidatura")
    .setEmoji(isTicket ? "💬" : "📝")
    .setStyle(ButtonStyle.Primary);
  const title = publicationValue(publication, "title", isTicket ? "Central de atendimento" : "Candidaturas");
  const description = publicationValue(publication, "description", isTicket ? "Abra um atendimento privado e fale com a equipe." : "Envie sua candidatura pelo formulário seguro.");
  if (publicationValue(publication, "format", "components_v2") === "components_v2") {
    return {
      flags: MessageFlags.IsComponentsV2,
      components: [{ type: ComponentType.Container, accentColor: publicationColor(publication), components: [
        { type: ComponentType.TextDisplay, content: `# ${title}` },
        { type: ComponentType.TextDisplay, content: description },
        { type: ComponentType.Separator, divider: true, spacing: 1 },
        { type: ComponentType.ActionRow, components: [action] },
        { type: ComponentType.TextDisplay, content: "-# Painel publicado pelo dashboard Wumpus." }
      ] }]
    };
  }
  return { embeds: [new EmbedBuilder().setColor(publicationColor(publication)).setTitle(title).setDescription(description)], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(action)] };
}

async function processPanelPublications() {
  const pending = await database.listPendingWumpusPanelPublications();
  for (const publication of pending) {
    try {
      const guild = client.guilds.cache.get(publication.guildId) ?? await client.guilds.fetch(publication.guildId);
      const channel = await guild.channels.fetch(publication.channelId);
      if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) throw new Error("Canal de texto não encontrado.");
      const message = await (channel as TextChannel).send(memberPanelPublication(publication));
      await database.finishWumpusPanelPublication({ id: publication.id, status: "published", messageId: message.id });
      await database.recordWumpusEvent({ guildId: publication.guildId, module: publication.module, eventType: "dashboard_panel_published", actorId: publication.createdBy, targetId: null, channelId: publication.channelId, data: { publicationId: publication.id, format: publicationValue(publication, "format") } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("Could not publish Wumpus panel", { publicationId: publication.id, error: message });
      await database.finishWumpusPanelPublication({ id: publication.id, status: "failed", error: message.slice(0, 500) });
    }
  }
}

async function processApprovedOccurrences() {
  const occurrences = await database.claimApprovedWumpusOccurrences();
  for (const occurrence of occurrences) {
    const finalAction = occurrence.strikeNumber >= 4 ? "ban" : "kick";
    try {
      const guild = client.guilds.cache.get(occurrence.guildId) ?? await client.guilds.fetch(occurrence.guildId);
      const member = await guild.members.fetch(occurrence.targetId).catch(() => null);
      if (finalAction === "kick") {
        if (!member?.kickable) throw new Error("Membro ausente ou acima da hierarquia do Wumpus.");
        await member.kick("Ocorrência Wumpus #" + occurrence.id + " aprovada: " + occurrence.reason);
      } else {
        const bot = guild.members.me;
        if (!bot?.permissions.has(PermissionFlagsBits.BanMembers)) throw new Error("O Wumpus não possui a permissão Banir membros.");
        await guild.members.ban(occurrence.targetId, { reason: "Ocorrência Wumpus #" + occurrence.id + " aprovada: " + occurrence.reason });
      }
      await database.finishWumpusOccurrence({ id: occurrence.id, status: "applied", appliedAction: finalAction });
      await database.recordWumpusEvent({ guildId: occurrence.guildId, module: "moderation", eventType: "approved_punishment_applied", actorId: occurrence.reviewedBy, targetId: occurrence.targetId, channelId: null, data: { occurrenceId: occurrence.id, action: finalAction, reviewedBy: occurrence.reviewedBy } });
      await moduleAlert(guild, "moderation", "punição aprovada aplicada", "Ocorrência **#" + occurrence.id + "** · <@" + occurrence.targetId + "> · **" + (finalAction === "kick" ? "expulsão" : "banimento") + "** aplicada.", 0x65e5ac);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await database.finishWumpusOccurrence({ id: occurrence.id, status: "failed", appliedAction: finalAction, error: message.slice(0, 500) });
      logger.warn("Approved punishment could not be applied", { occurrenceId: occurrence.id, guildId: occurrence.guildId, error: message });
    }
  }
}

client.once("ready", async () => {
  logger.info("Discord client ready", { user: client.user?.tag });
  try {
    await Promise.all([...client.guilds.cache.values()].map(syncGuild));
    await syncAllNativeAutoMod();
    await registerCommands();
    await database.heartbeat({ service: "wumpus", status: "operational", metadata: { user: client.user?.tag, guilds: client.guilds.cache.size } });
  } catch (error) {
    logger.error("Initial startup task failed", { error: error instanceof Error ? error.message : String(error) });
  }
});

client.on("guildCreate", (guild) => void syncGuild(guild).catch((error) => logger.warn("Guild sync failed", { guildId: guild.id, error: String(error) })));
client.on("guildDelete", (guild) => void database.markWumpusGuildRemoved(guild.id).catch((error) => logger.warn("Guild removal sync failed", { guildId: guild.id, error: String(error) })));
client.on("roleCreate", (role) => void syncRoles(role.guild).catch((error) => logger.warn("Role sync failed", { guildId: role.guild.id, error: String(error) })));
client.on("roleUpdate", (_, role) => void syncRoles(role.guild).catch((error) => logger.warn("Role sync failed", { guildId: role.guild.id, error: String(error) })));
client.on("roleDelete", (role) => void syncRoles(role.guild).catch((error) => logger.warn("Role sync failed", { guildId: role.guild.id, error: String(error) })));
client.on("channelCreate", (channel) => { if ("guild" in channel) void syncChannels(channel.guild).catch((error) => logger.warn("Channel sync failed", { guildId: channel.guild.id, error: String(error) })); });
client.on("channelUpdate", (_, channel) => { if ("guild" in channel) void syncChannels(channel.guild).catch((error) => logger.warn("Channel sync failed", { guildId: channel.guild.id, error: String(error) })); });
client.on("channelDelete", (channel) => { if ("guild" in channel) void syncChannels(channel.guild).catch((error) => logger.warn("Channel sync failed", { guildId: channel.guild.id, error: String(error) })); });
client.on("guildMemberAdd", (member) => { bufferMetric(member.guild.id, "joins"); void handleRaid(member).catch((error) => logger.warn("Anti-raid failed", { guildId: member.guild.id, error: String(error) })); });
client.on("guildMemberRemove", (member) => bufferMetric(member.guild.id, "leaves"));
client.on("messageCreate", (message) => void handleAutoMod(message).catch((error) => logger.warn("AutoMod failed", { guildId: message.guild?.id, error: String(error) })));
client.on("guildAuditLogEntryCreate", (entry, guild) => {
  const destructive = new Set<number>([AuditLogEvent.ChannelDelete, AuditLogEvent.RoleDelete, AuditLogEvent.MemberBanAdd, AuditLogEvent.WebhookDelete, AuditLogEvent.BotAdd]);
  if (destructive.has(entry.action)) void handleNuke(guild, entry.executorId, entry.action).catch((error) => logger.warn("Anti-nuke failed", { guildId: guild.id, error: String(error) }));
});
client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isModalSubmit()) return void handleModal(interaction);
    if (interaction.isButton()) {
      if (interaction.customId.startsWith("wumpus:roles:")) return void reviewRoleDraft(interaction);
      if (interaction.customId === "wumpus:ticket:open") return void beginTicket(interaction);
      if (interaction.customId === "wumpus:ticket:close") return void closeTicket(interaction);
      if (interaction.customId === "wumpus:application:open") return void beginApplication(interaction);
      return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId === "wumpus:ticket:department") return void openTicket(interaction);
    if (interaction.isStringSelectMenu() && interaction.customId === "wumpus:form:select") return void selectApplication(interaction);
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === "wumpus") return void interaction.reply({ embeds: [new EmbedBuilder().setColor(0x8b7dff).setTitle("Wumpus · central de gestão").setDescription("Acesse sua central segura: " + config.dashboardUrl + "\n\nVocê verá somente servidores onde possui permissão de gestão e onde o Wumpus está instalado.")], ephemeral: true });
    if (interaction.commandName === "punir") return void punish(interaction);
    if (interaction.commandName === "moderar") return void moderate(interaction);
    if (interaction.commandName === "rascunho-cargos") return void createRoleDraft(interaction);
    if (interaction.commandName === "perguntar") return void answerKnowledge(interaction);
    if (interaction.commandName === "painel") return void publishPanel(interaction);
    if (interaction.commandName === "denunciar") {
      if (!interaction.guildId) return void interaction.reply({ content: "Este comando só funciona em um servidor.", ephemeral: true });
      return void interaction.showModal(reportModal(interaction.guildId, interaction.options.getUser("membro", true).id));
    }
    if (interaction.commandName === "apelar") {
      if (!interaction.guildId) return void interaction.reply({ content: "Este comando só funciona em um servidor.", ephemeral: true });
      return void interaction.showModal(appealModal(interaction.guildId));
    }
    if (interaction.commandName === "diagnostico") {
      if (!interaction.guild) return void interaction.reply({ content: "Este comando só funciona em um servidor.", ephemeral: true });
      const bot = interaction.guild.members.me;
      const required = [PermissionFlagsBits.ViewAuditLog, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ManageRoles];
      const missing = required.filter((permission) => !bot?.permissions.has(permission)).length;
      return void interaction.reply({ content: missing ? "Wumpus conectado, mas faltam **" + missing + " permissões importantes**. Revise a instalação no dashboard." : "Wumpus conectado e com as permissões essenciais em **" + interaction.guild.name + "**.", ephemeral: true });
    }
  } catch (error) {
    logger.error("Interaction failed", { error: error instanceof Error ? error.message : String(error), interactionId: interaction.id });
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) await interaction.reply({ content: "Ocorreu um erro ao processar esta ação.", ephemeral: true });
  }
});

setInterval(() => database.heartbeat({ service: "wumpus", status: client.isReady() ? "operational" : "degraded", metadata: { guilds: client.guilds.cache.size } }).catch((error) => logger.warn("Heartbeat failed", { error: String(error) })), 60_000).unref();
setInterval(() => void flushMetrics().catch((error) => logger.warn("Metric flush failed", { error: String(error) })), 60_000).unref();
setInterval(() => void processPanelPublications().catch((error) => logger.warn("Panel publication processing failed", { error: String(error) })), 3_000).unref();
setInterval(() => void processApprovedOccurrences().catch((error) => logger.warn("Occurrence approval processing failed", { error: String(error) })), 3_000).unref();
setInterval(() => void syncAllNativeAutoMod(), 5 * 60_000).unref();
process.once("SIGTERM", () => void flushMetrics().finally(() => database.close()).finally(() => client.destroy()));

await client.login(config.token);
