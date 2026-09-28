import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { BrandMark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isPlatformOwner } from "@/lib/wumpus/owner";
import { useWumpus } from "@/lib/wumpus/store";
import { formatRelative } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const hydrate = useWumpus((s) => s.hydrate);
  const hydrated = useWumpus((s) => s.hydrated);
  const user = useWumpus((s) => s.sessionUser);
  const members = useWumpus((s) => s.dashboardMembers);
  const licenses = useWumpus((s) => s.licenses);
  const allLogs = useWumpus((s) => s.logs);
  const logs = allLogs.slice(0, 8);
  const guilds = useWumpus((s) => s.guilds);
  const queue = useWumpus((s) => s.publishQueue);
  const processQueue = useWumpus((s) => s.processQueue);
  const pending = queue.filter((j) => j.status === "queued").length;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return <div className="grid min-h-dvh place-items-center text-muted-foreground">Carregando…</div>;
  }

  if (!isPlatformOwner(user.id)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
        <Card className="w-full max-w-sm space-y-3">
          <BrandMark />
          <h1 className="m-0 text-xl font-semibold">Sem acesso</h1>
          <p className="m-0 text-sm text-muted-foreground">Esta área é só do dono da plataforma.</p>
          <Link to="/app" className="text-sm text-muted-foreground">
            Voltar ao painel
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="flex h-14 items-center gap-3 border-b border-border px-4">
        <BrandMark size={28} />
        <strong>Admin</strong>
        <Link to="/app" className="ml-auto text-sm text-muted-foreground hover:text-foreground">
          Painel
        </Link>
      </header>
      <div className="mx-auto grid max-w-5xl gap-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="m-0 text-xs text-muted-foreground">Dono</p>
            <p className="mt-1 mb-0 text-lg font-semibold">{user.globalName}</p>
            <p className="m-0 font-mono text-xs text-muted-foreground">{user.id}</p>
          </Card>
          <Card className="p-4">
            <p className="m-0 text-xs text-muted-foreground">Fila de publicação</p>
            <p className="mt-1 mb-0 text-lg font-semibold">{pending}</p>
          </Card>
          <Card className="p-4">
            <p className="m-0 text-xs text-muted-foreground">Servidores no painel</p>
            <p className="mt-1 mb-0 text-lg font-semibold">{guilds.length}</p>
          </Card>
        </div>

        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mt-0 mr-auto mb-0 text-base font-semibold">Fila</h2>
            <Button size="sm" onClick={() => processQueue()}>
              Processar fila
            </Button>
          </div>
          <ul className="mt-3 m-0 space-y-2 p-0">
            {queue.slice(0, 8).map((j) => (
              <li key={j.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">
                  {j.kind} · {j.detail}
                </span>
                <Badge tone={j.status === "queued" ? "warn" : "ok"}>{j.status}</Badge>
              </li>
            ))}
            {queue.length === 0 ? <li className="text-sm text-muted-foreground">Vazia.</li> : null}
          </ul>
        </Card>

        <Card>
          <h2 className="mt-0 text-base font-semibold">Membros da dashboard</h2>
          <ul className="m-0 space-y-2 p-0">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1">
                  {m.username} <Badge>{m.role}</Badge>
                </span>
                <span className="text-xs text-muted-foreground">{formatRelative(m.addedAt)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mt-0 text-base font-semibold">Licenças</h2>
          <ul className="m-0 space-y-2 p-0">
            {licenses.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="flex-1">{l.guildName}</span>
                <Badge tone="primary">{l.plan}</Badge>
                <Badge tone={l.status === "active" ? "ok" : "warn"}>{l.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mt-0 text-base font-semibold">Eventos</h2>
          <ul className="m-0 space-y-2 p-0 text-sm">
            {logs.map((l) => (
              <li key={l.id}>
                <span className="text-muted-foreground">{l.actor} · </span>
                {l.summary}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
