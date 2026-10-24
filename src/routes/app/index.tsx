import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, AlertTriangle, CheckCircle2, Clock3, ClipboardCheck, Ticket, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ticketSla } from "@/lib/wumpus/engine";
import { useGuildMembers, useModule, useWumpus } from "@/lib/wumpus/store";
import { formatRelative } from "@/lib/utils";
import { getGuildActivity, getGuildTickets, getPublishStatus, type PublishStatus } from "@/lib/wumpus/runtime-store";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import type { Ticket as WumpusTicket } from "@/lib/wumpus/types";

export const Route = createFileRoute("/app/")({ component: Overview });

function Overview() {
  const members = useGuildMembers();
  const gid = useWumpus((s) => s.activeGuildId);
  const tcfg = useModule("tickets");
  const lockdown = Boolean(useModule("security").config.lockdown);
  const [publishStatuses, setPublishStatuses] = useState<PublishStatus[]>([]);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<WumpusTicket[]>([]);
  const [activity, setActivity] = useState<Awaited<ReturnType<typeof getGuildActivity>> | null>(null);
  // #3 — loading state para feedback visual do refresh periódico
  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const submissions = activity?.pendingForms ?? 0;
  const logs = activity?.recentEvents ?? [];
  const pendingSync = publishStatuses.filter((job) => job.status === "queued").length;
  const failedSync = publishStatuses.filter((job) => job.status === "failed");
  const latestAttempt = [...publishStatuses].sort((a, b) => (b.at ?? b.createdAt) - (a.at ?? a.createdAt))[0];
  const latestConfirmed = publishStatuses.filter((job) => job.status === "done").sort((a, b) => (b.at ?? b.createdAt) - (a.at ?? a.createdAt))[0];

  // #7 — Map id→member para lookup O(1) em vez de .find() O(n) por ticket
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  useEffect(() => {
    let active = true;
    const refreshStatus = async () => {
      if (active) setLoading(true);
      try {
        const token = getStoredSessionToken();
        if (!token) {
          if (active) setStatusError(null);
          return;
        }
        const [statuses, liveTickets, liveActivity] = await Promise.all([
          getPublishStatus({ data: { token, guildId: gid } }),
          getGuildTickets({ data: { token, guildId: gid } }),
          getGuildActivity({ data: { token, guildId: gid } }),
        ]);
        if (active) {
          setPublishStatuses(statuses);
          setTickets(liveTickets);
          setActivity(liveActivity);
          setStatusError(null);
          setLastUpdatedAt(new Date());
        }
      } catch (error) {
        if (active) setStatusError(error instanceof Error ? error.message : "Não foi possível consultar o estado real do bot.");
      } finally {
        if (active) setLoading(false);
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
  const priorityTicket = breaches[0] ?? open[0] ?? null;
  const csat = tickets.filter((t) => t.feedback);
  const avg =
    csat.length === 0 ? "—" : (csat.reduce((s, t) => s + (t.feedback?.rating ?? 0), 0) / csat.length).toFixed(1);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="relative isolate overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-border sm:p-6"><div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 -z-10 size-56 rounded-full bg-primary/10 blur-3xl" /><div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Visão geral</p>
          <h1 className="m-0 mt-1 text-2xl font-semibold tracking-tight">O que precisa de atenção?</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Acompanhe a operação do seu servidor sem procurar em vários lugares.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lockdown ? <Badge tone="danger">Lockdown ativo</Badge> : null}
          <Link to="/app/tickets"><Button size="sm">Abrir fila <ArrowRight className="size-4" /></Button></Link>
        </div>
        </div>
      </header>

      {/* Barra de status do bot */}
      <div className="grid gap-2 rounded-xl border border-border bg-card px-3 py-3 text-sm sm:grid-cols-3" aria-label="Estado do bot e das publicações">
        <StatusLine label="Bot neste servidor" tone={activity?.bot.status === "online" ? "ok" : activity?.bot.status === "offline" ? "danger" : "warn"}>
          {activity?.bot.status === "online" ? `Conectado${activity.bot.pingMs == null ? "" : ` · ${activity.bot.pingMs} ms`}` : activity?.bot.status === "offline" ? "Sem conexão recente" : "Estado indisponível"}
        </StatusLine>
        <StatusLine label="Fila de publicação" tone={failedSync.length ? "danger" : pendingSync ? "warn" : "ok"}>
          {pendingSync || failedSync.length ? `${pendingSync} aguardando · ${failedSync.length} com falha` : "Sem pendências"}
          {failedSync[0]?.detail ? <span className="block truncate text-xs text-destructive">{failedSync[0].detail}</span> : null}
        </StatusLine>
        <StatusLine label="Última publicação confirmada" tone={latestConfirmed ? "ok" : "warn"}>
          {latestConfirmed ? formatRelative(latestConfirmed.at ?? latestConfirmed.createdAt) : "Ainda não confirmada pelo bot"}
          {latestAttempt?.status === "failed" ? <span className="block text-xs text-muted-foreground">Última tentativa falhou · {formatRelative(latestAttempt.at ?? latestAttempt.createdAt)}</span> : null}
        </StatusLine>
      </div>

      {/* #3 — Feedback de última atualização */}
      <div className="flex items-center justify-between">
        {statusError ? <p className="m-0 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">Não foi possível atualizar o estado: {statusError}</p> : <span />}
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
          {loading ? (
            <><span className="inline-block size-2 animate-pulse rounded-full bg-warn" />Atualizando…</>
          ) : lastUpdatedAt ? (
            <>Atualizado às {lastUpdatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>
          ) : null}
        </span>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary icon={<Ticket className="size-4" />} label="Tickets abertos" value={String(open.length)} hint="sem encerrar" />
        <Summary icon={<AlertTriangle className="size-4" />} label="SLA em atraso" value={String(breaches.length)} hint="sem primeira resposta" warn={breaches.length > 0} />
        <Summary icon={<ClipboardCheck className="size-4" />} label="Formulários" value={String(submissions)} hint="aguardando revisão" />
        <Summary icon={<CheckCircle2 className="size-4" />} label="Satisfação" value={avg} hint={csat.length > 0 ? `${csat.length} avaliações` : "Solicite feedback nos tickets"} />
      </dl>

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
        {/* #5 — text-[11px] → text-xs (12px mínimo) */}
        <div className="hidden grid-cols-[90px_minmax(180px,1fr)_130px_140px_100px_110px] gap-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
          <span>Registro</span><span>Assunto</span><span>Departamento</span><span>Responsável</span><span>Prioridade</span><span>Prazo</span>
        </div>
        <ul className="m-0 divide-y divide-border p-0">
          {open.slice(0, 6).map((t) => {
            const sla = ticketSla(t, tcfg.config);
            const tone = sla === "ok" ? "ok" : sla === "warning" ? "warn" : "danger";
            return <li key={t.id} className="grid gap-2 py-3 lg:grid-cols-[90px_minmax(180px,1fr)_130px_140px_100px_110px] lg:items-center lg:gap-3">
              <span className="font-mono-num text-sm font-semibold text-primary">#{t.number}</span>
              <span className="min-w-0"><a href={`/app/tickets?ticket=${encodeURIComponent(t.id)}`} className="block truncate text-sm font-medium text-foreground underline-offset-2 hover:text-primary hover:underline">{t.subject || `Ticket #${t.number}`}</a><small className="text-muted-foreground">Aberto {formatRelative(t.createdAt)}</small></span>
              {/* #7 — lookup O(1) via memberById */}
              <span className="text-sm">{t.department}</span><span className="text-sm text-muted-foreground">{t.claimedBy ? `Em atendimento · ${memberById.get(t.claimedBy)?.displayName ?? t.claimedBy}` : "Aguardando equipe"}</span>
              <Badge tone={t.priority === "urgent" ? "danger" : t.priority === "high" ? "warn" : "default"}>{t.priority === "urgent" ? "Urgente" : t.priority === "high" ? "Alta" : t.priority === "low" ? "Baixa" : "Normal"}</Badge>
              <Badge tone={tone}>{sla === "ok" ? "No prazo" : sla === "warning" ? "Atenção" : "Atrasado"}</Badge>
            </li>;
          })}
          {open.length === 0 ? <li className="py-8 text-center"><p className="m-0 font-medium">A fila está em dia</p><p className="m-0 mt-1 text-sm text-muted-foreground">Tickets novos aparecem aqui assim que alguém abrir um atendimento.</p></li> : null}
        </ul>
      </section>

      {/* #4 — Auditoria em largura total (sem grid de 2 colunas vazio) */}
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
              <span className="min-w-0">
                <strong className="font-medium">{eventLabel(event.eventType)}</strong>
                {/* #7 — memberById também no log de auditoria */}
                <span className="block truncate text-xs text-muted-foreground">{moduleLabel(event.module)} · {event.actorId ? memberById.get(event.actorId)?.displayName ?? "Equipe" : "Wumpus"} · {formatRelative(event.at)}</span>
              </span>
            </li>
          ))}
          {logs.length === 0 ? <li className="text-sm text-muted-foreground">Nenhum evento retornado pelo bot.</li> : null}
        </ul>
      </Card>

      <section aria-labelledby="next-actions-title" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-primary">Próximo passo</p>
            <h2 id="next-actions-title" className="m-0 mt-1 text-lg font-semibold">Ações para manter a operação fluindo</h2>
          </div>
          <span className="text-xs text-muted-foreground">Atalhos para os módulos mais usados</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {/* #8 — Quick usa Link do TanStack Router para navegação client-side */}
          <Quick to={priorityTicket ? `/app/tickets?ticket=${encodeURIComponent(priorityTicket.id)}` : "/app/tickets"} icon={<Ticket className="size-4" />} title={priorityTicket ? breaches.length ? `Abrir ticket atrasado #${priorityTicket.number}` : `Abrir ticket #${priorityTicket.number}` : "Abrir fila de tickets"} />
          {/* #2 — Ícone correto para formulários */}
          <Quick to="/app/forms" icon={<ClipboardCheck className="size-4" />} title={submissions ? `Revisar ${submissions} formulário${submissions === 1 ? "" : "s"}` : "Revisar formulários"} />
          <Quick to="/app/protect" icon={<Shield className="size-4" />} title="Testar o AutoMod" />
        </div>
      </section>

      {logs.some((event) => event.module === "security" && event.severity === "critical") ? (
        <Card>
          <h2 className="mt-0 mb-2 text-base font-semibold">Alertas críticos recentes</h2>
          {logs.filter((event) => event.module === "security" && event.severity === "critical").slice(0, 3).map((event) => (
            <p key={event.id} className="m-0 text-sm text-muted-foreground">
              {eventLabel(event.eventType)} · {formatRelative(event.at)}
            </p>
          ))}
        </Card>
      ) : null}
    </div>
  );
}

