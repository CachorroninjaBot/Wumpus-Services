import type { ModuleId } from "./brand.js";

/**
 * Referencias de configuracao que apontam para objetos do Discord: canais e cargos.
 *
 * Isto e o que faz a configuracao por GRUPO funcionar de verdade. Um grupo
 * cobre varios servidores, e cada servidor tem os seus proprios canais e
 * cargos. Guardar IDs no grupo seria valido em no maximo um servidor; guardando
 * o NOME, cada servidor resolve para o seu proprio objeto.
 */

export type ChannelRefKind = "text" | "category";

export type ChannelRef = { key: string; kind: ChannelRefKind };

export const channelRefs: Partial<Record<ModuleId, ChannelRef[]>> = {
  staff: [{ key: "logChannelId", kind: "text" }],
  automations: [{ key: "logChannelId", kind: "text" }],
  moderation: [{ key: "logChannelId", kind: "text" }],
  automod: [{ key: "logChannelId", kind: "text" }],
  security: [{ key: "alertChannelId", kind: "text" }],
  logs: [{ key: "channelId", kind: "text" }],
  tickets: [
    { key: "panelChannelId", kind: "text" },
    { key: "categoryId", kind: "category" },
    { key: "transcriptChannelId", kind: "text" },
    { key: "logChannelId", kind: "text" }
  ],
  forms: [{ key: "reviewChannelId", kind: "text" }],
  knowledge: [{ key: "answerChannelId", kind: "text" }]
};

export function channelRefsFor(module: ModuleId): ChannelRef[] {
  return channelRefs[module] ?? [];
}

/**
 * Chaves que guardam LISTAS de cargos.
 *
 * Mesma logica dos canais: o grupo guarda nomes ("equipe", "moderador") e cada
 * servidor resolve para os seus cargos. Diferente do canal, aqui o valor e uma
 * lista, entao a resolucao e por item.
 */
export const roleRefs: Partial<Record<ModuleId, string[]>> = {
  staff: ["staffRoleIds"],
  roles: ["protectedRoleIds"],
  moderation: ["staffRoleIds"],
  security: ["trustedRoleIds"],
  tickets: ["staffRoleIds"],
  forms: ["reviewerRoleIds"]
};

export function roleRefsFor(module: ModuleId): string[] {
  return roleRefs[module] ?? [];
}

/** Um ID do Discord e puramente numerico e longo; qualquer outra coisa e nome. */
export function isSnowflake(value: unknown): boolean {
  return typeof value === "string" && /^\d{17,20}$/.test(value.trim());
}

/** Normaliza nome de canal para comparacao: sem "#", sem espacos nas pontas. */
export function normalizeChannelName(value: string): string {
  return value.replace(/^#/, "").trim().toLowerCase();
}

/** Normaliza nome de cargo: sem "@", sem espacos nas pontas. */
export function normalizeRoleName(value: string): string {
  return value.replace(/^@/, "").trim().toLowerCase();
}
