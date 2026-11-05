/**
 * Executor de correcoes da auditoria de permissoes.
 *
 * A IA sugere acoes estruturadas (`fixes`) e o bot aplica cada uma com guardas
 * rigidas. Nada aqui exclui, nada bane, nada da permissao: so remove permissao
 * de cargo ou nega permissao em canal — acoes restritivas e reversiveis. Tudo
 * vai para o registro de auditoria do Discord com motivo rastreavel.
 *
 * Guardas que NAO se negocia:
 *   - nunca remover permissao do @everyone (risco de travar o servidor);
 *   - nunca mexer em cargo gerenciado por bot/integracao;
 *   - nunca mexer em cargo acima do bot na hierarquia;
 *   - toda acao e validada de novo na hora de aplicar (a IA pode inventar).
 */
import {
  PermissionFlagsBits,
  type Guild,
  type Role,
} from "discord.js";
import type { Logger } from "./logger.ts";
import { resolveChannel, resolveRole } from "./resolve.ts";
import { auditAndLog } from "./logs.ts";
import {
  readBotCollection,
  updateBotCollection,
  type OutboxJob,
  type SecurityAuditFix,
  type SecurityAuditFinding,
  type SecurityAuditRecord,
  type SecurityFixBatch,
  type SecurityFixOutcome,
} from "../lib/wumpus/runtime.server.ts";

