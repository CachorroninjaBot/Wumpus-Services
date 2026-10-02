import { createServerFn } from "@tanstack/react-start";

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
  if (!CLIENT_SECRET()) {
    return { ok: false as const, error: "DISCORD_CLIENT_SECRET ausente na Shard Cloud." };
  }
  const state = crypto.randomUUID();
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
    });
    if (!tokenRes.ok) {
      return { ok: false as const, error: `Discord recusou o código (${tokenRes.status}).` };
    }
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) return { ok: false as const, error: "Sem access_token." };

    const meRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!meRes.ok) return { ok: false as const, error: "Não deu para ler o usuário." };
    const me = (await meRes.json()) as {
      id: string;
      username: string;
      global_name?: string | null;
      avatar?: string | null;
    };

    const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const guilds = guildsRes.ok
      ? ((await guildsRes.json()) as Array<{
          id: string;
          name: string;
          icon: string | null;
          owner: boolean;
          permissions: string;
        }>)
      : [];
    const managed = guilds.filter((g) => g.owner || (BigInt(g.permissions) & 0x20n) === 0x20n);

    return {
      ok: true as const,
      user: {
        id: me.id,
        username: me.username,
        globalName: me.global_name || me.username,
        avatar: me.avatar,
      },
      guilds: managed.slice(0, 25).map((g) => ({
        id: g.id,
        name: g.name,
        owner: g.owner,
        iconUrl: discordIconUrl(g.id, g.icon),
      })),
    };
}

/** Porta de entrada do cliente para a troca do code. */
export const exchangeDiscordCode = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }) => exchangeDiscordCodeDirect(data.code));
