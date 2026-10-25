import { createServerFn } from "@tanstack/react-start";
import { setOAuthStateCookie } from "@/lib/wumpus/session-cookie.server";
import { enforceRequestLimit } from "@/lib/wumpus/request-limits.server";
import { parseDiscordGuilds } from "./guilds.ts";

export const discordClientId = () => process.env.DISCORD_CLIENT_ID || "1187601667559002225";
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
    client_id: discordClientId(),
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
type DiscordOAuthOptions = {
  codeVerifier?: string;
  includeAccessToken?: boolean;
};

export async function exchangeDiscordCodeDirect(code: string, options: DiscordOAuthOptions = {}) {
  const secret = CLIENT_SECRET();
  if (!secret) return { ok: false as const, error: "DISCORD_CLIENT_SECRET ausente." };

  const body = new URLSearchParams({
    client_id: discordClientId(),
    client_secret: secret,
    grant_type: "authorization_code",
    code,
  });
  if (!options.includeAccessToken) body.set("redirect_uri", REDIRECT_URI());
  if (options.codeVerifier) body.set("code_verifier", options.codeVerifier);

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (tokenRes.status === 429) {
    const retryAfter = Number(tokenRes.headers.get("retry-after"));
    const waitHint = Number.isFinite(retryAfter) && retryAfter > 0
      ? ` Aguarde pelo menos ${Math.ceil(retryAfter)} segundos.`
      : " Aguarde alguns minutos.";
    console.warn("[discord-oauth-token] Discord limitou a troca do código OAuth.", JSON.stringify({
      status: tokenRes.status,
      retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : null,
    }));
    return {
      ok: false as const,
      error: `O Discord está limitando tentativas de login.${waitHint} Volte ao início e inicie um novo login; não reutilize esta página de callback.`,
    };
  }
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

  const guildsRes = await fetch("https://discord.com/api/users/@me/guilds?limit=200", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!guildsRes.ok) {
    console.error("[discord-oauth-guilds] Discord recusou a consulta de servidores.", JSON.stringify({ status: guildsRes.status }));
    return { ok: false as const, error: "Não foi possível validar os servidores da conta Discord." };
  }
  const parsedGuilds = parseDiscordGuilds(await guildsRes.json() as unknown);
  if (!parsedGuilds) {
    console.error("[discord-oauth-guilds] Discord retornou uma lista de servidores inválida.");
    return { ok: false as const, error: "O Discord retornou uma lista de servidores inválida." };
  }
  const managed = parsedGuilds.guilds;
  console.info("[discord-oauth-guilds]", JSON.stringify({
    ...parsedGuilds.stats,
    manageable: managed.length,
  }));

  return {
    ok: true as const,
    ...(options.includeAccessToken ? { accessToken: token.access_token } : {}),
    user: {
      id: me.id,
      username: me.username.slice(0, 100),
      globalName: typeof me.global_name === "string" && me.global_name ? me.global_name.slice(0, 100) : me.username.slice(0, 100),
      avatar: typeof me.avatar === "string" ? me.avatar : null,
      mfaEnabled: me.mfa_enabled === true,
    },
    guilds: managed.map((guild) => ({
      id: guild.id,
      name: guild.name,
      owner: guild.owner,
      iconUrl: discordIconUrl(guild.id, guild.icon),
    })),
  };
}
