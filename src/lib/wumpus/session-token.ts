/**
 * Token de sessao assinado — a decisao de acesso sai do navegador.
 *
 * O problema que isto resolve: o painel decidia tudo no cliente. `isAdmin`,
 * `plan` e a lista de servidores viviam no localStorage, entao bastava editar
 * o campo `id` para o do dono e a checagem passava. Revalidar na leitura nao
 * resolve: o dado continua vindo do cliente.
 *
 * O servidor assina (HMAC-SHA256, via `jose`) a identidade temporária do
 * usuário. Os servidores autorizados ficam no armazenamento da sessão no
 * servidor para que uma conta com muitos servidores não exceda o limite de
 * tamanho de cookies. A credencial trafega somente em cookie HttpOnly.
 */
import { SignJWT, jwtVerify } from "jose";

export type SessionGuild = {
  id: string;
  name: string;
  iconUrl: string | null;
  /** Dono no Discord. E o unico que da acesso ao painel. */
  owner: boolean;
};

export type SessionPayload = {
  sessionId: string;
  userId: string;
  username: string;
  globalName: string;
  avatar: string | null;
  mfaEnabled: boolean;
  guilds: SessionGuild[];
};

const ALG = "HS256";
const TTL = "30d";

/** Chave antiga removida durante a migração para cookie HttpOnly. */
export const SESSION_TOKEN_KEY = "wumpus-session-token";
/** Maximum accepted legacy marker length in server-function request schemas. */
export const SESSION_TOKEN_MAX_LENGTH = 16_384;
const COOKIE_SESSION_MARKER = "cookie-session";

export function getStoredSessionToken(): string {
  if (typeof window === "undefined") return "";
  try {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // Storage pode estar bloqueado; o cookie HttpOnly continua sendo enviado.
  }
  // This marker is not an authentication credential. Server functions ignore
  // the body value and validate the HttpOnly cookie from the request instead.
  return COOKIE_SESSION_MARKER;
}

/**
 * Segredo do servidor.
 *
 * Exige um segredo independente do OAuth do Discord. A chave precisa ter pelo
 * menos 32 bytes para limitar o impacto de vazamentos e permitir rotação
 * independente das credenciais do bot e do provedor.
 */
export function sessionSecret(): Uint8Array | null {
  const raw = process.env.WUMPUS_SESSION_SECRET?.trim() ?? "";
  if (new TextEncoder().encode(raw).byteLength < 32) return null;
  return new TextEncoder().encode(raw);
}

export async function signSession(payload: SessionPayload, secret: Uint8Array): Promise<string> {
  const { guilds: _guilds, ...identity } = payload;
  return new SignJWT(identity)
    .setProtectedHeader({ alg: ALG })
    .setJti(payload.sessionId)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(secret);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Descarta servidor sem id — id vazio viraria chave de estado invalida. */
function parseGuilds(value: unknown): SessionGuild[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: text(item.id),
      name: text(item.name),
      iconUrl: typeof item.iconUrl === "string" ? item.iconUrl : null,
      owner: item.owner === true,
    }))
    .filter((guild) => guild.id.length > 0);
}

/**
 * Verifica o token. Devolve `null` em QUALQUER falha — assinatura errada,
 * expirado, formato invalido. Nunca lanca: quem chama trata `null` como
 * "sem sessao", que e o comportamento seguro.
 */
export async function verifySession(token: string, secret: Uint8Array): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });

    const userId = text(payload.userId);
    const sessionId = text(payload.jti);
    if (!/^\d{17,20}$/.test(userId) || !/^[0-9a-f-]{36}$/i.test(sessionId)) return null;

    return {
      sessionId,
      userId,
      username: text(payload.username),
      globalName: text(payload.globalName),
      avatar: typeof payload.avatar === "string" ? payload.avatar : null,
      mfaEnabled: payload.mfaEnabled === true,
      guilds: parseGuilds(payload.guilds),
    };
  } catch {
    return null;
  }
}
