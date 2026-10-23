import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, AlertTriangle, Clock3, Ticket, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ticketSla } from "@/lib/wumpus/engine";
import { useGuildMembers, useModule, useWumpus } from "@/lib/wumpus/store";
import { formatRelative } from "@/lib/utils";
import { getGuildActivity, getGuildTickets, getPublishStatus, type PublishStatus } from "@/lib/wumpus/runtime-store";
import { getPublicBotHealth, type PublicBotHealth } from "@/lib/wumpus/health";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import type { Ticket as WumpusTicket } from "@/lib/wumpus/types";

export const Route = createFileRoute("/app/")({ component: Overview });

function Overview() {
  const members = useGuildMembers();
  const gid = useWumpus((s) => s.activeGuildId);
  const tcfg = useModule("tickets");
  const lockdown = Boolean(useModule("security").config.lockdown);
  const [publishStatuses, setPublishStatuses] = useState<PublishStatus[]>([]);
  const [botHealth, setBotHealth] = useState<PublicBotHealth | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<WumpusTicket[]>([]);
  const [activity, setActivity] = useState<Awaited<ReturnType<typeof getGuildActivity>> | null>(null);

  const submissions = activity?.pendingForms ?? 0;
  const logs = activity?.recentEvents ?? [];
  const pendingSync = publishStatuses.filter((job) => job.status === "queued").length;
  const latestSync = [...publishStatuses].sort((a, b) => (b.at ?? b.createdAt) - (a.at ?? a.createdAt))[0];

  useEffect(() => {
    let active = true;
    const refreshStatus = async () => {
      try {
        const token = getStoredSessionToken();
        if (!token) {
          if (active) setStatusError(null);
          return;
        }
        const [health, statuses, liveTickets, liveActivity] = await Promise.all([
          getPublicBotHealth(),
          getPublishStatus({ data: { token, guildId: gid } }),
          getGuildTickets({ data: { token, guildId: gid } }),
          getGuildActivity({ data: { token, guildId: gid } }),
        ]);
        if (active) {
          setBotHealth(health);
          setPublishStatuses(statuses);
          setTickets(liveTickets);
          setActivity(liveActivity);
          setStatusError(null);
        }
      } catch (error) {
        if (active) setStatusError(error instanceof Error ? error.message : "Não foi possível consultar o estado real do bot.");
      }
    };
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [gid]);

  const open = tickets.filter((t) => t.status === "open" || t.status === "claimed");
  const breaches = open.filter((t) => ticketSla(t, tcfg.config) !== "ok");
  const csat = tickets.filter((t) => t.feedback);
  const avg =
    csat.length === 0 ? "—" : (csat.reduce((s, t) => s + (t.feedback?.rating ?? 0), 0) / csat.length).toFixed(1);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 text-2xl font-semibold tracking-tight">O que precisa de atenção?</h1>
        {lockdown ? <Badge tone="danger">Lockdown ativo</Badge> : null}
      </header>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5" role="status">
          <i className={`inline-block size-2 rounded-full ${botHealth?.status === "online" ? "bg-ok" : botHealth?.status === "offline" ? "bg-destructive" : "bg-warn"}`} />
          {pendingSync ? `${pendingSync} publicações aguardando` : botHealth?.status === "online" ? `Bot conectado · ${botHealth.pingMs ?? "—"} ms` : botHealth?.status === "offline" ? "Bot desconectado" : "Conexão do bot indisponível"}
        </span>
        <span className="text-muted-foreground">Última publicação: {latestSync ? formatRelative(latestSync.at ?? latestSync.createdAt) : "nenhuma ainda"}</span>
        {statusError ? <span className="text-destructive" role="alert">{statusError}</span> : null}
      </div>
      {breaches.length > 0 ? (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="grid size-10 place-items-center rounded-xl bg-destructive/15 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <div className="flex-1">
            <p className="m-0 font-medium">Há atendimento fora do SLA de {String(tcfg.config.slaWarningMinutes)} min</p>
            <p className="m-0 text-sm text-muted-foreground">
              {breaches.map((t) => `#${t.number} ${t.subject}`).join(" · ")}
            </p>
          </div>
          <Link to="/app/tickets">
            <Button>
              Ir para a fila
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </Card>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="m-0 text-lg font-semibold">Próximos atendimentos</h2><p className="m-0 mt-1 text-sm text-muted-foreground">Acompanhe responsável, prioridade e prazo numa única leitura.</p></div>
          <Link to="/app/tickets" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Abrir fila completa <ArrowRight className="size-4" /></Link>
        </div>
        <div className="hidden grid-cols-[90px_minmax(180px,1fr)_130px_140px_100px_110px] gap-3 border-b border-border pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
          <span>Registro</span><span>Assunto</span><span>Departamento</span><span>Responsável</span><span>Prioridade</span><span>Prazo</span>
        </div>
        <ul className="m-0 divide-y divide-border p-0">
          {open.slice(0, 6).map((t) => {
            const sla = ticketSla(t, tcfg.config);
            const tone = sla === "ok" ? "ok" : sla === "warning" ? "warn" : "danger";
            return <li key={t.id} className="grid gap-2 py-3 lg:grid-cols-[90px_minmax(180px,1fr)_130px_140px_100px_110px] lg:items-center lg:gap-3">
              <span className="font-mono-num text-sm font-semibold text-primary">#{t.number}</span>
              <span className="min-w-0"><strong className="block truncate text-sm font-medium">{t.subject}</strong><small className="text-muted-foreground">Aberto {formatRelative(t.createdAt)}</small></span>
              <span className="text-sm">{t.department}</span><span className="text-sm text-muted-foreground">{t.claimedBy ? `Em atendimento · ${members.find((member) => member.id === t.claimedBy)?.displayName ?? t.claimedBy}` : "Aguardando equipe"}</span>
              <Badge tone={t.priority === "urgent" ? "danger" : t.priority === "high" ? "warn" : "default"}>{t.priority === "urgent" ? "Urgente" : t.priority === "high" ? "Alta" : t.priority === "low" ? "Baixa" : "Normal"}</Badge>
              <Badge tone={tone}>{sla === "ok" ? "No prazo" : sla === "warning" ? "Atenção" : "Atrasado"}</Badge>
            </li>;
          })}
          {open.length === 0 ? <li className="py-8 text-center"><p className="m-0 font-medium">A fila está em dia</p><p className="m-0 mt-1 text-sm text-muted-foreground">Tickets novos aparecem aqui assim que alguém abrir um atendimento.</p></li> : null}
        </ul>
      </section>

      <dl className="grid grid-cols-2 gap-y-3 rounded-xl border border-border bg-card px-4 py-3 lg:grid-cols-4 lg:divide-x lg:divide-border">
        <Summary label="Tickets abertos" value={String(open.length)} hint="sem encerrar" />
        <Summary label="SLA em atraso" value={String(breaches.length)} hint="sem primeira resposta" warn={breaches.length > 0} />
        <Summary label="Formulários" value={String(submissions)} hint="aguardando revisão" />
        <Summary label="Satisfação" value={avg} hint={`${csat.length} avaliações`} />
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="m-0 text-base font-semibold">Auditoria recente do bot</h2>
            <Link to="/app/logs" className="text-sm text-primary">
              Ver logs
            </Link>
          </div>
          <ul className="m-0 space-y-2 p-0">
            {logs.map((event) => (
              <li key={event.id} className="flex gap-3 text-sm">
                <Clock3 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span>
                  <span className="text-muted-foreground">{event.module} · {event.actorId ?? "Sistema"} · {formatRelative(event.at)} · </span>
                  {event.eventType.replaceAll("_", " ")}
                </span>
              </li>
            ))}
            {logs.length === 0 ? <li className="text-sm text-muted-foreground">Nenhum evento retornado pelo bot.</li> : null}
          </ul>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Quick to="/app/tickets" icon={<Ticket className="size-4" />} title="Assumir um ticket" />
        <Quick to="/app/forms" icon={<Ticket className="size-4" />} title="Revisar formulários" />
        <Quick to="/app/protect" icon={<Shield className="size-4" />} title="Testar o AutoMod" />
      </div>

      {logs.some((event) => event.module === "security" && event.severity === "critical") ? (
        <Card>
          <h2 className="mt-0 mb-2 text-base font-semibold">Alertas críticos recentes</h2>
          {logs.filter((event) => event.module === "security" && event.severity === "critical").slice(0, 3).map((event) => (
            <p key={event.id} className="m-0 text-sm text-muted-foreground">
              {event.eventType.replaceAll("_", " ")} · {formatRelative(event.at)}
            </p>
          ))}
        </Card>
      ) : null}
    </div>
  );
}

function Summary({ label, value, hint, warn }: { label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <div className="min-w-0 px-2 first:pl-0 lg:px-4">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className={`m-0 mt-0.5 inline-flex items-baseline gap-2 font-mono-num text-lg font-semibold ${warn ? "text-destructive" : ""}`}>{value}<span className="font-sans text-[11px] font-normal text-muted-foreground">{hint}</span></dd>
    </div>
  );
}

function Quick({ to, icon, title }: { to: string; icon: React.ReactNode; title: string }) {
  return (
    <Link to={to} className="flex min-h-12 items-center gap-2 rounded-2xl bg-card px-4 text-sm font-medium shadow-border">
      {icon}
      {title}
      <ArrowRight className="ml-auto size-4 text-muted-foreground" />
    </Link>
  );
}
