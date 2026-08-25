import { NextResponse } from "next/server";
import { createOAuthState } from "../../../lib/auth";

export async function GET() {
  const clientId = process.env.WUMPUS_OAUTH_CLIENT_ID;
  const redirectUri = process.env.WUMPUS_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) return new NextResponse("Discord OAuth is not configured.", { status: 503 });

  const state = await createOAuthState();
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify guilds");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");
  return NextResponse.redirect(url);
}