const PERMISSIONS: Array<{ key: string; bit: bigint; labels: string[] }> = [
  { key: "CreateInstantInvite", bit: PermissionFlagsBits.CreateInstantInvite, labels: ["criar convites", "createinstantinvite"] },
  { key: "KickMembers", bit: PermissionFlagsBits.KickMembers, labels: ["expulsar membros", "kickmembers"] },
  { key: "BanMembers", bit: PermissionFlagsBits.BanMembers, labels: ["banir membros", "banmembers"] },
  { key: "Administrator", bit: PermissionFlagsBits.Administrator, labels: ["administrador", "administrator"] },
  { key: "ManageChannels", bit: PermissionFlagsBits.ManageChannels, labels: ["gerenciar canais", "managechannels"] },
  { key: "ManageGuild", bit: PermissionFlagsBits.ManageGuild, labels: ["gerenciar servidor", "manageguild"] },
  { key: "AddReactions", bit: PermissionFlagsBits.AddReactions, labels: ["adicionar reações", "addreactions"] },
  { key: "ViewAuditLog", bit: PermissionFlagsBits.ViewAuditLog, labels: ["ver registro de auditoria", "viewauditlog"] },
  { key: "PrioritySpeaker", bit: PermissionFlagsBits.PrioritySpeaker, labels: ["voz prioritária", "priorityspeaker"] },
  { key: "Stream", bit: PermissionFlagsBits.Stream, labels: ["transmitir", "stream"] },
  { key: "ViewChannel", bit: PermissionFlagsBits.ViewChannel, labels: ["ver canais", "viewchannel"] },
  { key: "SendMessages", bit: PermissionFlagsBits.SendMessages, labels: ["enviar mensagens", "sendmessages"] },
  { key: "SendTTSMessages", bit: PermissionFlagsBits.SendTTSMessages, labels: ["enviar mensagens de texto", "sendttsmessages"] },
  { key: "ManageMessages", bit: PermissionFlagsBits.ManageMessages, labels: ["gerenciar mensagens", "managemessages"] },
  { key: "EmbedLinks", bit: PermissionFlagsBits.EmbedLinks, labels: ["inserir links", "embedlinks"] },
  { key: "AttachFiles", bit: PermissionFlagsBits.AttachFiles, labels: ["anexar arquivos", "attachfiles"] },
  { key: "ReadMessageHistory", bit: PermissionFlagsBits.ReadMessageHistory, labels: ["ver histórico de mensagens", "readmessagehistory"] },
  { key: "MentionEveryone", bit: PermissionFlagsBits.MentionEveryone, labels: ["mencionar everyone", "mencionar @everyone", "mentioneveryone"] },
  { key: "UseExternalEmojis", bit: PermissionFlagsBits.UseExternalEmojis, labels: ["usar emojis externos", "useexternalemojis"] },
  { key: "ViewGuildInsights", bit: PermissionFlagsBits.ViewGuildInsights, labels: ["ver insights do servidor", "viewguildinsights"] },
  { key: "Connect", bit: PermissionFlagsBits.Connect, labels: ["conectar", "connect"] },
  { key: "Speak", bit: PermissionFlagsBits.Speak, labels: ["falar", "speak"] },
  { key: "MuteMembers", bit: PermissionFlagsBits.MuteMembers, labels: ["silenciar membros", "mutemembers"] },
  { key: "DeafenMembers", bit: PermissionFlagsBits.DeafenMembers, labels: ["ensurdecer membros", "deafenmembers"] },
  { key: "MoveMembers", bit: PermissionFlagsBits.MoveMembers, labels: ["mover membros", "movemembers"] },
  { key: "UseVAD", bit: PermissionFlagsBits.UseVAD, labels: ["usar detecção de voz", "usevad"] },
  { key: "ChangeNickname", bit: PermissionFlagsBits.ChangeNickname, labels: ["mudar apelido", "changenickname"] },
  { key: "ManageNicknames", bit: PermissionFlagsBits.ManageNicknames, labels: ["gerenciar apelidos", "managenicknames"] },
  { key: "ManageRoles", bit: PermissionFlagsBits.ManageRoles, labels: ["gerenciar cargos", "manageroles"] },
  { key: "ManageWebhooks", bit: PermissionFlagsBits.ManageWebhooks, labels: ["gerenciar webhooks", "managewebhooks"] },
  { key: "ManageGuildExpressions", bit: PermissionFlagsBits.ManageGuildExpressions, labels: ["gerenciar expressões", "manageguildexpressions"] },
  { key: "UseApplicationCommands", bit: PermissionFlagsBits.UseApplicationCommands, labels: ["usar comandos de aplicativo", "useapplicationcommands"] },
  { key: "RequestToSpeak", bit: PermissionFlagsBits.RequestToSpeak, labels: ["pedir para falar", "requesttospeak"] },
  { key: "ManageEvents", bit: PermissionFlagsBits.ManageEvents, labels: ["gerenciar eventos", "manageevents"] },
  { key: "ManageThreads", bit: PermissionFlagsBits.ManageThreads, labels: ["gerenciar tópicos", "gerenciar topicos", "managethreads"] },
  { key: "CreatePublicThreads", bit: PermissionFlagsBits.CreatePublicThreads, labels: ["criar tópicos públicos", "createpublicthreads"] },
  { key: "CreatePrivateThreads", bit: PermissionFlagsBits.CreatePrivateThreads, labels: ["criar tópicos privados", "createprivatethreads"] },
  { key: "UseExternalStickers", bit: PermissionFlagsBits.UseExternalStickers, labels: ["usar figurinhas externas", "useexternalstickers"] },
  { key: "SendMessagesInThreads", bit: PermissionFlagsBits.SendMessagesInThreads, labels: ["enviar mensagens em tópicos", "sendmessagesinthreads"] },
  { key: "UseEmbeddedActivities", bit: PermissionFlagsBits.UseEmbeddedActivities, labels: ["usar atividades", "useembeddedactivities"] },
  { key: "ModerateMembers", bit: PermissionFlagsBits.ModerateMembers, labels: ["moderar membros", "moderatemembers"] },
  { key: "ViewCreatorMonetizationAnalytics", bit: PermissionFlagsBits.ViewCreatorMonetizationAnalytics, labels: ["ver analytics do criador", "viewcreatormonetizationanalytics"] },
  { key: "UseSoundboard", bit: PermissionFlagsBits.UseSoundboard, labels: ["usar soundboard", "usesoundboard"] },
  { key: "CreateGuildExpressions", bit: PermissionFlagsBits.CreateGuildExpressions, labels: ["criar expressões", "createguildexpressions"] },
  { key: "CreateEvents", bit: PermissionFlagsBits.CreateEvents, labels: ["criar eventos", "createevents"] },
  { key: "UseExternalSounds", bit: PermissionFlagsBits.UseExternalSounds, labels: ["usar sons externos", "useexternalsounds"] },
  { key: "SendVoiceMessages", bit: PermissionFlagsBits.SendVoiceMessages, labels: ["enviar mensagens de voz", "sendvoicemessages"] },
  { key: "SendPolls", bit: PermissionFlagsBits.SendPolls, labels: ["enviar enquetes", "sendpolls"] },
  { key: "UseExternalApps", bit: PermissionFlagsBits.UseExternalApps, labels: ["usar apps externos", "useexternalapps"] },
];

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[@#]/g, "")
    .replace(/[\s_]+/g, "");
}

