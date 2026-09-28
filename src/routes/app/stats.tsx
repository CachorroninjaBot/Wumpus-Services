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

export const Route = createFileRoute("/app/stats")({ component: StatsPage });

function StatsPage() {
  const gid = useWumpus((s) => s.activeGuildId);
  const allTickets = useWumpus((s) => s.tickets);
  const allHits = useWumpus((s) => s.automodHits);
  const allCases = useWumpus((s) => s.cases);
  const tickets = allTickets.filter((t) => t.guildId === gid);
  const hits = allHits.filter((h) => h.guildId === gid);
  const cases = allCases.filter((c) => c.guildId === gid);
  const tcfg = useModule("tickets");
  const closed = tickets.filter((t) => t.closedAt);
  const rated = tickets.filter((t) => t.feedback);
  const csat = rated.length ? rated.reduce((s, t) => s + (t.feedback?.rating ?? 0), 0) / rated.length : 0;
  const first = tickets.filter((t) => t.firstResponseAt);
  const avgFirst =
    first.length === 0
      ? 0
      : first.reduce((s, t) => s + (t.firstResponseAt! - t.createdAt) / 60_000, 0) / first.length;
  const late = tickets.filter((t) => ticketSla(t, tcfg.config) === "breach").length;

  const series = Array.from({ length: 7 }, (_, index) => {
    const end = new Date();
    end.setHours(24, 0, 0, 0);
    const dayEnd = end.getTime() - (6 - index) * 86_400_000;
    const dayStart = dayEnd - 86_400_000;
    const label = new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(new Date(dayStart + 3_600_000));
    return {
      d: index === 6 ? "hoje" : label.replace(".", ""),
      tickets: tickets.filter((t) => t.createdAt >= dayStart && t.createdAt < dayEnd).length,
      automod: hits.filter((h) => h.at >= dayStart && h.at < dayEnd).length,
      mod: cases.filter((c) => c.createdAt >= dayStart && c.createdAt < dayEnd).length,
    };
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1 className="m-0 text-xl font-semibold tracking-tight">Estatísticas</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Tickets no período" value={String(tickets.length)} />
        <Kpi label="1ª resposta média" value={`${Math.round(avgFirst)} min`} />
        <Kpi label="CSAT" value={rated.length ? csat.toFixed(1) : "—"} />
        <Kpi label="SLA estourado" value={String(late)} />
      </div>
      <Card className="h-72">
        <p className="m-0 mb-2 text-sm text-muted-foreground">Atividade dos últimos 7 dias, a partir dos eventos reais</p>
        <ResponsiveContainer width="100%" height="90%">
          <AreaChart data={series}>
            <CartesianGrid stroke="rgba(243,244,247,0.08)" vertical={false} />
            <XAxis dataKey="d" tick={{ fill: "#9aa0ad", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#9aa0ad", fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{ background: "#16161d", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}
            />
            <Area type="monotone" dataKey="tickets" stroke="#7c5cff" fill="rgba(124,92,255,0.25)" />
            <Area type="monotone" dataKey="automod" stroke="#5b8def" fill="rgba(91,141,239,0.15)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
      <p className="m-0 text-sm text-muted-foreground">
        Encerrados com transcrição: {closed.filter((t) => t.transcript).length} · hits AutoMod: {hits.length} · casos
        de mod: {cases.length}
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
