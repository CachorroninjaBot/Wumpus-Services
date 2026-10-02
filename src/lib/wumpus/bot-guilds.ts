/**
 * Em quais servidores o BOT esta de fato.
 *
 * Faltava esta pergunta. O OAuth devolve os servidores onde a PESSOA e admin,
 * nao onde o Wumpus foi instalado — por isso servidor sem o bot aparecia no
 * painel e "configurava" coisa que ninguem ia ler.
 *
 * Consulta a API do Discord com o token do bot (que fica no servidor, nunca no
 * cliente). O resultado e cacheado porque a lista muda raramente e isto roda a
 * cada carregamento de painel.
 */
import { createServerFn } from "@tanstack/react-start";

const TTL_MS = 60_000;

let cache: { ids: string[]; at: number } | null = null;

export async function loadBotGuildIds(): Promise<string[]> {
  const token = process.env.DISCORD_TOKEN || process.env.WUMPUS_DISCORD_TOKEN;
  if (!token) return [];

  const res = await fetch("https://discord.com/api/v10/users/@me/guilds?limit=200", {
    headers: { Authorization: `Bot ${token}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return [];

  const rows = (await res.json()) as Array<{ id?: string }>;
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => row.id).filter((id): id is string => typeof id === "string");
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
