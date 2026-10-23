import { canManageDiscordGuild } from "./permissions.ts";

export type DiscordManagedGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
};

export type DiscordGuildParseResult = {
  guilds: DiscordManagedGuild[];
  stats: {
    received: number;
    valid: number;
    owners: number;
    withPermissions: number;
    manageableByPermissions: number;
    missingPermissions: number;
  };
};

export function parseDiscordGuilds(value: unknown): DiscordGuildParseResult | null {
  if (!Array.isArray(value)) return null;

  const validGuilds: Array<DiscordManagedGuild & { permissions: string | null }> = [];
  let missingPermissions = 0;

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || !/^\d{17,20}$/.test(row.id) || typeof row.name !== "string") continue;

    const permissions = typeof row.permissions === "string" ? row.permissions : null;
    if (!permissions && row.owner !== true) missingPermissions += 1;
    validGuilds.push({
      id: row.id,
      name: row.name.slice(0, 100),
      icon: typeof row.icon === "string" ? row.icon : null,
      owner: row.owner === true,
      permissions,
    });
  }

  const manageableByPermissions = validGuilds.filter((guild) =>
    guild.permissions !== null && canManageDiscordGuild(guild.permissions),
  ).length;
  const guilds = validGuilds
    .filter((guild) => guild.owner || (guild.permissions !== null && canManageDiscordGuild(guild.permissions)))
    .map(({ permissions: _permissions, ...guild }) => guild);

  return {
    guilds,
    stats: {
      received: value.length,
      valid: validGuilds.length,
      owners: validGuilds.filter((guild) => guild.owner).length,
      withPermissions: validGuilds.filter((guild) => guild.permissions !== null).length,
      manageableByPermissions,
      missingPermissions,
    },
  };
}
