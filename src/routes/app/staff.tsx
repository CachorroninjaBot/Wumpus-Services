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
import type { StaffActivityEntry, StaffMonitoringRow } from "@/lib/wumpus/staff-monitoring";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import { useModule, useWumpus } from "@/lib/wumpus/store";

export const Route = createFileRoute("/app/staff")({ component: StaffPage });

function formatMinutes(value: number | null): string {
  if (value === null) return "—";
  if (value < 60) return `${Math.round(value)} min`;
  return `${(value / 60).toFixed(1)} h`;
}

function formatLastActivity(value: number | null): string {
  if (value === null) return "Sem ação registrada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(value);
}

function StaffProfile({
  person,
  guildId,
  periodDays,
  roleNames,
  goal,
  maxConcurrent,
  onPeriodChange,
  onClose,
  loading,
  error,
}: {
  person: StaffMonitoringRow;
  guildId: string;
  periodDays: 7 | 30 | 90;
  roleNames: string[];
  goal: number;
  maxConcurrent: number;
  onPeriodChange: (periodDays: 7 | 30 | 90) => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
}) {
  const ageBuckets = [
    {
      label: "Menos de 24 h",
      count: person.openTicketDetails.filter((ticket) => ticket.ageHours < 24).length,
    },
    {
      label: "1 a 3 dias",
      count: person.openTicketDetails.filter(
        (ticket) => ticket.ageHours >= 24 && ticket.ageHours < 72,
      ).length,
    },
    {
      label: "Mais de 3 dias",
      count: person.openTicketDetails.filter((ticket) => ticket.ageHours >= 72).length,
    },
  ];
  const ratingTotal = Object.values(person.ratingDistribution).reduce(
    (sum, count) => sum + count,
    0,
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <MemberAvatar name={person.displayName} hue={176} size={52} />
          <div>
            <h1 className="m-0 text-xl font-semibold tracking-tight">{person.displayName}</h1>
            <p className="m-0 mt-1 text-sm text-muted-foreground">
              {roleNames.join(" · ") || person.username}
            </p>
            <p className="m-0 mt-1 text-xs text-muted-foreground">
              Última ação registrada: {formatLastActivity(person.lastActivityAt)}
            </p>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="profile-period">Período</Label>
            <NativeSelect
              id="profile-period"
              value={periodDays}
              disabled={loading}
              onChange={(event) => onPeriodChange(Number(event.target.value) as 7 | 30 | 90)}
            >
              <option value={7}>7 dias</option>
              <option value={30}>30 dias</option>
              <option value={90}>90 dias</option>
            </NativeSelect>
          </div>
          <Button
            variant="outline"
            onClick={onClose}
            aria-label="Fechar perfil e voltar para a equipe"
          >
            Fechar perfil
          </Button>
        </div>
      </header>

      {error ? (
        <p className="m-0 rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn" role="alert">
          Não foi possível atualizar os dados. Exibindo a última sincronização disponível. {error}
        </p>
      ) : loading ? (
        <p className="m-0 text-sm text-muted-foreground" role="status">
          Atualizando as estatísticas da equipe…
        </p>
      ) : null}

      <p className="m-0 -mt-4 text-xs text-muted-foreground">
        Estatísticas do período de {periodDays} dias. A carga e os tickets abertos refletem o estado
        atual.
      </p>

      <section aria-labelledby="profile-overview-heading">
        <h2 id="profile-overview-heading" className="m-0 mb-3 text-base font-semibold">
          Resumo do período
        </h2>
        <Card className="grid grid-cols-2 gap-x-6 gap-y-4 p-4 sm:grid-cols-4 lg:grid-cols-6">
          <Metric label="Abertos agora" value={`${person.openTickets}/${maxConcurrent}`} />
          <Metric label="Fora do SLA" value={String(person.overdueTickets)} />
          <Metric label="Assumidos no período" value={String(person.claimedTickets)} />
          <Metric label="Encerrados no período" value={String(person.closedTickets)} />
          <Metric
            label="Média de 1ª resposta"
            value={formatMinutes(person.averageFirstResponseMinutes)}
          />
          <Metric label="Resolução média" value={formatMinutes(person.averageResolutionMinutes)} />
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="m-0 mb-3 text-base font-semibold">Carga e envelhecimento</h2>
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-3">
              {ageBuckets.map((bucket) => (
                <div key={bucket.label}>
                  <p className="m-0 text-xs text-muted-foreground">{bucket.label}</p>
                  <p className="m-0 mt-1 font-mono-num text-xl font-semibold">{bucket.count}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 divide-y divide-border">
              {person.openTicketDetails.length ? (
                person.openTicketDetails.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="m-0 truncate font-medium">
                        {ticket.channelId ? (
                          <a
                            className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                            href={`https://discord.com/channels/${guildId}/${ticket.channelId}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            #{ticket.id} · {ticket.subject}
                          </a>
                        ) : (
                          `#${ticket.id} · ${ticket.subject}`
                        )}
                      </p>
                      <p className="m-0 mt-1 text-xs text-muted-foreground">
                        {ticket.department} · {ticket.priority} · aberto há{" "}
                        {formatAge(ticket.ageHours)}
                      </p>
                      <p className="m-0 mt-1 text-xs text-muted-foreground">
                        Última atividade: {formatLastActivity(ticket.lastActivityAt)}
                      </p>
                    </div>
                    <Badge
                      tone={
                        ticket.sla === "breach"
                          ? "danger"
                          : ticket.sla === "warning"
                            ? "warn"
                            : "ok"
                      }
                    >
                      {ticket.sla === "breach"
                        ? "SLA estourado"
                        : ticket.sla === "warning"
                          ? "Atenção ao SLA"
                          : "No prazo"}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="m-0 text-sm text-muted-foreground">
                  Nenhum atendimento aberto atribuído a esta pessoa.
                </p>
              )}
            </div>
          </Card>
        </div>

        <div>
          <h2 className="m-0 mb-3 text-base font-semibold">Qualidade e encaminhamentos</h2>
          <Card className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Respostas dentro da meta"
                value={person.responseGoalRate === null ? "—" : `${person.responseGoalRate}%`}
              />
              <Metric label="Respostas avaliadas" value={String(person.firstResponseCount)} />
              <Metric label="Meta configurada" value={`${goal} min`} />
              <Metric
                label="Média das avaliações"
                value={
                  person.averageRating === null ? "—" : `${person.averageRating.toFixed(1)} / 5`
                }
              />
              <Metric label="Avaliações recebidas" value={String(person.ratingCount)} />
              <Metric
                label="Formulários revisados"
                value={`${person.reviewedForms} · ${person.approvedForms} aprovados / ${person.rejectedForms} recusados`}
              />
            </div>
            <div>
              <h3 className="m-0 mb-2 text-sm font-medium">Distribuição das avaliações</h3>
              <div className="space-y-2">
                {([5, 4, 3, 2, 1] as const).map((rating) => {
                  const count = person.ratingDistribution[rating];
                  const percent = ratingTotal ? (count / ratingTotal) * 100 : 0;
                  return (
                    <div
                      key={rating}
                      className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2 text-xs"
                    >
                      <span>{rating} ★</span>
                      <span
                        className="h-2 overflow-hidden rounded-full bg-muted"
                        aria-hidden="true"
                      >
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${percent}%` }}
                        />
                      </span>
                      <span className="text-right font-mono-num">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <Metric label="Transferências feitas" value={String(person.transfersMade)} />
              <Metric label="Atendimentos recebidos" value={String(person.transfersReceived)} />
              <Metric label="Escalonamentos" value={String(person.escalations)} />
              <Metric label="Reaberturas iniciadas" value={String(person.reopenActions)} />
              <Metric
                label="Ações de moderação aplicadas"
                value={String(person.moderationActions)}
              />
              <Metric label="Tentativas de moderação" value={String(person.moderationAttempts)} />
              <Metric label="Mensagens em atendimentos" value={String(person.ticketMessages)} />
            </div>
          </Card>
        </div>
      </section>

      <section aria-labelledby="staff-activity-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="staff-activity-heading" className="m-0 text-base font-semibold">
              Atividade recente
            </h2>
            <p className="m-0 mt-1 text-sm text-muted-foreground">
              Até 40 eventos atribuídos nos últimos {periodDays} dias.
            </p>
          </div>
          <p className="m-0 text-xs text-muted-foreground">
            Conteúdo das conversas não é exibido neste histórico.
          </p>
        </div>
        <Card className="mt-3 p-4">
          {person.activity.length ? (
            <ol className="m-0 divide-y divide-border p-0">
              {person.activity.map((event) => (
                <ActivityItem key={event.id} event={event} />
              ))}
            </ol>
          ) : (
            <p className="m-0 text-sm text-muted-foreground">
              Não há atividade registrada para esta pessoa no período. Isso não indica ausência no
              servidor; apenas ausência de eventos atribuíveis.
            </p>
          )}
        </Card>
      </section>

      <p className="m-0 text-xs text-muted-foreground">
        Indicadores descrevem eventos registrados pelo bot, não produtividade individual. Tempos,
        transferências e avaliações incompletos por falta de dados não são estimados.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="m-0 text-xs text-muted-foreground">{label}</p>
      <p className="m-0 mt-1 break-words font-mono-num text-sm font-medium">{value}</p>
    </div>
  );
}

function ActivityItem({ event }: { event: StaffActivityEntry }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
      <div>
        <p className="m-0 text-sm font-medium">{event.title}</p>
        <p className="m-0 mt-1 text-xs text-muted-foreground">{event.detail}</p>
      </div>
      <time
        className="shrink-0 text-xs text-muted-foreground"
        dateTime={new Date(event.at).toISOString()}
      >
        {formatLastActivity(event.at)}
      </time>
    </li>
  );
}

function formatAge(hours: number): string {
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  const remainderHours = hours % 24;
  return remainderHours ? `${days} d ${remainderHours} h` : `${days} d`;
}

function StaffPage() {
  const gid = useWumpus((s) => s.activeGuildId);
  const [monitoring, setMonitoring] = useState<StaffMonitoringResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [windowDays, setWindowDays] = useState<7 | 30 | 90>(30);
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
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
    let requestPending = false;
    const load = async () => {
      if (!active || requestPending || document.visibilityState === "hidden") return;
      requestPending = true;
      try {
        const token = getStoredSessionToken();
        if (!token || !gid) {
          setMonitoring(null);
          setError("Entre com Discord para ver a atividade real da equipe.");
          setLoading(false);
          return;
        }
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
      } finally {
        requestPending = false;
      }
    };
    setLoading(true);
    void load();
    const timer = window.setInterval(() => void load(), 5_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [gid, windowDays, refreshKey]);

  useEffect(() => {
    setActiveStaffId(null);
    setMonitoring(null);
    setError(null);
  }, [gid]);

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
  const activeStaff = monitoring?.staff.find((person) => person.id === activeStaffId);

  if (monitoring && activeStaff) {
    const roleNames = roles
      .filter((role) => activeStaff.roleIds.includes(role.id))
      .map((role) => role.name);
    return (
      <StaffProfile
        person={activeStaff}
        guildId={gid}
        periodDays={monitoring.periodDays}
        roleNames={roleNames}
        goal={goal}
        maxConcurrent={maxConcurrent}
        onPeriodChange={setWindowDays}
        onClose={() => setActiveStaffId(null)}
        loading={loading}
        error={error}
      />
    );
  }

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
            atendimento. Entradas, saídas e mudanças de cargo são sincronizadas pelo bot; a
            dashboard verifica novidades a cada 5 segundos. Uma sincronização completa também ocorre
            a cada 5 minutos.
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
                            <button
                              type="button"
                              className="min-w-0 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                              onClick={() => setActiveStaffId(person.id)}
                              aria-label={`Abrir perfil de ${person.displayName}`}
                            >
                              <span className="block truncate font-medium hover:underline">
                                {person.displayName}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {roleNames.join(" · ") || person.username}
                              </span>
                              <span className="block text-xs text-primary">Abrir perfil</span>
                            </button>
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
