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
import { readBotHealth } from "./health.server";

export async function loadBotGuildIds(): Promise<string[]> {
  const health = await readBotHealth();
  if (!health || health.status !== "online" || Date.now() - health.at > 90_000) return [];
  return health.guildIds;
}
