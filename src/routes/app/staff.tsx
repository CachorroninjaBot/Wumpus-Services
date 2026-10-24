import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MemberAvatar } from "@/components/brand";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DiscordMultiSelect, DiscordSelect } from "@/components/discord-select";
import { ticketSla } from "@/lib/wumpus/engine";
import { getGuildTickets } from "@/lib/wumpus/runtime-store";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import type { Ticket } from "@/lib/wumpus/types";
import { useGuildMembers, useModule, useWumpus } from "@/lib/wumpus/store";

export const Route = createFileRoute("/app/staff")({ component: StaffPage });

function StaffPage() {
  const gid = useWumpus((s) => s.activeGuildId);
  const members = useGuildMembers();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const scfg = useModule("staff");
  const tcfg = useModule("tickets");
  const updateConfig = useWumpus((s) => s.updateConfig);
  const roles = useWumpus((s) => s.roles[gid] ?? []);
  const staffRoleRefs = (scfg.config.staffRoleIds as string[]) ?? [];
  const staffRoles = roles.filter((role) => staffRoleRefs.includes(role.id) || staffRoleRefs.includes(role.name)).map((role) => role.id);
  const agentIds = [...new Set(tickets.map((ticket) => ticket.claimedBy).filter((id): id is string => Boolean(id)))];
  const staff = agentIds.map((id) => members.find((member) => member.id === id) ?? { id, displayName: `Atendente · ${id.slice(-4)}`, hue: 176, roleIds: [] as string[] });
  const goal = Number(scfg.config.responseTimeGoalMinutes ?? 30);
  const maxC = Number(scfg.config.maxConcurrentTickets ?? 5);
  const [windowDays, setWindowDays] = useState(30);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const token = getStoredSessionToken();
      if (!token || !gid) {
        if (active) {
          setTickets([]);
          setTicketError("Entre com Discord para ver a atividade real da equipe.");
          setTicketsLoading(false);
        }
        return;
      }
      try {
        const rows = await getGuildTickets({ data: { token, guildId: gid } });
        if (active) { setTickets(rows); setTicketError(null); setTicketsLoading(false); }
      } catch (error) {
        if (active) {
          setTicketError(error instanceof Error ? error.message : "Não foi possível carregar os tickets deste servidor.");
          setTicketsLoading(false);
        }
      }
    };
    setTickets([]);
    setTicketsLoading(true);
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [gid, refreshKey]);
  const metricsCutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const metricTickets = tickets.filter((ticket) => ticket.createdAt >= metricsCutoff);
  const unassigned = tickets.filter((ticket) => (ticket.status === "open" || ticket.status === "claimed") && !ticket.claimedBy).length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <h1 className="m-0 text-xl font-semibold tracking-tight">Equipe</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="m-0 text-xs text-muted-foreground">Meta de 1ª resposta</p>
          <p className="mt-1 mb-0 font-mono-num text-2xl font-semibold">{goal} min</p>
        </Card>
        <Card className="p-4">
          <p className="m-0 text-xs text-muted-foreground">Máx. simultâneos</p>
          <p className="mt-1 mb-0 font-mono-num text-2xl font-semibold">{maxC}</p>
        </Card>
        <Card className="p-4"><p className="m-0 text-xs text-muted-foreground">Sem responsável</p><p className="mt-1 mb-0 font-mono-num text-2xl font-semibold">{ticketsLoading || ticketError ? "—" : unassigned}</p></Card>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="m-0 text-base font-semibold">Atividade por responsável</h2><p className="m-0 mt-1 text-sm text-muted-foreground">Tickets atribuídos consideram até 500 registros reais recentes, criados nos últimos {windowDays} dias. Atualiza a cada 15 segundos.</p><p className="m-0 mt-1 text-xs text-muted-foreground">O bot ainda não registra quem enviou a primeira resposta; tempos médios e avaliações individuais não são atribuídos para evitar números incorretos.</p></div><div className="flex items-end gap-2"><div><Label htmlFor="staff-window">Período</Label><NativeSelect id="staff-window" value={windowDays} onChange={(event) => setWindowDays(Number(event.target.value))}><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option></NativeSelect></div><Button variant="outline" size="sm" disabled={ticketsLoading} onClick={() => { setTicketsLoading(true); setRefreshKey((key) => key + 1); }}>{ticketsLoading ? "Atualizando…" : "Atualizar"}</Button></div></div>
      {ticketError ? <p className="m-0 rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn" role="alert">{ticketError}</p> : null}
      <section className="space-y-3 rounded-xl border border-border p-4">
        <div><h2 className="m-0 text-base font-semibold">Quem atende os tickets?</h2><p className="m-0 mt-1 text-sm text-muted-foreground">Escolha os cargos da equipe. Só membros com esses cargos entram na lista e recebem alertas.</p></div>
        <DiscordMultiSelect value={[...staffRoles]} onChange={(staffRoleIds) => updateConfig("staff", { staffRoleIds })} />
      </section>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Pessoa</th>
              <th className="px-4 py-3 font-medium">Carga</th>
              <th className="px-4 py-3 font-medium">Fora do prazo</th>
              <th className="px-4 py-3 font-medium">Tickets atribuídos no período</th>
            </tr>
          </thead>
          <tbody>
            {ticketsLoading ? <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Carregando atividade real do bot…</td></tr> : null}
            {!ticketsLoading && ticketError ? <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Não foi possível calcular as métricas com os tickets deste servidor.</td></tr> : null}
            {!ticketsLoading && !ticketError && !tickets.length ? <tr><td colSpan={4} className="px-4 py-10 text-center"><p className="m-0 font-medium">Ainda não há tickets registrados</p><p className="mb-0 mt-1 text-sm text-muted-foreground">As métricas aparecerão quando o bot registrar os primeiros atendimentos neste servidor.</p></td></tr> : null}
            {!ticketsLoading && !ticketError && tickets.length > 0 && !staff.length ? <tr><td colSpan={4} className="px-4 py-10 text-center"><p className="m-0 font-medium">Nenhum responsável registrado nos tickets</p><p className="mb-0 mt-1 text-sm text-muted-foreground">Quando alguém da equipe assumir um atendimento, sua carga aparecerá aqui.</p></td></tr> : null}
            {!ticketsLoading && !ticketError ? staff.map((s) => {
              const mine = metricTickets.filter((t) => t.claimedBy === s.id);
              const open = tickets.filter((t) => t.claimedBy === s.id && (t.status === "open" || t.status === "claimed"));
              const late = open.filter((t) => ticketSla(t, tcfg.config) !== "ok").length;
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MemberAvatar name={s.displayName} hue={s.hue} size={28} />
                      <span>
                        {s.displayName}
                        <span className="block text-xs text-muted-foreground">
                          {members.some((member) => member.id === s.id) ? roles.filter((r) => s.roleIds.includes(r.id)).map((r) => r.name).join(" · ") : "ID do atendente registrado pelo bot"}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono-num">
                    {open.length}/{maxC}
                    {open.length >= maxC ? <Badge tone="warn" className="ml-2">cheio</Badge> : null}
                  </td>
                  <td className="px-4 py-3">{late ? <Badge tone="danger">{late} atrasado</Badge> : <Badge tone="ok">Nenhum</Badge>}</td>
                  <td className="px-4 py-3 font-mono-num">{mine.length}</td>
                </tr>
              );
            }) : null}
          </tbody>
        </table>
      </Card>
      <Card className="grid gap-4 sm:grid-cols-2">
        <div><Label>Canal de avisos da equipe</Label><DiscordSelect kind="text" value={String(scfg.config.logChannelId ?? "")} onChange={(logChannelId) => updateConfig("staff", { logChannelId })} placeholder="Sem canal de avisos" /></div>
        <div><Label>Cargo para escalonamento</Label><DiscordSelect kind="role" value={String(scfg.config.escalationRoleId ?? "")} onChange={(escalationRoleId) => updateConfig("staff", { escalationRoleId })} placeholder="Sem escalonamento" /></div>
        <div>
          <Label>Meta de resposta (min)</Label>
          <Input
            className="mt-1"
            type="number"
            defaultValue={goal}
            onBlur={(e) => updateConfig("staff", { responseTimeGoalMinutes: Number(e.target.value) || 5 })}
          />
        </div>
        <div>
          <Label>Máximo simultâneo</Label>
          <Input
            className="mt-1"
            type="number"
            defaultValue={maxC}
            onBlur={(e) => updateConfig("staff", { maxConcurrentTickets: Number(e.target.value) || 1 })}
          />
        </div>
        <div className="flex items-center justify-between sm:col-span-2">
          <Label>Exigir motivo nas ações</Label>
          <Switch
            checked={Boolean(scfg.config.requireReason)}
            onCheckedChange={(v) => updateConfig("staff", { requireReason: v })}
          />
        </div>
      </Card>
    </div>
  );
}
