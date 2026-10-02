import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isPlatformOwner } from "@/lib/wumpus/owner";
import { forceGuildResync, getAdminOverview } from "@/lib/wumpus/admin";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import { useWumpus } from "@/lib/wumpus/store";
import { formatRelative } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type AdminOverview = Awaited<ReturnType<typeof getAdminOverview>>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível carregar a administração.";
}

function AdminPage() {
  const hydrate = useWumpus((s) => s.hydrate);
  const hydrated = useWumpus((s) => s.hydrated);
  const user = useWumpus((s) => s.sessionUser);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyGuild, setBusyGuild] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  async function refresh() {
    setError(null);
    try {
      setOverview(await getAdminOverview({ data: { token: getStoredSessionToken() } }));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  useEffect(() => {
    if (hydrated && user.signedIn && isPlatformOwner(user.id)) void refresh();
  }, [hydrated, user.id, user.signedIn]);

  async function resync(guildId: string, guildName: string) {
    setBusyGuild(guildId);
    setNotice(null);
    try {
      const result = await forceGuildResync({ data: { token: getStoredSessionToken(), guildId } });
      setNotice(`${result.queued.length} painel(is) enviado(s) para republicação em ${guildName}.`);
    } catch (cause) {
      setNotice(errorMessage(cause));
    } finally {
      setBusyGuild(null);
    }
  }

  if (!hydrated) {
    return <div className="grid min-h-dvh place-items-center text-muted-foreground">Carregando…</div>;
  }

  if (!user.signedIn || !isPlatformOwner(user.id)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
        <Card className="w-full max-w-sm space-y-4">
          <BrandMark />
          <div>
            <h1 className="m-0 text-xl font-semibold">Área restrita</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Entre com a conta Discord autorizada para acessar a administração da plataforma.
            </p>
          </div>
          <Link
            to="/entrar"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Entrar com Discord
          </Link>
          <Link to="/" className="block text-center text-sm text-muted-foreground">Voltar ao site</Link>
        </Card>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="flex h-14 items-center gap-3 border-b border-border px-4">
        <BrandMark size={28} />
        <strong>Admin</strong>
        <Badge tone="primary">dono</Badge>
        <Link to="/app" className="ml-auto text-sm text-muted-foreground hover:text-foreground">Painel</Link>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Site</Link>
      </header>

      <main className="mx-auto grid max-w-5xl gap-4 p-4 sm:p-6">
        {error ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <h1 className="m-0 text-lg font-semibold">Acesso administrativo indisponível</h1>
            <p className="mt-2 mb-0 text-sm text-muted-foreground">{error}</p>
            <p className="mt-2 mb-0 text-sm text-muted-foreground">
              O acesso administrativo exige MFA ativo na conta Discord autorizada. Ative-o no Discord e entre novamente.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => void refresh()}>Tentar novamente</Button>
          </Card>
        ) : null}

        {notice ? (
          <Card role="status" className="p-3 text-sm">{notice}</Card>
        ) : null}

        {!overview && !error ? (
          <Card role="status" className="text-sm text-muted-foreground">Carregando dados administrativos verificados…</Card>
        ) : null}

        {overview ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="p-4">
                <p className="m-0 text-xs text-muted-foreground">Saúde do bot</p>
                <p className="mt-1 mb-0 text-lg font-semibold">
                  {overview.health.status === "online" ? "Online" : "Offline"}
                </p>
                <p className="m-0 text-xs text-muted-foreground">
                  {overview.health.guildCount} servidores · ping {overview.health.pingMs ?? "—"} ms
                </p>
                <p className="m-0 text-xs text-muted-foreground">
                  {overview.health.lastSeenAt
                    ? `Último heartbeat ${formatRelative(overview.health.lastSeenAt)}`
                    : "Nenhum heartbeat recebido"}
                </p>
              </Card>
              <Card className="p-4">
                <p className="m-0 text-xs text-muted-foreground">Configurações publicadas</p>
                <p className="mt-1 mb-0 text-lg font-semibold">{overview.guilds.length}</p>
                <p className="m-0 text-xs text-muted-foreground">servidores retornados pela API do Discord</p>
              </Card>
              <Card className="p-4">
                <p className="m-0 text-xs text-muted-foreground">Assinaturas ShardPay</p>
                <p className="mt-1 mb-0 text-lg font-semibold">{overview.subscriptions.length}</p>
                <p className="m-0 text-xs text-muted-foreground">
                  {overview.billingAvailable ? "dados atuais" : "vitrine apenas; API indisponível"}
                </p>
              </Card>
            </div>

            <Card>
              <div className="flex items-center gap-3">
                <h2 className="m-0 flex-1 text-base font-semibold">Membros da dashboard</h2>
                <Button size="sm" variant="outline" onClick={() => void refresh()}>Atualizar</Button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Contas Discord que concluíram login. O registro começa a ser coletado a partir desta versão.
              </p>
              {overview.members.length ? (
                <ul className="m-0 space-y-2 p-0">
                  {overview.members.map((member) => (
                    <li key={member.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{member.username}</span>
                      <code className="text-xs text-muted-foreground">{member.id}</code>
                      <span className="text-xs text-muted-foreground">
                        visto {formatRelative(member.lastSeenAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
                  Nenhum login registrado ainda. Os próximos acessos aparecerão aqui.
                </p>
              )}
            </Card>

            <Card>
              <h2 className="mt-0 text-base font-semibold">Licenças e assinaturas</h2>
              {!overview.billingAvailable ? (
                <p className="m-0 text-sm text-warn">{overview.billingError}</p>
              ) : null}
              {overview.subscriptions.length ? (
                <ul className="m-0 space-y-2 p-0">
                  {overview.subscriptions.map((subscription) => {
                    const active = ["active", "trialing", "paid", "authorized", "succeeded"].includes(subscription.status.toLowerCase());
                    return (
                      <li key={subscription.id} className="flex flex-wrap items-center gap-2 border-t border-border py-2 text-sm">
                        <span className="min-w-0 flex-1">{subscription.username}</span>
                        <span>{subscription.productName}</span>
                        <Badge tone={active ? "ok" : "warn"}>{subscription.status}</Badge>
                        <span className="text-muted-foreground">
                          {subscription.nextBillingDate || subscription.billingCycle || "sem renovação"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="m-0 text-sm text-muted-foreground">Nenhuma assinatura retornada pela ShardPay.</p>
              )}
            </Card>

            <Card>
              <h2 className="mt-0 text-base font-semibold">Republicar configuração</h2>
              <p className="mt-0 text-sm text-muted-foreground">
                Solicita ao bot que publique novamente os painéis já configurados no canal de cada servidor.
              </p>
              <ul className="m-0 space-y-2 p-0">
                {overview.guilds.map((guild) => (
                  <li key={guild.id} className="flex flex-wrap items-center gap-3 border-t border-border py-2 text-sm">
                    <span className="min-w-0 flex-1">{guild.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {guild.hasTicketsPanel ? "tickets" : ""}
                      {guild.hasTicketsPanel && guild.hasFormsPanel ? " · " : ""}
                      {guild.hasFormsPanel ? "candidaturas" : ""}
                      {!guild.hasTicketsPanel && !guild.hasFormsPanel ? "sem painel configurado" : ""}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyGuild === guild.id || (!guild.hasTicketsPanel && !guild.hasFormsPanel)}
                      onClick={() => void resync(guild.id, guild.name)}
                    >
                      {busyGuild === guild.id ? "Enfileirando…" : "Force-resync"}
                    </Button>
                  </li>
                ))}
              </ul>
              {!overview.guilds.length ? (
                <p className="m-0 text-sm text-muted-foreground">O bot não retornou servidores ativos.</p>
              ) : null}
            </Card>
          </>
        ) : null}
      </main>
    </div>
  );
}
