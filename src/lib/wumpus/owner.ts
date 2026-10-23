/** Fallback legado; em produção, configure WUMPUS_OWNER_ID. */
export const OWNER_DISCORD_ID = "928871447940710480";

/**
 * Lê o dono no servidor sem incluir valores de ambiente no bundle do cliente.
 * O nome minúsculo continua aceito para instalações que já o configuraram.
 */
function configuredOwnerIds(): string[] | null {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  const env = runtime.process?.env;
  const raw = [env?.WUMPUS_OWNER_ID, env?.wumpus_owner_id]
    .find((value) => Boolean(value?.trim()))
    ?.trim();

  if (!raw) return null;
  return raw.split(/[\s,;]+/).map((value) => value.trim()).filter((value) => /^\d{17,20}$/.test(value));
}

export function isPlatformOwner(id: string | undefined | null) {
  if (!id) return false;
  const configured = configuredOwnerIds();
  return configured ? configured.includes(id) : id === OWNER_DISCORD_ID;
}
