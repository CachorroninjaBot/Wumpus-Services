/** Único Discord que vê /admin. */
export const OWNER_DISCORD_ID = "928871447940710480";

export function isPlatformOwner(id: string | undefined | null) {
  return id === OWNER_DISCORD_ID;
}
