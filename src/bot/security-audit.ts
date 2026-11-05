/**
 * Auditoria de permissoes com IA — aba "Auditoria" dentro do Protect.
 *
 * O pedido (pesquisa com usuarios) era: usar a IA para checar permissoes de um
 * servidor inteiro — cargos, canais, categorias, @everyone, hierarquia do bot —
 * e devolver recomendacoes com severidade. E exatamente o papel deste modulo.
 *
 * Regra herdada do assistente: a IA NUNCA aplica nada. Ela devolve o relatorio;
 * quem decide e o dono. Nenhuma funcao aqui toca em cargo, canal ou overwrite.
 *
 * Fluxo:
 *   1. `buildPermissionSnapshot` monta um texto compacto do servidor (teto de
 *      tamanho: servidor grande nao cabe no contexto, entao limitamos).
 *   2. `groqChat` pede a analise em JSON (mesmo provedor do resto do produto).
 *   3. `parsePermissionAudit` converte a resposta — nunca lanca; formato errado
 *      vira `null` e o relatorio fica marcado como indisponivel.
 *   4. `runPermissionAudit` grava o resultado em `security-audits`, a colecao
 *      que o painel le para exibir a aba.
 */
import {
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
  type Guild,
  type GuildChannel,
  type Permissions,
  type Role,
  type TextBasedChannel,
} from "discord.js";
import { groqChat, qualityModel } from "./ai.ts";
import { normalizeSeverity } from "./assistant.ts";
import type { Logger } from "./logger.ts";
import { resolveRole } from "./resolve.ts";
import {
  readBotCollection,
  updateBotCollection,
  type SecurityAuditFix,
  type SecurityAuditRecord,
} from "../lib/wumpus/runtime.server.ts";

export type PermissionSnapshot = {
  text: string;
  size: number;
};

export type ParsedPermissionAudit = {
  summary: string;
  risk: number;
  findings: Array<{
    title: string;
    detail: string;
    severity: "info" | "attention" | "urgent";
    suggestion: string;
    scope: string;
    fixes: SecurityAuditFix[];
  }>;
};

