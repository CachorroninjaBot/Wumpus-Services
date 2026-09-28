import { createFileRoute } from "@tanstack/react-router";
import { MemberAvatar } from "@/components/brand";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ticketSla } from "@/lib/wumpus/engine";
import { useGuildMembers, useModule, useWumpus } from "@/lib/wumpus/store";

export const Route = createFileRoute("/app/staff")({ component: StaffPage });

function StaffPage() {
  const gid = useWumpus((s) => s.activeGuildId);
  const members = useGuildMembers();
  const allTickets = useWumpus((s) => s.tickets);
  const tickets = allTickets.filter((t) => t.guildId === gid);
  const scfg = useModule("staff");
  const tcfg = useModule("tickets");
  const updateConfig = useWumpus((s) => s.updateConfig);
  const roles = useWumpus((s) => s.roles[gid] ?? []);
  const staffRoles = new Set((scfg.config.staffRoleIds as string[]) ?? []);
  const staff = members.filter((m) => m.roleIds.some((r) => staffRoles.has(r) || r === "role_owner"));
  const goal = Number(scfg.config.responseTimeGoalMinutes ?? 30);
  const maxC = Number(scfg.config.maxConcurrentTickets ?? 5);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
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
        <Card className="p-4">
          <p className="m-0 text-xs text-muted-foreground">Staff ativo</p>
          <p className="mt-1 mb-0 font-mono-num text-2xl font-semibold">
            {staff.filter((s) => s.status === "online").length}/{staff.length}
          </p>
        </Card>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Pessoa</th>
              <th className="px-4 py-3 font-medium">Carga</th>
              <th className="px-4 py-3 font-medium">1ª resposta média</th>
              <th className="px-4 py-3 font-medium">CSAT</th>
              <th className="px-4 py-3 font-medium">SLA</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const mine = tickets.filter((t) => t.claimedBy === s.id);
              const open = mine.filter((t) => t.status === "open" || t.status === "claimed");
              const responded = mine.filter((t) => t.firstResponseAt);
              const avg =
                responded.length === 0
                  ? null
                  : responded.reduce((acc, t) => acc + (t.firstResponseAt! - t.createdAt) / 60_000, 0) /
                    responded.length;
              const rated = mine.filter((t) => t.feedback);
              const csat =
                rated.length === 0
                  ? null
                  : rated.reduce((acc, t) => acc + (t.feedback?.rating ?? 0), 0) / rated.length;
              const late = open.filter((t) => ticketSla(t, tcfg.config) !== "ok").length;
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MemberAvatar name={s.displayName} hue={s.hue} size={28} />
                      <span>
                        {s.displayName}
                        <span className="block text-xs text-muted-foreground">
                          {roles.filter((r) => s.roleIds.includes(r.id)).map((r) => r.name).join(" · ")}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono-num">
                    {open.length}/{maxC}
                    {open.length >= maxC ? <Badge tone="warn" className="ml-2">cheio</Badge> : null}
                  </td>
                  <td className="px-4 py-3 font-mono-num">{avg == null ? "—" : `${Math.round(avg)} min`}</td>
                  <td className="px-4 py-3 font-mono-num">{csat == null ? "—" : csat.toFixed(1)}</td>
                  <td className="px-4 py-3">{late ? <Badge tone="danger">{late} atrasado</Badge> : <Badge tone="ok">ok</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card className="grid gap-4 sm:grid-cols-2">
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
