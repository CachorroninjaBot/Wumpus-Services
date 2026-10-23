import { createServerFn } from "@tanstack/react-start";
import { setOAuthStateCookie } from "@/lib/wumpus/session-cookie.server";
import { enforceRequestLimit } from "@/lib/wumpus/request-limits.server";
import { canManageDiscordGuild } from "./permissions.ts";

const CLIENT_ID = () => process.env.DISCORD_CLIENT_ID || "1187601667559002225";
const CLIENT_SECRET = () => process.env.DISCORD_CLIENT_SECRET || "";
const REDIRECT_URI = () =>
  process.env.DISCORD_REDIRECT_URI || "https://wumpus-dashboard.shardweb.app/auth/discord/callback";

export function discordIconUrl(id: string, icon: string | null | undefined) {
  if (!icon) return null;
  const ext = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${id}/${icon}.${ext}?size=128`;
}
export function discordAuthorizeUrl(state: string) {
  const q = new URLSearchParams({
    client_id: CLIENT_ID(),
    response_type: "code",
    scope: "identify guilds",
    redirect_uri: REDIRECT_URI(),
    state,
    prompt: "consent",
  });
  return `https://discord.com/api/oauth2/authorize?${q}`;
}

export const getDiscordLoginUrl = createServerFn({ method: "GET" }).handler(async () => {
  enforceRequestLimit("discord-oauth-start", 10, 10 * 60_000);
  if (!CLIENT_SECRET()) {
    return { ok: false as const, error: "DISCORD_CLIENT_SECRET ausente na Shard Cloud." };
  }
  const state = crypto.randomUUID();
  setOAuthStateCookie(state);
  return { ok: true as const, url: discordAuthorizeUrl(state), state };
});

/**
 * Troca o `code` do Discord pelos dados do usuario.
 *
 * Fica como funcao comum exportada para que OUTRO handler de servidor possa
 * reaproveitar — o de sessao precisa disto para assinar o token com dados que
 * vieram do Discord, nunca do navegador. O `createServerFn` abaixo e so a
 * porta de entrada do cliente.
 */
export async function exchangeDiscordCodeDirect(code: string) {
  const secret = CLIENT_SECRET();
  if (!secret) return { ok: false as const, error: "DISCORD_CLIENT_SECRET ausente." };

  const body = new URLSearchParams({
    client_id: CLIENT_ID(),
    client_secret: secret,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI(),
  });

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenRes.ok) return { ok: false as const, error: `Discord recusou o código (${tokenRes.status}).` };
  const token = (await tokenRes.json()) as { access_token?: unknown };
  if (typeof token.access_token !== "string" || token.access_token.length < 1 || token.access_token.length > 4096) {
    return { ok: false as const, error: "A resposta de autenticação do Discord é inválida." };
  }

  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!meRes.ok) return { ok: false as const, error: "Não deu para ler o usuário." };
  const me = (await meRes.json()) as {
    id?: unknown;
    username?: unknown;
    global_name?: unknown;
    avatar?: unknown;
    mfa_enabled?: unknown;
  };
  if (typeof me.id !== "string" || !/^\d{17,20}$/.test(me.id) || typeof me.username !== "string" || !me.username.trim()) {
    return { ok: false as const, error: "O Discord retornou uma identidade inválida." };
  }

  const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!guildsRes.ok) return { ok: false as const, error: "Não foi possível validar os servidores da conta Discord." };
  const guildRows = await guildsRes.json() as unknown;
  if (!Array.isArray(guildRows)) return { ok: false as const, error: "O Discord retornou uma lista de servidores inválida." };
  const guilds = guildRows.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const guild = value as Record<string, unknown>;
    if (typeof guild.id !== "string" || !/^\d{17,20}$/.test(guild.id) || typeof guild.name !== "string" || typeof guild.permissions !== "string") return [];
    try {
      return [{ id: guild.id, name: guild.name.slice(0, 100), icon: typeof guild.icon === "string" ? guild.icon : null, owner: guild.owner === true, permissions: BigInt(guild.permissions) }];
    } catch {
      return [];
    }
  });
  const managed = guilds.filter((guild) => guild.owner || canManageDiscordGuild(guild.permissions.toString()));

  return {
    ok: true as const,
    user: {
      id: me.id,
      username: me.username.slice(0, 100),
      globalName: typeof me.global_name === "string" && me.global_name ? me.global_name.slice(0, 100) : me.username.slice(0, 100),
      avatar: typeof me.avatar === "string" ? me.avatar : null,
      mfaEnabled: me.mfa_enabled === true,
    },
    guilds: managed.slice(0, 25).map((guild) => ({
      id: guild.id,
      name: guild.name,
      owner: guild.owner,
      iconUrl: discordIconUrl(guild.id, guild.icon),
    })),
  };
}
