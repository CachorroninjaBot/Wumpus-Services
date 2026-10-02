/**
 * Ponto de entrada do bot — eventos e despacho.
 *
 * Substitui o `scripts/bot.mjs` monolítico. Cada evento aqui e so encanamento:
 * a regra vive no modulo correspondente (tickets, forms, moderation, automod,
 * security, logs), entao da para testar cada um sem subir o Discord.
 *
 * Diferente do bot antigo, a config e lida do runtime publicado pelo painel —
 * e o `/config status` mostra exatamente o que foi lido, para o caso de o
 * painel e o bot discordarem.
 */
import {
  ActionRowBuilder,
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ButtonInteraction,
  type Guild,
  type Interaction,
  type Message,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction
} from "discord.js";
import { handleGhostPing, handleImageContent, handleMessage } from "./automod.ts";
import { handleCommand, registerCommands } from "./commands.ts";
import { list, moduleConfig } from "./config.ts";
import { buildFormModal, handleFormSelect, openForm, parseFields, readDraft, reviewForm, submitForm } from "./forms.ts";
import { id, parseId } from "./ids.ts";
import { handleKnowledgeMessage } from "./knowledge.ts";
import { consoleLogger, type Logger } from "./logger.ts";
import { pruneAudit } from "./logs.ts";
import { applyDefaultRole, removeManagedRolesOnLeave } from "./roles.ts";
import { checkInactivity, checkOverload } from "./staff.ts";
import { bump, maybeSendDigest, pruneStatistics } from "./statistics.ts";
import {
  claimTicket,
  checkSla,
  closeTicket,
  openTicket,
  recordFeedback,
  recordTicketMessage,
  reopenClosedTicket,
  setTicketPriority
} from "./tickets.ts";
import { handleAuditLogEntry, handleMemberAdd } from "./security.ts";
import { processOutbox } from "./outbox-send.ts";

export type BotHandle = {
  client: Client;
  stop: () => Promise<void>;
};

const SLA_INTERVAL_MS = 5 * 60_000;
const PRUNE_INTERVAL_MS = 6 * 60 * 60_000;

/** Permissoes que o bot precisa. Sem elas, os modulos falham em silencio. */
export const INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildModeration,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent
];

async function respond(interaction: Interaction, content: string): Promise<void> {
  try {
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content });
      else await interaction.reply({ content, ephemeral: true });
    }
  } catch {
    // Interacao expirada: nada a fazer.
  }
}

/**
 * Select de departamento — o padrao que tickets.bot e tickettool usam.
 *
 * Antes eram botoes: cada departamento virava um botao, e o Discord limita a 5
 * por linha. Com select cabem 25, da para por descricao em cada opcao, e a
 * escolha fica num unico controle em vez de uma fileira de botoes.
 */
async function promptDepartment(interaction: ButtonInteraction, log: Logger): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const config = await moduleConfig(guild.id, "tickets");
  const departments = list(config, "departments").filter(Boolean).slice(0, 25);

  if (departments.length <= 1) {
    await interaction.deferReply({ ephemeral: true });
    const result = await openTicket(guild, interaction.user.id, departments[0] ?? null, log);
    await interaction.editReply(result.ok ? `Atendimento aberto em <#${result.channelId}>.` : result.error);
    return;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(id("ticket", "dept"))
    .setPlaceholder("Escolha o departamento")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      departments.map((department) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(department.slice(0, 100))
          .setValue(department.slice(0, 100))
      )
    );

  await interaction.reply({
    content: "Escolha o departamento para abrir o atendimento:",
    ephemeral: true,
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)]
  });
}

/** Abre o atendimento no departamento escolhido no select. */
async function handleDepartmentSelect(
  interaction: StringSelectMenuInteraction,
  log: Logger
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const department = interaction.values[0] ?? null;

  await interaction.deferReply({ ephemeral: true });
  const result = await openTicket(guild, interaction.user.id, department, log);
  await interaction.editReply(
    result.ok ? `Atendimento aberto em <#${result.channelId}>.` : result.error
  );
}

