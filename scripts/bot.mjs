/**
 * Wumpus bot — lê data/wumpus-runtime.json publicado pelo painel.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.log("[bot] DISCORD_TOKEN ausente — bot não inicia.");
  process.exit(0);
}

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} = await import("discord.js");

const RUNTIME = process.env.WUMPUS_RUNTIME_PATH || join(process.cwd(), "data", "wumpus-runtime.json");

async function loadRuntime() {
  try {
    return JSON.parse(await readFile(RUNTIME, "utf8"));
  } catch {
    return { guilds: {} };
  }
}

function cfg(runtime, guildId, module, key, fallback) {
  const g = runtime.guilds?.[guildId]?.[module];
  if (!g || g[key] === undefined || g[key] === null) return fallback;
  return g[key];
}

const INVITE_RE = /(?:discord\.gg|discord\.com\/invite)\/[a-z0-9-]+/i;
const URL_RE = /https?:\/\/[^\s]+/i;

function scanAutomod(am, text, member) {
  const ignoredRoles = Array.isArray(am.ignoredRoleIds) ? am.ignoredRoleIds : [];
  if (member.roles.cache.some((r) => ignoredRoles.includes(r.id))) return null;
  if (am.blockInvites !== false && INVITE_RE.test(text)) return { rule: "convite", action: am.action || "delete" };
  const terms = (am.blockedTerms || []).map((t) => String(t).toLowerCase()).filter(Boolean);
  const lower = text.toLowerCase();
  const hit = terms.find((t) => lower.includes(t));
  if (hit) return { rule: `termo:${hit}`, action: am.action || "delete" };
  if (am.blockLinks && URL_RE.test(text)) {
    const allowed = (am.allowedDomains || []).map((d) => String(d).toLowerCase());
    const m = text.match(/https?:\/\/(?:www\.)?([^/\s]+)/i);
    const domain = m?.[1]?.toLowerCase() ?? "";
    const ok = allowed.some((d) => domain === d || domain.endsWith(`.${d}`));
    if (!ok) return { rule: "link", action: am.action || "delete" };
  }
  return null;
}

const joins = new Map();
const openTickets = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Wumpus no ar?"),
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Publicar o painel de tickets neste canal")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("form")
    .setDescription("Publicar o painel de candidaturas neste canal")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("mod")
    .setDescription("Moderação")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((s) =>
      s
        .setName("warn")
        .setDescription("Advertir")
        .addUserOption((o) => o.setName("alvo").setDescription("Membro").setRequired(true))
        .addStringOption((o) => o.setName("motivo").setDescription("Motivo").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("timeout")
        .setDescription("Silenciar")
        .addUserOption((o) => o.setName("alvo").setDescription("Membro").setRequired(true))
        .addIntegerOption((o) => o.setName("minutos").setDescription("Duração").setRequired(true))
        .addStringOption((o) => o.setName("motivo").setDescription("Motivo").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("kick")
        .setDescription("Expulsar")
        .addUserOption((o) => o.setName("alvo").setDescription("Membro").setRequired(true))
        .addStringOption((o) => o.setName("motivo").setDescription("Motivo").setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName("ban")
        .setDescription("Banir")
        .addUserOption((o) => o.setName("alvo").setDescription("Membro").setRequired(true))
        .addStringOption((o) => o.setName("motivo").setDescription("Motivo").setRequired(true)),
    ),
];

client.once("ready", async () => {
  console.log(`[bot] online como ${client.user.tag} · ${client.guilds.cache.size} guilds`);
  const rest = new REST({ version: "10" }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands.map((c) => c.toJSON()) });
    console.log("[bot] slash registrados: /ping /ticket /form /mod");
  } catch (err) {
    console.error("[bot] slash:", err.message || err);
  }
});

client.on("guildMemberAdd", async (member) => {
  const rt = await loadRuntime();
  const now = Date.now();
  const list = joins.get(member.guild.id) || [];
  list.push(now);
  const windowMs = Number(cfg(rt, member.guild.id, "security", "raidWindowSeconds", 60)) * 1000;
  const recent = list.filter((t) => now - t <= windowMs);
  joins.set(member.guild.id, recent);
  const threshold = Number(cfg(rt, member.guild.id, "security", "raidJoinThreshold", 12));
  if (recent.length >= threshold) {
    const alertId = cfg(rt, member.guild.id, "security", "alertChannelId", "");
    const ch = alertId ? member.guild.channels.cache.get(alertId) : member.guild.systemChannel;
    await ch?.send?.(`Alerta de raid: ${recent.length} entradas em ${windowMs / 1000}s.`);
  }
  const joinCh = cfg(rt, member.guild.id, "servers", "announceJoinChannelId", "");
  const msg = String(cfg(rt, member.guild.id, "servers", "joinMessage", "Bem-vindo(a), {user}."));
  const channel = joinCh ? member.guild.channels.cache.get(joinCh) : member.guild.systemChannel;
  await channel?.send?.(msg.replace("{user}", `<@${member.id}>`));
});

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;
  const rt = await loadRuntime();
  const am = rt.guilds?.[message.guild.id]?.automod;
  if (!am) return;
  const ignored = Array.isArray(am.ignoredChannelIds) ? am.ignoredChannelIds : [];
  if (ignored.includes(message.channel.id)) return;
  const hit = scanAutomod(am, message.content || "", message.member);
  if (!hit) return;
  try {
    await message.delete();
  } catch {
    /* perms */
  }
  if (hit.action === "timeout" || hit.action === "mute") {
    const min = Number(am.timeoutMinutes || 10);
    await message.member.timeout(min * 60_000, `automod:${hit.rule}`).catch(() => {});
  }
  const logId = am.logChannelId;
  const log = logId ? message.guild.channels.cache.get(logId) : null;
  await log?.send?.(`AutoMod · ${hit.rule} · ${message.author.tag} em <#${message.channel.id}>`);
});

