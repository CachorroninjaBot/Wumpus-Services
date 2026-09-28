/**
 * Processo do bot. Só sobe se DISCORD_TOKEN estiver na Shard Cloud.
 * Escopo desta entrega: gateway online + /ping. Tickets reais vêm no próximo eixo.
 */
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.log("[bot] DISCORD_TOKEN ausente — bot não inicia.");
  process.exit(0);
}

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = await import("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once("ready", async () => {
  console.log(`[bot] online como ${client.user?.tag} em ${client.guilds.cache.size} servidor(es)`);
  const rest = new REST({ version: "10" }).setToken(token);
  const ping = new SlashCommandBuilder().setName("ping").setDescription("Wumpus no ar?");
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: [ping.toJSON()] });
  } catch (err) {
    console.error("[bot] falha ao registrar /ping", err?.message || err);
  }
});

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;
  if (i.commandName === "ping") {
    await i.reply({ content: `Pong. Shard ok. Guilds: ${client.guilds.cache.size}.`, ephemeral: true });
  }
});

client.login(token).catch((err) => {
  console.error("[bot] login falhou:", err?.message || err);
  process.exit(1);
});