/** Todas as permissões conhecidas com rótulo em pt-BR — o snapshot mostra o que cada cargo/canal realmente permite ou nega. */
const PERMISSION_LABELS: Array<{ bit: bigint; label: string }> = [
  { bit: PermissionFlagsBits.CreateInstantInvite, label: "Criar convites" },
  { bit: PermissionFlagsBits.KickMembers, label: "Expulsar membros" },
  { bit: PermissionFlagsBits.BanMembers, label: "Banir membros" },
  { bit: PermissionFlagsBits.Administrator, label: "Administrador" },
  { bit: PermissionFlagsBits.ManageChannels, label: "Gerenciar canais" },
  { bit: PermissionFlagsBits.ManageGuild, label: "Gerenciar servidor" },
  { bit: PermissionFlagsBits.AddReactions, label: "Adicionar reações" },
  { bit: PermissionFlagsBits.ViewAuditLog, label: "Ver registro de auditoria" },
  { bit: PermissionFlagsBits.PrioritySpeaker, label: "Voz prioritária" },
  { bit: PermissionFlagsBits.Stream, label: "Transmitir" },
  { bit: PermissionFlagsBits.ViewChannel, label: "Ver canais" },
  { bit: PermissionFlagsBits.SendMessages, label: "Enviar mensagens" },
  { bit: PermissionFlagsBits.SendTTSMessages, label: "Enviar mensagens de texto" },
  { bit: PermissionFlagsBits.ManageMessages, label: "Gerenciar mensagens" },
  { bit: PermissionFlagsBits.EmbedLinks, label: "Inserir links" },
  { bit: PermissionFlagsBits.AttachFiles, label: "Anexar arquivos" },
  { bit: PermissionFlagsBits.ReadMessageHistory, label: "Ver histórico de mensagens" },
  { bit: PermissionFlagsBits.MentionEveryone, label: "Mencionar @everyone" },
  { bit: PermissionFlagsBits.UseExternalEmojis, label: "Usar emojis externos" },
  { bit: PermissionFlagsBits.ViewGuildInsights, label: "Ver insights do servidor" },
  { bit: PermissionFlagsBits.Connect, label: "Conectar" },
  { bit: PermissionFlagsBits.Speak, label: "Falar" },
  { bit: PermissionFlagsBits.MuteMembers, label: "Silenciar membros" },
  { bit: PermissionFlagsBits.DeafenMembers, label: "Ensurdecer membros" },
  { bit: PermissionFlagsBits.MoveMembers, label: "Mover membros" },
  { bit: PermissionFlagsBits.UseVAD, label: "Usar detecção de voz" },
  { bit: PermissionFlagsBits.ChangeNickname, label: "Mudar apelido" },
  { bit: PermissionFlagsBits.ManageNicknames, label: "Gerenciar apelidos" },
  { bit: PermissionFlagsBits.ManageRoles, label: "Gerenciar cargos" },
  { bit: PermissionFlagsBits.ManageWebhooks, label: "Gerenciar webhooks" },
  { bit: PermissionFlagsBits.ManageGuildExpressions, label: "Gerenciar expressões" },
  { bit: PermissionFlagsBits.UseApplicationCommands, label: "Usar comandos de aplicativo" },
  { bit: PermissionFlagsBits.RequestToSpeak, label: "Pedir para falar" },
  { bit: PermissionFlagsBits.ManageEvents, label: "Gerenciar eventos" },
  { bit: PermissionFlagsBits.ManageThreads, label: "Gerenciar tópicos" },
  { bit: PermissionFlagsBits.CreatePublicThreads, label: "Criar tópicos públicos" },
  { bit: PermissionFlagsBits.CreatePrivateThreads, label: "Criar tópicos privados" },
  { bit: PermissionFlagsBits.UseExternalStickers, label: "Usar figurinhas externas" },
  { bit: PermissionFlagsBits.SendMessagesInThreads, label: "Enviar mensagens em tópicos" },
  { bit: PermissionFlagsBits.UseEmbeddedActivities, label: "Usar atividades" },
  { bit: PermissionFlagsBits.ModerateMembers, label: "Moderar membros" },
  { bit: PermissionFlagsBits.ViewCreatorMonetizationAnalytics, label: "Ver analytics do criador" },
  { bit: PermissionFlagsBits.UseSoundboard, label: "Usar soundboard" },
  { bit: PermissionFlagsBits.CreateGuildExpressions, label: "Criar expressões" },
  { bit: PermissionFlagsBits.CreateEvents, label: "Criar eventos" },
  { bit: PermissionFlagsBits.UseExternalSounds, label: "Usar sons externos" },
  { bit: PermissionFlagsBits.SendVoiceMessages, label: "Enviar mensagens de voz" },
  { bit: PermissionFlagsBits.SendPolls, label: "Enviar enquetes" },
  { bit: PermissionFlagsBits.UseExternalApps, label: "Usar apps externos" },
];

const ROLE_LIMIT = 150;
const CHANNEL_LIMIT = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Canais cujas mensagens recentes entram no contexto ("embeds de canais importantes"). */
const IMPORTANT_CHANNEL_RE =
  /regra|rule|aviso|anuncio|announc|info|informac|boas[- ]vindas|welcome|leia|read|tutorial|staff|admin|modera|log|comunicado|edital|novidade|news|update|transparencia|central|ajuda|help/i;
const CONTEXT_CHANNELS = 4;
const CONTEXT_MESSAGES_PER_CHANNEL = 3;

