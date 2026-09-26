import { createBot, type BotHandle, type BotLogger } from "./client.js";
import { syncNativeKeywordRule } from "./automod.js";
import { resolveModuleConfig } from "../server/db/index.js";

/**
 * O bot vive no mesmo processo do dashboard, mas e OPCIONAL.
 *
 * Sem WUMPUS_DISCORD_TOKEN o servidor sobe normalmente e serve a dashboard:
 * isso permite desenvolver e testar a interface sem o token de producao.
 * Quando o token e configurado, o bot conecta e assume a fila de publicacoes.
 */

let handle: BotHandle | null = null;
let logger: BotLogger | null = null;

export function startBot(log: BotLogger): BotHandle | null {
  logger = log;
  const token = process.env.WUMPUS_DISCORD_TOKEN;
  if (!token) {
    log.info("bot nao iniciado: WUMPUS_DISCORD_TOKEN ainda nao configurada");
    return null;
  }
  handle = createBot(token, log);
  return handle;
}

/**
 * Estado do bot para o endpoint de status. Informa separadamente o que esta
 * de fato armado: o automod depende de uma intent que o anti-raid nao usa,
 * entao os dois podem estar em estados diferentes.
 */
export function botStatus(): { running: boolean; mode: string; security: string; automod: string } {
  const mode = handle?.mode ?? null;
  return {
    running: Boolean(handle?.client),
    mode: mode ?? "off",
    security: mode === "full" || mode === "security_only" ? "armed" : "off",
    automod: mode === "full" ? "armed" : "off"
  };
}

/**
 * Reaplica as regras nativas do AutoMod em todos os servidores.
 *
 * Chamado quando a dashboard salva configuracao de automod: sem isso, um termo
 * bloqueado novo so chegaria ao Discord no proximo reinicio do bot. Cada
 * servidor resolve a propria configuracao (grupo + excecao), entao um grupo
 * nunca sobrescreve a excecao de um servidor.
 */
export async function resyncAutomod(): Promise<number> {
  const client = handle?.client;
  if (!client || !logger) return 0;

  let synced = 0;
  for (const guild of client.guilds.cache.values()) {
    try {
      const config = await resolveModuleConfig(guild.id, "automod");
      await syncNativeKeywordRule(client, guild.id, config.enabled ? config.config : {}, logger);
      synced += 1;
    } catch {
      // Um servidor com falha nao impede a sincronizacao dos outros.
    }
  }
  return synced;
}

export async function stopBot(): Promise<void> {
  if (!handle) return;
  await handle.stop();
  handle = null;
}
