import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  Routes,
  type Guild,
  type Interaction,
  type Message
} from "discord.js";
import { getPool, resolveModuleConfig, upsertGuild, recordAuditEvent } from "../server/db/index.js";
import {
  deactivateGuild,
  processPendingPublications,
  saveGuildSnapshot,
  type PublicationRow
} from "../server/db/publishing.js";
import { invalidateChannelIndex } from "../server/db/channel-refs.js";
import { analyzeTicket } from "./ai.js";
import { handleImageContent, handleMessage, handleGhostPing, trackMentions, syncNativeKeywordRule } from "./automod.js";
import { logMemberJoin, logMemberLeave, logMessageEdit, logMessageDelete, logRoleCreate, logRoleDelete, logChannelCreate, logChannelDelete, logBanAdd, logBanRemove } from "./logs.js";
import { trackMessage, trackJoin, flushStatistics, sendDailyDigest } from "./statistics.js";
import { recordOccurrence } from "./moderation.js";
import { answerFromKnowledge, type KnowledgeConfig } from "./knowledge.js";
import { buildPanelPayload, defaultButtons, IS_COMPONENTS_V2, type PanelFormat } from "./panels.js";
import { handleAuditLogEntry, handleMemberAdd } from "./security.js";

export type BotLogger = {
  info: (message: string, extra?: Record<string, unknown>) => void;
  warn: (message: string, extra?: Record<string, unknown>) => void;
  error: (message: string, extra?: Record<string, unknown>) => void;
};

/**
 * Niveis de operacao, do mais completo ao mais basico:
 *  - full:          anti-raid + anti-nuke + automod
 *  - security_only: anti-raid + anti-nuke (sem automod)
 *  - minimal:       apenas a fila de publicacao e os botoes
 *
 * O nivel cai apenas o necessario: se o Discord recusar a intent de conteudo,
 * perdemos o automod mas MANTEMOS a protecao de raid, que e mais critica.
 */
export type BotMode = "full" | "security_only" | "minimal";

export type BotHandle = {
  readonly client: Client | null;
  readonly mode: BotMode | null;
  stop: () => Promise<void>;
};

const WORKER_INTERVAL_MS = 5_000;

/** Intents por nivel, na ordem em que sao tentadas. */
const INTENT_TIERS: Array<{ mode: BotMode; intents: number[] }> = [
  {
    mode: "full",
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  },
  {
    mode: "security_only",
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration
    ]
  },
  { mode: "minimal", intents: [GatewayIntentBits.Guilds] }
];

