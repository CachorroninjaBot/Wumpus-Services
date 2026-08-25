import { NextResponse } from "next/server";
import { consumeOAuthState, setWumpusSession, type DiscordManagedGuild } from "../../../../lib/auth";

type DiscordUser = { id: string; username: string; global_name: string | null; avatar: string | null };

function redirectWithError(request: Request, error: string) {
  const url = new URL("/wumpus", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

function canManageGuild(guild: DiscordManagedGuild) {
  return guild.owner || (BigInt(guild.permissions) & 0x20n) === 0x20n;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state || !await consumeOAuthState(state)) return redirectWithError(request, "oauth_invalid");

  const clientId = process.env.WUMPUS_OAUTH_CLIENT_ID;
  const clientSecret = process.env.WUMPUS_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.WUMPUS_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return redirectWithError(request, "oauth_unconfigured");

  const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code, redirect_uri: redirectUri }),
    cache: "no-store"
  });
  if (!tokenResponse.ok) return redirectWithError(request, "oauth_exchange_failed");
  const token = await tokenResponse.json() as { access_token?: string };
  if (!token.access_token) return redirectWithError(request, "oauth_token_missing");

  const headers = { authorization: `Bearer ${token.access_token}` };
  const [userResponse, guildsResponse] = await Promise.all([
    fetch("https://discord.com/api/v10/users/@me", { headers, cache: "no-store" }),
    fetch("https://discord.com/api/v10/users/@me/guilds", { headers, cache: "no-store" })
  ]);
  if (!userResponse.ok || !guildsResponse.ok) return redirectWithError(request, "discord_profile_failed");

  const user = await userResponse.json() as DiscordUser;
  const guilds = (await guildsResponse.json() as DiscordManagedGuild[]).filter(canManageGuild);
  await setWumpusSession({ user: { id: user.id, username: user.username, globalName: user.global_name, avatar: user.avatar }, guilds });
  return NextResponse.redirect(new URL("/wumpus", request.url));
}
