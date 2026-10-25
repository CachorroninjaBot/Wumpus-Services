import { PageHeader } from "@/components/page-header";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, ArrowDownRight, ArrowUpRight, ClipboardList, Clock3, MessageSquareText, RefreshCw, TicketCheck, Tickets, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { getGuildActivity, getGuildTickets } from "@/lib/wumpus/runtime-store";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import { useModule, useWumpus } from "@/lib/wumpus/store";
import type { Ticket } from "@/lib/wumpus/types";
import { formatRelative, formatTime } from "@/lib/utils";

export const Route = createFileRoute("/app/stats")({ component: StatsPage });

type Activity = Awaited<ReturnType<typeof getGuildActivity>>;
type Period = 7 | 30 | 90;

function StatsPage() {
  const gid = useWumpus((state) => state.activeGuildId);
  const guild = useWumpus((state) => state.guilds.find((item) => item.id === state.activeGuildId));
  const tcfg = useModule("tickets");
  const [period, setPeriod] = useState<Period>(7);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const refresh = async (showLoading = false) => {
      const token = getStoredSessionToken();
      if (!token || !gid) {
        if (active) { setError("Entre com Discord e selecione um servidor para consultar as estatísticas."); setLoading(false); }
        return;
      }
      if (inFlight) return;
      inFlight = true;
      if (active) { setRefreshing(true); if (showLoading) { setLoading(true); setActivity(null); setTickets([]); setError(null); } }
      try {
        const [summary, rows] = await Promise.all([
          getGuildActivity({ data: { token, guildId: gid, periodDays: period, slaGoalMinutes: Number(tcfg.config.slaWarningMinutes ?? 60) } }),
          getGuildTickets({ data: { token, guildId: gid } }),
        ]);
        if (active) { setActivity(summary); setTickets(rows); setError(null); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar as estatísticas reais.");
      } finally {
        inFlight = false;
        if (active) { setRefreshing(false); setLoading(false); }
      }
    };
    setSelectedDay(null);
    void refresh(true);
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [gid, period, refreshKey, tcfg.config.slaWarningMinutes]);

  const range = activity?.range;
  const previous = activity?.previousRange;
  const chartData = activity?.days ?? [];
  const ticketsBySelectedDay = useMemo(() => selectedDay ? tickets.filter((ticket) => Number.isFinite(ticket.createdAt) && new Date(ticket.createdAt).toISOString().slice(0, 10) === selectedDay).sort((a, b) => b.createdAt - a.createdAt) : [], [selectedDay, tickets]);
  const selectedDayRow = chartData.find((day) => day.day === selectedDay);
  const dataInRange = Boolean(range && (range.opened || range.closed || chartData.some((day) => day.messages || day.joins || day.automod || day.moderation)));

  const relativeText = (current: number, prior: number) => {
    if (prior === 0) return current === 0 ? "igual ao período anterior" : "novo neste período";
    const difference = current - prior;
    const percent = Math.round((difference / prior) * 100);
    return `${difference > 0 ? "+" : ""}${difference} (${percent > 0 ? "+" : ""}${percent}%) vs. período anterior`;
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageHeader title="Estatísticas" description="Métricas de atendimento e atividade do servidor." />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect aria-label="Período das estatísticas" value={period} onChange={(event) => setPeriod(Number(event.target.value) as Period)} className="h-10 w-auto min-w-36">
            <option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option>
          </NativeSelect>
          <Button size="sm" variant="outline" disabled={refreshing} onClick={() => setRefreshKey((key) => key + 1)}><RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />Atualizar</Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>De {formatDate(range?.start)} a {formatDate(range?.end)} · comparação com os {period} dias anteriores</span>
        <span className="flex flex-wrap items-center gap-2" role="status">
          {activity ? <><Badge tone={activity.bot.status === "online" ? "ok" : activity.bot.status === "offline" ? "warn" : "default"}>{activity.bot.status === "online" ? "Bot conectado" : activity.bot.status === "offline" ? "Bot sem sinal" : "Bot não localizado"}</Badge><span>{activity.bot.lastSeenAt ? `Último sinal ${formatRelative(activity.bot.lastSeenAt)}` : "Sem sinal recente"} · dados consultados {formatTime(activity.refreshedAt)}</span></> : loading ? "Buscando dados do bot…" : "Aguardando dados"}
        </span>
      </div>
      {error ? <Notice tone="error" className="m-0">{error}{activity ? " Os números exibidos são da última sincronização bem-sucedida." : ""}</Notice> : null}
      {activity?.bot.status !== "online" && activity ? <Notice tone="warning" className="m-0">O bot não está enviando atualizações agora. Os dados disponíveis podem estar desatualizados.</Notice> : null}

      <section aria-label="Indicadores do período" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi icon={<Tickets className="size-4" />} label="Tickets criados" value={range ? String(range.opened) : loading ? "…" : "—"} detail={range && previous ? relativeText(range.opened, previous.opened) : "No período selecionado"} />
        <Kpi icon={<TicketCheck className="size-4" />} label="Tickets encerrados" value={range ? String(range.closed) : loading ? "…" : "—"} detail={range && previous ? relativeText(range.closed, previous.closed) : "No período selecionado"} />
        <Kpi icon={<Clock3 className="size-4" />} label="Mediana da 1ª resposta" value={range?.medianResponseMinutes == null ? "—" : formatDuration(range.medianResponseMinutes)} detail={`${range?.responseCount ?? 0} tickets com resposta`} />
        <Kpi icon={<MessageSquareText className="size-4" />} label="Satisfação (CSAT)" value={range?.csat == null ? "—" : `${range.csat.toFixed(1)}/5`} detail={`${range?.csatCount ?? 0} avaliações no período`} />
        <Kpi icon={<Activity className="size-4" />} label="Respostas dentro do prazo" value={range?.slaMet == null ? "—" : `${range.slaMet}%`} detail={Number(tcfg.config.slaWarningMinutes ?? 60) > 0 ? `${range?.slaCount ?? 0} tickets respondidos ou já vencidos · meta ${Number(tcfg.config.slaWarningMinutes ?? 60)} min` : "Meta de resposta desativada"} />
        <Kpi icon={<UsersRound className="size-4" />} label="Fila aberta agora" value={activity ? String(activity.currentOpen) : loading ? "…" : "—"} detail={activity?.oldestUnanswered ? `Mais antigo sem resposta: ${formatRelative(activity.oldestUnanswered.createdAt)}` : "Sem ticket aguardando primeira resposta"} tone={activity?.oldestUnanswered ? "warn" : "default"} />
        <Kpi icon={<ClipboardList className="size-4" />} label="Formulários aguardando" value={activity ? String(activity.pendingForms) : loading ? "…" : "—"} detail="Envios que ainda precisam de análise" tone={activity?.pendingForms ? "warn" : "default"} />
      </section>

      {activity && !dataInRange ? <Card className="border-dashed p-6 text-center"><h2 className="m-0 text-base font-semibold">Ainda sem atividade neste período</h2><p className="mb-0 mt-1 text-sm text-muted-foreground">Quando houver atendimentos ou eventos do bot, eles aparecerão aqui. Tente ampliar o período para consultar o histórico.</p></Card> : null}

      <Card className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="m-0 text-base font-semibold">Atividade por dia</h2><p className="m-0 mt-1 text-sm text-muted-foreground">Selecione um dia no gráfico ou na lista para ver os tickets criados nele.</p></div><div className="flex flex-wrap items-center gap-3"><NativeSelect aria-label="Ver tickets de um dia" value={selectedDay ?? ""} onChange={(event) => setSelectedDay(event.target.value || null)} className="h-9 w-auto min-w-40 text-xs"><option value="">Detalhar um dia…</option>{chartData.map((day) => <option key={day.day} value={day.day}>{formatDate(day.day)}</option>)}</NativeSelect><div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"><LegendDot color="var(--color-primary)" label="Criados" /><LegendDot color="var(--color-ok)" label="Encerrados" /><LegendDot color="var(--color-info)" label="AutoMod" /><LegendDot color="var(--color-warn)" label="Moderação" /></div></div></div>
        <div className="h-[19rem] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} onClick={(state) => { const row = state?.activePayload?.[0]?.payload as { day?: string } | undefined; if (row?.day) setSelectedDay((current) => current === row.day ? null : row.day!); }}>
              <CartesianGrid stroke="var(--wumpus-chart-grid)" vertical={false} />
              <XAxis dataKey="label" interval={period === 90 ? 12 : period === 30 ? 4 : "preserveStartEnd"} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} labelFormatter={(_, rows) => rows[0]?.payload?.day ? formatDate(rows[0].payload.day) : "Atividade"} />
              <Area type="monotone" dataKey="tickets" name="Tickets criados" stroke="var(--color-primary)" fill="var(--wumpus-chart-tickets)" strokeWidth={2} activeDot={{ r: 5 }} animationDuration={320} animationEasing="ease-out" />
              <Area type="monotone" dataKey="closed" name="Tickets encerrados" stroke="var(--color-ok)" fill="var(--color-ok)" fillOpacity={0.08} strokeWidth={1.5} activeDot={{ r: 4 }} animationDuration={320} animationEasing="ease-out" />
              <Area type="monotone" dataKey="automod" name="AutoMod" stroke="var(--color-info)" fill="var(--wumpus-chart-automod)" strokeWidth={1.5} activeDot={{ r: 4 }} animationDuration={320} animationEasing="ease-out" />
              <Area type="monotone" dataKey="moderation" name="Moderação" stroke="var(--color-warn)" fill="var(--color-warn)" fillOpacity={0.06} strokeWidth={1.5} activeDot={{ r: 4 }} animationDuration={320} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {selectedDay ? <section aria-label="Tickets do dia selecionado" className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="m-0 text-sm font-semibold">Tickets criados em {formatDate(selectedDay)}</h3><p className="m-0 mt-1 text-xs text-muted-foreground">{selectedDayRow?.tickets ?? 0} no total{tickets.length >= 500 ? " · lista limitada aos 500 mais recentes" : ""}</p></div><Button size="sm" variant="ghost" onClick={() => setSelectedDay(null)}>Fechar lista</Button></div>
          {ticketsBySelectedDay.length ? <ul className="mt-3 mb-0 max-h-72 space-y-2 overflow-y-auto p-0">{ticketsBySelectedDay.map((ticket) => <li key={ticket.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-card px-3 py-2.5"><span className="font-mono-num text-xs text-muted-foreground">#{ticket.number}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{ticket.subject}</span><Badge tone={ticket.status === "closed" ? "default" : "primary"}>{ticket.status === "closed" ? "Encerrado" : "Aberto"}</Badge><span className="text-xs text-muted-foreground">{ticket.department}</span><a className="text-xs font-medium text-primary underline-offset-2 hover:underline" href={`https://discord.com/channels/${guild?.id}/${ticket.channelName}`} target="_blank" rel="noreferrer">Abrir no Discord</a></li>)}</ul> : <p className="mb-0 mt-3 rounded-xl bg-card px-3 py-3 text-sm text-muted-foreground">Não há tickets deste dia na lista recente do bot.</p>}
        </section> : null}
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-4 sm:p-5"><div><h2 className="m-0 text-base font-semibold">Atendimento por departamento</h2><p className="m-0 mt-1 text-sm text-muted-foreground">Abertos e encerrados no período selecionado.</p></div>{range?.departments.length ? <div className="space-y-2">{range.departments.map((item) => <div key={item.department} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5"><span className="truncate text-sm font-medium">{item.department}</span><span className="text-xs text-muted-foreground">{item.opened} criados</span><span className="text-xs text-muted-foreground">{item.closed} encerrados</span></div>)}</div> : <p className="m-0 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">Não há tickets por departamento para mostrar.</p>}</Card>
        <Card className="space-y-3 p-4 sm:p-5"><div className="flex items-center gap-2"><Activity className="size-4 text-primary" /><div><h2 className="m-0 text-base font-semibold">Comparação do período</h2><p className="m-0 mt-1 text-sm text-muted-foreground">{period} dias atuais contra os {period} anteriores.</p></div></div><Comparison label="Tickets criados" current={range?.opened ?? null} previous={previous?.opened ?? null} /><Comparison label="Tickets encerrados" current={range?.closed ?? null} previous={previous?.closed ?? null} /><Comparison label="Mediana da 1ª resposta" current={range?.medianResponseMinutes ?? null} previous={previous?.medianResponseMinutes ?? null} unit="min" /><Comparison label="CSAT médio" current={range?.csat ?? null} previous={previous?.csat ?? null} unit="/5" /><Comparison label="Respostas dentro do prazo" current={range?.slaMet ?? null} previous={previous?.slaMet ?? null} unit="%" /><Comparison label="Eventos AutoMod" current={range?.automod ?? null} previous={previous?.automod ?? null} /><Comparison label="Ações de moderação" current={range?.moderation ?? null} previous={previous?.moderation ?? null} /></Card>
      </div>

      <Section title="Atividade recente" description="Últimos registros importantes do servidor." className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
        {activity?.recentEvents.length ? <ul className="m-0 divide-y divide-border p-0">{activity.recentEvents.map((event) => <li key={event.id} className="flex flex-wrap items-center gap-2 py-3 first:pt-0 last:pb-0"><Badge tone={event.severity === "critical" || event.severity === "error" ? "danger" : event.severity === "warning" ? "warn" : "default"}>{moduleLabel(event.module)}</Badge><span className="min-w-0 flex-1 text-sm">{eventLabel(event.eventType)}</span><span className="text-xs text-muted-foreground">{formatRelative(event.at)}</span></li>)}</ul> : <p className="m-0 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">Ainda não há registros recentes para este servidor.</p>}
      </Section>
    </div>
  );
}