async function handleButton(interaction: ButtonInteraction, log: Logger): Promise<void> {
  const parsed = parseId(interaction.customId);
  if (!parsed) return;

  const guild = interaction.guild;
  if (!guild) return;

  const { kind, action, args } = parsed;

  if (kind === "ticket" && action === "open") {
    await promptDepartment(interaction, log);
    return;
  }

  if (kind === "ticket" && action === "claim") {
    const ticketId = Number(args[0]);
    await interaction.deferReply({ ephemeral: true });
    const result = await claimTicket(guild, ticketId, interaction.user.id, log);

    if (result.alreadyBy) await interaction.editReply(`<@${result.alreadyBy}> ja assumiu este atendimento.`);
    else if (result.ok) await interaction.editReply("Voce assumiu o atendimento.");
    else await interaction.editReply("Nao foi possivel assumir este atendimento.");
    return;
  }

  if (kind === "ticket" && action === "close") {
    const ticketId = Number(args[0]);
    await interaction.deferReply({ ephemeral: true });
    const result = await closeTicket(guild, ticketId, interaction.user.id, log);
    await interaction.editReply(result.ok ? "Atendimento encerrado." : "Este atendimento ja estava encerrado.");
    return;
  }

  if (kind === "ticket" && action === "rate") {
    const ticketId = Number(args[0]);
    const rating = Number(args[1]);
    await recordFeedback(guild.id, ticketId, rating, log);
    await interaction.update({ content: `Obrigado! Nota **${rating}/5** registrada.`, components: [] });
    return;
  }

  if (kind === "ticket" && action === "prior") {
    const ticketId = Number(args[0]);
    const priority = args[1] ?? "normal";
    const applied = await setTicketPriority(guild, ticketId, priority, interaction.user.id, log);
    await interaction.reply({
      content: applied
        ? `Prioridade do atendimento **#${ticketId}** agora e **${priority}**.`
        : "Este atendimento nao existe ou ja foi encerrado.",
      ephemeral: true
    });
    return;
  }

  if (kind === "ticket" && action === "reopen") {
    const ticketId = Number(args[0]);
    await interaction.deferReply({ ephemeral: true });
    const result = await reopenClosedTicket(guild, ticketId, interaction.user.id, log);
    await interaction.editReply(
      result.ok ? `Atendimento reaberto em <#${result.channelId}>.` : (result.error ?? "Nao foi possivel reabrir.")
    );
    return;
  }

  if (kind === "form" && action === "open") {
    // Duas etapas: se o formulario tem selecoes, elas vem antes do modal.
    await openForm(interaction, log);
    return;
  }

  if (kind === "form" && action === "continue") {
    // Terminou de escolher: abre o modal levando as escolhas do rascunho.
    const config = await moduleConfig(guild.id, "forms");
    const draft = await readDraft(guild.id, interaction.user.id);
    await interaction.showModal(buildFormModal(parseFields(config), id("form", "submit"), draft?.values ?? {}));
    return;
  }

  if (kind === "form" && (action === "approve" || action === "reject")) {
    const submissionId = Number(args[0]);

    if (action === "approve") {
      await interaction.deferReply({ ephemeral: true });
      const result = await reviewForm(guild, submissionId, interaction.user.id, "approved", null, log);
      await interaction.editReply(result.ok ? "Candidatura aprovada." : (result.error ?? "Falhou."));
      return;
    }

    // Recusa pede motivo: abre modal com um campo.
    const modal = {
      title: "Recusar candidatura",
      custom_id: id("form", "rejectreason", submissionId),
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "motivo",
              label: "Motivo da recusa",
              style: 2,
              required: true,
              max_length: 500
            }
          ]
        }
      ]
    };

    await interaction.showModal(modal as never);
    return;
  }
}

async function handleModal(interaction: ModalSubmitInteraction, log: Logger): Promise<void> {
  const parsed = parseId(interaction.customId);
  if (!parsed) return;

  const guild = interaction.guild;
  if (!guild) return;

  const { kind, action, args } = parsed;

  if (kind === "form" && action === "submit") {
    await interaction.deferReply({ ephemeral: true });
    const result = await submitForm(interaction, log);
    await interaction.editReply(result.ok ? "Candidatura enviada. Boa sorte!" : result.error);
    return;
  }

  if (kind === "form" && action === "rejectreason") {
    const submissionId = Number(args[0]);
    const reason = interaction.fields.getTextInputValue("motivo");

    await interaction.deferReply({ ephemeral: true });
    const result = await reviewForm(guild, submissionId, interaction.user.id, "rejected", reason, log);
    await interaction.editReply(result.ok ? "Candidatura recusada." : (result.error ?? "Falhou."));
  }
}

