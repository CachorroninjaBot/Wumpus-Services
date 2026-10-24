import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MemberAvatar } from "@/components/brand";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DiscordMultiSelect, DiscordSelect } from "@/components/discord-select";
import { getGuildStaffMonitoring } from "@/lib/wumpus/runtime-store";
import type { StaffMonitoringResult } from "@/lib/wumpus/staff-monitoring";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import { useModule, useWumpus } from "@/lib/wumpus/store";

export const Route = createFileRoute("/app/staff")({ component: StaffPage });

function formatMinutes(value: number | null): string {
  if (value === null) return "—";
  if (value < 60) return `${Math.round(value)} min`;
  return `${(value / 60).toFixed(1)} h`;
}

function formatLastActivity(value: number | null): string {
  if (value === null) return "Sem atividade registrada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(value);
}

function StaffPage() {
  const gid = useWumpus((s) => s.activeGuildId);
  const [monitoring, setMonitoring] = useState<StaffMonitoringResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [windowDays, setWindowDays] = useState<7 | 30 | 90>(30);
  const scfg = useModule("staff");
  const updateConfig = useWumpus((s) => s.updateConfig);
  const roles = useWumpus((s) => s.roles[gid] ?? []);
  const staffRoleRefs = (scfg.config.staffRoleIds as string[]) ?? [];
  const staffRoles = roles
    .filter((role) => staffRoleRefs.includes(role.id) || staffRoleRefs.includes(role.name))
    .map((role) => role.id);
  const goal = Number(scfg.config.responseTimeGoalMinutes ?? 30);
  const maxConcurrent = Number(scfg.config.maxConcurrentTickets ?? 5);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const token = getStoredSessionToken();
      if (!token || !gid) {
        if (active) {
          setMonitoring(null);
          setError("Entre com Discord para ver a atividade real da equipe.");
          setLoading(false);
        }
        return;
      }
      try {
        const result = await getGuildStaffMonitoring({
          data: { token, guildId: gid, periodDays: windowDays },
        });
        if (active) {
          setMonitoring(result);
          setError(null);
          setLoading(false);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar a atividade da equipe.",
          );
          setLoading(false);
        }
      }
    };
    setMonitoring(null);
    setLoading(true);
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [gid, windowDays, refreshKey]);

  const refresh = () => {
    setLoading(true);
    setRefreshKey((key) => key + 1);
  };
  const rosterMessage =
    monitoring?.rosterStatus === "unconfigured"
      ? "Selecione os cargos da equipe para sincronizar os membros que devem aparecer aqui."
      : monitoring?.rosterStatus === "refreshing"
        ? "Sincronizando os membros dos cargos configurados com o Discord…"
        : monitoring?.rosterStatus === "error"
          ? (monitoring.rosterDetail ?? "Não foi possível sincronizar os membros da equipe.")
          : monitoring?.rosterUpdatedAt
            ? `Membros sincronizados em ${formatLastActivity(monitoring.rosterUpdatedAt)}.`
            : null;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl font-semibold tracking-tight">Equipe</h1>
          <p className="m-0 mt-1 max-w-3xl text-sm text-muted-foreground">
            Acompanhe trabalho registrado pelo bot. Presença online e tempo em voz não são usados
            como medida de produtividade.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="staff-window">Período de atividade</Label>
            <NativeSelect
              id="staff-window"
              value={windowDays}
              onChange={(event) => setWindowDays(Number(event.target.value) as 7 | 30 | 90)}
            >
              <option value={7}>7 dias</option>
              <option value={30}>30 dias</option>
              <option value={90}>90 dias</option>
            </NativeSelect>
          </div>
          <Button variant="outline" size="sm" disabled={loading} onClick={refresh}>
            {loading ? "Atualizando…" : "Atualizar"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="m-0 rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="m-0 text-xs text-muted-foreground">Membros nos cargos da equipe</p>
          <p className="mt-1 mb-0 font-mono-num text-2xl font-semibold">
            {loading ? "—" : (monitoring?.summary.staffCount ?? 0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="m-0 text-xs text-muted-foreground">Atendimentos abertos</p>
          <p className="mt-1 mb-0 font-mono-num text-2xl font-semibold">
            {loading ? "—" : (monitoring?.summary.openTickets ?? 0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="m-0 text-xs text-muted-foreground">Sem responsável · fora do SLA</p>
          <p className="mt-1 mb-0 font-mono-num text-2xl font-semibold">
            {loading
              ? "—"
              : `${monitoring?.summary.unassignedTickets ?? 0} · ${monitoring?.summary.overdueTickets ?? 0}`}
          </p>
        </Card>
      </div>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <div>
          <h2 className="m-0 text-base font-semibold">Cargos monitorados</h2>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            Todos os membros que possuem estes cargos entram na lista, mesmo sem histórico de
            atendimento. A sincronização é feita sob demanda e armazenada por até 5 minutos.
          </p>
        </div>
        <DiscordMultiSelect
          value={staffRoles}
          onChange={(staffRoleIds) => updateConfig("staff", { staffRoleIds })}
        />
        {rosterMessage ? (
          <p
            className={`m-0 text-xs ${monitoring?.rosterStatus === "error" ? "text-warn" : "text-muted-foreground"}`}
            role={monitoring?.rosterStatus === "error" ? "alert" : undefined}
          >
            {rosterMessage}
          </p>
        ) : null}
      </section>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="m-0 text-base font-semibold">Atividade por pessoa</h2>
            <p className="m-0 mt-1 text-sm text-muted-foreground">
              Eventos registrados pelo bot nos últimos {windowDays} dias; métricas sem amostra
              aparecem como “—”.
            </p>
          </div>
          {monitoring?.rosterUpdatedAt ? (
            <Badge tone={monitoring.rosterStatus === "error" ? "warn" : "default"}>
              {monitoring.rosterStatus === "refreshing"
                ? "Atualizando membros"
                : `Lista atualizada ${formatLastActivity(monitoring.rosterUpdatedAt)}`}
            </Badge>
          ) : null}
        </div>
        <Card className="mt-3 overflow-x-auto p-0">
          <table className="w-full min-w-[1280px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-card px-4 py-3 font-medium">Pessoa</th>
                <th className="px-4 py-3 font-medium">Carga / atrasos</th>
                <th className="px-4 py-3 font-medium">Assumidos</th>
                <th className="px-4 py-3 font-medium">Encerrados</th>
                <th className="px-4 py-3 font-medium">Resolução</th>
                <th className="px-4 py-3 font-medium">1ª resposta / meta</th>
                <th className="px-4 py-3 font-medium">Avaliação</th>
                <th className="px-4 py-3 font-medium">Formulários</th>
                <th className="px-4 py-3 font-medium">Moderação</th>
                <th className="px-4 py-3 font-medium">Mensagens</th>
                <th className="px-4 py-3 font-medium">Última atividade</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                    Carregando atividade da equipe…
                  </td>
                </tr>
              ) : null}
              {!loading && error ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                    Não foi possível calcular as métricas deste servidor.
                  </td>
                </tr>
              ) : null}
              {!loading && !error && monitoring?.rosterStatus === "unconfigured" ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                    Configure pelo menos um cargo da equipe para listar as pessoas.
                  </td>
                </tr>
              ) : null}
              {!loading &&
              !error &&
              monitoring?.rosterStatus === "refreshing" &&
              !monitoring.staff.length ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                    Aguardando a lista de membros do Discord…
                  </td>
                </tr>
              ) : null}
              {!loading &&
              !error &&
              monitoring?.rosterStatus === "error" &&
              !monitoring.staff.length ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                    A lista de membros não pôde ser carregada. Verifique o Server Members Intent e
                    atualize novamente.
                  </td>
                </tr>
              ) : null}
              {!loading &&
              !error &&
              monitoring &&
              monitoring.rosterStatus !== "unconfigured" &&
              monitoring.staff.length === 0 &&
              monitoring.rosterStatus === "ready" ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center">
                    <p className="m-0 font-medium">Nenhum membro encontrado nesses cargos</p>
                    <p className="mb-0 mt-1 text-sm text-muted-foreground">
                      Confirme se os cargos selecionados ainda existem e se há membros com eles.
                    </p>
                  </td>
                </tr>
              ) : null}
              {!loading && !error
                ? monitoring?.staff.map((person) => {
                    const roleNames = roles
                      .filter((role) => person.roleIds.includes(role.id))
                      .map((role) => role.name);
                    return (
                      <tr key={person.id} className="border-t border-border align-top">
                        <td className="sticky left-0 z-10 bg-card px-4 py-3">
                          <div className="flex min-w-44 items-center gap-2">
                            <MemberAvatar name={person.displayName} hue={176} size={28} />
                            <span>
                              <span className="block font-medium">{person.displayName}</span>
                              <span className="block text-xs text-muted-foreground">
                                {roleNames.join(" · ") || person.username}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono-num">
                          {person.openTickets}/{maxConcurrent}
                          {person.overdueTickets ? (
                            <Badge tone="danger" className="ml-2">
                              {person.overdueTickets} atrasado(s)
                            </Badge>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-mono-num">{person.claimedTickets}</td>
                        <td className="px-4 py-3 font-mono-num">{person.closedTickets}</td>
                        <td className="px-4 py-3">
                          {person.averageResolutionMinutes === null ? (
                            "—"
                          ) : (
                            <>
                              <span className="font-mono-num">
                                {formatMinutes(person.averageResolutionMinutes)}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {person.resolutionCount} resolução(ões)
                              </span>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {person.averageFirstResponseMinutes === null ? (
                            "—"
                          ) : (
                            <>
                              <span className="font-mono-num">
                                {formatMinutes(person.averageFirstResponseMinutes)}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {person.firstResponseCount} resposta(s) · {person.responseGoalRate}%
                                na meta
                              </span>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {person.averageRating === null ? (
                            "—"
                          ) : (
                            <>
                              <span className="font-mono-num">
                                {person.averageRating.toFixed(1)} / 5
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {person.ratingCount} avaliação(ões)
                              </span>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {person.reviewedForms}
                          {person.reviewedForms ? (
                            <span className="block text-xs text-muted-foreground">
                              {person.approvedForms} aprov. · {person.rejectedForms} recus.
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-mono-num">{person.moderationActions}</td>
                        <td className="px-4 py-3 font-mono-num">{person.ticketMessages}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatLastActivity(person.lastActivityAt)}
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </table>
        </Card>
        <p className="mb-0 mt-2 text-xs text-muted-foreground">
          A cobertura segue a retenção dos registros do bot. A 1ª resposta e as avaliações só são
          atribuídas individualmente quando o bot registra quem respondeu ou quem estava responsável
          no momento da nota; dados antigos sem essa identificação não são estimados.
        </p>
      </div>

      <Card className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Canal de avisos da equipe</Label>
          <DiscordSelect
            kind="text"
            value={String(scfg.config.logChannelId ?? "")}
            onChange={(logChannelId) => updateConfig("staff", { logChannelId })}
            placeholder="Sem canal de avisos"
          />
        </div>
        <div>
          <Label>Cargo para escalonamento</Label>
          <DiscordSelect
            kind="role"
            value={String(scfg.config.escalationRoleId ?? "")}
            onChange={(escalationRoleId) => updateConfig("staff", { escalationRoleId })}
            placeholder="Sem escalonamento"
          />
        </div>
        <div>
          <Label>Meta de resposta (min)</Label>
          <Input
            className="mt-1"
            type="number"
            min={1}
            max={10080}
            defaultValue={goal}
            onBlur={(event) =>
              updateConfig("staff", {
                responseTimeGoalMinutes: Math.max(
                  1,
                  Math.min(10080, Number(event.target.value) || 5),
                ),
              })
            }
          />
        </div>
        <div>
          <Label>Máximo simultâneo</Label>
          <Input
            className="mt-1"
            type="number"
            min={1}
            max={100}
            defaultValue={maxConcurrent}
            onBlur={(event) =>
              updateConfig("staff", {
                maxConcurrentTickets: Math.max(1, Math.min(100, Number(event.target.value) || 1)),
              })
            }
          />
        </div>
        <div className="flex items-center justify-between sm:col-span-2">
          <Label>Exigir motivo nas ações</Label>
          <Switch
            checked={Boolean(scfg.config.requireReason)}
            onCheckedChange={(value) => updateConfig("staff", { requireReason: value })}
          />
        </div>
      </Card>
    </div>
  );
}
