import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { createClientOnlyFn } from "@tanstack/react-start";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { isDiscordActivityContext, rememberDiscordActivityContext } from "@/lib/discord/activity-session.client";
import { heartbeatDashboardSession } from "@/lib/wumpus/session";

const isActivityClient = createClientOnlyFn(isDiscordActivityContext);
const rememberActivityClient = createClientOnlyFn(rememberDiscordActivityContext);
const connectActivityClient = createClientOnlyFn(async () => {
  const { connectDiscordActivityOnce } = await import("@/lib/discord/activity");
  return connectDiscordActivityOnce();
});

/**
 * App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
 *
 *   <AuthProvider><Outlet /></AuthProvider>
 *
 * Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
 * its `useSession()` works standalone — so this is a passthrough today. It's
 * kept as the single, stable mount point for any future client-side providers
 * (e.g. a toast or theme provider) without churning the root shell.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<"checking" | "web" | "activity">("checking");
  const [activityStatus, setActivityStatus] = useState<"connecting" | "failed" | "ready">("connecting");
  const [activityError, setActivityError] = useState<string | null>(null);
  const navigate = useNavigate();

  const connect = () => {
    setActivityStatus("connecting");
    setActivityError(null);
    void connectActivityClient().then(() => {
      setActivityStatus("ready");
      if (!window.location.pathname.startsWith("/app")) void navigate({ to: "/app" });
    }).catch((cause: unknown) => {
      console.error("Não foi possível autenticar a Activity do Discord.", cause);
      setActivityError(cause instanceof Error ? cause.message : "Não foi possível conectar ao Discord.");
      setActivityStatus("failed");
    });
  };

  useEffect(() => {
    if (!isActivityClient()) {
      setMode("web");
      return;
    }
    rememberActivityClient();
    document.querySelector('link[href^="https://fonts.googleapis.com"]')?.remove();
    document.documentElement.dataset.discordActivity = "true";
    setMode("activity");
    connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mode === "activity" && activityStatus !== "ready") {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
        <section className="w-full max-w-md space-y-4 rounded-2xl bg-card p-6 shadow-border">
          <BrandMark />
          <h1 className="m-0 text-xl font-semibold">
            {activityStatus === "connecting" ? "Conectando ao Discord" : "Não foi possível abrir a Activity"}
          </h1>
          <p role={activityStatus === "connecting" ? "status" : "alert"} className="m-0 text-sm leading-6 text-muted-foreground">
            {activityStatus === "connecting"
              ? "Estamos validando sua conta e preparando os servidores disponíveis."
              : activityError ?? "Verifique a configuração da Activity e tente novamente."}
          </p>
          {activityStatus === "failed" ? <Button onClick={connect}>Tentar novamente</Button> : null}
        </section>
      </main>
    );
  }

  return (
    <>
      {mode === "web" || activityStatus === "ready" ? <SessionPresence /> : null}
      {children}
    </>
  );
}

function SessionPresence() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (!pathname.startsWith("/app") && pathname !== "/admin") return;
    const heartbeat = () => {
      if (document.visibilityState === "visible") {
        void heartbeatDashboardSession({ data: {} }).then((result) => {
          if (result.ok) return;
          localStorage.removeItem("wumpus-demo-v2");
          window.location.replace("/entrar?motivo=sessao-expirada");
        }).catch(() => undefined);
      }
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 60_000);
    return () => window.clearInterval(timer);
  }, [pathname]);

  return null;
}
