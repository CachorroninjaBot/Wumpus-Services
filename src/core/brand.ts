/**
 * Catalogo de modulos do Wumpus — o contrato entre painel e bot.
 *
 * Este arquivo e a fonte da verdade de QUAIS modulos existem. As chaves de
 * configuracao de cada modulo vivem em `module-defaults.ts`, e os canais e
 * cargos que cada um referencia vivem em `channel-refs.ts`.
 *
 * Regra do contrato: todo modulo listado aqui precisa ter
 *   - um default em `module-defaults.ts`
 *   - um caminho de leitura real no bot
 * Modulo que nao atende os dois nao deve estar nesta lista.
 */

export const brand = {
  name: "Wumpus",
  tagline: "A central de comando da sua comunidade.",
  legal: "HubOrder"
} as const;

/**
 * Todos os modulos configuraveis.
 * A ordem e a ordem de exibicao dentro de cada grupo.
 */
export const modules = [
  "tickets",
  "forms",
  "staff",
  "roles",
  "servers",
  "automations",
  "moderation",
  "automod",
  "security",
  "logs",
  "knowledge",
  "statistics",
  "integrations",
  "ocr"
] as const;

export type ModuleId = (typeof modules)[number];

export type ModuleGroupId = "attend" | "protect" | "team" | "intel";

/**
 * Agrupamento por RESULTADO, nao por lista de campos: e assim que o painel
 * apresenta a configuracao (o que voce quer fazer, nao qual modulo mexer).
 */
export const moduleGroups: Record<ModuleGroupId, { label: string; modules: ModuleId[] }> = {
  attend: { label: "Atender", modules: ["tickets", "forms"] },
  protect: { label: "Proteger", modules: ["moderation", "automod", "security", "logs"] },
  team: { label: "Gerenciar", modules: ["staff", "roles", "servers", "automations"] },
  intel: { label: "Inteligencia", modules: ["knowledge", "statistics", "integrations", "ocr"] }
};

export function modulesOf(group: ModuleGroupId): ModuleId[] {
  return moduleGroups[group].modules;
}
