import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { buildWorkspace } from "@/lib/wumpus/owner-workspace";
import { resolveAccess, startSession } from "@/lib/wumpus/session";
import { SESSION_TOKEN_KEY } from "@/lib/wumpus/session-token";

const KEY = "wumpus-demo-v2";

export const Route = createFileRoute("/auth/discord/callback")({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : "",
    state: typeof s.state === "string" ? s.state : "",
    error: typeof s.error === "string" ? s.error : "",
  }),
  component: CallbackPage,
});

function CallbackPage() {
  const { code, state, error } = Route.useSearch();
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Falando com o Discord…");

  useEffect(() => {
    if (error) {
      setMsg("Login cancelado no Discord.");
      return;
    }
    const expectedState = sessionStorage.getItem("wumpus-discord-oauth-state");
    sessionStorage.removeItem("wumpus-discord-oauth-state");
    if (!state || state !== expectedState) {
      setMsg("A validação do login expirou. Volte ao início e tente novamente.");
      return;
    }
    if (!code) {
      setMsg("Código ausente.");
      return;
    }

    void (async () => {
      // O servidor troca o code e ASSINA a identidade. Daqui em diante o
      // `userId` vem do token, nao do navegador.
      const started = await startSession({ data: { code } });
      if (!started.ok) {
        setMsg(started.error);
        return;
      }

      localStorage.setItem(SESSION_TOKEN_KEY, started.token);
      setMsg("Verificando assinatura e servidores…");

      // O direito e resolvido no servidor: plano pago, bot presente e posse do
      // servidor sao conferidos la, a cada login.
      const access = await resolveAccess({ data: { token: started.token } });
      if (!access.ok) {
        setMsg(access.error);
        return;
      }

      const slice = buildWorkspace(
        {
          id: access.session.id,
          username: access.session.username,
          globalName: access.session.globalName,
          avatar: access.session.avatar,
        },
        access.guilds,
        access.entitlements,
      );

      localStorage.setItem(KEY, JSON.stringify(slice));
      localStorage.removeItem("wumpus-demo-v1");
      navigate({ to: "/app" });
    })();
  }, [code, error, navigate, state]);

  return <main className="grid min-h-dvh place-items-center bg-muted-foreground">{msg}</main>;
}