/** Permissões perigosas que merecem destaque no resumo; as demais entram só como contagem. */
const DANGEROUS_PERMISSIONS: Array<{ bit: bigint; label: string }> = [
  { bit: PermissionFlagsBits.Administrator, label: "Administrador" },
  { bit: PermissionFlagsBits.ManageGuild, label: "Gerenciar servidor" },
  { bit: PermissionFlagsBits.ManageRoles, label: "Gerenciar cargos" },
  { bit: PermissionFlagsBits.ManageChannels, label: "Gerenciar canais" },
  { bit: PermissionFlagsBits.KickMembers, label: "Expulsar membros" },
  { bit: PermissionFlagsBits.BanMembers, label: "Banir membros" },
  { bit: PermissionFlagsBits.ModerateMembers, label: "Moderar membros" },
  { bit: PermissionFlagsBits.ManageWebhooks, label: "Gerenciar webhooks" },
  { bit: PermissionFlagsBits.ManageMessages, label: "Gerenciar mensagens" },
  { bit: PermissionFlagsBits.MentionEveryone, label: "Mencionar @everyone" },
  { bit: PermissionFlagsBits.ManageEvents, label: "Gerenciar eventos" },
  { bit: PermissionFlagsBits.ManageThreads, label: "Gerenciar tópicos" },
  { bit: PermissionFlagsBits.ManageNicknames, label: "Gerenciar apelidos" },
];

function labelForBit(bit: bigint): string | undefined {
  return PERMISSION_LABELS.find((entry) => entry.bit === bit)?.label;
}

function bitSet(permissions: Readonly<Permissions>): Set<bigint> {
  const set = new Set<bigint>();
  for (const { bit } of PERMISSION_LABELS) {
    if (permissions.has(bit)) set.add(bit);
  }
  return set;
}

/** Resumo de permissões: as perigosas por nome + contagem das demais. Ex.: "PERMITE Administrador, Gerenciar cargos +45 outras". */
function permissionSummary(permissions: Readonly<Permissions>): string {
  const has = bitSet(permissions);
  const dangerous = DANGEROUS_PERMISSIONS.filter(({ bit }) => has.has(bit)).map(({ label }) => label);
  const extras = has.size - dangerous.length;
  if (dangerous.length) {
    return `PERMITE ${dangerous.join(", ")}${extras > 0 ? ` +${extras} outras` : ""}`;
  }
  return extras > 0 ? `PERMITE ${extras} permissões básicas` : "sem permissões";
}

