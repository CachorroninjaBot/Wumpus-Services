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

export type BotMode = "full" | "security_only" | "minimal";

export type BotHandle = {
  readonly client: Client | null;
  readonly mode: BotMode | null;
  stop: () => Promise<void>;
};

const WORKER_INTERVAL_MS = 5_000;

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
  const extraTimers: NodeJS.Timeout[] = [];
  let running = false;
  let stopped = false;

  async function syncGuild(guild: Guild): Promise<void> {
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

    invalidateChannelIndex(guild.id);

    const automod = await resolveModuleConfig(guild.id, "automod").catch(() => null);
    if (automod?.enabled && client) {
      await syncNativeKeywordRule(client, guild.id, automod.config, log);
    }

    log.info("servidor sincronizado", {
      guildId: guild.id,
      channels: guild.channels.cache.size,
      roles: guild.roles.cache.size
    });
  }

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

  /** Grava mensagens de canais de ticket para histórico/IA. */
  async function recordTicketMessage(message: Message): Promise<void> {
    if (!message.guild || message.author.bot || !message.content) return;
    const found = await getPool().query<{ id: number }>(
      `select id from tickets
       where guild_id = $1 and channel_id = $2 and status <> 'closed'
       limit 1`,
      [message.guild.id, message.channelId]
    );
    const ticketId = found.rows[0]?.id;
    if (!ticketId) return;

    const attachments = message.attachments.size
      ? [...message.attachments.values()].map((a) => ({
          id: a.id,
          name: a.name,
          url: a.url,
          contentType: a.contentType
        }))
      : [];

    await getPool().query(
      `insert into ticket_messages (ticket_id, author_id, author_name, content, attachments)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [
        ticketId,
        message.author.id,
        message.author.username,
        message.content.slice(0, 4000),
        JSON.stringify(attachments)
      ]
    );
  }

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

      const welcomeMsg = typeof config.config.welcomeMessage === "string" ? config.config.welcomeMessage.trim() : "";
      if (welcomeMsg) {
        await current.rest.post(Routes.channelMessages(channel.id), {
          body: { content: welcomeMsg.slice(0, 2000) }
        }).catch(() => undefined);
      }

      await interaction.editReply(`Atendimento aberto em <#${channel.id}>.`);
      log.info("atendimento aberto", { guildId: guild.id, ticketId, userId: interaction.user.id, department });

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

  // PLACEHOLDER_REMAINDER - will need full file
}
