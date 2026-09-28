import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { useWumpus } from "@/lib/wumpus/store";
import { formatRelative } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ component: AdminPage });

const DEMO_USER = "admin";
const DEMO_PASS = "wumpus";
const DEMO_OTP = "482913";

function AdminPage() {
  const hydrate = useWumpus((s) => s.hydrate);
  const hydrated = useWumpus((s) => s.hydrated);
  const user = useWumpus((s) => s.sessionUser);
  const setAdmin = useWumpus((s) => s.setAdmin);
  const members = useWumpus((s) => s.dashboardMembers);
  const licenses = useWumpus((s) => s.licenses);
  const addMember = useWumpus((s) => s.addDashboardMember);
  const removeMember = useWumpus((s) => s.removeDashboardMember);
  const resetDemo = useWumpus((s) => s.resetDemo);
  const allLogs = useWumpus((s) => s.logs);
  const logs = allLogs.slice(0, 8);
  const guilds = useWumpus((s) => s.guilds);
  const queue = useWumpus((s) => s.publishQueue);
  const processQueue = useWumpus((s) => s.processQueue);
  const pending = queue.filter((j) => j.status === "queued").length;

  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"pass" | "otp">("pass");
  const [error, setError] = useState<string | null>(null);
  const [queueNote, setQueueNote] = useState<string | null>(null);
  const [newUser, setNewUser] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("viewer");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return <div className="grid min-h-dvh place-items-center text-muted-foreground">Carregando…</div>;
  }

  if (!user.isAdmin) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
        <Card className="w-full max-w-sm space-y-4">
          <BrandMark />
          <div>
            <h1 className="m-0 text-xl font-semibold">Admin</h1>
            <p className="mt-1 text-sm text-muted-foreground">Área isolada da dashboard de clientes. Senha e segundo fator.</p>
          </div>
          {step === "pass" ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim() === DEMO_USER && pass === DEMO_PASS) {
                  setStep("otp");
                  setError(null);
                } else {
                  setError("Usuário ou senha incorretos.");
                }
              }}
            >
              <div>
                <Label>Usuário</Label>
                <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" />
              </div>
              <div>
                <Label>Senha</Label>
                <Input
                  className="mt-1"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {error ? <p className="m-0 text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full">
                Continuar
              </Button>
              <p className="m-0 text-xs text-muted-foreground">Demo: admin / wumpus</p>
            </form>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (otp.trim() === DEMO_OTP) {
                  setAdmin(true);
                  setError(null);
                } else {
                  setError("Código do autenticador inválido.");
                }
              }}
            >
              <div>
                <Label>Código de 6 dígitos</Label>
                <Input
                  className="mt-1"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="000000"
                />
              </div>
              {error ? <p className="m-0 text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full">
                Entrar
              </Button>
              <p className="m-0 text-xs text-muted-foreground">App autenticador da demo: {DEMO_OTP}</p>
              <button type="button" className="text-sm text-muted-foreground" onClick={() => setStep("pass")}>
                Voltar à senha
              </button>
            </form>
          )}
          <Link to="/" className="text-sm text-muted-foreground">
            Voltar
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
        <Button variant="ghost" size="sm" onClick={() => setAdmin(false)}>
          Sair
        </Button>
      </header>
      <div className="mx-auto grid max-w-5xl gap-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="m-0 text-xs text-muted-foreground">Bot</p>
            <p className="mt-1 mb-0 text-lg font-semibold">Online</p>
            <p className="m-0 text-xs text-muted-foreground">heartbeat há 4s · shard 0</p>
          </Card>
          <Card className="p-4">
            <p className="m-0 text-xs text-muted-foreground">Fila de publicação</p>
            <p className="mt-1 mb-0 text-lg font-semibold">{pending}</p>
            <p className="m-0 text-xs text-muted-foreground">painéis esperando sync</p>
          </Card>
          <Card className="p-4">
            <p className="m-0 text-xs text-muted-foreground">Servidores</p>
            <p className="mt-1 mb-0 text-lg font-semibold">{guilds.length}</p>
            <p className="m-0 text-xs text-muted-foreground">com Wumpus instalado</p>
          </Card>
        </div>

        <Card>
          <h2 className="mt-0 text-base font-semibold">Membros da dashboard</h2>
          <ul className="m-0 space-y-2 p-0">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1">
                  {m.username} <Badge>{m.role}</Badge>
                </span>
                <span className="text-xs text-muted-foreground">{formatRelative(m.addedAt)}</span>
                {m.role !== "owner" ? (
                  <Button size="sm" variant="ghost" onClick={() => removeMember(m.id)}>
                    Remover
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newUser.trim()) return;
              addMember(newUser.trim(), newRole);
              setNewUser("");
            }}
          >
            <Input value={newUser} onChange={(e) => setNewUser(e.target.value)} placeholder="discord id ou user" />
            <NativeSelect value={newRole} onChange={(e) => setNewRole(e.target.value as "admin" | "viewer")} className="sm:w-36">
              <option value="admin">admin</option>
              <option value="viewer">viewer</option>
            </NativeSelect>
            <Button type="submit">Adicionar</Button>
          </form>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mt-0 mr-auto mb-0 text-base font-semibold">Fila de publicação</h2>
            <Button
              size="sm"
              onClick={() => {
                const n = processQueue();
                setQueueNote(n > 0 ? `${n} painel(is) publicado(s) nos canais.` : "Fila vazia.");
              }}
            >
              Processar fila
            </Button>
          </div>
          {queueNote ? <p className="mt-2 text-sm text-muted-foreground">{queueNote}</p> : null}
          <ul className="mt-3 m-0 space-y-2 p-0">
            {queue.slice(0, 8).map((j) => (
              <li key={j.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">
                  {j.kind} · {j.detail}
                </span>
                <Badge tone={j.status === "queued" ? "warn" : "ok"}>{j.status === "queued" ? "na fila" : "publicado"}</Badge>
                <span className="text-xs text-muted-foreground">{formatRelative(j.at)}</span>
              </li>
            ))}
            {queue.length === 0 ? <li className="text-sm text-muted-foreground">Nenhum painel enfileirado.</li> : null}
          </ul>
        </Card>

        <Card>
          <h2 className="mt-0 text-base font-semibold">Licenças</h2>
          <ul className="m-0 space-y-2 p-0">
            {licenses.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="flex-1">{l.guildName}</span>
                <Badge tone="primary">{l.plan}</Badge>
                <span className="text-muted-foreground">{l.seats} seats</span>
                <span className="text-muted-foreground">até {l.expires}</span>
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

        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="m-0 font-medium">Force resync</p>
            <p className="m-0 text-sm text-muted-foreground">
              Restaura a demo Aurora Store + Nexus RP ao estado inicial.
            </p>
          </div>
          <Button variant="destructive" onClick={() => resetDemo()}>
            Restaurar demo
          </Button>
        </Card>
      </div>
    </div>
  );
}