function permissionInfo(name: string): { key: string; bit: bigint } | null {
  const want = normalizeName(name);
  for (const entry of PERMISSIONS) {
    if (normalizeName(entry.key) === want) return entry;
    if (entry.labels.some((label) => normalizeName(label) === want)) return entry;
  }
  return null;
}

/** Guardas comuns a toda correcao que mexe em cargo. */
function guardRole(guild: Guild, fix: SecurityAuditFix, role: Role | null): string | null {
  if (!role) return `Cargo "${fix.target}" não encontrado neste servidor.`;
  if (role.id === guild.roles.everyone.id) return "Não alteramos o @everyone automaticamente.";
  if (role.managed) return `"${role.name}" é gerenciado por uma integração.`;
  const me = guild.members.me;
  if (!me || role.position >= me.roles.highest.position) {
    return `"${role.name}" está acima do cargo do bot na hierarquia.`;
  }
  return null;
}

async function applyRolePermissionRemoval(
  guild: Guild,
  fix: SecurityAuditFix,
  log: Logger,
): Promise<{ ok: boolean; applied: boolean; detail: string }> {
  const role = resolveRole(guild, fix.target);
  const guard = guardRole(guild, fix, role);
  if (guard) return { ok: false, applied: false, detail: guard };
  if (!role) return { ok: false, applied: false, detail: "Cargo não encontrado." };

  const info = permissionInfo(fix.permission);
  if (!info) return { ok: false, applied: false, detail: `Permissão "${fix.permission}" não reconhecida.` };
  if (!role.permissions.has(info.bit)) {
    return { ok: true, applied: false, detail: `"${role.name}" já não tem "${fix.permission}".` };
  }

  await role.setPermissions(
    role.permissions.remove(info.bit),
    "Correção sugerida pela auditoria do Wumpus",
  );
  await auditAndLog(
    guild,
    {
      module: "security",
      category: "roles",
      eventType: "permission_fix_removed_role_permission",
      severity: "info",
      title: "PERMISSÃO REMOVIDA (AUDITORIA IA)",
      description: `Permissão **${fix.permission}** removida do cargo **${role.name}**.`,
      accentColor: "#7c5cff",
      fields: [{ name: "Motivo", value: (fix.note ?? "Recomendação da auditoria de permissões").slice(0, 400) }],
    },
    log,
  );
  return { ok: true, applied: true, detail: `Permissão "${fix.permission}" removida de "${role.name}".` };
}

async function applyChannelPermissionDeny(
  guild: Guild,
  fix: SecurityAuditFix,
  log: Logger,
): Promise<{ ok: boolean; applied: boolean; detail: string }> {
  const channel = resolveChannel(guild, fix.target);
  if (!channel || !("permissionOverwrites" in channel)) {
    return { ok: false, applied: false, detail: `Canal "${fix.target}" não encontrado neste servidor.` };
  }

  const roleRef = (fix.role ?? "@everyone").trim();
  const role =
    resolveRole(guild, roleRef) ??
    (normalizeName(roleRef) === "everyone" ? guild.roles.everyone : null);
  if (!role) return { ok: false, applied: false, detail: `Cargo "${roleRef}" não encontrado.` };

  const info = permissionInfo(fix.permission);
  if (!info) return { ok: false, applied: false, detail: `Permissão "${fix.permission}" não reconhecida.` };

  const existing = channel.permissionOverwrites.cache.get(role.id);
  const alreadyDenied = existing?.deny.has(info.bit) ?? false;
  if (alreadyDenied) {
    return {
      ok: true,
      applied: false,
      detail: `"${channel.name}" já nega "${fix.permission}" para ${role.name}.`,
    };
  }

  await channel.permissionOverwrites.edit(
    role,
    { [info.key]: false },
    { reason: "Correção sugerida pela auditoria do Wumpus" },
  );
  await auditAndLog(
    guild,
    {
      module: "security",
      category: "channels",
      eventType: "permission_fix_denied_channel_permission",
      severity: "info",
      title: "PERMISSÃO NEGADA EM CANAL (AUDITORIA IA)",
      description: `**${fix.permission}** negada para **${role.name}** em **#${channel.name}**.`,
      accentColor: "#7c5cff",
      fields: [{ name: "Motivo", value: (fix.note ?? "Recomendação da auditoria de permissões").slice(0, 400) }],
    },
    log,
  );
  return {
    ok: true,
    applied: true,
    detail: `"${fix.permission}" negada para ${role.name} em #${channel.name}.`,
  };
}

