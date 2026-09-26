import type { ModuleId } from "../../core/brand.js";
import {
  channelRefsFor,
  isSnowflake,
  normalizeChannelName,
  normalizeRoleName,
  roleRefsFor
} from "../../core/channel-refs.js";
import { listGuildAssets } from "./publishing.js";

/**
 * Traduz NOMES de canais e cargos para os IDs reais, por servidor.
 *
 * Por que isto existe: a configuracao principal e do GRUPO, e um grupo cobre
 * varios servidores — cada um com canais e cargos diferentes. Guardar um ID no
 * grupo seria valido em no maximo um servidor. Guardando o NOME, o mesmo grupo
 * funciona em todos: cada servidor resolve "logs" para o seu proprio canal.
 *
 * Se um nome nao existir no servidor, o valor e mantido como esta. Preferimos
 * deixar o nome visivel na dashboard a resolver para nada e o bot ficar mudo
 * sem explicacao.
 */

const CACHE_TTL_MS = 30_000;
const TEXT_TYPES = [0, 5, 15];
const CATEGORY_TYPE = 4;

type Index = { text: Map<string, string>; category: Map<string, string>; role: Map<string, string> };
type CacheEntry = { index: Index; at: number };

/**
 * Cache curto por servidor: o bot resolve configuracao a cada mensagem, e sem
 * isto um grupo configurado por nome faria uma consulta por mensagem.
 */
const cache = new Map<string, CacheEntry>();

async function buildIndex(guildId: string): Promise<Index> {
  const text = new Map<string, string>();
  const category = new Map<string, string>();
  const role = new Map<string, string>();

  const assets = await listGuildAssets(guildId);
  for (const channel of assets.channels) {
    const key = normalizeChannelName(channel.name);
    if (!key) continue;
    if (channel.type === CATEGORY_TYPE) {
      if (!category.has(key)) category.set(key, channel.id);
    } else if (TEXT_TYPES.includes(channel.type)) {
      if (!text.has(key)) text.set(key, channel.id);
    }
  }

  for (const entry of assets.roles) {
    // Cargos de integracao nao fazem sentido como equipe nem como confianca.
    if (entry.managed) continue;
    const key = normalizeRoleName(entry.name);
    if (key && !role.has(key)) role.set(key, entry.id);
  }

  return { text, category, role };
}

async function indexFor(guildId: string): Promise<Index> {
  const now = Date.now();
  const hit = cache.get(guildId);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.index;

  let index: Index;
  try {
    index = await buildIndex(guildId);
  } catch {
    // Falha de leitura: indices vazios e NADA e alterado. Nao guardamos no
    // cache de proposito — assim a proxima tentativa recupera na hora, em vez
    // de servir "sem canais" por 30s depois de um tropeco momentaneo.
    return { text: new Map(), category: new Map(), role: new Map() };
  }

  // O mesmo vale para um servidor que o bot ainda nao sincronizou: cachear o
  // vazio faria a configuracao por nome ficar sem efeito logo apos o primeiro
  // sync. So cacheamos quando ha algo util para reaproveitar.
  if (index.text.size || index.category.size || index.role.size) {
    cache.set(guildId, { index, at: now });
  }

  return index;
}

/** Descarta o cache: chamado quando o bot ressincroniza canais e cargos. */
export function invalidateChannelIndex(guildId?: string): void {
  if (guildId) cache.delete(guildId);
  else cache.clear();
}

/** Um valor e "nome" quando nao esta vazio e nao e um ID numerico. */
function isName(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "" && !isSnowflake(value);
}

/**
 * Substitui nomes de canal e de cargo pelos IDs daquele servidor.
 *
 * So consulta o snapshot quando ha de fato um nome para resolver: com IDs
 * (o caso comum) nao custa nenhuma consulta adicional.
 */
export async function resolveConfigRefs(
  guildId: string,
  module: ModuleId,
  config: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const channelKeys = channelRefsFor(module);
  const roleKeys = roleRefsFor(module);
  if (!channelKeys.length && !roleKeys.length) return config;

  const pendingChannels = channelKeys.filter((ref) => isName(config[ref.key]));
  const pendingRoles = roleKeys.filter((key) => {
    const value = config[key];
    return Array.isArray(value) && value.some((entry) => isName(entry));
  });
  if (!pendingChannels.length && !pendingRoles.length) return config;

  const index = await indexFor(guildId);
  const resolved = { ...config };

  for (const ref of pendingChannels) {
    const key = normalizeChannelName(String(config[ref.key]));
    const found = ref.kind === "category" ? index.category.get(key) : index.text.get(key);
    // Nao encontrado: mantemos o nome original, para a dashboard exibir.
    if (found) resolved[ref.key] = found;
  }

  for (const key of pendingRoles) {
    const list = config[key] as unknown[];
    // Resolvemos item a item: a lista pode misturar IDs ja definidos e nomes.
    resolved[key] = list.map((entry) => {
      if (!isName(entry)) return entry;
      return index.role.get(normalizeRoleName(String(entry))) ?? entry;
    });
  }

  return resolved;
}
