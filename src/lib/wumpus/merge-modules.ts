/**
 * Merge de defaults dos modulos.
 *
 * O hydrate fazia `set({ ...base, ...parsed })`. Como `parsed.modules`
 * substitui `base.modules` INTEIRO, toda chave nova de padrao ficava invisivel
 * para quem ja tinha estado salvo no navegador: o campo nascia so para quem
 * abrisse a dashboard pela primeira vez.
 *
 * Foi exatamente o que aconteceu com `fields` no formulario — o construtor
 * novo gravava, mas o estado antigo nao tinha a chave, entao o bot caia no
 * fallback e a tela parecia nao ter efeito.
 *
 * Aqui o padrao entra POR BAIXO do que esta salvo: chave nova aparece, e o
 * valor que o cliente configurou continua ganhando.
 */
import { defaultsFor, moduleDefaults, type ModuleKey } from "./defaults.ts";
import type { GuildModules } from "./types";

const MODULE_KEYS = Object.keys(moduleDefaults) as ModuleKey[];

/**
 * Normaliza um servidor: todo modulo conhecido existe, com o padrao preenchido
 * e o que foi salvo por cima.
 *
 * O merge e raso de proposito. `config` guarda listas e objetos que o cliente
 * monta inteiros (as perguntas do formulario, por exemplo) — mesclar dentro
 * deles produziria listas misturadas, que e pior que substituir.
 */
export function mergeGuildModules(saved: GuildModules | undefined): GuildModules {
  const out = {} as GuildModules;

  for (const key of MODULE_KEYS) {
    const current = saved?.[key];

    out[key] = {
      // Modulo que ainda nao existia no estado salvo nasce ligado.
      enabled: current?.enabled !== false,
      config: { ...defaultsFor(key), ...(current?.config ?? {}) },
    };
  }

  return out;
}

/** Normaliza todos os servidores de uma vez. */
export function mergeModuleDefaults(
  saved: Record<string, GuildModules> | undefined
): Record<string, GuildModules> {
  if (!saved) return {};

  const out: Record<string, GuildModules> = {};

  for (const [guildId, modules] of Object.entries(saved)) {
    out[guildId] = mergeGuildModules(modules);
  }

  return out;
}
