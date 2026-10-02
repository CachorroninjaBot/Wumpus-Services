/**
 * Resolucao de referencias de configuracao.
 *
 * O painel NAO guarda IDs do Discord. Guarda nomes — "ch_logs", "role_staff" —
 * porque a configuracao e por GRUPO e um grupo cobre varios servidores, cada um
 * com os seus proprios canais e cargos. Um ID fixo so valeria em um servidor.
 *
 * Este modulo traduz nome -> objeto real daquele servidor. Sem ele, todo campo
 * que aponta para canal ou cargo e silenciosamente inutil: `cache.get("ch_logs")`
 * devolve undefined, porque o cache indexa por snowflake.
 *
 * Aceita snowflake tambem, para quem preferir configurar por ID.
 */
import type { Guild, GuildBasedChannel, Role } from "discord.js";

const TTL_MS = 60_000;

type Entry<T> = { value: T | null; at: number };

const channelCache = new Map<string, Entry<GuildBasedChannel>>();
const roleCache = new Map<string, Entry<Role>>();

/** Um ID do Discord e puramente numerico e longo; qualquer outra coisa e nome. */
export function isSnowflake(value: unknown): boolean {
  return typeof value === "string" && /^\d{17,20}$/.test(value.trim());
}

/** Normaliza para comparacao: sem "#"/"@", sem espacos nas pontas, minusculo. */
export function normalize(value: string): string {
  return value.replace(/^[#@]/, "").trim().toLowerCase();
}

function lookupChannel(guild: Guild, ref: string): GuildBasedChannel | null {
  const raw = ref.trim();
  if (!raw) return null;
  if (isSnowflake(raw)) return guild.channels.cache.get(raw) ?? null;

  const want = normalize(raw);
  const all = [...guild.channels.cache.values()];
  return (
    all.find((channel) => normalize(channel.name) === want) ??
    all.find((channel) => normalize(channel.name).replace(/[-_]/g, "") === want.replace(/[-_]/g, "")) ??
    null
  );
}

function lookupRole(guild: Guild, ref: string): Role | null {
  const raw = ref.trim();
  if (!raw) return null;
  if (isSnowflake(raw)) return guild.roles.cache.get(raw) ?? null;

  const want = normalize(raw);
  const all = [...guild.roles.cache.values()];
  return (
    all.find((role) => normalize(role.name) === want) ??
    all.find((role) => normalize(role.name).replace(/[-_]/g, "") === want.replace(/[-_]/g, "")) ??
    null
  );
}

/**
 * Canal configurado. `null` quando o painel deixou em branco OU quando o nome
 * nao existe naquele servidor — os dois casos significam "nao fazer nada",
 * nunca "fazer em outro lugar".
 */
export function resolveChannel(guild: Guild, ref: string | null | undefined): GuildBasedChannel | null {
  if (!ref) return null;
  const key = `${guild.id}:c:${ref}`;
  const hit = channelCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const value = lookupChannel(guild, ref);
  channelCache.set(key, { value, at: Date.now() });
  return value;
}

export function resolveRole(guild: Guild, ref: string | null | undefined): Role | null {
  if (!ref) return null;
  const key = `${guild.id}:r:${ref}`;
  const hit = roleCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const value = lookupRole(guild, ref);
  roleCache.set(key, { value, at: Date.now() });
  return value;
}

/** Resolve uma lista de referencias, descartando as que nao existem naquele servidor. */
export function resolveRoles(guild: Guild, refs: string[]): Role[] {
  const out: Role[] = [];
  for (const ref of refs) {
    const role = resolveRole(guild, ref);
    if (role) out.push(role);
  }
  return out;
}

/**
 * Descarta o cache de um servidor. Chamado quando canais ou cargos mudam —
 * sem isso, um canal renomeado continuaria resolvendo para o objeto antigo.
 */
export function invalidateGuild(guildId: string): void {
  for (const key of [...channelCache.keys()]) {
    if (key.startsWith(`${guildId}:`)) channelCache.delete(key);
  }
  for (const key of [...roleCache.keys()]) {
    if (key.startsWith(`${guildId}:`)) roleCache.delete(key);
  }
}

/** Mensagem devolvida por `send` — o minimo que os handlers usam. */
export type SendableMessage = {
  id: string;
  channelId: string;
  delete: () => Promise<unknown>;
};

/**
 * Canal que realmente aceita envio.
 *
 * O union `Channel` do discord.js inclui `PartialGroupDMChannel`, que NAO tem
 * `send` — entao `isTextBased()` nao estreita o suficiente para o compilador.
 * Este guard checa a capacidade de verdade em vez de confiar no tipo, e devolve
 * `null` quando o canal nao serve — melhor nao falar do que estourar no meio de
 * um handler.
 */
export type Sendable = {
  id: string;
  /** Aceita texto simples ou um objeto de mensagem (com components/flags). */
  send: (options: string | Record<string, unknown>) => Promise<SendableMessage>;
  sendTyping?: () => Promise<void>;
};

export function asSendable(channel: unknown): Sendable | null {
  if (!channel || typeof channel !== "object") return null;
  const candidate = channel as Partial<Sendable>;
  return typeof candidate.send === "function" ? (candidate as Sendable) : null;
}