function Summary({ icon, label, value, hint, warn }: { icon: React.ReactNode; label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-border transition-transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between gap-3">
        <dt className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
        <span className={warn ? "text-destructive" : "text-primary"} aria-hidden="true">{icon}</span>
      </div>
      <dd className={`m-0 mt-3 flex items-baseline gap-2 font-mono-num text-2xl font-semibold tracking-tight ${warn ? "text-destructive" : ""}`}>
        {value}<span className="font-sans text-xs font-normal text-muted-foreground">{hint}</span>
      </dd>
    </div>
  );
}

// #8 — Quick usa Link do TanStack Router em vez de <a href> nativo
function Quick({ to, icon, title }: { to: string; icon: React.ReactNode; title: string }) {
  return (
    <Link to={to} className="flex min-h-12 items-center gap-2 rounded-2xl bg-card px-4 text-sm font-medium shadow-border hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {icon}
      {title}
      <ArrowRight className="ml-auto size-4 text-muted-foreground" />
    </Link>
  );
}

function StatusLine({ label, tone, children }: { label: string; tone: "ok" | "warn" | "danger"; children: React.ReactNode }) {
  return <div className="min-w-0"><span className="block text-xs text-muted-foreground">{label}</span><span className="mt-1 flex min-w-0 items-start gap-2"><i className={`mt-1 inline-block size-2 shrink-0 rounded-full ${tone === "ok" ? "bg-ok" : tone === "danger" ? "bg-destructive" : "bg-warn"}`} /><span className="min-w-0 truncate">{children}</span></span></div>;
}

