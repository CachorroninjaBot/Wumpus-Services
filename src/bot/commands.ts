/**
 * Slash commands.
 *
 * O bot antigo registrava /ping /ticket /form /mod no Discord, mas os paineis
 * eram montados com embeds e a config vinha sempre do fallback — o comando
 * respondia, so nao fazia o que o painel dizia.
 *
 * Aqui os comandos publicam o painel a partir da config real e existe
 * `/config status`, para o staff saber se o bot esta lendo o que foi salvo —
 * que era exatamente o ponto cego que ninguem conseguia enxergar.
 */
import {
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from "discord.js";
import { list, loadRuntime, moduleConfig, num } from "./config.ts";
import {
  adviseConfig,
  analyzeLogs,
  analyzeMember,
  buildMemberDigest,
  formatAnalysis,
  type AuditLite
} from "./assistant.ts";
import { buildFormPanel } from "./forms.ts";
import type { Logger } from "./logger.ts";
import { isModAction, recordOccurrence } from "./moderation.ts";
import { asSendable, resolveChannel, resolveRoles } from "./resolve.ts";
import { read } from "./store.ts";
import { shiftSummary } from "./staff.ts";
import { summarize } from "./statistics.ts";
import { buildTicketPanel, type Ticket, type TicketMessage } from "./tickets.ts";
import { reportLines, ticketStaffReport } from "./tickets-metrics.ts";
import type { FormSubmission } from "./forms.ts";
import type { ModerationOccurrence } from "./moderation.ts";

export const COMMANDS = [
  new SlashCommandBuilder().setName("ping").setDescription("O Wumpus esta no ar?"),

  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Publicar o painel de atendimento neste canal")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("form")
    .setDescription("Publicar o painel de candidaturas neste canal")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("config")
    .setDescription("Estado da configuracao do Wumpus neste servidor")
    .addSubcommand((sub) => sub.setName("status").setDescription("O bot esta lendo o que foi salvo?"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Numeros do Wumpus neste servidor")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("performance")
    .setDescription("Metricas de atendimento por atendente (assumidos, respostas, CSAT)")
    .addIntegerOption((option) =>
      option
        .setName("dias")
        .setDescription("Janela em dias (padrao: janela configurada no modulo Equipe)")
        .setMinValue(1)
        .setMaxValue(365)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("mod")
    .setDescription("Moderacao com strikes")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName("warn")
        .setDescription("Advertir")
        .addUserOption((option) => option.setName("alvo").setDescription("Membro").setRequired(true))
        .addStringOption((option) => option.setName("motivo").setDescription("Motivo").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("timeout")
        .setDescription("Silenciar")
        .addUserOption((option) => option.setName("alvo").setDescription("Membro").setRequired(true))
        .addStringOption((option) => option.setName("motivo").setDescription("Motivo").setRequired(true))
        .addIntegerOption((option) =>
          option.setName("minutos").setDescription("Duracao em minutos").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("kick")
        .setDescription("Expulsar")
        .addUserOption((option) => option.setName("alvo").setDescription("Membro").setRequired(true))
        .addStringOption((option) => option.setName("motivo").setDescription("Motivo").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("ban")
        .setDescription("Banir")
        .addUserOption((option) => option.setName("alvo").setDescription("Membro").setRequired(true))
        .addStringOption((option) => option.setName("motivo").setDescription("Motivo").setRequired(true))
    ),

  new SlashCommandBuilder()
    .setName("assistente")
    .setDescription("IA que analisa o servidor e sugere acoes (nunca aplica sozinha)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("logs").setDescription("Procurar o que foge do normal nos eventos recentes")
    )
    .addSubcommand((sub) =>
      sub
        .setName("membro")
        .setDescription("Analisar o comportamento de um membro")
        .addUserOption((option) => option.setName("alvo").setDescription("Membro").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("config")
        .setDescription("Pedir sugestoes de configuracao de um modulo")
        .addStringOption((option) =>
          option
            .setName("modulo")
            .setDescription("Modulo a avaliar")
            .setRequired(true)
            .addChoices(
              { name: "atendimento", value: "tickets" },
              { name: "candidaturas", value: "forms" },
              { name: "automod", value: "automod" },
              { name: "seguranca", value: "security" },
              { name: "moderacao", value: "moderation" }
            )
        )
    )
];

export async function registerCommands(clientId: string, token: string, log: Logger): Promise<number> {
  try {
    const rest = new REST({ version: "10" }).setToken(token);
    await rest.put(Routes.applicationCommands(clientId), {
      body: COMMANDS.map((command) => command.toJSON())
    });
    log.info("slash registrados", { commands: COMMANDS.map((command) => `/${command.name}`).join(" ") });
    return COMMANDS.length;
  } catch (error) {
    log.error("falha ao registrar slash", { error: String(error) });
    return 0;
  }
}

/** Quem pode usar /mod: cargo de staff configurado, ou quem gerencia o servidor. */
async function isStaff(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const guild = interaction.guild;
  if (!guild) return false;
  if (guild.ownerId === interaction.user.id) return true;

  const config = await moduleConfig(guild.id, "moderation");
  const roles = resolveRoles(guild, list(config, "staffRoleIds"));
  if (!roles.length) {
    // Sem cargo configurado, cai na permissao do Discord — nao trava o staff.
    return interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers) ?? false;
  }

  const member = interaction.member;
  if (!member || !("roles" in member)) return false;
  return roles.some((role) => (member.roles as { cache: { has: (id: string) => boolean } }).cache.has(role.id));
}

async function handleMod(interaction: ChatInputCommandInteraction, log: Logger): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  if (!(await isStaff(interaction))) {
    await interaction.reply({ content: "Voce nao tem permissao para usar a moderacao.", ephemeral: true });
    return;
  }

  const action = interaction.options.getSubcommand();
  if (!isModAction(action)) {
    await interaction.reply({ content: "Acao desconhecida.", ephemeral: true });
    return;
  }

  const target = interaction.options.getUser("alvo", true);
  const reason = interaction.options.getString("motivo", true);

  if (target.id === interaction.user.id) {
    await interaction.reply({ content: "Voce nao pode punir a si mesmo.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await recordOccurrence({
      guild,
      targetId: target.id,
      staffId: interaction.user.id,
      action,
      reason,
      log
    });

    const escalated = result.action !== action ? ` (escalado de ${action})` : "";
    await interaction.editReply(
      `**${result.action}** aplicado em <@${target.id}>${escalated}. ` +
      `Strike **${result.strikes}**${result.applied ? "" : " — a acao falhou, veja o log"}.`
    );
  } catch (error) {
    await interaction.editReply(`Nao consegui aplicar: ${String(error).slice(0, 300)}`);
  }
}

async function handleConfigStatus(interaction: ChatInputCommandInteraction, log: Logger): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const runtime = await loadRuntime(true);
  const published = runtime.guilds?.[guild.id];
  const modules = published ? Object.keys(published).filter((key) => key !== "name") : [];

  const lines: string[] = [];

  if (!modules.length) {
    lines.push(
      "**Nenhuma configuracao publicada para este servidor.**",
      "O painel ainda nao gravou nada, entao o bot esta operando com os valores padrao.",
      "Abra o painel, salve um modulo e rode este comando de novo."
    );
  } else {
    lines.push(`**${modules.length} modulo(s) publicado(s):** ${modules.join(", ")}`);
    if (runtime.updatedAt) {
      lines.push(`Ultima publicacao: <t:${Math.floor(runtime.updatedAt / 1000)}:R>`);
    }

    // Confere se os canais configurados existem de fato neste servidor —
    // era aqui que o bot antigo falhava em silencio.
    const broken: string[] = [];
    for (const module of modules) {
      const config = published?.[module];
      if (!config || typeof config !== "object") continue;
      for (const [key, value] of Object.entries(config as Record<string, unknown>)) {
        if (!key.toLowerCase().includes("channel") || typeof value !== "string" || !value) continue;
        if (!resolveChannel(guild, value)) broken.push(`${module}.${key} → "${value}"`);
      }
    }

    if (broken.length) {
      lines.push("", "⚠️ **Referencias que nao existem neste servidor:**", ...broken.slice(0, 10).map((b) => `· ${b}`));
      lines.push("Corrija no painel ou crie o canal com esse nome.");
    } else {
      lines.push("", "✅ Todos os canais configurados foram encontrados neste servidor.");
    }
  }

  await interaction.reply({ content: lines.join("\n").slice(0, 1900), ephemeral: true });
  log.info("config status consultado", { guildId: guild.id, modules: modules.length });
}

async function handleStats(interaction: ChatInputCommandInteraction, log: Logger): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const [tickets, forms, occurrences, messages] = await Promise.all([
    read<Ticket>("tickets"),
    read<FormSubmission>("forms"),
    read<ModerationOccurrence>("moderation"),
    read<TicketMessage>("ticket_messages")
  ]);

  const mine = tickets.filter((row) => row.guildId === guild.id);
  const open = mine.filter((row) => row.status !== "closed");
  const closed = mine.filter((row) => row.status === "closed");
  const rated = closed.filter((row) => row.feedback);
  const average = rated.length
    ? (rated.reduce((sum, row) => sum + (row.feedback?.rating ?? 0), 0) / rated.length).toFixed(1)
    : "sem avaliacoes";

  const guildForms = forms.filter((row) => row.guildId === guild.id);
  const guildOccurrences = occurrences.filter((row) => row.guildId === guild.id);
  const guildMessages = messages.filter((row) => mine.some((ticket) => ticket.id === row.ticketId));

  const byAction = guildOccurrences.reduce<Record<string, number>>((acc, row) => {
    const key = row.appliedAction ?? "sem efeito";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const lines = [
    `**Atendimento**`,
    `· Abertos agora: **${open.length}**`,
    `· Encerrados: **${closed.length}**`,
    `· Mensagens registradas: **${guildMessages.length}**`,
    `· Satisfacao media: **${average}**`,
    ``,
    `**Candidaturas**`,
    `· Total: **${guildForms.length}** (pendentes: ${guildForms.filter((row) => row.status === "pending").length})`,
    ``,
    `**Moderacao**`,
    `· Ocorrencias: **${guildOccurrences.length}**`,
    ...Object.entries(byAction).map(([action, count]) => `· ${action}: **${count}**`)
  ];

  // Atividade dos ultimos 7 dias — alimentada pelo modulo de estatisticas.
  const summary = await summarize(guild.id, 7);
  lines.push(
    ``,
    `**Atividade (7 dias)**`,
    `· Mensagens: **${summary.messages}**`,
    `· Entradas: **${summary.joins}** · Saidas: **${summary.leaves}** (saldo ${summary.net >= 0 ? "+" : ""}${summary.net})`
  );

  // Carga da equipe — le os tickets ja persistidos.
  const shift = await shiftSummary(guild);
  lines.push(``, shift);

  await interaction.reply({ content: lines.join("\n").slice(0, 1900), ephemeral: true });
  log.info("stats consultadas", { guildId: guild.id });
}

/**
 * Metricas por atendente — o item D do plano.
 *
 * O `/stats` mostra o plantao; este responde "como cada um esta trabalhando"
 * na janela pedida, com a meta de 1a resposta do modulo Equipe.
 */
async function handlePerformance(interaction: ChatInputCommandInteraction, log: Logger): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  await interaction.deferReply({ ephemeral: true });

  const staffConfig = await moduleConfig(guild.id, "staff");
  const configuredWindow = Math.trunc(num(staffConfig, "performanceWindowDays", 30));
  const requested = interaction.options.getInteger("dias");
  const windowDays = Math.max(1, requested ?? configuredWindow);
  const goal = Math.trunc(num(staffConfig, "responseTimeGoalMinutes", 30));

  const reports = await ticketStaffReport(guild.id, windowDays);
  if (!reports.length) {
    await interaction.editReply(`Nenhum atendimento assumido nos ultimos **${windowDays}** dias.`);
    return;
  }

  const totalClaimed = reports.reduce((sum, row) => sum + row.claimed, 0);
  const lines = reportLines(reports, goal).slice(0, 10);

  await interaction.editReply(
    [
      `**Desempenho da equipe · ultimos ${windowDays} dias**`,
      `Assumidos no periodo: **${totalClaimed}** · meta de 1a resposta: **${goal} min**`,
      "",
      ...lines
    ].join("\n").slice(0, 1900)
  );

  log.info("performance consultada", { guildId: guild.id, windowDays, atendentes: reports.length });
}

type StoredAudit = AuditLite & { guildId?: string; targetId?: string | null };

/**
 * Assistente de IA: analisa e sugere.
 *
 * Nao existe caminho aqui que APLIQUE a sugestao. Configuracao automatizada por
 * IA e um bot mexendo no servidor sem avisar: se a analise erra, o estrago ja
 * aconteceu. Quem decide e o dono, no painel.
 */
async function handleAssistant(interaction: ChatInputCommandInteraction, log: Logger): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const sub = interaction.options.getSubcommand();
  await interaction.deferReply({ ephemeral: true });

  const events = (await read<StoredAudit>("audit"))
    .filter((event) => event.guildId === guild.id)
    .sort((a, b) => b.at - a.at);

  if (sub === "logs") {
    const analysis = await analyzeLogs(guild.id, events.slice(0, 120), log);
    await interaction.editReply(formatAnalysis(analysis, "Analise dos eventos"));
    return;
  }

  if (sub === "membro") {
    const target = interaction.options.getUser("alvo", true);
    const member = await guild.members.fetch(target.id).catch(() => null);
    const history = events.filter((event) => event.targetId === target.id);

    const digest = buildMemberDigest({
      username: target.username,
      accountAgeDays: Math.floor((Date.now() - target.createdTimestamp) / 86_400_000),
      joinedDaysAgo: member?.joinedTimestamp
        ? Math.floor((Date.now() - member.joinedTimestamp) / 86_400_000)
        : 0,
      // Nao medimos mensagem por membro. Passar zero seria mentir para a IA.
      messages: null,
      strikes: history.filter((event) => event.category === "moderation").length,
      timedOut: Boolean(
        member?.communicationDisabledUntilTimestamp &&
          member.communicationDisabledUntilTimestamp > Date.now()
      ),
      tickets: 0
    });

    const analysis = await analyzeMember(guild.id, digest, log);
    await interaction.editReply(formatAnalysis(analysis, `Analise de ${target.username}`));
    return;
  }

  if (sub === "config") {
    const module = interaction.options.getString("modulo", true);
    const config = await moduleConfig(guild.id, module);
    const analysis = await adviseConfig(guild.id, module, config ?? {}, log);
    await interaction.editReply(formatAnalysis(analysis, `Sugestoes para ${module}`));
  }
}

/** Despacha um comando de barra. Devolve `true` quando tratou. */
export async function handleCommand(
  interaction: ChatInputCommandInteraction,
  log: Logger
): Promise<boolean> {
  const guild = interaction.guild;

  switch (interaction.commandName) {
    case "ping":
      await interaction.reply({
        content: `Pong. **${interaction.client.guilds.cache.size}** servidor(es), ${Math.round(interaction.client.ws.ping)}ms.`,
        ephemeral: true
      });
      return true;

    case "ticket": {
      if (!guild) return false;
      const panel = await buildTicketPanel(guild);
      const target = asSendable(interaction.channel);
      if (target) await target.send(panel as never);
      await interaction.reply({ content: "Painel de atendimento publicado.", ephemeral: true });
      return true;
    }

    case "form": {
      if (!guild) return false;
      const panel = await buildFormPanel(guild);
      const target = asSendable(interaction.channel);
      if (target) await target.send(panel as never);
      await interaction.reply({ content: "Painel de candidaturas publicado.", ephemeral: true });
      return true;
    }

    case "config":
      await handleConfigStatus(interaction, log);
      return true;

    case "stats":
      await handleStats(interaction, log);
      return true;

    case "performance":
      await handlePerformance(interaction, log);
      return true;

    case "mod":
      await handleMod(interaction, log);
      return true;

    case "assistente":
      await handleAssistant(interaction, log);
      return true;

    default:
      return false;
  }
}
