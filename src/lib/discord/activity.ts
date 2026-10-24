import { buildWorkspace } from "@/lib/wumpus/owner-workspace";
import {
  resolveAccess,
  getActivityAuthorizationState,
  logoutDashboardSession,
  startActivitySession,
} from "@/lib/wumpus/session";
import { clearActivitySessionToken, setActivitySessionToken } from "./activity-session.client";

let initialization: Promise<void> | null = null;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

async function connectDiscordActivity(): Promise<void> {
  const authorization = await getActivityAuthorizationState({ data: {} });
  const { DiscordSDK } = await import("@discord/embedded-app-sdk");
  const sdk = new DiscordSDK(authorization.clientId, { disableConsoleLogOverride: true });
  await sdk.ready();

  const { verifier, challenge } = await createPkcePair();
  const { code } = await sdk.commands.authorize({
    client_id: authorization.clientId,
    response_type: "code",
    state: authorization.state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "none",
    scope: ["identify", "guilds"],
  });

  const session = await startActivitySession({
    data: { code, state: authorization.state, codeVerifier: verifier },
  });
  if (!session.ok) throw new Error(session.error);

  setActivitySessionToken(session.sessionToken);
  try {
    await sdk.commands.authenticate({ access_token: session.discordAccessToken });

    const access = await resolveAccess({ data: { token: session.sessionToken } });
    if (!access.ok) throw new Error(access.error);

    const workspace = buildWorkspace(
      {
        id: access.session.id,
        username: access.session.username,
        globalName: access.session.globalName,
        avatar: access.session.avatar,
      },
      access.guilds,
      access.entitlements,
    );
    try {
      localStorage.setItem("wumpus-demo-v2", JSON.stringify(workspace));
      localStorage.removeItem("wumpus-demo-v1");
    } catch {
      throw new Error(
        "O armazenamento local está bloqueado para esta Activity. Habilite-o no Discord e tente novamente.",
      );
    }
  } catch (error) {
    await logoutDashboardSession({ data: {} }).catch((cleanupError: unknown) => {
      console.error("Não foi possível encerrar a sessão após falha na Activity.", cleanupError);
    });
    clearActivitySessionToken();
    throw error;
  }
}

export function connectDiscordActivityOnce(): Promise<void> {
  if (!initialization) {
    initialization = connectDiscordActivity().catch((error: unknown) => {
      initialization = null;
      clearActivitySessionToken();
      throw error;
    });
  }
  return initialization;
}
