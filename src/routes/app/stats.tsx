import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ticketSla } from "@/lib/wumpus/engine";
import { useModule, useWumpus } from "@/lib/wumpus/store";
import { getGuildActivity, getGuildTickets } from "@/lib/wumpus/runtime-store";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import type { Ticket } from "@/lib/wumpus/types";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/app/stats")({ component: StatsPage });

function StatsPage() {
  const gid = useWumpus((s) => s.activeGuildId);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activity, setActivity] = useState<Awaited<ReturnType<typeof getGuildActivity>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tcfg = useModule("tickets");

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const token = getStoredSessionToken();
      try {
        const [rows, summary] = await Promise.all([
          getGuildTickets({ data: { token, guildId: gid } }),
          getGuildActivity({ data: { token, guildId: gid } }),
        ]);
        if (active) { setTickets(rows); setActivity(summary); setError(null); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar as estatísticas reais.");
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [gid]);
  const closed = tickets.filter((t) => t.closedAt);
  const rated = tickets.filter((t) => t.feedback);
  const csat = rated.length ? rated.reduce((s, t) => s + (t.feedback?.rating ?? 0), 0) / rated.length : 0;
  const first = tickets.filter((t) => t.firstResponseAt);
  const avgFirst =
    first.length === 0
      ? 0
      : first.reduce((s, t) => s + (t.firstResponseAt! - t.createdAt) / 60_000, 0) / first.length;
  const late = tickets.filter((t) => ticketSla(t, tcfg.config) === "breach").length;

  const series = activity?.days.map((day) => ({ d: day.label, tickets: day.tickets, automod: day.automod, mod: day.moderation })) ?? [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1 className="m-0 text-xl font-semibold tracking-tight">Estatísticas</h1>
      {error ? <p role="alert" className="m-0 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Tickets recentes" value={String(tickets.length)} />
        <Kpi label="1ª resposta média" value={`${Math.round(avgFirst)} min`} />
        <Kpi label="CSAT" value={rated.length ? csat.toFixed(1) : "—"} />
        <Kpi label="SLA estourado" value={String(late)} />
      </div>
      <Card className="h-72">
        <p className="m-0 mb-2 text-sm text-muted-foreground">Atividade dos últimos 7 dias, sincronizada do bot</p>
        <ResponsiveContainer width="100%" height="90%">
          <AreaChart data={series}>
            <CartesianGrid stroke="var(--wumpus-chart-grid)" vertical={false} />
            <XAxis dataKey="d" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }}
            />
            <Area type="monotone" dataKey="tickets" stroke="var(--color-primary)" fill="var(--wumpus-chart-tickets)" />
            <Area type="monotone" dataKey="automod" stroke="var(--color-info)" fill="var(--wumpus-chart-automod)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
      <p className="m-0 text-sm text-muted-foreground">
        Encerrados: {closed.length} · hits AutoMod (7 dias): {activity?.totals.automod ?? "—"} · casos de mod (7 dias): {activity?.totals.moderation ?? "—"}
      </p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="m-0 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 mb-0 font-mono-num text-3xl font-semibold">{value}</p>
    </Card>
  );
}