export function createBot(token: string, log: Logger = consoleLogger): BotHandle {
  const client = new Client({ intents: INTENTS, partials: [Partials.Channel, Partials.Message] });

  client.once(Events.ClientReady, async () => {
    log.info("online", { user: client.user?.tag, guilds: client.guilds.cache.size });
    if (client.user) await registerCommands(client.user.id, token, log);
  });

  client.on(Events.GuildCreate, (guild: Guild) => {
    log.info("entrou em servidor", { guildId: guild.id, name: guild.name, members: guild.memberCount });
  });

  client.on(Events.GuildMemberAdd, (member) => {
    void handleMemberAdd(member, log).catch((error) =>
      log.error("falha no anti-raid", { error: String(error) })
    );
    // Cargo padrao: o campo existe no painel desde o inicio e nunca aplicava.
    void applyDefaultRole(member, log).catch((error) =>
      log.error("falha ao aplicar cargo padrao", { error: String(error) })
    );
    void bump(member.guild.id, "joins").catch(() => undefined);
  });

  client.on(Events.GuildMemberRemove, (member) => {
    void removeManagedRolesOnLeave(member.guild, member, log).catch(() => undefined);
    void bump(member.guild.id, "leaves").catch(() => undefined);
  });

  client.on(Events.MessageCreate, (message: Message) => {
    if (message.author.bot || !message.guild) return;

    void handleMessage(message, log).catch((error) =>
      log.error("falha no automod", { error: String(error) })
    );
    void handleImageContent(message, log).catch((error) =>
      log.error("falha no automod de imagem", { error: String(error) })
    );
    void recordTicketMessage(message).catch(() => undefined);
    void bump(message.guild.id, "messages").catch(() => undefined);
    void handleKnowledgeMessage(message, log).catch((error) =>
      log.error("falha na base de conhecimento", { error: String(error) })
    );
  });

  client.on(Events.MessageDelete, (message) => {
    if (!message.guild || message.author?.bot) return;
    void handleGhostPing(message, log).catch(() => undefined);
  });

  // Sem anotacao de tipo: o evento ja carrega a assinatura correta, e
  // `GuildAuditLogEntryCreateAction` nao existe como export no discord.js.
  client.on(Events.GuildAuditLogEntryCreate, (entry, guild) => {
    void handleAuditLogEntry(guild, entry, log).catch(() => undefined);
  });

  client.on(Events.InteractionCreate, (interaction: Interaction) => {
    void (async () => {
      try {
        if (interaction.isChatInputCommand()) {
          await handleCommand(interaction, log);
          return;
        }
        if (interaction.isButton()) {
          await handleButton(interaction, log);
          return;
        }
        if (interaction.isStringSelectMenu()) {
          const parsed = parseId(interaction.customId);
          if (parsed?.kind === "form" && parsed.action === "pick") {
            await handleFormSelect(interaction, parsed.args[0] ?? "", log);
          } else if (parsed?.kind === "ticket" && parsed.action === "dept") {
            await handleDepartmentSelect(interaction, log);
          }
          return;
        }
        if (interaction.isModalSubmit()) {
          await handleModal(interaction, log);
        }
      } catch (error) {
        log.error("falha ao tratar interacao", {
          kind: interaction.type,
          error: String(error)
        });
        await respond(interaction, "Algo falhou do meu lado. A equipe foi avisada pelo log.");
      }
    })();
  });

  // SLA + fechamento automatico (vencimento e inatividade): um ciclo so,
  // porque os dois leem os mesmos tickets e um encerrado sai da conta do SLA.
  // Aproveita o mesmo ciclo para carga da equipe e digest — todos olham tickets.
  const slaTimer = setInterval(() => {
    void (async () => {
      for (const guild of client.guilds.cache.values()) {
        await checkSla(guild, log).catch(() => 0);
        await checkOverload(guild, log).catch(() => 0);
        await maybeSendDigest(guild, log).catch(() => false);
      }
    })();
  }, SLA_INTERVAL_MS);

  // Poda: auditoria e estatisticas, para os arquivos nao crescerem para sempre.
  const pruneTimer = setInterval(() => {
    void (async () => {
      await pruneAudit(log).catch(() => 0);
      for (const guild of client.guilds.cache.values()) {
        await pruneStatistics(guild.id, log).catch(() => 0);
      }
    })();
  }, PRUNE_INTERVAL_MS);

  // Fila de saida: o painel pede, o bot publica. Roda a cada 20s porque e a
  // unica forma de "Publicar painel" na dashboard chegar a um canal de verdade
  // — o painel nao tem conexao com o gateway do Discord.
  const outboxTimer = setInterval(() => {
    void (async () => {
      for (const guild of client.guilds.cache.values()) {
        await processOutbox(guild, log).catch(() => 0);
      }
    })();
  }, 20_000);

  // Uma passada logo apos conectar, para nao esperar o primeiro intervalo.
  client.once(Events.ClientReady, () => {
    void (async () => {
      for (const guild of client.guilds.cache.values()) {
        await processOutbox(guild, log).catch(() => 0);
      }
    })();
  });

  // Inatividade da equipe roda uma vez por dia — nao precisa de mais que isso.
  const inactivityTimer = setInterval(() => {
    void (async () => {
      for (const guild of client.guilds.cache.values()) {
        await checkInactivity(guild, log).catch(() => 0);
      }
    })();
  }, 24 * 60 * 60_000);

  const stop = async (): Promise<void> => {
    clearInterval(slaTimer);
    clearInterval(pruneTimer);
    clearInterval(inactivityTimer);
    clearInterval(outboxTimer);
    await client.destroy();
    log.info("desconectado");
  };

  void client.login(token).catch((error) => {
    log.error("login falhou", { error: String(error) });
    process.exitCode = 1;
  });

  return { client, stop };
}

/**
 * Sobe o bot se houver token. Sem token o processo nao morre — quem sobe o
 * painel nao pode ser derrubado por falta de credencial do bot.
 */
export function startBot(token = process.env.DISCORD_TOKEN ?? process.env.WUMPUS_DISCORD_TOKEN, log: Logger = consoleLogger): BotHandle | null {
  if (!token) {
    log.info("sem token do Discord — bot nao iniciado");
    return null;
  }
  return createBot(token, log);
}

// Execucao direta: `node --experimental-strip-types src/bot/index.ts`
if (process.argv[1] && process.argv[1].endsWith("bot/index.ts")) {
  startBot();
}
