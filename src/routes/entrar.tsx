import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDiscordLoginUrl } from "@/lib/discord/oauth";
import { buildWorkspace } from "@/lib/wumpus/owner-workspace";
import { resolveAccess } from "@/lib/wumpus/session";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";

const KEY = "wumpus-demo-v2";

export const Route = createFileRoute("/entrar")({
  validateSearch: (search: Record<string, unknown>): { reconectar?: true } =>
    search.reconectar === "1" ? { reconectar: true } : {},
  component: EntrarPage,
});

function EntrarPage() {
  const { reconectar } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(!reconectar);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    setSessionExpired(new URLSearchParams(window.location.search).get("motivo") === "sessao-expirada");
    if (reconectar) {
      setCheckingSession(false);
      return;
    }

    let cancelled = false;
    void resolveAccess({ data: { token: getStoredSessionToken() } }).then((access) => {
      if (cancelled) return;
      if (!access.ok) {
        setCheckingSession(false);
        return;
      }
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
      localStorage.setItem(KEY, JSON.stringify(workspace));
      localStorage.removeItem("wumpus-demo-v1");
      navigate({ to: "/app" });
    }).catch((cause: unknown) => {
      console.error("Não foi possível restaurar a sessão existente.", cause);
      if (!cancelled) setCheckingSession(false);
    });
    return () => { cancelled = true; };
  }, [navigate, reconectar]);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-sm space-y-4">
        <BrandMark />
        <div>
          <h1 className="m-0 text-xl font-semibold">Entrar no painel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Login oficial com a tua conta Discord. Só servidores que tu administra aparecem.</p>
        </div>
        {checkingSession ? <p role="status" className="m-0 text-sm text-muted-foreground">Verificando sua sessão…</p> : null}
        {sessionExpired ? <p role="status" className="m-0 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Sua sessão encerrou após um período sem atividade. Entre novamente para continuar.</p> : null}
        <Button
          className="w-full"
          disabled={busy || checkingSession}
          onClick={() => {
            setBusy(true);
            void getDiscordLoginUrl().then((res) => {
              if (!res.ok) {
                setError(res.error);
                setBusy(false);
                return;
              }
              sessionStorage.setItem("wumpus-discord-oauth-state", res.state);
              window.location.href = res.url;
            });
          }}
        >
          Entrar com Discord
        </Button>
        {error ? <p className="m-0 text-sm text-destructive">{error}</p> : null}
        <Link to="/" className="text-sm text-muted-foreground">
          Voltar
        </Link>
      </Card>
    </main>
  );
}
