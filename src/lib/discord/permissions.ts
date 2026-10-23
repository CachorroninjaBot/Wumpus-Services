/** Manage Server may be granted directly or implicitly through Administrator. */
export function canManageDiscordGuild(permissionValue: string): boolean {
  try {
    const permissions = BigInt(permissionValue);
    const manageGuild = 1n << 5n;
    const administrator = 1n << 3n;
    return (permissions & (manageGuild | administrator)) !== 0n;
  } catch {
    return false;
  }
}
