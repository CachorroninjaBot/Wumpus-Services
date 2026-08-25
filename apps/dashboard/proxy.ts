import { NextRequest } from "next/server";

/** The HubOrder operations page remains private. Client Wumpus pages use Discord OAuth instead. */
export function proxy(request: NextRequest) {
  const username = process.env.DASHBOARD_USERNAME;
  const password = process.env.DASHBOARD_PASSWORD;
  if (!username || !password) return new Response("Dashboard access is not configured.", { status: 503 });

  const expected = `Basic ${btoa(`${username}:${password}`)}`;
  if (request.headers.get("authorization") === expected) return;
  return new Response("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="HubOrder Operations"' } });
}

export const config = { matcher: ["/", "/operations/:path*"] };
