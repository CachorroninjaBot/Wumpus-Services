import crypto from "node:crypto";

/**
 * Autenticacao do dashboard.
 *
 * Decisoes:
 * - O access token do Discord NUNCA vai para o navegador nem para o banco.
 *   Ele vive apenas dentro da requisicao que lista os servidores e e descartado.
 * - O navegador guarda um id de sessao assinado (HMAC) em cookie httpOnly.
 *   Os dados reais da sessao ficam no Postgres.
 */

const DISCORD_API = "https://discord.com/api/v10";

/** Permissoes que autorizam gerenciar o servidor no dashboard. */
export const PERM_ADMINISTRATOR = 0x8n;
export const PERM_MANAGE_GUILD = 0x20n;

export type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  locale?: string;
};

export type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  approximate_member_count?: number;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} nao esta configurada.`);
  return value;
}

function secret(): string {
  return required("WUMPUS_SESSION_SECRET");
}

/* ------------------------------------------------------------------ *
 * Cookie de sessao assinado
 * ------------------------------------------------------------------ */

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

export function issueSessionCookie(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

/** Devolve o id da sessao apenas se a assinatura conferir. */
export function readSessionCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  const index = raw.lastIndexOf(".");
  if (index <= 0) return null;
  const sessionId = raw.slice(0, index);
  const provided = raw.slice(index + 1);
  const expected = sign(sessionId);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? sessionId : null;
}

export function newState(): string {
  return crypto.randomBytes(16).toString("base64url");
}

/* ------------------------------------------------------------------ *
 * OAuth
 * ------------------------------------------------------------------ */

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: required("WUMPUS_OAUTH_CLIENT_ID"),
    redirect_uri: required("WUMPUS_OAUTH_REDIRECT_URI"),
    response_type: "code",
    scope: "identify guilds",
    state
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<string> {
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: required("WUMPUS_OAUTH_CLIENT_ID"),
      client_secret: required("WUMPUS_OAUTH_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code,
      redirect_uri: required("WUMPUS_OAUTH_REDIRECT_URI")
    })
  });
  if (!response.ok) {
    throw new Error(`Discord recusou o codigo (${response.status}).`);
  }
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error("Resposta do Discord sem access_token.");
  return payload.access_token;
}

export async function fetchCurrentUser(accessToken: string): Promise<DiscordUser> {
  const response = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(`Falha ao ler o usuario (${response.status}).`);
  return (await response.json()) as DiscordUser;
}

export async function fetchUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const response = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(`Falha ao ler os servidores (${response.status}).`);
  return (await response.json()) as DiscordGuild[];
}

/** O cliente so ve servidores onde pode gerenciar. */
export function canManage(guild: DiscordGuild): boolean {
  if (guild.owner) return true;
  let bits: bigint;
  try {
    bits = BigInt(guild.permissions);
  } catch {
    return false;
  }
  return (bits & PERM_ADMINISTRATOR) !== 0n || (bits & PERM_MANAGE_GUILD) !== 0n;
}

export function guildIconUrl(guild: { id: string; icon: string | null }, size = 128): string | null {
  return guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=${size}` : null;
}

export function avatarUrl(user: DiscordUser, size = 128): string | null {
  return user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=${size}` : null;
}