function roleLine(role: Role, botRoleId: string | null): string {
  const flags = [
    `pos ${role.position}`,
    botRoleId !== null && role.id === botRoleId ? "CARGO DO BOT - IGNORAR" : null,
    role.managed ? "bot/integracao - apenas recomendar" : null,
    role.hoist ? "exibido separado" : null,
    role.mentionable ? "mençãoável" : null,
    role.members?.size ? `${role.members.size} membro(s)` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return `- ${role.name} (${flags}) : ${permissionSummary(role.permissions)}`;
}

/** Só o que o overwrite MUDOU em relação às permissões base do cargo — sem repetir a lista inteira em todo canal. */
function channelLine(channel: GuildChannel, everyoneId: string): string {
  const parts: string[] = [];
  const everyone = channel.guild.roles.everyone;
  for (const overwrite of channel.permissionOverwrites.cache.values()) {
    if (overwrite.type !== OverwriteType.Role) continue;
    const role = channel.guild.roles.cache.get(overwrite.id);
    const base = overwrite.id === everyoneId ? everyone.permissions : role?.permissions;
    if (!base) continue;
    const baseBits = bitSet(base);
    const granted = [...bitSet(overwrite.allow)]
      .filter((bit) => !baseBits.has(bit))
      .map(labelForBit)
      .filter(Boolean);
    const removed = [...bitSet(overwrite.deny)]
      .filter((bit) => baseBits.has(bit))
      .map(labelForBit)
      .filter(Boolean);
    if (!granted.length && !removed.length) continue;
    const who =
      overwrite.id === everyoneId ? "@everyone" : role ? `cargo ${role.name}` : `cargo ${overwrite.id}`;
    parts.push(
      `${who}: ${granted.length ? `ganha ${granted.join(", ")}` : ""}${granted.length && removed.length ? " / " : ""}${removed.length ? `perde ${removed.join(", ")}` : ""}`,
    );
  }
  const type =
    channel.type === ChannelType.GuildText
      ? "texto"
      : channel.type === ChannelType.GuildVoice
        ? "voz"
        : channel.type === ChannelType.GuildCategory
          ? "categoria"
          : "outro";
  const topic =
    channel.type === ChannelType.GuildText && channel.topic
      ? ` | topico: ${channel.topic.replace(/\s+/g, " ").trim().slice(0, 140)}`
      : "";
  const parent = channel.parent ? ` | categoria: ${channel.parent.name}` : "";
  return `- ${channel.name} [${type}${parent}${topic}]${parts.length ? ` { ${parts.join("; ")} }` : ""}`;
}

const VERIFICATION_LEVEL_LABELS: Record<number, string> = {
  0: "nenhum",
  1: "baixo (email verificado)",
  2: "medio (registrado ha 5 min)",
  3: "alto (membro ha 10 min)",
  4: "muito alto (telefone verificado)",
};
const CONTENT_FILTER_LABELS: Record<number, string> = {
  0: "desativado",
  1: "sem cargo",
  2: "todos os membros",
};
const NOTIFICATION_LABELS: Record<number, string> = {
  0: "todas as mensagens",
  1: "apenas mencoes",
};
const MFA_LABELS: Record<number, string> = {
  0: "sem exigencia",
  1: "exigido",
};
const TIER_LABELS: Record<number, string> = {
  0: "sem boost",
  1: "nivel 1",
  2: "nivel 2",
  3: "nivel 3",
};

/**
 * Mensagens recentes de canais importantes (regras, avisos, anuncios, info,
 * boas-vindas, staff...). Nunca lanca: canal sem permissao de leitura e
 * simplesmente ignorado.
 */
async function importantChannelMessages(guild: Guild): Promise<string[]> {
  const chosen: TextBasedChannel[] = [];
  const seen = new Set<string>();
  const tryAdd = (channel: GuildChannel | null | undefined) => {
    if (!channel || !channel.isTextBased() || seen.has(channel.id)) return;
    seen.add(channel.id);
    chosen.push(channel);
  };

  tryAdd(guild.rulesChannel);
  tryAdd(guild.publicUpdatesChannel);
  tryAdd(guild.systemChannel);
  for (const channel of guild.channels.cache.values()) {
    if (chosen.length >= CONTEXT_CHANNELS) break;
    if (IMPORTANT_CHANNEL_RE.test(channel.name)) tryAdd(channel);
  }

  const blocks: string[] = [];
  for (const channel of chosen.slice(0, CONTEXT_CHANNELS)) {
    try {
      const fetched = await channel.messages.fetch({ limit: CONTEXT_MESSAGES_PER_CHANNEL });
      const lines: string[] = [`- #${channel.name}:`];
      for (const message of [...fetched.values()].reverse()) {
        const author = message.author?.displayName ?? "?";
        const content = (message.content ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
        const embeds = (message.embeds ?? [])
          .map((embed) => [embed.title, embed.description].filter(Boolean).join(" - ").slice(0, 300))
          .filter(Boolean);
        const parts = [content, ...embeds].filter(Boolean);
        if (parts.length) {
          lines.push(`  - ${author}: ${parts.join(" | ").slice(0, 420)}`);
        }
      }
      if (lines.length > 1) blocks.push(lines.join("\n"));
    } catch {
      // sem permissao de leitura — segue sem esse canal
    }
  }
  return blocks;
}

/**
 * Monta o snapshot do servidor: configuracoes, cargos com todas as permissoes,
 * canais com overwrites (por NOME de cargo), topicos e mensagens recentes de
 * canais importantes. Teto de tamanho para caber no contexto do modelo.
 */
export async function buildPermissionSnapshot(guild: Guild): Promise<PermissionSnapshot> {
  const lines: string[] = [];
  lines.push(`Servidor: ${guild.name} (${guild.id}) · ${guild.memberCount} membros`);
  lines.push(
    `Configuracoes: verificacao=${VERIFICATION_LEVEL_LABELS[guild.verificationLevel] ?? "?"}; ` +
      `filtro de conteudo=${CONTENT_FILTER_LABELS[guild.explicitContentFilter] ?? "?"}; ` +
      `notificacoes=${NOTIFICATION_LABELS[guild.defaultMessageNotifications] ?? "?"}; ` +
      `MFA=${MFA_LABELS[guild.mfaLevel] ?? "?"}; boost=${TIER_LABELS[guild.premiumTier] ?? "?"}; ` +
      `recursos=${guild.features.join(", ") || "nenhum"}`,
  );

  const botRole = guild.members.me?.roles.highest;
  const botRoleId = botRole?.id ?? null;
  lines.push(`Cargo mais alto do bot: ${botRole?.name ?? "?"} (pos ${botRole?.position ?? "?"})`);

  const everyone = guild.roles.everyone;
  lines.push(`@everyone: ${permissionSummary(everyone.permissions)}`);

  const roles = [...guild.roles.cache.values()]
    .filter((role) => role.id !== everyone.id)
    .sort((a, b) => b.position - a.position)
    .slice(0, ROLE_LIMIT);
  lines.push(`Cargos (${roles.length}):`);
  for (const role of roles) lines.push(roleLine(role, botRoleId));

  const channels = [...guild.channels.cache.values()]
    .filter(
      (channel): channel is GuildChannel =>
        [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory].includes(
          channel.type,
        ),
    )
    .slice(0, CHANNEL_LIMIT);
  lines.push(`Canais (${channels.length}):`);
  for (const channel of channels) lines.push(channelLine(channel, everyone.id));

  const important = await importantChannelMessages(guild);
  if (important.length) {
    lines.push("Mensagens recentes de canais importantes:");
    for (const block of important) lines.push(block);
  }

  return { text: lines.join("\n"), size: roles.length + channels.length };
}

export const PERMISSION_AUDIT_SYSTEM_PROMPT = [
  "Voce e o auditor de seguranca do Wumpus para servidores do Discord.",
  "Analise o snapshot de permissoes do servidor abaixo e aponte riscos reais de seguranca e excessos de permissao.",
  "Responda em portugues do Brasil, direto e operacional.",
  "Nunca invente dados que nao estejam no snapshot; se faltar informacao essencial, diga no resumo.",
  "Procure: cargos com permissoes perigosas demais para a funcao, @everyone com permissoes de moderacao,",
  "hierarquia que permite escalada de cargo, canais sensiveis",
  "(admin, staff, auditoria, log) com permissoes permissivas, e cargos de bot/integracao com permissoes fortes.",
  "IMPORTANTE: nunca recomende, sugira ou aponte nada sobre o cargo do proprio bot (marcado como CARGO DO BOT no snapshot).",
  "Para cargos de bot/integracao e permissoes de integracao (webhooks, integracoes, gerenciar servidor),",
  "gere SOMENTE a recomendacao textual no campo suggestion e deixe o campo fixes vazio (nunca gere fixes para esses casos).",
  "Para cada achado, aponte severidade, uma correcao concreta e, quando houver acao segura, fixes.",
  "Fix seguro = remover uma permissao perigosa de um cargo, ou negar uma permissao em um canal para um cargo.",
  "NUNCA sugira: banir, expulsar, excluir cargo/canal, dar permissoes, ou remover permissoes do @everyone.",
  "Use o NOME exato do cargo ou canal como aparece no snapshot, sem # ou @.",
  "Responda SOMENTE com um objeto JSON, sem texto fora dele:",
  '{"summary":"resumo em uma frase","risk":0-100,',
  '"findings":[{"title":"...","detail":"...","severity":"info|attention|urgent","suggestion":"...","scope":"...","fixes":[{"kind":"remove_role_permission","target":"nome do cargo","permission":"Gerenciar cargos"},{"kind":"deny_channel_permission","target":"nome do canal","role":"@everyone","permission":"Enviar mensagens"}]}]}',
  "Use no maximo 8 findings e ate 3 fixes por finding. Se nao houver correcao segura, deixe fixes vazio.",
].join(" ");

/** Converte a resposta crua da IA em relatorio. Nunca lanca. */
export function parsePermissionAudit(raw: string | null): ParsedPermissionAudit | null {
  if (!raw) return null;
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const parsed = extractJsonObject(cleaned);
  if (!parsed) return null;
  if (!parsed || typeof parsed !== "object") return null;

  const row = parsed as Record<string, unknown>;
  const findingsRaw = Array.isArray(row.findings) ? row.findings : [];
  const findings = findingsRaw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .slice(0, 8)
    .map((item) => ({
      title: String(item.title ?? "Observacao").slice(0, 120),
      detail: String(item.detail ?? "").slice(0, 600),
      severity: normalizeSeverity(item.severity),
      suggestion: String(item.suggestion ?? "").slice(0, 400),
      scope: String(item.scope ?? "").slice(0, 120),
      fixes: parseFixes(item.fixes),
    }));

  const risk = Number(row.risk);
  return {
    summary:
      typeof row.summary === "string" && row.summary.trim()
        ? row.summary.trim().slice(0, 600)
        : "Sem resumo.",
    risk: Number.isFinite(risk) ? Math.max(0, Math.min(100, Math.round(risk))) : 0,
    findings,
  };
}

/**
 * Extrai o primeiro objeto JSON balanceado de um texto. A IA as vezes
 * embrulha o JSON em texto ("Aqui está..."), então procura por pares
 * { } balanceados em vez de assumir o 1º { e o último }.
 */
function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          return JSON.parse(candidate) as unknown;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Extrai e valida as acoes estruturadas de um achado. Nunca lanca. */
function parseFixes(value: unknown): SecurityAuditFix[] {  if (!Array.isArray(value)) return [];
  return value
    .filter((fix): fix is Record<string, unknown> => Boolean(fix) && typeof fix === "object")
    .slice(0, 3)
    .flatMap((fix) => {
      const kind = String(fix.kind ?? "");
      if (kind !== "remove_role_permission" && kind !== "deny_channel_permission") return [];
      const target = String(fix.target ?? "").trim();
      const permission = String(fix.permission ?? "").trim();
      if (!target || !permission) return [];
      const role = String(fix.role ?? "").trim();
      const note = String(fix.note ?? "").trim();
      return [
        {
          kind,
          target: target.slice(0, 120),
          permission: permission.slice(0, 60),
          ...(role ? { role: role.slice(0, 120) } : {}),
          ...(note ? { note: note.slice(0, 300) } : {}),
        },
      ];
    });
}

/** Ultimo horario de auditoria do servidor, se houver. */
export async function lastAuditAt(guildId: string): Promise<number | null> {
  const rows = await readBotCollection<SecurityAuditRecord>("security-audits");
  const last = rows.filter((row) => row.guildId === guildId).sort((a, b) => b.at - a.at)[0];
  return last?.at ?? null;
}

function normalizeAuditName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[#@]/g, "")
    .replace(/[\s_]+/g, "")
    .trim();
}

/** Permissoes que "envolvem integracoes": o pedido e recomendar, nunca aplicar. */
const INTEGRATION_PERMISSION_KEYS = new Set([
  "managewebhooks",
  "gerenciarwebhooks",
  "manageguild",
  "gerenciarservidor",
]);

function isIntegrationPermission(permission: string): boolean {
  return INTEGRATION_PERMISSION_KEYS.has(normalizeAuditName(permission));
}

/**
 * Guarda deterministica sobre a resposta da IA (ela pode ignorar o prompt):
 *  - o cargo do proprio bot nao entra no relatorio de jeito nenhum;
 *  - coisas de integracao (cargo gerenciado por bot/integracao ou permissao
 *    de webhook/integracao) ficam so como recomendacao textual: os `fixes`
 *    estruturados — que geram o botao "Corrigir" no painel — sao removidos.
 */
/** Troca IDs numericos de cargos/canais que a IA repetiu pelos nomes reais. */
function replaceIdsWithNames(guild: Guild, text: string): string {
  return text.replace(/\b\d{17,20}\b/g, (id) => {
    const role = guild.roles.cache.get(id);
    if (role) return role.name;
    const channel = guild.channels.cache.get(id);
    return channel ? channel.name : id;
  });
}

function filterFindingsForGuild(
  guild: Guild,
  parsed: ParsedPermissionAudit,
): ParsedPermissionAudit {
  const botRole = guild.members.me?.roles.highest ?? null;
  const isBotRoleName = (name: string | null | undefined): boolean => {
    if (!botRole || !name) return false;
    return normalizeAuditName(name) === normalizeAuditName(botRole.name);
  };

  const findings = parsed.findings
    .map((finding) => ({
      ...finding,
      title: replaceIdsWithNames(guild, finding.title),
      detail: replaceIdsWithNames(guild, finding.detail),
      scope: replaceIdsWithNames(guild, finding.scope),
      suggestion: replaceIdsWithNames(guild, finding.suggestion),
      fixes: (finding.fixes ?? []).map((fix) => ({
        ...fix,
        target: replaceIdsWithNames(guild, fix.target),
        ...(fix.role ? { role: replaceIdsWithNames(guild, fix.role) } : {}),
      })),
    }))
    .flatMap((finding) => {
      if (isBotRoleName(finding.scope)) return [];
      const touchesBotRole = (finding.fixes ?? []).some(
        (fix) =>
          (fix.kind === "remove_role_permission" && isBotRoleName(fix.target)) ||
          (fix.kind === "deny_channel_permission" && isBotRoleName(fix.role)),
      );
      if (touchesBotRole) return [];

      const fixes = (finding.fixes ?? []).filter((fix) => {
        if (fix.kind === "remove_role_permission") {
          const role = resolveRole(guild, fix.target);
          if (role?.managed) return false;
        }
        if (isIntegrationPermission(fix.permission)) return false;
        return true;
      });

      return [{ ...finding, fixes }];
    });

  return { ...parsed, findings };
}

/**
 * "Auto-treino": resume as auditorias anteriores do servidor e o que o dono
 * aplicou, deixou sem mudanca ou teve bloqueado, para a IA calibrar as novas
 * recomendacoes (nao repetir o que foi ignorado; priorizar o padrao aceito).
 */
async function buildLearningContext(guildId: string): Promise<string> {
  const rows = await readBotCollection<SecurityAuditRecord>("security-audits").catch(() => []);
  const past = rows
    .filter((row) => row.guildId === guildId)
    .sort((a, b) => b.at - a.at)
    .slice(0, 5);
  if (!past.length) return "";

  const lines = past.map((record) => {
    const outcomes = (record.fixResults ?? []).flatMap((batch) => batch.outcomes);
    const applied = outcomes.filter((o) => o.ok && o.applied).length;
    const unchanged = outcomes.filter((o) => o.ok && !o.applied).length;
    const blocked = outcomes.filter((o) => !o.ok).length;
    return (
      `- auditoria de ${new Date(record.at).toISOString().slice(0, 10)}: ` +
      `${record.findings.length} achado(s), risco ${record.risk}/100, ` +
      `${applied} correcao(es) aplicada(s), ${unchanged} sem mudanca, ${blocked} bloqueada(s).`
    );
  });
  return lines.join("\n");
}

/**
 * Roda a auditoria de verdade: monta o snapshot, chama a IA, grava o relatorio.
 * Nunca lanca para quem chamou — falha vira `{ ok: false }` com motivo.
 */
export async function runPermissionAudit(
  guild: Guild,
  trigger: "manual" | "scheduled",
  log: Logger,
): Promise<{ ok: boolean; detail: string }> {
  const startedAt = Date.now();
  try {
    const snapshot = await buildPermissionSnapshot(guild);
    if (snapshot.size === 0) {
      return { ok: false, detail: "Servidor sem cargos ou canais para analisar." };
    }

    const learning = await buildLearningContext(guild.id);
    const messages = [
      { role: "system", content: PERMISSION_AUDIT_SYSTEM_PROMPT },
      { role: "user", content: snapshot.text },
    ];
    if (learning) {
      messages.push({
        role: "user",
        content:
          `Contexto de aprendizagem (auditorias anteriores e o que o dono aplicou/ignorou):\n${learning}\n` +
          "Use para calibrar: nao repita correcoes que o dono ignorou e priorize o padrao que ele aceita.",
      });
    }

    let raw = await groqChat(messages, {
      model: qualityModel(),
      maxTokens: 2400,
      timeoutMs: 30_000,
      noCache: true,
    });
    let parsed = parsePermissionAudit(raw);
    if (!parsed) {
      // A IA respondeu, mas o texto nao virou JSON — tenta uma vez mais
      // pedindo SOMENTE o JSON, para nao gravar relatorio "indisponivel"
      // por causa de resposta malformada (e evita reusar texto ruim do cache).
      log.warn("auditoria: resposta da IA nao parseou, tentando de novo", {
        guildId: guild.id,
        trigger,
        rawLength: raw?.length ?? 0,
      });
      raw = await groqChat(
        [
          ...messages,
          { role: "assistant", content: raw ?? "" },
          {
            role: "user",
            content:
              "Sua resposta anterior nao era um JSON valido. Responda SOMENTE com o objeto JSON, sem nenhum texto fora dele.",
          },
        ],
        { model: qualityModel(), maxTokens: 2400, timeoutMs: 30_000, noCache: true },
      );
      parsed = parsePermissionAudit(raw);
    }
    if (parsed) parsed = filterFindingsForGuild(guild, parsed);

    const record: SecurityAuditRecord = {
      id: `audit_${startedAt.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      guildId: guild.id,
      at: startedAt,
      trigger,
      summary: parsed?.summary ?? "A IA nao devolveu uma analise utilizavel agora.",
      risk: parsed?.risk ?? 0,
      findings: parsed?.findings ?? [],
      source: parsed ? "ai" : "unavailable",
      snapshotSize: snapshot.size,
      context: snapshot.text,
      durationMs: Date.now() - startedAt,
    };

    await updateBotCollection<SecurityAuditRecord>("security-audits", (rows) =>
      [...rows.filter((row) => row.id !== record.id), record].slice(-200),
    );

    log.info("auditoria de permissoes executada", {
      guildId: guild.id,
      trigger,
      findings: record.findings.length,
      source: record.source,
      risk: record.risk,
    });

    return {
      ok: true,
      detail:
        record.source === "ai"
          ? `Auditoria concluida: ${record.findings.length} achado(s), risco ${record.risk}/100.`
          : "Auditoria concluida, mas a IA nao devolveu analise utilizavel.",
    };
  } catch (error) {
    log.warn("auditoria de permissoes falhou", {
      guildId: guild.id,
      trigger,
      error: String(error).slice(0, 250),
    });
    return { ok: false, detail: "Nao foi possivel concluir a auditoria de permissoes agora." };
  }
}

/**
 * Auditoria agendada (diaria). So roda se a ultima for mais velha que 24h,
 * para o bot reiniciar nao disparar uma enxurrada de chamadas de IA.
 */
export async function runScheduledPermissionAudit(guild: Guild, log: Logger): Promise<boolean> {
  const last = await lastAuditAt(guild.id).catch(() => null);
  if (last && Date.now() - last < DAY_MS) return false;
  const result = await runPermissionAudit(guild, "scheduled", log);
  return result.ok;
}
