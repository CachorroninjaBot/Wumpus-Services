/** Credenciais do dono. Sobrescreve com VITE_OWNER_USER / VITE_OWNER_PASSWORD na Shard Cloud. */
export const OWNER_USER = (import.meta.env.VITE_OWNER_USER as string | undefined)?.trim() || "admin";
export const OWNER_PASSWORD = (import.meta.env.VITE_OWNER_PASSWORD as string | undefined) || "wumpus";

export function checkOwnerCredentials(user: string, password: string): boolean {
  return user.trim().toLowerCase() === OWNER_USER.toLowerCase() && password === OWNER_PASSWORD;
}
