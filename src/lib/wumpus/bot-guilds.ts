/**
 * Em quais servidores o BOT esta de fato.
 *
 * Faltava esta pergunta. O OAuth devolve os servidores onde a PESSOA e admin,
 * nao onde o Wumpus foi instalado — por isso servidor sem o bot aparecia no
 * painel e "configurava" coisa que ninguem ia ler.
 *
 * A lista e publicada pelo processo do bot no arquivo compartilhado de saúde.
 * O token do bot não oferece uma lista de guildas por essa rota OAuth: ela
 * exige um token de usuário com o escopo `guilds`.
 */
import { createServerFn } from "@tanstack/react-start";
import { readBotHealth } from "./health.server";

const TTL_MS = 60_000;

let cache: { ids: string[]; at: number } | null = null;

export async function loadBotGuildIds(): Promise<string[]> {
  const health = await readBotHealth();
  if (!health || health.status !== "online" || Date.now() - health.at > 90_000) return [];
  return health.guildIds;
}

/**
 * Lista de ids dos servidores com o bot.
 *
 * Em falha devolve `[]` em vez de lancar: sem a lista o painel fica vazio, mas
 * continua de pe. Derrubar a dashboard porque a API do Discord oscilou seria
 * pior — e um painel vazio e um sintoma visivel, nao um erro silencioso.
 */
export const getBotGuildIds = createServerFn({ method: "GET" }).handler(async (): Promise<string[]> => {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.ids;

  try {
    const ids = await loadBotGuildIds();
    cache = { ids, at: Date.now() };
    return ids;
  } catch {
    return cache?.ids ?? [];
  }
});
