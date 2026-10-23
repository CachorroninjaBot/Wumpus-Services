import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MemberAvatar } from "@/components/brand";
import { Search } from "lucide-react";
import { DiscordPanel } from "@/components/discord-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDesc, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { analyzeWithGrok } from "@/lib/wumpus/analyze";
import { asList, asString, planAllows, searchArticles, shouldAutoClose, ticketSla, type SlaState } from "@/lib/wumpus/engine";
import { useActiveGuild, useGuildMembers, useModule, useWumpus } from "@/lib/wumpus/store";
import { publishPanelAndWait, publishResultMessage } from "@/lib/wumpus/publish-panel";
import { getGuildTickets, getTicketActionStatus, requestTicketAction } from "@/lib/wumpus/runtime-store";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import type { Ticket, TicketPriority } from "@/lib/wumpus/types";
import { cn, formatRelative, formatTime } from "@/lib/utils";

export const Route = createFileRoute("/app/tickets")({ component: TicketsPage });

const slaTone: Record<SlaState, "ok" | "warn" | "danger"> = {
  ok: "ok",
  warning: "warn",
  breach: "danger",
};

function TicketsPage() {
  const gid = useWumpus((s) => s.activeGuildId);
  const guild = useActiveGuild();
  const user = useWumpus((s) => s.sessionUser);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  const [ticketLoadError, setTicketLoadError] = useState<string | null>(null);
  const members = useGuildMembers();
  const channels = useWumpus((state) => state.channels[state.activeGuildId] ?? []);
  const roles = useWumpus((state) => state.roles[state.activeGuildId] ?? []);
  const tcfg = useModule("tickets");
  const updateConfig = useWumpus((s) => s.updateConfig);
  const setEnabled = useWumpus((s) => s.setModuleEnabled);
  const articles = useWumpus((s) => s.articles);
  const kcfg = useModule("knowledge");
  const aiAllowed = planAllows(guild.plan, "ai") && Boolean(tcfg.config.aiSupportEnabled);
  const departments = (planAllows(guild.plan, "multiDepartment") ? asList(tcfg.config.departments) : asList(tcfg.config.departments).slice(0, 1));

  const [filter, setFilter] = useState<"active" | "closed">("active");
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(tickets[0]?.id ?? null);
  const [showTicketOnMobile, setShowTicketOnMobile] = useState(false);
  const [reply, setReply] = useState("");
  const [settings, setSettings] = useState(false);
  const [ai, setAi] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pubBusy, setPubBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const firstTicketId = tickets[0]?.id ?? null;

  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      const token = getStoredSessionToken();
      if (!token || !gid) {
        if (!stopped) {
          setTickets([]);
          setTicketLoadError("Entre com Discord para consultar os tickets deste servidor.");
          setTicketsLoaded(true);
        }
        return;
      }
      try {
        const rows = await getGuildTickets({ data: { token, guildId: gid } });
        if (!stopped) { setTickets(rows); setTicketLoadError(null); setTicketsLoaded(true); }
      } catch (error) {
        if (!stopped) { setTicketLoadError(error instanceof Error ? error.message : "Não foi possível carregar os atendimentos reais."); setTicketsLoaded(true); }
      }
    };
    setTickets([]);
    setTicketsLoaded(false);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [gid]);

  async function runTicketAction(action: "claim" | "reply" | "close" | "priority", input: { content?: string; priority?: TicketPriority } = {}) {
    if (!ticket) return false;
    const token = getStoredSessionToken();
    if (!token) { setNotice("Entre novamente com Discord para atender tickets."); return false; }
    setActionBusy(true);
    try {
      const { jobId } = await requestTicketAction({ data: { token, guildId: gid, ticketId: ticket.number, actorId: user.id, action, ...input } });
      for (let attempt = 0; attempt < 24; attempt++) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        const result = await getTicketActionStatus({ data: { token, guildId: gid, jobId } });
        if (result.status === "done" || result.status === "failed") {
          setNotice(result.detail ?? (result.status === "done" ? "Concluído." : "O bot não conseguiu executar a ação."));
          const rows = await getGuildTickets({ data: { token, guildId: gid } });
          setTickets(rows);
          return result.status === "done";
        }
      }
      setNotice("O bot ainda está processando. A fila será atualizada automaticamente.");
      return false;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível solicitar a ação ao bot.");
      return false;
    } finally { setActionBusy(false); }
  }

  useEffect(() => {
    setSelectedId(firstTicketId);
    setShowTicketOnMobile(false);
  }, [gid, firstTicketId]);

  const memberById = (id: string) => members.find((m) => m.id === id);
  const list = useMemo(() => {
    return tickets
      .filter((t) => (filter === "active" ? t.status === "open" || t.status === "claimed" : t.status === filter))
      .filter((t) => departmentFilter === "all" || t.department === departmentFilter)
      .filter((t) => priorityFilter === "all" || t.priority === priorityFilter)
      .filter((t) => {
        const opener = memberById(t.openerId)?.displayName ?? t.openerId;
        const haystack = `#${t.number} ${t.subject} ${t.department} ${opener} ${t.claimedBy ?? ""}`;
        return haystack.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"));
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [tickets, filter, departmentFilter, priorityFilter, query, members]);

  const ticket = list.find((t) => t.id === selectedId) ?? list[0] ?? null;

  async function runAi(t: Ticket) {
    setAiBusy(true);
    setAi(null);
    const transcript = t.messages.map((m) => `${m.kind}: ${m.content}`).join("\n");
    const related = kcfg.enabled
      ? searchArticles(`${t.subject}\n${transcript}`, articles.filter((a) => a.guildId === gid), Boolean(kcfg.config.requireApprovedArticles)).slice(0, 3)
      : [];
    const knowledge = related.map((a) => `${a.title}: ${a.body}`).join("\n");
    const res = await analyzeWithGrok({
      data: {
        kind: "ticket",
        title: `#${t.number} ${t.subject} (${t.department})`,
        body: transcript,
        extra: `SLA ${String(tcfg.config.slaWarningMinutes)} min. Prioridade ${t.priority}.${knowledge ? `\nBase do servidor:\n${knowledge}` : ""}`,
      },
    });
    setAiBusy(false);
    setAi(res.ok ? res.text : res.error);
  }

  return (
      <div key={gid} className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Fila de atendimento</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Tickets abertos, prioridade, responsável e prazo.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSettings(true)}>
          Configurar atendimento
        </Button>
      </div>

      <p role="note" className="m-0 rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
        Esta fila lê os atendimentos persistidos pelo bot. As ações são encaminhadas ao Discord pelo bot.
      </p>
      {ticketLoadError ? <p role="alert" className="m-0 rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn">{ticketLoadError}</p> : null}

      {!tcfg.enabled ? (
        <p className="m-0 rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn">Atendimento pausado neste servidor.</p>
      ) : null}
      {notice ? <p className="m-0 rounded-xl bg-muted px-3 py-2 text-sm">{notice}</p> : null}
      {!planAllows(guild.plan, "ai") ? (
        <p className="m-0 text-sm text-muted-foreground">Plano Essencial não inclui IA. O Pro libera a análise para a equipe.</p>
      ) : null}
      {!planAllows(guild.plan, "transcripts") ? (
        <p className="m-0 text-sm text-muted-foreground">Transcrição no encerramento entra no Pro.</p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {(["active", "closed"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "h-9 rounded-full px-3 text-sm",
              filter === f ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {f === "active" ? "Abertos" : "Encerrados"}
          </button>
        ))}
      </div>

      <div className="grid gap-2 rounded-2xl border border-border bg-card p-3 sm:grid-cols-[minmax(220px,1fr)_180px_150px]">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar tickets" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por assunto, pessoa ou número" />
        </div>
        <NativeSelect aria-label="Filtrar por departamento" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
          <option value="all">Todos os departamentos</option>
          {[...new Set(tickets.map((item) => item.department).filter(Boolean))].map((department) => <option key={department} value={department}>{department}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Filtrar por prioridade" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
          <option value="all">Todas as prioridades</option>
          <option value="urgent">Urgente</option><option value="high">Alta</option><option value="normal">Normal</option><option value="low">Baixa</option>
        </NativeSelect>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{list.length} {list.length === 1 ? "atendimento" : "atendimentos"} nesta vista · fila mantida ao abrir um registro</span>
        <span className="flex items-center gap-3"><span><i className="mr-1 inline-block size-2 rounded-full bg-ok" />No prazo</span><span><i className="mr-1 inline-block size-2 rounded-full bg-warn" />Atenção</span><span><i className="mr-1 inline-block size-2 rounded-full bg-destructive" />Atrasado</span></span>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <Card className={cn("max-h-[70vh] overflow-y-auto p-2", showTicketOnMobile && "hidden lg:block")}>
          {list.length === 0 ? (
            <div className="space-y-3 p-4">
              <div>
                <h2 className="m-0 text-base font-semibold">
                  {!ticketsLoaded ? "Carregando atendimentos…" : tickets.length === 0 ? "Sua fila começa aqui" : "Nenhum atendimento nesta vista"}
                </h2>
                <p className="mt-1 mb-0 text-sm text-muted-foreground">
                  {!ticketsLoaded
                    ? "Buscando tickets reais no armazenamento do bot."
                    : tickets.length === 0
                    ? "Configure o canal e os cargos de atendimento e publique o painel no Discord para receber os primeiros tickets."
                    : "Troque o filtro para consultar os atendimentos de outro estado."}
                </p>
              </div>
              {tickets.length === 0 ? (
                <Button size="sm" onClick={() => setSettings(true)}>Configurar o fluxo</Button>
              ) : null}
            </div>
          ) : (
            list.map((t) => {
              const sla = ticketSla(t, tcfg.config);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(t.id);
                    setShowTicketOnMobile(true);
                    setAi(null);
                  }}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left",
                    ticket?.id === t.id ? "bg-muted" : "hover:bg-muted/50",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    #{t.number}
                    <Badge tone={slaTone[sla]}>{t.priority}</Badge>
                    {shouldAutoClose(t, tcfg.config) ? <Badge tone="warn">ocioso</Badge> : null}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">{t.subject}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {t.department} · {formatRelative(t.createdAt)}
                  </span>
                </button>
              );
            })
          )}
        </Card>

        {ticket ? (
          <Card className={cn("min-h-[70vh] min-w-0 flex-col p-0", showTicketOnMobile ? "flex" : "hidden lg:flex")}>
            <header className="border-b border-border px-4 py-3">
              <div className="flex flex-wrap items-start gap-2">
                <Button
                  className="lg:hidden"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowTicketOnMobile(false)}
                >
                  Voltar à fila
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-xs text-muted-foreground">
                    #{ticket.number} · <a className="underline underline-offset-2" href={`https://discord.com/channels/${ticket.guildId}/${ticket.channelName}`} target="_blank" rel="noreferrer">Abrir canal</a>
                  </p>
                  <h2 className="mt-0.5 mb-0 text-lg font-semibold">{ticket.subject}</h2>
                </div>
                {tcfg.config.priorityEnabled ? (
                  <NativeSelect
                    className="h-9 w-auto"
                    value={ticket.priority}
                    disabled={actionBusy || ticket.status === "closed"}
                    onChange={(e) => void runTicketAction("priority", { priority: e.target.value as TicketPriority })}
                  >
                    <option value="low">baixa</option>
                    <option value="normal">normal</option>
                    <option value="high">alta</option>
                    <option value="urgent">urgente</option>
                  </NativeSelect>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{ticket.department}</span>
                <span>aberto {formatTime(ticket.createdAt)}</span>
                {ticket.claimedBy ? <span>com {memberById(ticket.claimedBy)?.displayName ?? ticket.claimedBy}</span> : <span>sem dono</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {ticket.status === "open" || ticket.status === "claimed" ? (
                  <>
                    <Button size="sm" variant="secondary" disabled={actionBusy} onClick={() => void runTicketAction("claim")}>
                      Assumir
                    </Button>
                    <Button size="sm" variant="outline" disabled={actionBusy} onClick={() => setCloseOpen(true)}>
                      Encerrar
                    </Button>
                    {aiAllowed ? (
                      <Button size="sm" variant="ghost" disabled={aiBusy} onClick={() => void runAi(ticket)}>
                        {aiBusy ? "Analisando…" : "Analisar com IA"}
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {ticket.messages.map((m) => {
                const who = m.kind === "system" ? null : memberById(m.authorId);
                return (
                  <div key={m.id} className="flex gap-2">
                    {who ? <MemberAvatar name={who.displayName} hue={who.hue} size={28} /> : <span className="size-7" />}
                    <div className="min-w-0">
                      <p className="m-0 text-[11px] text-muted-foreground">
                        {who?.displayName ?? m.authorName ?? "Sistema"} · {formatRelative(m.at)}
                      </p>
                      <p className="m-0 text-sm leading-relaxed">{m.content}</p>
                    </div>
                  </div>
                );
              })}
              {ai ? (
                <div className="rounded-xl bg-primary/10 px-3 py-2 text-sm whitespace-pre-wrap">{ai}</div>
              ) : null}
              {ticket.transcript && ticket.status !== "open" ? (
                <details className="rounded-xl bg-muted px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-medium">Transcrição</summary>
                  <pre className="mt-2 mb-0 overflow-x-auto whitespace-pre-wrap font-sans text-muted-foreground">
                    {ticket.transcript}
                  </pre>
                </details>
              ) : null}
              {ticket.feedback ? (
                <p className="m-0 text-sm">
                  Feedback: {ticket.feedback.rating}/5 — {ticket.feedback.comment}
                </p>
              ) : null}
            </div>

            {ticket.status === "open" || ticket.status === "claimed" ? (
              <form
                className="flex gap-2 border-t border-border p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!reply.trim()) return;
                  void runTicketAction("reply", { content: reply.trim() }).then((ok) => { if (ok) setReply(""); });
                }}
              >
                <Input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Responder como staff…"
                />
                <Button type="submit" disabled={actionBusy}>Enviar</Button>
              </form>
            ) : null}

          </Card>
        ) : (
          <Card className={cn("min-h-64 place-items-center text-sm text-muted-foreground", showTicketOnMobile ? "grid" : "hidden lg:grid")}>
            {tickets.length ? "Selecione um atendimento da fila." : "Configure e publique o painel para começar a receber atendimentos."}
          </Card>
        )}
      </div>

      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogTitle>Painel e fluxo</DialogTitle>
          <DialogDesc>Defina o caminho do atendimento. As opções avançadas ficam recolhidas.</DialogDesc>
          <div className="mt-4 space-y-2">
            <p className="m-0 text-sm font-semibold">Prévia do painel · atualiza ao salvar cada campo</p>
            <DiscordPanel
              channel={asString(tcfg.config.panelChannelId, "abrir-ticket").replace(/^#/, "") || "abrir-ticket"}
              title={asString(tcfg.config.panelTitle, "Precisa de ajuda?")}
              description={asString(tcfg.config.panelDescription, "Escolha uma opção para falar com nossa equipe.")}
              accent={asString(tcfg.config.panelAccentColor, "#28655b")}
              buttons={departments}
            />
          </div>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Label>Atendimento ligado</Label>
              <Switch checked={tcfg.enabled} onCheckedChange={(v) => setEnabled("tickets", v)} />
            </div>
            <Field label="Onde o painel de atendimento aparece">
              <Input list="ticket-text-channels" defaultValue={asString(tcfg.config.panelChannelId)} placeholder="Digite ou escolha #canal" onBlur={(e) => updateConfig("tickets", { panelChannelId: e.target.value.trim() })} />
              <datalist id="ticket-text-channels">{channels.filter((channel) => channel.type === "text").flatMap((channel) => [<option key={channel.id} value={channel.name} />, <option key={`${channel.id}-hash`} value={`#${channel.name}`} />, <option key={`${channel.id}-id`} value={channel.id} />])}</datalist>
            </Field>
            <Field label="Categoria onde os canais privados serão criados">
              <Input list="ticket-category-channels" defaultValue={asString(tcfg.config.categoryId)} placeholder="Digite ou escolha uma categoria" onBlur={(e) => updateConfig("tickets", { categoryId: e.target.value.trim() })} />
              <datalist id="ticket-category-channels">{channels.filter((channel) => channel.type === "category").flatMap((channel) => [<option key={channel.id} value={channel.name} />, <option key={`${channel.id}-id`} value={channel.id} />])}</datalist>
            </Field>
            <Field label="Quem atende">
              <Input list="ticket-staff-roles" defaultValue={asList(tcfg.config.staffRoleIds).join(", ")} placeholder="Digite ou escolha os cargos, separados por vírgula" onBlur={(e) => updateConfig("tickets", { staffRoleIds: e.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />
              <datalist id="ticket-staff-roles">{roles.flatMap((role) => [<option key={role.id} value={role.name} />, <option key={`${role.id}-id`} value={role.id} />])}</datalist>
              <p className="m-0 text-xs text-muted-foreground">Digite o nome do cargo ou escolha uma sugestão. A equipe terá acesso privado aos canais.</p>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Máximo de tickets abertos por pessoa">
                <Input type="number" min={1} max={25} defaultValue={Number(tcfg.config.maxOpenPerUser ?? 1)} onBlur={(e) => updateConfig("tickets", { maxOpenPerUser: Math.max(1, Math.min(25, Number(e.target.value) || 1)) })} />
              </Field>
              <Field label="Nome do canal · use {user} e {number}">
                <Input defaultValue={asString(tcfg.config.namingPattern, "atendimento-{user}")} onBlur={(e) => updateConfig("tickets", { namingPattern: e.target.value.trim() || "atendimento-{user}" })} />
              </Field>
            </div>
            <Field label="Avisar a equipe depois de (minutos; 0 desliga)">
              <Input
                type="number"
                min={0}
                max={10080}
                defaultValue={Number(tcfg.config.slaWarningMinutes ?? 60)}
                onBlur={(e) => updateConfig("tickets", { slaWarningMinutes: Math.max(0, Number(e.target.value) || 0) })}
              />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Pedir avaliação ao encerrar</Label>
                <p className="m-0 text-xs text-muted-foreground">Receba uma nota e um comentário do cliente.</p>
              </div>
              <Switch
                checked={Boolean(tcfg.config.feedbackEnabled)}
                onCheckedChange={(v) => updateConfig("tickets", { feedbackEnabled: v })}
              />
            </div>
            <details className="rounded-xl border border-border px-3 py-2">
              <summary className="cursor-pointer py-1 text-sm font-medium">Avançado: aparência, categorias e automações</summary>
              <div className="mt-4 space-y-4">
                <Field label="Título do painel">
                  <Input
                    defaultValue={asString(tcfg.config.panelTitle)}
                    onBlur={(e) => updateConfig("tickets", { panelTitle: e.target.value })}
                  />
                </Field>
                <Field label="Descrição">
                  <Textarea
                    defaultValue={asString(tcfg.config.panelDescription)}
                    onBlur={(e) => updateConfig("tickets", { panelDescription: e.target.value })}
                  />
                </Field>
                <Field label="Mensagem de boas-vindas">
                  <Textarea
                    defaultValue={asString(tcfg.config.welcomeMessage)}
                    onBlur={(e) => updateConfig("tickets", { welcomeMessage: e.target.value })}
                  />
                </Field>
                <Field label="Categorias de atendimento (uma por linha)">
                  <Textarea
                    rows={3}
                    defaultValue={departments.join("\n")}
                    onBlur={(e) => updateConfig("tickets", {
                      departments: e.target.value.split("\n").map((value) => value.trim()).filter(Boolean),
                    })}
                  />
                  <p className="m-0 text-xs text-muted-foreground">A pessoa escolhe uma categoria ao abrir um ticket. Você pode organizar suporte, denúncias e parcerias em opções claras.</p>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Canal de transcrições">
                    <Input list="ticket-text-channels" defaultValue={asString(tcfg.config.transcriptChannelId)} placeholder="Digite ou escolha #canal" onBlur={(e) => updateConfig("tickets", { transcriptChannelId: e.target.value.trim() })} />
                  </Field>
                  <Field label="Canal de auditoria">
                    <Input list="ticket-text-channels" defaultValue={asString(tcfg.config.logChannelId)} placeholder="Digite ou escolha #canal" onBlur={(e) => updateConfig("tickets", { logChannelId: e.target.value.trim() })} />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><Label>Notificar a equipe</Label><p className="m-0 text-xs text-muted-foreground">Menciona os cargos ao abrir.</p></div><Switch checked={Boolean(tcfg.config.pingStaffOnOpen)} onCheckedChange={(value) => updateConfig("tickets", { pingStaffOnOpen: value })} /></div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><Label>Permitir reabertura</Label><p className="m-0 text-xs text-muted-foreground">A pessoa pode voltar ao canal.</p></div><Switch checked={Boolean(tcfg.config.reopenEnabled)} onCheckedChange={(value) => updateConfig("tickets", { reopenEnabled: value })} /></div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><Label>Prioridade</Label><p className="m-0 text-xs text-muted-foreground">A equipe classifica urgência.</p></div><Switch checked={Boolean(tcfg.config.priorityEnabled)} onCheckedChange={(value) => updateConfig("tickets", { priorityEnabled: value })} /></div>
                  <Field label="Prazo para fechar automaticamente (horas; 0 desliga)"><Input type="number" min={0} max={8760} defaultValue={Number(tcfg.config.closeAfterHours ?? 48)} onBlur={(e) => updateConfig("tickets", { closeAfterHours: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>IA de apoio à equipe</Label>
                    <p className="m-0 text-xs text-muted-foreground">Gera sugestões privadas para a equipe.</p>
                  </div>
                  <Switch
                    checked={Boolean(tcfg.config.aiSupportEnabled)}
                    onCheckedChange={(value) => updateConfig("tickets", { aiSupportEnabled: value })}
                  />
                </div>
                <Field label="Encerrar por inatividade (horas; 0 desliga)">
                  <Input
                    type="number"
                    min={0}
                    max={8760}
                    defaultValue={Number(tcfg.config.autoCloseInactiveHours ?? 24)}
                    onBlur={(e) => updateConfig("tickets", { autoCloseInactiveHours: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </Field>
                <Button
                  variant="outline"
                  disabled={pubBusy || !asString(tcfg.config.panelChannelId).trim()}
                  onClick={async () => {
                    setPubBusy(true);
                    setNotice(null);
                    try {
                      const result = await publishPanelAndWait({
                        guildId: gid,
                        target: "tickets",
                        channelRef: asString(tcfg.config.panelChannelId).trim(),
                      });
                      setNotice(publishResultMessage(result));
                    } catch (cause) {
                      setNotice(cause instanceof Error ? cause.message : "Não foi possível pedir a publicação ao bot.");
                    } finally {
                      setPubBusy(false);
                    }
                  }}
                >
                  {pubBusy ? "Aguardando o bot…" : "Publicar painel no Discord"}
                </Button>
              </div>
            </details>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogTitle>Encerrar atendimento</DialogTitle>
          <DialogDesc>O bot encerrará o canal e enviará a pesquisa de satisfação configurada.</DialogDesc>
          <Button
            className="mt-4 w-full"
            disabled={actionBusy}
            onClick={() => void runTicketAction("close").then((ok) => { if (ok) setCloseOpen(false); })}
          >
            Encerrar e gerar transcrição
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