client.on("interactionCreate", async (i) => {
  const rt = await loadRuntime();

  if (i.isChatInputCommand()) {
    if (i.commandName === "ping") {
      await i.reply({ content: `Pong. ${client.guilds.cache.size} servidor(es).`, ephemeral: true });
      return;
    }
    if (i.commandName === "ticket") {
      const deps = cfg(rt, i.guildId, "tickets", "departments", ["Suporte", "Denúncia"]);
      const title = cfg(rt, i.guildId, "tickets", "panelTitle", "Central de atendimento");
      const desc = cfg(rt, i.guildId, "tickets", "panelDescription", "Escolha o departamento.");
      const row = new ActionRowBuilder().addComponents(
        deps.slice(0, 5).map((d, idx) =>
          new ButtonBuilder().setCustomId(`tkt:open:${idx}`).setLabel(String(d)).setStyle(ButtonStyle.Primary),
        ),
      );
      await i.reply({
        embeds: [new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0x7c5cff)],
        components: [row],
      });
      return;
    }
    if (i.commandName === "form") {
      const title = cfg(rt, i.guildId, "forms", "panelTitle", "Candidaturas");
      const desc = cfg(rt, i.guildId, "forms", "panelDescription", "Envie pelo formulário.");
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("form:open").setLabel("Candidatar-se").setStyle(ButtonStyle.Primary),
      );
      await i.reply({
        embeds: [new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0x7c5cff)],
        components: [row],
      });
      return;
    }
    if (i.commandName === "mod") {
      const sub = i.options.getSubcommand();
      const alvo = i.options.getUser("alvo", true);
      const motivo = i.options.getString("motivo", true);
      const member = await i.guild.members.fetch(alvo.id).catch(() => null);
      if (!member) {
        await i.reply({ content: "Membro não encontrado.", ephemeral: true });
        return;
      }
      try {
        if (sub === "warn") {
          await alvo.send(`Advertência em **${i.guild.name}**: ${motivo}`).catch(() => {});
          await i.reply({ content: `Warn em ${alvo.tag}: ${motivo}` });
        } else if (sub === "timeout") {
          const min = i.options.getInteger("minutos", true);
          await member.timeout(min * 60_000, motivo);
          await i.reply({ content: `Timeout ${min} min em ${alvo.tag}: ${motivo}` });
        } else if (sub === "kick") {
          await member.kick(motivo);
          await i.reply({ content: `Kick em ${alvo.tag}: ${motivo}` });
        } else if (sub === "ban") {
          await member.ban({ reason: motivo, deleteMessageDays: 1 });
          await i.reply({ content: `Ban em ${alvo.tag}: ${motivo}` });
        }
      } catch (err) {
        await i.reply({ content: `Falha: ${err.message}`, ephemeral: true });
      }
      return;
    }
  }

  if (i.isButton() && i.customId.startsWith("tkt:open:")) {
    const idx = Number(i.customId.split(":")[2] || 0);
    const deps = cfg(rt, i.guildId, "tickets", "departments", ["Suporte"]);
    const dept = String(deps[idx] || deps[0] || "Suporte");
    const key = `${i.guildId}:${i.user.id}`;
    const maxOpen = Number(cfg(rt, i.guildId, "tickets", "maxOpenPerUser", 1));
    const current = openTickets.get(key) || 0;
    if (current >= maxOpen) {
      await i.reply({ content: `Você já tem ${maxOpen} atendimento(s) aberto(s).`, ephemeral: true });
      return;
    }
    const catId = cfg(rt, i.guildId, "tickets", "categoryId", null);
    const staff = cfg(rt, i.guildId, "tickets", "staffRoleIds", []);
    const welcome = String(cfg(rt, i.guildId, "tickets", "welcomeMessage", "Descreva o que você precisa."));
    const name = `atendimento-${i.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 90);
    const overwrites = [
      { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      { id: i.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
    ];
    for (const roleId of staff) {
      overwrites.push({
        id: roleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      });
    }
    try {
      const ch = await i.guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: typeof catId === "string" && catId.startsWith("cat_") ? undefined : catId || undefined,
        permissionOverwrites: overwrites,
      });
      openTickets.set(key, current + 1);
      const close = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tkt:close:${i.user.id}`).setLabel("Encerrar").setStyle(ButtonStyle.Danger),
      );
      await ch.send({
        content: `<@${i.user.id}> · **${dept}**\n${welcome}`,
        components: [close],
      });
      await i.reply({ content: `Ticket aberto em ${ch}`, ephemeral: true });
    } catch (err) {
      await i.reply({ content: `Não consegui criar o canal: ${err.message}`, ephemeral: true });
    }
    return;
  }

  if (i.isButton() && i.customId.startsWith("tkt:close:")) {
    const opener = i.customId.split(":")[2];
    const staffIds = cfg(rt, i.guildId, "tickets", "staffRoleIds", []);
    const isStaff = i.member.roles.cache.some((r) => staffIds.includes(r.id)) || i.member.permissions.has(PermissionFlagsBits.ManageChannels);
    if (i.user.id !== opener && !isStaff) {
      await i.reply({ content: "Só quem abriu ou a equipe pode encerrar.", ephemeral: true });
      return;
    }
    const msgs = await i.channel.messages.fetch({ limit: 50 });
    const transcript = [...msgs.values()]
      .reverse()
      .map((m) => `${m.author.tag}: ${m.content}`)
      .join("\n");
    const tCh = cfg(rt, i.guildId, "tickets", "transcriptChannelId", "");
    const dest = tCh ? i.guild.channels.cache.get(tCh) : null;
    if (dest) {
      await dest.send(`Transcrição de ${i.channel.name}\n\`\`\`\n${transcript.slice(0, 1800)}\n\`\`\``).catch(() => {});
    }
    const key = `${i.guildId}:${opener}`;
    openTickets.set(key, Math.max(0, (openTickets.get(key) || 1) - 1));
    await i.reply({ content: "Encerrando canal em 3s…" });
    setTimeout(() => i.channel.delete("ticket encerrado").catch(() => {}), 3000);
    return;
  }

  if (i.isButton() && i.customId === "form:open") {
    const questions = cfg(rt, i.guildId, "forms", "questions", [
      "Qual o seu nome ou apelido?",
      "Por que quer fazer parte da equipe?",
      "Qual a sua experiência relevante?",
    ]);
    const modal = new ModalBuilder().setCustomId("form:submit").setTitle("Candidatura");
    for (const [idx, q] of questions.slice(0, 5).entries()) {
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(`q${idx}`)
            .setLabel(String(q).slice(0, 45))
            .setStyle(idx === 0 ? TextInputStyle.Short : TextInputStyle.Paragraph)
            .setRequired(true),
        ),
      );
    }
    await i.showModal(modal);
    return;
  }

  if (i.isModalSubmit() && i.customId === "form:submit") {
    const questions = cfg(rt, i.guildId, "forms", "questions", []);
    const lines = i.fields.fields.map((f, idx) => `**${questions[idx] || f.customId}**\n${f.value}`);
    const reviewId = cfg(rt, i.guildId, "forms", "reviewChannelId", "");
    const ch = reviewId ? i.guild.channels.cache.get(reviewId) : i.channel;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`form:ok:${i.user.id}`).setLabel("Aprovar").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`form:no:${i.user.id}`).setLabel("Recusar").setStyle(ButtonStyle.Danger),
    );
    await ch?.send?.({
      content: `Candidatura de <@${i.user.id}>`,
      embeds: [new EmbedBuilder().setDescription(lines.join("\n\n")).setColor(0x7c5cff)],
      components: [row],
    });
    await i.reply({ content: "Candidatura enviada.", ephemeral: true });
    return;
  }

  if (i.isButton() && (i.customId.startsWith("form:ok:") || i.customId.startsWith("form:no:"))) {
    const [kind, , userId] = i.customId.split(":");
    const ok = kind === "ok";
    await i.update({
      content: `${ok ? "Aprovada" : "Recusada"} por <@${i.user.id}> · <@${userId}>`,
      components: [],
    });
    const user = await client.users.fetch(userId).catch(() => null);
    await user?.send(`Sua candidatura em **${i.guild.name}** foi ${ok ? "aprovada" : "recusada"}.`).catch(() => {});
  }
});

client.login(token).catch((err) => {
  console.error("[bot] login falhou:", err.message || err);
  process.exit(1);
});