export function createBot(token: string, log: BotLogger): BotHandle {
  let client: Client | null = null;
  let mode: BotMode | null = null;
  let worker: NodeJS.Timeout | null = null;
  let running = false;
  let stopped = false;

  /* --------------------------- sincronizacao -------------------------- */

  async function syncGuild(guild: Guild): Promise<void> {
    // Servidor indisponivel no gateway nao tem nome, e gravar isso violaria a
    // constraint NOT NULL. O discord.js tipa `name` como string, mas em runtime
    // ele vem undefined nesse caso. Sincronizamos quando o servidor voltar.
    if (!guild.available || !guild.name) {
      log.info("servidor indisponivel no gateway; sincronizo quando ele voltar", { guildId: guild.id });
      return;
    }

    await upsertGuild({
      guildId: guild.id,
      name: guild.name,
      iconUrl: guild.iconURL({ size: 128 }),
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
      botPermissions: guild.members.me?.permissions.bitfield.toString() ?? null
    });

    await saveGuildSnapshot({
      guildId: guild.id,
      channels: [...guild.channels.cache.values()].map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        parentId: channel.parentId,
        position: "position" in channel ? Number(channel.position) : 0
      })),
      roles: [...guild.roles.cache.values()]
        .filter((role) => role.id !== guild.id)
        .map((role) => ({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
          managed: role.managed
        }))
    });

    // Canais e cargos acabaram de ser atualizados: descartamos o cache de
    // resolucao por nome para que um canal novo valha imediatamente, em vez de
    // esperar o cache expirar.
    invalidateChannelIndex(guild.id);

    // Termos bloqueados tambem viram uma regra nativa do Discord: filtra no
    // lado deles, mesmo sem a intent de conteudo.
    const automod = await resolveModuleConfig(guild.id, "automod").catch(() => null);
    if (automod?.enabled && client) {
      await syncNativeKeywordRule(client, guild.id, automod.config, log);
    }

    // Registrar o sucesso: sem isso nao da para distinguir "sincronizou" de
    // "o evento nunca chegou", e a dashboard depende desta sincronizacao.
    log.info("servidor sincronizado", {
      guildId: guild.id,
      channels: guild.channels.cache.size,
      roles: guild.roles.cache.size
    });
  }

  /* ------------------------------ publicacao -------------------------- */

  /** Envia um painel enfileirado pelo dashboard. */
  async function publish(row: PublicationRow): Promise<string> {
    const current = client;
    if (!current) throw new Error("O bot nao esta conectado.");

    const payload = buildPanelPayload({
      module: row.module,
      format: (row.format as PanelFormat) ?? "components_v2",
      title: String(row.payload.title ?? "Painel do Wumpus"),
      description: String(row.payload.description ?? ""),
      accentColor: String(row.payload.accentColor ?? "#7c5cff"),
      buttons: defaultButtons(row.module)
    });

    const message = (await current.rest.post(Routes.channelMessages(row.channelId), {
      body: payload
    })) as { id?: string };

    if (!message?.id) throw new Error("O Discord nao devolveu o id da mensagem.");
    return message.id;
  }

  async function tick(): Promise<void> {
    if (running || !client) return;
    running = true;
    try {
      const processed = await processPendingPublications(publish, 5);
      if (processed > 0) log.info(`publicou ${processed} painel(is)`);
    } catch (error) {
      log.error("falha ao processar a fila de publicacoes", { error: String(error) });
    } finally {
      running = false;
    }
  }

  /* ------------------------------ atendimento ------------------------- */

  async function openTicket(interaction: Interaction, department: string | null): Promise<void> {
    const current = client;
    if (!interaction.isButton() || !interaction.guild || !current) return;
    await interaction.deferReply({ flags: 64 });

    const guild = interaction.guild;
    const config = await resolveModuleConfig(guild.id, "tickets");

    if (!config.enabled) {
      await interaction.editReply("O atendimento está pausado neste servidor.");
      return;
    }

    const existing = await getPool().query<{ channelId: string | null }>(
      `select channel_id as "channelId" from tickets
       where guild_id = $1 and opener_id = $2 and status <> 'closed' limit 1`,
      [guild.id, interaction.user.id]
    );
    if (existing.rows[0]?.channelId) {
      await interaction.editReply(`Você já tem um atendimento aberto: <#${existing.rows[0].channelId}>`);
      return;
    }

    const staffRoleIds = Array.isArray(config.config.staffRoleIds) ? (config.config.staffRoleIds as string[]) : [];
    const categoryId = typeof config.config.categoryId === "string" ? config.config.categoryId : "";

    try {
      const namingPattern = typeof config.config.namingPattern === "string" && config.config.namingPattern
        ? config.config.namingPattern
        : "atendimento-{user}";
      const channelName = namingPattern.replace(/\{user\}/g, interaction.user.username).slice(0, 90);

      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryId || undefined,
        topic: `Atendimento de ${interaction.user.tag} · Wumpus`,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles
            ]
          },
          {
            id: current.user!.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          ...staffRoleIds.map((roleId) => ({
            id: roleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages
            ]
          }))
        ]
      });

      const ticket = await getPool().query<{ id: number }>(
        `insert into tickets (guild_id, channel_id, opener_id, department, subject)
         values ($1, $2, $3, $4, $5) returning id`,
        [guild.id, channel.id, interaction.user.id, department, "Atendimento aberto pelo painel"]
      );
      const ticketId = ticket.rows[0].id;

      await getPool().query(
        `insert into ticket_events (ticket_id, event_type, actor_id, data)
         values ($1, 'opened', $2, $3::jsonb)`,
        [ticketId, interaction.user.id, JSON.stringify({ department })]
      );

      await current.rest.post(Routes.channelMessages(channel.id), {
        body: {
          content: `<@${interaction.user.id}> · atendimento **#${ticketId}** aberto. ${
            staffRoleIds.length ? staffRoleIds.map((id) => `<@&${id}>`).join(" ") : ""
          }`,
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: "Assumir", custom_id: `wumpus:ticket:claim:${ticketId}` },
                { type: 2, style: 4, label: "Encerrar", custom_id: `wumpus:ticket:close:${ticketId}` }
              ]
            }
          ]
        }
      });

      // Mensagem de boas-vindas configurável
      const welcomeMsg = typeof config.config.welcomeMessage === "string" ? config.config.welcomeMessage.trim() : "";
      if (welcomeMsg) {
        await current.rest.post(Routes.channelMessages(channel.id), {
          body: { content: welcomeMsg.slice(0, 2000) }
        }).catch(() => undefined);
      }

      await interaction.editReply(`Atendimento aberto em <#${channel.id}>.`);
      log.info("atendimento aberto", { guildId: guild.id, ticketId, userId: interaction.user.id, department });

      // Log de atendimento: e aqui que a equipe tem o botao de analise por IA.
      // Migrado para Components V2 (Container + Text Display + Action Row),
      // consistente com o resto dos paineis e logs do produto.
      const logChannelId = typeof config.config.logChannelId === "string" ? config.config.logChannelId : "";
      const aiEnabled = config.config.aiSupportEnabled !== false;
      if (logChannelId) {
        const containerChildren: Array<Record<string, unknown>> = [
          {
            type: 10,
            content:
              `## Atendimento #${ticketId} aberto\n` +
              `Aberto por <@${interaction.user.id}> em <#${channel.id}>.\n\n` +
              `**Departamento**\n${department ?? "não informado"}\n\n` +
              `**Assunto**\nAtendimento aberto pelo painel`
          }
        ];

        if (aiEnabled) {
          containerChildren.push({ type: 14, divider: true, spacing: 1 });
          containerChildren.push({
            type: 1,
            components: [
              {
                type: 2,
                style: 2,
                label: "Analisar com IA",
                emoji: { name: "🧠" },
                custom_id: `wumpus:ai:analyze:${ticketId}`
              }
            ]
          });
        }

        await current.rest
          .post(Routes.channelMessages(logChannelId), {
            body: {
              flags: IS_COMPONENTS_V2,
              components: [{ type: 17, accent_color: 0x7c5cff, components: containerChildren }]
            }
          })
          .catch((error) => log.error("falha ao publicar o log do atendimento", { error: String(error) }));
      }
    } catch (error) {
      log.error("falha ao abrir atendimento", { error: String(error) });
      await interaction.editReply(
        "Não consegui abrir o atendimento. Verifique minhas permissões de gerenciar canais."
      );
    }
  }

  async function closeTicket(interaction: Interaction, rawTicketId: string): Promise<void> {
    const current = client;
    if (!interaction.isButton() || !interaction.guild || !current) return;
    await interaction.deferReply({ flags: 64 });

    const ticketId = Number(rawTicketId);
    if (!Number.isSafeInteger(ticketId)) {
      await interaction.editReply("Atendimento inválido.");
      return;
    }

    const result = await getPool().query<{ openerId: string }>(
      `update tickets set status = 'closed', closed_at = now()
       where id = $1 and guild_id = $2 and status <> 'closed'
       returning opener_id as "openerId"`,
      [ticketId, interaction.guild.id]
    );
    const ticket = result.rows[0];
    if (!ticket) {
      await interaction.editReply("Esse atendimento já estava encerrado.");
      return;
    }

    await getPool().query(
      `insert into ticket_events (ticket_id, event_type, actor_id, data) values ($1, 'closed', $2, '{}'::jsonb)`,
      [ticketId, interaction.user.id]
    );

    // Feedback vai por DM: so se feedbackEnabled estiver ativo
    const ticketConfig = await resolveModuleConfig(interaction.guild.id, "tickets").catch(() => null);
    const feedbackEnabled = ticketConfig?.config?.feedbackEnabled !== false;
    if (feedbackEnabled) {
    try {
      const dm = await current.users.createDM(ticket.openerId);
      await current.rest.post(Routes.channelMessages(dm.id), {
        body: {
          content: "Seu atendimento foi encerrado. Como foi o suporte?",
          components: [
            {
              type: 1,
              components: [1, 2, 3, 4, 5].map((score) => ({
                type: 2,
                style: score >= 4 ? 3 : score === 3 ? 2 : 4,
                label: "⭐".repeat(score),
                custom_id: `wumpus:feedback:${ticketId}:${score}`
              }))
            }
          ]
        }
      });
    } catch {
      log.info("nao foi possivel enviar o pedido de feedback por DM", { ticketId });
    }
    }

    await interaction.editReply("Atendimento encerrado. Obrigado!");
    log.info("atendimento encerrado", { guildId: interaction.guild.id, ticketId, closedBy: interaction.user.id });
  }

  async function saveFeedback(interaction: Interaction, rawTicketId: string, score: string): Promise<void> {
    if (!interaction.isButton() || !interaction.guild) return;

    const ticketId = Number(rawTicketId);
    const value = Number(score);
    if (!Number.isSafeInteger(ticketId) || !Number.isInteger(value) || value < 1 || value > 5) {
      await interaction.reply({ content: "Nota inválida.", flags: 64 });
      return;
    }

    await getPool().query(
      `insert into ticket_feedback (ticket_id, guild_id, score)
       values ($1, $2, $3)
       on conflict (ticket_id) do update set score = excluded.score, created_at = now()`,
      [ticketId, interaction.guild.id, value]
    );

    await interaction.reply({ content: `Obrigado! Registrei sua nota ${value}/5.`, flags: 64 });
  }

  async function claimTicket(interaction: Interaction, rawTicketId: string): Promise<void> {
    if (!interaction.isButton() || !interaction.guild) return;
    await interaction.deferReply({ flags: 64 });

    const ticketId = Number(rawTicketId);
    if (!Number.isSafeInteger(ticketId)) {
      await interaction.editReply("Atendimento inválido.");
      return;
    }

    // Verifica se o usuário tem cargo de staff
    const config = await resolveModuleConfig(interaction.guild.id, "tickets");
    const staffRoleIds = Array.isArray(config.config.staffRoleIds) ? (config.config.staffRoleIds as string[]) : [];
    const member = interaction.member;
    if (staffRoleIds.length && member && "roles" in member) {
      const roles = member.roles as { cache: { some: (fn: (r: { id: string }) => boolean) => boolean } };
      const hasStaffRole = roles.cache.some((r) => staffRoleIds.includes(r.id));
      if (!hasStaffRole && interaction.guild.ownerId !== interaction.user.id) {
        await interaction.editReply("Apenas a equipe pode assumir atendimentos.");
        return;
      }
    }

    const result = await getPool().query<{ claimedBy: string | null; status: string }>(
      `select claimed_by as "claimedBy", status from tickets
       where id = $1 and guild_id = $2 and status <> 'closed'`,
      [ticketId, interaction.guild.id]
    );
    const ticket = result.rows[0];
    if (!ticket) {
      await interaction.editReply("Esse atendimento não existe ou já foi encerrado.");
      return;
    }
    if (ticket.claimedBy) {
      await interaction.editReply(`Esse atendimento já foi assumido por <@${ticket.claimedBy}>.`);
      return;
    }

    await getPool().query(
      `update tickets set claimed_by = $1, status = 'claimed' where id = $2 and guild_id = $3`,
      [interaction.user.id, ticketId, interaction.guild.id]
    );

    await getPool().query(
      `insert into ticket_events (ticket_id, event_type, actor_id, data) values ($1, 'claimed', $2, '{}'::jsonb)`,
      [ticketId, interaction.user.id]
    );

    await interaction.editReply(`Atendimento #${ticketId} assumido por você.`);
    log.info("atendimento assumido", { guildId: interaction.guild.id, ticketId, claimedBy: interaction.user.id });
  }

  async function handleFormOpen(interaction: Interaction): Promise<void> {
    if (!interaction.isButton() || !interaction.guild) return;
    await interaction.deferReply({ flags: 64 });

    const guildId = interaction.guild.id;
    const config = await resolveModuleConfig(guildId, "forms");
    if (!config.enabled) {
      await interaction.editReply("As candidaturas estão pausadas neste servidor.");
      return;
    }

    // Verifica cooldown
    const cooldownHours = typeof config.config.cooldownHours === "number" ? config.config.cooldownHours : 24;
    if (cooldownHours > 0) {
      const recent = await getPool().query(
        `select 1 from form_submissions where guild_id = $1 and user_id = $2 and created_at > now() - interval '${cooldownHours} hours' limit 1`,
        [guildId, interaction.user.id]
      );
      if (recent.rowCount && recent.rowCount > 0) {
        await interaction.editReply(`Você já enviou uma candidatura recentemente. Aguarde ${cooldownHours}h.`);
        return;
      }
    }

    // Verifica idade mínima da conta
    const minDays = typeof config.config.minAccountAgeDays === "number" ? config.config.minAccountAgeDays : 0;
    if (minDays > 0) {
      const accountAge = (Date.now() - interaction.user.createdTimestamp) / (1000 * 60 * 60 * 24);
      if (accountAge < minDays) {
        await interaction.editReply(`Sua conta precisa ter pelo menos ${minDays} dia(s) para se candidatar.`);
        return;
      }
    }

    // Cria uma submissão simples (sem modal para compatibilidade)
    // O usuário será instruído a enviar as respostas no canal
    const maxSubmissions = typeof config.config.maxSubmissionsPerUser === "number" ? config.config.maxSubmissionsPerUser : 3;
    const userSubmissions = await getPool().query(
      `select count(*)::integer as cnt from form_submissions where guild_id = $1 and user_id = $2`,
      [guildId, interaction.user.id]
    );
    if ((userSubmissions.rows[0]?.cnt ?? 0) >= maxSubmissions) {
      await interaction.editReply(`Você atingiu o limite de ${maxSubmissions} envio(s).`);
      return;
    }

    // Insere a submissão pendente
    const result = await getPool().query<{ id: number }>(
      `insert into form_submissions (form_id, guild_id, user_id, answers, status)
       values (0, $1, $2, $3::jsonb, 'pending') returning id`,
      [guildId, interaction.user.id, JSON.stringify({ submittedAt: new Date().toISOString(), channelId: interaction.channelId })]
    );
    const submissionId = result.rows[0].id;

    // Notifica revisores
    const reviewChannelId = typeof config.config.reviewChannelId === "string" ? config.config.reviewChannelId : "";
    const reviewerRoleIds = Array.isArray(config.config.reviewerRoleIds) ? config.config.reviewerRoleIds as string[] : [];
    if (reviewChannelId) {
      const roleMentions = reviewerRoleIds.length ? reviewerRoleIds.map((id) => `<@&${id}>`).join(" ") : "";
      const currentClient = client;
      if (currentClient) {
        await currentClient.rest.post(Routes.channelMessages(reviewChannelId), {
          body: {
            content: `📝 Nova candidatura #${submissionId} de <@${interaction.user.id}> ${roleMentions}`.slice(0, 2000),
            components: [
              {
                type: 1,
                components: [
                  { type: 2, style: 3, label: "Aprovar", custom_id: `wumpus:form:approve:${submissionId}` },
                  { type: 2, style: 4, label: "Rejeitar", custom_id: `wumpus:form:reject:${submissionId}` }
                ]
              }
            ]
          }
        }).catch(() => undefined);
      }
    }

    await recordAuditEvent({
      guildId,
      module: "forms",
      eventType: "form_submitted",
      actorId: interaction.user.id,
      data: { submissionId }
    }).catch(() => undefined);

    await interaction.editReply(`Candidatura #${submissionId} enviada! A equipe vai analisar.`);
    log.info("candidatura enviada", { guildId, submissionId, userId: interaction.user.id });
  }

  /**
   * Analise por IA: a resposta e efemera, entao apenas quem clicou ve.
   * Isso e o que garante, na pratica, que a IA nao responde ao cliente.
   */
  async function runAiAnalysis(interaction: Interaction, rawTicketId: string): Promise<void> {
    if (!interaction.isButton() || !interaction.guild) return;
    await interaction.deferReply({ flags: 64 });

    const ticketId = Number(rawTicketId);
    if (!Number.isSafeInteger(ticketId)) {
      await interaction.editReply("Atendimento inválido.");
      return;
    }

    try {
      const result = await analyzeTicket({
        ticketId,
        guildId: interaction.guild.id,
        requestedBy: interaction.user.id
      });

      const suggestions = result.suggestions.length
        ? result.suggestions.map((entry) => `- ${entry}`).join("\n")
        : "- (sem sugestões)";
      const sources = result.sources.length
        ? result.sources.map((entry) => `${entry.ok ? "✅" : "⚠️"} ${entry.name}`).join(" · ")
        : "nenhuma plataforma interna configurada";

      const body = [
        `**Análise do atendimento #${ticketId}**`,
        result.analysis.slice(0, 1400),
        "",
        "**Sugestões**",
        suggestions,
        "",
        `-# Fontes: ${sources} · modelo ${result.model}${result.retries > 0 ? ` · ${result.retries} retry(s)` : ""}`
      ].join("\n");

      await interaction.editReply({ content: body.slice(0, 1990) });
    } catch (error) {
      log.error("falha na analise por IA", { ticketId, error: String(error) });
      await interaction.editReply(
        "Não consegui analisar agora. Verifique se a chave da IA está configurada e tente novamente."
      );
    }
  }

  /**
   * Responde duvidas usando apenas artigos aprovados. Fica separado do
   * automod porque e atendimento, nao moderacao — e o canal de respostas
   * define onde ele atua.
   */
  async function handleKnowledge(message: Message): Promise<void> {
    const current = client;
    if (!current || !message.guild || message.author.bot || !message.content) return;

    const module = await resolveModuleConfig(message.guild.id, "knowledge");
    if (!module.enabled) return;

    await answerFromKnowledge(current, message, module.config as KnowledgeConfig, log);
  }

  /* ------------------------------- eventos ---------------------------- */

  function attach(target: Client, capabilities: { security: boolean; automod: boolean }): void {
    target.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isButton()) return;
      const [scope, action, ...rest] = interaction.customId.split(":");
      if (scope !== "wumpus") return;

      try {
        if (action === "ticket" && rest[0] === "open") {
          await openTicket(interaction, rest[1] ?? null);
        } else if (action === "ticket" && rest[0] === "close") {
          await closeTicket(interaction, rest[1] ?? "0");
        } else if (action === "ticket" && rest[0] === "claim") {
          await claimTicket(interaction, rest[1] ?? "0");
        } else if (action === "ai" && rest[0] === "analyze") {
          await runAiAnalysis(interaction, rest[1] ?? "0");
        } else if (action === "feedback") {
          await saveFeedback(interaction, rest[0] ?? "0", rest[1] ?? "0");
        } else if (action === "form" && rest[0] === "open") {
          await handleFormOpen(interaction);
        } else if (action === "report" && rest[0] === "open") {
          await interaction.reply({ content: "Denúncia registrada. A equipe vai analisar.", flags: 64 });
        }
      } catch (error) {
        log.error("erro ao tratar interacao", { customId: interaction.customId, userId: interaction.user.id, error: String(error) });
        if (interaction.isRepliable() && !interaction.replied) {
          await interaction
            .reply({ content: "Algo falhou ao processar esta ação.", flags: 64 })
            .catch(() => undefined);
        }
      }
    });

    target.on(Events.GuildCreate, (guild) => {
      log.info(`entrou no servidor: ${guild.name}`, { guildId: guild.id, members: guild.memberCount });
      void syncGuild(guild).catch((error) =>
        log.error("falha ao sincronizar novo servidor", { error: String(error) })
      );
    });

    target.on(Events.GuildAvailable, (guild) => {
      void syncGuild(guild).catch((error) =>
        log.error("falha ao sincronizar servidor disponivel", { error: String(error) })
      );
    });

    target.on(Events.GuildDelete, (guild) => {
      log.info(`saiu do servidor: ${guild.name ?? guild.id}`, { guildId: guild.id });
      void deactivateGuild(guild.id).catch(() => undefined);
    });

    target.on(Events.Error, (error) => log.error("erro no cliente do Discord", { error: String(error) }));

    if (capabilities.automod) {
      target.on(Events.MessageCreate, (message) => {
        // Statistics: contagem de mensagens
        if (message.guild && !message.author.bot) trackMessage(message.guild.id);
        void handleMessage(target, message, log).catch((error) =>
          log.error("falha no automod", { error: String(error) })
        );
        void handleImageContent(target, message, log).catch((error) =>
          log.error("falha no ocr", { error: String(error) })
        );
        void handleKnowledge(message).catch((error) =>
          log.error("falha na base de conhecimento", { error: String(error) })
        );
        // Rastreia menções para detecção de ghost ping
        trackMentions(message);
      });

      target.on(Events.MessageDelete, (message) => {
        if (!message.guildId) return;
        void handleGhostPing(target, message.id, message.guildId, message.channelId, log).catch((error) =>
          log.error("falha na deteccao de ghost ping", { error: String(error) })
        );
      });
    }

    if (capabilities.security) {
      target.on(Events.GuildMemberAdd, (member) => {
        void handleMemberAdd(target, member, log).catch((error) =>
          log.error("falha no anti-raid", { error: String(error) })
        );
      });

      target.on(Events.GuildAuditLogEntryCreate, (entry, guild) => {
        void handleAuditLogEntry(target, entry, guild, log).catch((error) =>
          log.error("falha no anti-nuke", { error: String(error) })
        );
      });
    }

    // Módulo servers: mensagens de boas-vindas e saída + statistics + auto-roles
    target.on(Events.GuildMemberAdd, (member) => {
      if (member.user.bot) return;
      // Statistics: contagem de joins
      trackJoin(member.guild.id);
      // Logs: membro entrou
      void logMemberJoin(member, log).catch(() => undefined);
      // Roles: auto-assign
      void (async () => {
        try {
          const rolesConfig = await resolveModuleConfig(member.guild.id, "roles");
          if (!rolesConfig.enabled) return;
          const defaultRoleIds = Array.isArray(rolesConfig.config.defaultRoleIds) ? rolesConfig.config.defaultRoleIds as string[] : [];
          if (!defaultRoleIds.length) return;
          await member.roles.add(defaultRoleIds, "Auto-assign na entrada");
        } catch { /* sem permissão ou cargo inválido */ }
      })();
      // Servers: mensagem de boas-vindas
      void (async () => {
        try {
          const config = await resolveModuleConfig(member.guild.id, "servers");
          if (!config.enabled) return;
          const channelId = typeof config.config.announceJoinChannelId === "string" ? config.config.announceJoinChannelId : "";
          if (!channelId) return;
          const template = typeof config.config.joinMessage === "string" ? config.config.joinMessage : "";
          if (!template) return;
          const content = template.replace(/\{user\}/g, `<@${member.id}>`).replace(/\{username\}/g, member.user.username).replace(/\{server\}/g, member.guild.name);
          await target.rest.post(Routes.channelMessages(channelId), { body: { content: content.slice(0, 2000) } });
        } catch { /* servidor sem config ou sem permissão */ }
      })();
    });

    target.on(Events.GuildMemberRemove, (member) => {
      if (member.user.bot) return;
      void logMemberLeave(member, log).catch(() => undefined);
      void (async () => {
        try {
          const config = await resolveModuleConfig(member.guild.id, "servers");
          if (!config.enabled) return;
          const channelId = typeof config.config.announceLeaveChannelId === "string" ? config.config.announceLeaveChannelId : "";
          if (!channelId) return;
          const template = typeof config.config.leaveMessage === "string" ? config.config.leaveMessage : "";
          if (!template) return;
          const content = template.replace(/\{user\}/g, member.user.username).replace(/\{username\}/g, member.user.username).replace(/\{server\}/g, member.guild.name);
          await target.rest.post(Routes.channelMessages(channelId), { body: { content: content.slice(0, 2000) } });
        } catch { /* servidor sem config ou sem permissão */ }
      })();
    });

    // Módulo logs: eventos de mensagem, cargo, canal, ban
    target.on(Events.MessageUpdate, (oldMsg, newMsg) => {
      void logMessageEdit(oldMsg, newMsg, log).catch(() => undefined);
    });
    target.on(Events.MessageDelete, (message) => {
      void logMessageDelete(message, log).catch(() => undefined);
    });
    target.on(Events.GuildRoleCreate, (role) => {
      void logRoleCreate(role, log).catch(() => undefined);
    });
    target.on(Events.GuildRoleDelete, (role) => {
      void logRoleDelete(role, log).catch(() => undefined);
    });
    target.on(Events.ChannelCreate, (channel) => {
      void logChannelCreate(channel, log).catch(() => undefined);
    });
    target.on(Events.ChannelDelete, (channel) => {
      void logChannelDelete(channel, log).catch(() => undefined);
    });
    target.on(Events.GuildBanAdd, (ban) => {
      void logBanAdd(ban.guild.id, ban.client, ban.user.id, log).catch(() => undefined);
    });
    target.on(Events.GuildBanRemove, (ban) => {
      void logBanRemove(ban.guild.id, ban.client, ban.user.id, log).catch(() => undefined);
    });
  }

  /* -------------------------------- ciclo ----------------------------- */

  async function connectWith(intents: number[], nextMode: BotMode): Promise<Client> {
    const candidate = new Client({ intents });
    // Os listeners precisam existir ANTES do login: o login resolve no ready.
    attach(candidate, { security: nextMode !== "minimal", automod: nextMode === "full" });
    await candidate.login(token);
    return candidate;
  }

  async function boot(): Promise<void> {
    for (const tier of INTENT_TIERS) {
      try {
        client = await connectWith(tier.intents, tier.mode);
        mode = tier.mode;
        break;
      } catch (error) {
        const message = String(error);

        if (!/disallowed intent/i.test(message)) {
          log.error("nao foi possivel conectar o bot (token invalido?)", { error: message });
          return;
        }

        if (tier.mode === "minimal") {
          log.error("o Discord recusou ate as intents basicas; o bot nao vai subir", { error: message });
          return;
        }

        log.warn(
          `intents recusadas no nivel "${tier.mode}"; tentando nivel mais basico. ` +
            "Habilite as intents no portal do Discord para restaurar a protecao completa.",
          { error: message }
        );
      }
    }

    if (!client || !mode) return;

    if (stopped) {
      await client.destroy().catch(() => undefined);
      return;
    }

    log.info("bot conectado", { mode, user: client.user?.tag, guilds: client.guilds.cache.size });

    for (const guild of client.guilds.cache.values()) {
      await syncGuild(guild).catch((error) =>
        log.error("falha ao sincronizar servidor", { guildId: guild.id, error: String(error) })
      );
    }

    worker = setInterval(() => void tick(), WORKER_INTERVAL_MS);
    void tick();

    // Statistics: flush a cada hora
    setInterval(() => { void flushStatistics().catch(() => undefined); }, 60 * 60_000);

    // Statistics: resumo diário às 12h UTC
    setInterval(() => {
      const now = new Date();
      const currentClient = client;
      if (now.getUTCHours() === 12 && now.getUTCMinutes() < 5 && currentClient) {
        for (const guild of currentClient.guilds.cache.values()) {
          void sendDailyDigest(currentClient, guild.id, log).catch(() => undefined);
        }
      }
    }, 5 * 60_000);
  }

  void boot().catch((error) => log.error("falha ao iniciar o bot", { error: String(error) }));

  return {
    get client() {
      return client;
    },
    get mode() {
      return mode;
    },
    stop: async () => {
      stopped = true;
      if (worker) clearInterval(worker);
      await client?.destroy().catch(() => undefined);
    }
  };
}