/** Executa as acoes de um achado e devolve o resultado de cada uma. Nunca lanca. */
export async function executeSecurityFix(
  guild: Guild,
  finding: SecurityAuditFinding,
  log: Logger,
): Promise<SecurityFixOutcome[]> {
  const outcomes: SecurityFixOutcome[] = [];
  for (const [fixIndex, fix] of (finding.fixes ?? []).entries()) {
    try {
      const result =
        fix.kind === "remove_role_permission"
          ? await applyRolePermissionRemoval(guild, fix, log)
          : fix.kind === "deny_channel_permission"
            ? await applyChannelPermissionDeny(guild, fix, log)
            : { ok: false, applied: false, detail: "Tipo de correção não suportado." };
      outcomes.push({ fixIndex, ...result });
    } catch (error) {
      outcomes.push({ fixIndex, ok: false, applied: false, detail: String(error).slice(0, 200) });
    }
  }
  return outcomes;
}

/**
 * Processa um pedido de correcao vindo do painel. Aplica os fixes do achado
 * (ou de todos, quando `findingIndex` vem vazio) e grava os resultados de
 * volta no relatorio para o painel exibir.
 */
export async function processSecurityFixJob(
  guild: Guild,
  job: OutboxJob,
  log: Logger,
): Promise<{ ok: boolean; detail: string }> {
  const ref = job.securityFix;
  if (!ref) return { ok: false, detail: "Pedido de correção incompleto." };

  const rows = await readBotCollection<SecurityAuditRecord>("security-audits");
  const record = rows.find((row) => row.id === ref.auditId && row.guildId === guild.id);
  if (!record) return { ok: false, detail: "O relatório de auditoria não existe mais." };

  const indexes =
    ref.findingIndex === undefined
      ? record.findings.map((_, index) => index)
      : [ref.findingIndex];

  const batches: SecurityFixBatch[] = [];
  let appliedCount = 0;
  let totalCount = 0;

  for (const findingIndex of indexes) {
    const finding = record.findings[findingIndex];
    if (!finding || !finding.fixes?.length) continue;
    const outcomes = await executeSecurityFix(guild, finding, log);
    totalCount += outcomes.length;
    appliedCount += outcomes.filter((outcome) => outcome.ok && outcome.applied).length;
    batches.push({ findingIndex, at: Date.now(), outcomes });
  }

  if (!totalCount) {
    return { ok: false, detail: "Este relatório não tem correções aplicáveis." };
  }

  record.fixResults = [
    ...(record.fixResults ?? []).filter(
      (batch) => !batches.some((next) => next.findingIndex === batch.findingIndex),
    ),
    ...batches,
  ];
  await updateBotCollection<SecurityAuditRecord>("security-audits", (rows) =>
    rows.map((row) => (row.id === record.id ? record : row)),
  );

  log.info("correcoes da auditoria aplicadas", {
    guildId: guild.id,
    auditId: record.id,
    applied: appliedCount,
    total: totalCount,
  });

  return {
    ok: true,
    detail:
      appliedCount === totalCount
        ? `${appliedCount} de ${totalCount} correções aplicadas.`
        : `${appliedCount} de ${totalCount} correções aplicadas; ${totalCount - appliedCount} recusada(s) pela verificação de segurança.`,
  };
}
