import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, AlertTriangle, Clock3, Ticket, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ticketSla } from "@/lib/wumpus/engine";
import { useActiveGuild, useModule, useWumpus } from "@/lib/wumpus/store";
import { formatRelative } from "@/lib/utils";

export const Route = createFileRoute("/app/")({ component: Overview });

function Overview() {
  const guild = useActiveGuild();
  const gid = useWumpus((s) => s.activeGuildId);
  const allTickets = useWumpus((s) => s.tickets);
  const tcfg = useModule("tickets");
  const allIncidents = useWumpus((s) => s.incidents);
  const allLogs = useWumpus((s) => s.logs);
  const allSubs = useWumpus((s) => s.submissions);
  const lockdown = Boolean(useModule("security").config.lockdown);
  const automod = useModule("automod");
  const [cmd, setCmd] = useState("/config status");
  const [cmdOut, setCmdOut] = useState<string | null>(null);

  const tickets = allTickets.filter((t) => t.guildId === gid);
  const incidents = allIncidents.filter((i) => i.guildId === gid && i.status !== "closed");
  const logs = allLogs.filter((l) => l.guildId === gid).slice(0, 6);
  const submissions = allSubs.filter((x) => x.guildId === gid && x.status === "pending");

  const open = tickets.filter((t) => t.status === "open" || t.status === "claimed");
  const breaches = open.filter((t) => ticketSla(t, tcfg.config) !== "ok");
  const csat = tickets.filter((t) => t.feedback);
  const avg =
    csat.length === 0 ? "—" : (csat.reduce((s, t) => s + (t.feedback?.rating ?? 0), 0) / csat.length).toFixed(1);

  function runCommand(raw: string) {
    const parts = raw.trim().replace(/^\//, "").split(/\s+/);
    const name = parts[0]?.toLowerCase() ?? "";
    if (name === "config") {
      setCmdOut(
        `Plano ${guild.plan} · preset ${guild.preset}\nAtendimento ${tcfg.enabled ? "ligado" : "pausado"} · SLA ${String(tcfg.config.slaWarningMinutes)} min\nAutoMod ${automod.enabled ? String(automod.config.action) : "pausado"} · lockdown ${lockdown ? "sim" : "não"}`,
      );
      return;
    }
    if (name === "stats") {
      setCmdOut(`Abertos ${open.length} · SLA atrasado ${breaches.length} · CSAT ${avg} · candidaturas ${submissions.length}`);
      return;
    }
    if (name === "ticket") {
      setCmdOut(open.length ? open.map((t) => `#${t.number} ${t.department} — ${t.subject}`).join("\n") : "Fila vazia.");
      return;
    }
    if (name === "mod") {
      setCmdOut("Use Moderação para advertir, silenciar, expulsar ou banir. O limiar de strikes está nas regras daquele painel.");
      return;
    }
    setCmdOut("Comandos: /config status · /stats · /ticket · /mod");
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="m-0 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            {guild.name}
          </p>
          <h1 className="mt-1 mb-0 text-2xl font-semibold tracking-tight">O que precisa de você agora</h1>
        </div>
        {lockdown ? <Badge tone="danger">Lockdown ativo</Badge> : <Badge tone="ok">Bot operacional</Badge>}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Fila aberta" value={String(open.length)} hint="tickets sem encerrar" />
        <Stat label="SLA em atraso" value={String(breaches.length)} hint="sem 1ª resposta a tempo" warn={breaches.length > 0} />
        <Stat label="Candidaturas" value={String(submissions.length)} hint="esperando review" />
        <Stat label="CSAT" value={avg} hint={`${csat.length} avaliações`} />
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="m-0 text-base font-semibold">Fila</h2>
            <Link to="/app/tickets" className="text-sm text-primary">
              Ver todos
            </Link>
          </div>
          <ul className="m-0 space-y-2 p-0">
            {open.slice(0, 4).map((t) => {
              const sla = ticketSla(t, tcfg.config);
              return (
                <li key={t.id} className="flex items-start justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm font-medium">
                      #{t.number} · {t.subject}
                    </p>
                    <p className="m-0 text-xs text-muted-foreground">
                      {t.department} · {formatRelative(t.createdAt)}
                    </p>
                  </div>
                  <Badge tone={sla === "ok" ? "ok" : sla === "warning" ? "warn" : "danger"}>
                    {sla === "ok" ? "no prazo" : sla === "warning" ? "alerta" : "atraso"}
                  </Badge>
                </li>
              );
            })}
            {open.length === 0 ? <p className="m-0 text-sm text-muted-foreground">Nada na fila.</p> : null}
          </ul>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="m-0 text-base font-semibold">Auditoria recente</h2>
            <Link to="/app/logs" className="text-sm text-primary">
              Ver logs
            </Link>
          </div>
          <ul className="m-0 space-y-2 p-0">
            {logs.map((l) => (
              <li key={l.id} className="flex gap-3 text-sm">
                <Clock3 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span>
                  <span className="text-muted-foreground">{l.actor} · </span>
                  {l.summary}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="mt-0 text-base font-semibold">Comandos da equipe</h2>
        <p className="text-sm text-muted-foreground">Os mesmos slash que a staff usa no Discord, lendo a config deste servidor.</p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            runCommand(cmd);
          }}
        >
          <Input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="/config status" />
          <Button type="submit">Rodar</Button>
        </form>
        {cmdOut ? <pre className="mt-3 mb-0 whitespace-pre-wrap font-sans text-sm">{cmdOut}</pre> : null}
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Quick to="/app/tickets" icon={<Ticket className="size-4" />} title="Assumir um ticket" />
        <Quick to="/app/forms" icon={<Ticket className="size-4" />} title="Revisar candidaturas" />
        <Quick to="/app/protect" icon={<Shield className="size-4" />} title="Testar o AutoMod" />
      </div>

      {incidents.length > 0 ? (
        <Card>
          <h2 className="mt-0 mb-2 text-base font-semibold">Incidentes abertos</h2>
          {incidents.map((i) => (
            <p key={i.id} className="m-0 text-sm text-muted-foreground">
              {i.title} — {i.detail}
            </p>
          ))}
        </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <Card className="p-4">
      <p className="m-0 text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 mb-0 font-mono-num text-3xl font-semibold ${warn ? "text-destructive" : ""}`}>{value}</p>
      <p className="m-0 text-xs text-muted-foreground">{hint}</p>
    </Card>
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
