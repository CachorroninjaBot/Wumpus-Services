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
import { getPool, resolveModuleConfig, upsertGuild } from "../server/db/index.js";
import {
  deactivateGuild,
  processPendingPublications,
  saveGuildSnapshot,
  type PublicationRow
} from "../server/db/publishing.js";
import { invalidateChannelIndex } from "../server/db/channel-refs.js";
import { analyzeTicket } from "./ai.js";
import { handleImageContent, handleMessage, syncNativeKeywordRule } from "./automod.js";
import { answerFromKnowledge, type KnowledgeConfig } from "./knowledge.js";
import { buildPanelPayload, defaultButtons, IS_COMPONENTS_V2, type PanelFormat } from "./panels.js";
import { handleAuditLogEntry, handleMemberAdd } from "./security.js";

export type BotLogger = {
  info: (message: string, extra?: Record<string, unknown>) => void;
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
    await interaction.deferReply({ ephemeral: true });

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
      const channel = await guild.channels.create({
        name: `atendimento-${interaction.user.username}`.slice(0, 90),
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

      await interaction.editReply(`Atendimento aberto em <#${channel.id}>.`);

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
    await interaction.deferReply({ ephemeral: true });

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

    // Feedback vai por DM: nao polui o canal e nao depende de permissao nele.
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

    await interaction.editReply("Atendimento encerrado. Obrigado!");
  }

  async function saveFeedback(interaction: Interaction, rawTicketId: string, score: string): Promise<void> {
    if (!interaction.isButton() || !interaction.guild) return;

    const ticketId = Number(rawTicketId);
    const value = Number(score);
    if (!Number.isSafeInteger(ticketId) || !Number.isInteger(value) || value < 1 || value > 5) {
      await interaction.reply({ content: "Nota inválida.", ephemeral: true });
      return;
    }

    await getPool().query(
      `insert into ticket_feedback (ticket_id, guild_id, score)
       values ($1, $2, $3)
       on conflict (ticket_id) do update set score = excluded.score, created_at = now()`,
      [ticketId, interaction.guild.id, value]
    );

    await interaction.reply({ content: `Obrigado! Registrei sua nota ${value}/5.`, ephemeral: true });
  }

  /**
   * Analise por IA: a resposta e efemera, entao apenas quem clicou ve.
   * Isso e o que garante, na pratica, que a IA nao responde ao cliente.
   */
  async function runAiAnalysis(interaction: Interaction, rawTicketId: string): Promise<void> {
    if (!interaction.isButton() || !interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });

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
        `-# Fontes: ${sources} · modelo ${result.model}`
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
          await interaction.reply({ content: "Em breve: assumir atendimento.", ephemeral: true });
        } else if (action === "ai" && rest[0] === "analyze") {
          await runAiAnalysis(interaction, rest[1] ?? "0");
        } else if (action === "feedback") {
          await saveFeedback(interaction, rest[0] ?? "0", rest[1] ?? "0");
        }
      } catch (error) {
        log.error("erro ao tratar interacao", { customId: interaction.customId, error: String(error) });
        if (interaction.isRepliable() && !interaction.replied) {
          await interaction
            .reply({ content: "Algo falhou ao processar esta ação.", ephemeral: true })
            .catch(() => undefined);
        }
      }
    });

    target.on(Events.GuildCreate, (guild) => {
      void syncGuild(guild).catch((error) =>
        log.error("falha ao sincronizar novo servidor", { error: String(error) })
      );
    });

    // Servidor que estava indisponivel voltou: agora sim conseguimos sincronizar.
    target.on(Events.GuildAvailable, (guild) => {
      void syncGuild(guild).catch((error) =>
        log.error("falha ao sincronizar servidor disponivel", { error: String(error) })
      );
    });

    target.on(Events.GuildDelete, (guild) => {
      void deactivateGuild(guild.id).catch(() => undefined);
    });

    target.on(Events.Error, (error) => log.error("erro no cliente do Discord", { error: String(error) }));

    if (capabilities.automod) {
      target.on(Events.MessageCreate, (message) => {
        void handleMessage(target, message, log).catch((error) =>
          log.error("falha no automod", { error: String(error) })
        );
        // Le imagens: o texto dentro delas escapa do filtro de texto.
        void handleImageContent(target, message, log).catch((error) =>
          log.error("falha no ocr", { error: String(error) })
        );
        // Responde pela base de conhecimento, quando o canal for o configurado.
        void handleKnowledge(message).catch((error) =>
          log.error("falha na base de conhecimento", { error: String(error) })
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

        log.error(
          `intents recusadas no nivel "${tier.mode}"; tentando um nivel mais basico. ` +
            "Habilite as intents no portal do Discord para restaurar a protecao completa.",
          {}
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