function Kpi({ icon, label, value, detail, tone = "default" }: { icon: React.ReactNode; label: string; value: string; detail: string; tone?: "default" | "warn" }) {
  return <Card className="flex min-h-32 items-start gap-3 p-4"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tone === "warn" ? "bg-warn/10 text-warn" : "bg-muted text-muted-foreground"}`}>{icon}</span><div className="min-w-0"><p className="m-0 text-xs text-muted-foreground">{label}</p><p className="mb-0 mt-1 text-2xl font-semibold tracking-tight">{value}</p><p className="mb-0 mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div></Card>;
}

function Comparison({ label, current, previous, unit }: { label: string; current: number | null; previous: number | null; unit?: "min" | "/5" | "%" }) {
  if (current == null || previous == null) return <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5"><span className="text-sm">{label}</span><span className="text-xs text-muted-foreground">Sem dados suficientes</span></div>;
  const delta = current - previous;
  if (unit) {
    const value = (amount: number) => unit === "min" ? formatDuration(amount) : unit === "/5" ? `${amount.toFixed(1)}/5` : `${amount}%`;
    const difference = Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    return <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5"><span className="text-sm">{label}</span><span className="text-right text-xs text-muted-foreground">{value(current)} vs. {value(previous)} <span className="block">{delta > 0 ? "+" : delta < 0 ? "−" : ""}{difference}{unit === "/5" ? " pontos" : unit === "%" ? " p.p." : " min"}</span></span></div>;
  }
  const phrase = previous === 0 ? (current === 0 ? "Sem mudança" : "Novo") : `${Math.abs(Math.round((delta / previous) * 100))}%`;
  return <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5"><span className="text-sm">{label}</span><span className="flex items-center gap-1 text-xs text-muted-foreground">{delta > 0 ? <ArrowUpRight className="size-3.5" /> : delta < 0 ? <ArrowDownRight className="size-3.5" /> : null}{phrase} · {current} vs. {previous}</span></div>;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: color }} />{label}</span>;
}

function moduleLabel(module: string) {
  const labels: Record<string, string> = { automod: "AutoMod", tickets: "Atendimento", ticket: "Atendimento", forms: "Formulários", moderation: "Moderação", security: "Segurança", members: "Membros", knowledge: "Base de conhecimento" };
  return labels[module] ?? "Servidor";
}

function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    ticket_opened: "Novo ticket aberto",
    ticket_closed: "Ticket encerrado",
    ticket_claimed: "Ticket assumido pela equipe",
    ticket_reopened: "Ticket reaberto",
    ticket_sla_warning: "Ticket próximo do prazo de resposta",
    ticket_sla_breach: "Ticket passou do prazo de resposta",
    form_submitted: "Novo formulário enviado",
    form_approved: "Formulário aprovado",
    form_rejected: "Formulário recusado",
    knowledge_answered: "Dúvida respondida pela base de conhecimento",
    member_joined: "Novo membro entrou no servidor",
    member_left: "Membro saiu do servidor",
    moderation_ban: "Banimento aplicado",
    moderation_timeout: "Timeout aplicado",
    moderation_kick: "Expulsão aplicada",
    moderation_warn: "Advertência aplicada",
  };
  return labels[eventType] ?? eventType.replace(/_/g, " ").replace(/^./, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  return hours < 24 ? `${hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h` : `${(hours / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`;
}

function formatDate(value: string | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