function moduleLabel(module: string) {
  const labels: Record<string, string> = { tickets: "Atendimento", forms: "Formulários", automod: "Proteção", security: "Segurança", moderation: "Moderação", knowledge: "Base de conhecimento", members: "Membros", staff: "Equipe", automation: "Automação", integrations: "Integrações", roles: "Cargos", channels: "Canais", bans: "Banimentos" };
  return labels[module] ?? "Servidor";
}

function eventLabel(eventType: string) {
  const exact: Record<string, string> = {
    ticket_opened: "Novo atendimento aberto", ticket_claimed: "Atendimento assumido", ticket_closed: "Atendimento encerrado", ticket_reopened: "Atendimento reaberto", ticket_priority_changed: "Prioridade alterada", ticket_sla_warning: "Prazo de resposta próximo", ticket_sla_breach: "Prazo de resposta ultrapassado",
    form_submitted: "Nova resposta recebida", form_approved: "Resposta aprovada", form_rejected: "Resposta recusada", knowledge_answered: "Resposta sugerida pela base de conhecimento",
    member_joined: "Novo membro entrou", member_left: "Membro saiu", member_updated: "Perfil de membro atualizado", automation_awaiting_approval: "Automação aguarda aprovação", automation_failed: "Automação não foi concluída", staff_overloaded: "Equipe acima da capacidade", staff_inactive: "Atendente inativo",
  };
  if (exact[eventType]) return exact[eventType];
  if (eventType.startsWith("automod_")) return "Regra automática aplicada";
  if (eventType.startsWith("moderation_")) return "Ação de moderação registrada";
  if (eventType.startsWith("security_")) return "Alerta de segurança registrado";
  if (eventType.startsWith("integration_")) return "Integração atualizada";
  return "Atividade registrada";
}
