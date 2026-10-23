import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MemberAvatar } from "@/components/brand";
import { DiscordMultiSelect, DiscordSelect } from "@/components/discord-select";
import { Check, Search } from "lucide-react";
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
import { getGuildTicketMessages, getGuildTickets, getTicketActionStatus, requestTicketAction } from "@/lib/wumpus/runtime-store";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import type { Ticket, TicketPriority } from "@/lib/wumpus/types";
import { cn, formatRelative, formatTime } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/app/tickets")({ component: TicketsPage });

const slaTone: Record<SlaState, "ok" | "warn" | "danger"> = {
  ok: "ok",
  warning: "warn",
  breach: "danger",
};

type NoticeTone = "neutral" | "success" | "error";

function TicketsPage() {
  const gid = useWumpus((s) => s.activeGuildId);
  const guild = useActiveGuild();
  const user = useWumpus((s) => s.sessionUser);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  const [ticketLoadError, setTicketLoadError] = useState<string | null>(null);
  const [loadingTicketId, setLoadingTicketId] = useState<string | null>(null);
  const members = useGuildMembers();
  const tcfg = useModule("tickets");
  const staffConfig = useModule("staff");
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
  const [transferStaffInput, setTransferStaffInput] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [activeView, setActiveView] = useState<"queue" | "panel">("queue");
  const [ai, setAi] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("neutral");
  const noticeId = useRef(0);
  const [pubBusy, setPubBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const firstTicketId = tickets[0]?.id ?? null;
  const announce = useCallback((message: string, tone: NoticeTone = "neutral") => {
    setNotice(message);
    setNoticeTone(tone);
    noticeId.current += 1;
  }, []);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const token = getStoredSessionToken();
        if (!token || !gid) {
          if (!stopped) {
            setTickets([]);
            setTicketLoadError("Entre com Discord para consultar os tickets deste servidor.");
            setTicketsLoaded(true);
          }
          return;
        }
        const rows = await getGuildTickets({ data: { token, guildId: gid } });
        if (!stopped) {
          setTickets((current) => {
            const currentById = new Map(current.map((ticket) => [ticket.id, ticket]));
            const next = rows.map((row) => ({
              ...row,
              messages: currentById.get(row.id)?.messages ?? row.messages,
            }));
            return next.length === current.length && next.every((row, index) => {
              const previous = current[index];
              return previous
                && previous.id === row.id
                && previous.subject === row.subject
                && previous.status === row.status
                && previous.priority === row.priority
                && previous.claimedBy === row.claimedBy
                && previous.department === row.department
                && previous.createdAt === row.createdAt
                && previous.firstResponseAt === row.firstResponseAt
                && previous.closedAt === row.closedAt
                && previous.feedback?.rating === row.feedback?.rating
                && previous.feedback?.comment === row.feedback?.comment;
            }) ? current : next;
          });
          setTicketLoadError(null);
          setTicketsLoaded(true);
          const requestedTicket = new URLSearchParams(window.location.search).get("ticket");
          const requested = requestedTicket && rows.find((row) => row.id === requestedTicket || String(row.number) === requestedTicket);
          if (requested) {
            setSelectedId(requested.id);
            setShowTicketOnMobile(true);
          }
        }
      } catch (error) {
        if (!stopped) { setTicketLoadError(error instanceof Error ? error.message : "Não foi possível carregar os atendimentos reais."); setTicketsLoaded(true); }
      } finally {
        inFlight = false;
      }
    };
    setTickets([]);
    setTicketsLoaded(false);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [gid]);

  async function runTicketAction(action: "claim" | "reply" | "close" | "priority" | "transfer" | "escalate", input: { content?: string; priority?: TicketPriority; reason?: string; targetStaffId?: string } = {}) {
    if (!ticket) return false;
    const token = getStoredSessionToken();
    if (!token) { announce("Entre novamente com Discord para atender tickets.", "error"); return false; }
    setActionBusy(true);
    setNotice(null);
    try {
      const { jobId } = await requestTicketAction({ data: { token, guildId: gid, ticketId: ticket.number, actorId: user.id, action, ...input } });
      for (let attempt = 0; attempt < 24; attempt++) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        const result = await getTicketActionStatus({ data: { token, guildId: gid, jobId } });
        if (result.status === "done" || result.status === "failed") {
          announce(
            result.detail ?? (
              result.status === "done"
                ? action === "close"
                  ? `Atendimento #${ticket.number} encerrado.`
                  : "Ação concluída no Discord."
                : "O bot não conseguiu executar a ação."
            ),
            result.status === "done" ? "success" : "error",
          );
          const rows = await getGuildTickets({ data: { token, guildId: gid } });
          setTickets((current) => {
            const currentById = new Map(current.map((item) => [item.id, item]));
            return rows.map((row) => ({ ...row, messages: currentById.get(row.id)?.messages ?? row.messages }));
          });
          return result.status === "done";
        }
      }
      announce("O bot ainda está processando. A fila será atualizada automaticamente.");
      return false;
    } catch (error) {
      announce(error instanceof Error ? error.message : "Não foi possível solicitar a ação ao bot.", "error");
      return false;
    } finally { setActionBusy(false); }
  }

  useEffect(() => {
    const requestedTicket = new URLSearchParams(window.location.search).get("ticket");
    const requested = requestedTicket ? tickets.find((row) => row.id === requestedTicket || String(row.number) === requestedTicket) : undefined;
    if (requested) {
      const url = new URL(window.location.href);
      url.searchParams.delete("ticket");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    setSelectedId(requested?.id ?? firstTicketId);
    setShowTicketOnMobile(Boolean(requested));
  }, [gid, tickets, firstTicketId]);

  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const list = useMemo(() => {
    return tickets
      .filter((t) => (filter === "active" ? t.status === "open" || t.status === "claimed" : t.status === filter))
      .filter((t) => departmentFilter === "all" || t.department === departmentFilter)
      .filter((t) => priorityFilter === "all" || t.priority === priorityFilter)
      .filter((t) => {
        const opener = memberById.get(t.openerId)?.displayName ?? t.openerId;
        const haystack = `#${t.number} ${t.subject} ${t.department} ${opener} ${t.claimedBy ?? ""}`;
        return haystack.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [tickets, filter, departmentFilter, priorityFilter, normalizedQuery, memberById]);

  const ticket = list.find((t) => t.id === selectedId) ?? list[0] ?? null;
  const selectedTicketId = ticket?.id;
  const selectedTicketNumber = ticket?.number;
  const selectedTicketMessageCount = ticket?.messages.length;

  useEffect(() => {
    if (!selectedTicketId || !selectedTicketNumber || !gid || selectedTicketMessageCount) return;
    let stopped = false;
    const token = getStoredSessionToken();
    if (!token) return;

    setLoadingTicketId(selectedTicketId);
    void getGuildTicketMessages({ data: { token, guildId: gid, ticketId: selectedTicketNumber } })
      .then((detail) => {
        if (stopped) return;
        setTickets((current) => current.map((row) => row.id === selectedTicketId
          ? { ...row, subject: detail.subject, messages: detail.messages }
          : row));
      })
      .catch((error) => {
        if (!stopped) announce(error instanceof Error ? error.message : "Não foi possível carregar a conversa.", "error");
      })
      .finally(() => {
        if (!stopped) setLoadingTicketId((current) => current === selectedTicketId ? null : current);
      });
    return () => { stopped = true; };
  }, [announce, gid, selectedTicketId, selectedTicketNumber, selectedTicketMessageCount]);

  async function runAi(t: Ticket) {
    const token = getStoredSessionToken();
    if (!token) { setAi("Entre novamente com Discord para usar a análise por IA."); return; }
    setAiBusy(true);
    setAi(null);
    const redact = (value: string) => value
      .replace(/<@!?\d{17,20}>|<@&\d{17,20}>|<#\d{17,20}>/g, "[referência Discord]")
      .replace(/\b\d{17,20}\b/g, "[ID removido]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[e-mail removido]")
      .replace(/(?:\+?\d[\d ().-]{7,}\d)/g, "[telefone removido]")
      .replace(/(?:discord\.gg|discord\.com\/invite)\/[\w-]+/gi, "[convite removido]");
    const includeConversation = Boolean(tcfg.config.aiIncludeConversation);
    const transcript = includeConversation
      ? t.messages.map((m) => `${m.kind}: ${redact(m.content)}`).join("\n")
      : "A conversa foi omitida conforme a configuração de privacidade do servidor.";
    const safeSubject = includeConversation ? redact(t.subject) : `Atendimento #${t.number}`;
    const related = kcfg.enabled
      ? searchArticles(includeConversation ? `${safeSubject}\n${transcript}` : "", articles.filter((a) => a.guildId === gid), Boolean(kcfg.config.requireApprovedArticles)).slice(0, 3)
      : [];
    const knowledge = related.map((a) => `${a.title}: ${a.body}`).join("\n");
    try {
      const res = await analyzeWithGrok({
        data: {
          token,
          guildId: gid,
          kind: "ticket",
          title: `#${t.number} ${safeSubject} (${t.department})`,
          body: transcript,
          extra: `SLA ${String(tcfg.config.slaWarningMinutes)} min. Prioridade ${t.priority}.${knowledge ? `\nBase do servidor:\n${knowledge}` : ""}`,
        },
      });
      setAi(res.ok ? res.text : res.error);
    } catch (error) {
      setAi(error instanceof Error ? error.message : "A análise não ficou disponível.");
    } finally {
      setAiBusy(false);
    }
  }

  return (
      <div key={gid} className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">Atendimento</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Configure o painel e acompanhe cada conversa com sua equipe.</p>
        </div>
      </div>

      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as "queue" | "panel")}>
        <TabsList aria-label="Área de atendimento">
          <TabsTrigger value="queue">Fila de tickets</TabsTrigger>
          <TabsTrigger value="panel">Painel e regras</TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="mt-4 space-y-4">

      <p role="note" className="m-0 rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
        O bot executa as ações no Discord e confirma quando conclui.
      </p>
      {ticketLoadError ? <p role="alert" className="m-0 rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn">{ticketLoadError}</p> : null}

      {!tcfg.enabled ? (
        <p className="m-0 rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn">Atendimento pausado neste servidor.</p>
      ) : null}
      {notice ? (
        <p
          key={noticeId.current}
          role="status"
          aria-live="polite"
          className={cn(
            "m-0 flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
            noticeTone === "success" && "bg-ok/10 text-ok",
            noticeTone === "error" && "bg-warn/15 text-warn",
            noticeTone === "neutral" && "bg-muted text-foreground",
          )}
        >
          {noticeTone === "success" ? <Check aria-hidden="true" className="ticket-success-check size-4 shrink-0" /> : null}
          <span>{notice}</span>
        </p>
      ) : null}
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
                  {!ticketsLoaded
                    ? "Carregando atendimentos…"
                    : ticketLoadError
                    ? "Não foi possível carregar a fila"
                    : tickets.length === 0
                    ? "Sua fila começa aqui"
                    : "Nenhum atendimento encontrado"}
                </h2>
                <p className="mt-1 mb-0 text-sm text-muted-foreground">
                  {!ticketsLoaded
                    ? "Buscando os atendimentos registrados pelo bot."
                    : ticketLoadError
                    ? "A fila tentará carregar novamente em instantes."
                    : tickets.length === 0
                    ? "Configure o canal e os cargos de atendimento e publique o painel no Discord para receber os primeiros tickets."
                    : "Ajuste a busca ou os filtros para encontrar atendimentos."}
                </p>
              </div>
              {tickets.length === 0 ? (
                <Button size="sm" onClick={() => setActiveView("panel")}>Configurar o painel de atendimento</Button>
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
                {ticket.claimedBy ? <span>com {memberById.get(ticket.claimedBy)?.displayName ?? ticket.claimedBy}</span> : <span>sem dono</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {ticket.status === "open" || ticket.status === "claimed" ? (
                  <>
                    <Button size="sm" variant="secondary" disabled={actionBusy} onClick={() => void runTicketAction("claim")}>
                      Assumir
                    </Button>
                    <Button size="sm" variant="outline" disabled={actionBusy || ticket.priority === "urgent"} onClick={() => void runTicketAction("escalate")}>
                      Escalar
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
              {ticket.status !== "closed" ? <form className="mt-3 flex flex-wrap gap-2" onSubmit={(event) => {
                event.preventDefault();
                const match = transferStaffInput.trim().match(/^(?:<@!?(\d{17,20})>|(\d{17,20}))$/);
                const targetStaffId = match?.[1] ?? match?.[2];
                if (targetStaffId) void runTicketAction("transfer", { targetStaffId }).then((ok) => { if (ok) setTransferStaffInput(""); });
              }}>
                <Input className="min-w-48 flex-1" value={transferStaffInput} onChange={(event) => setTransferStaffInput(event.target.value)} placeholder="ID ou menção do novo atendente" aria-label="Atendente para transferência" />
                <Button size="sm" variant="outline" type="submit" disabled={actionBusy || !/^(?:<@!?\d{17,20}>|\d{17,20})$/.test(transferStaffInput.trim())}>Transferir</Button>
              </form> : null}
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {ticket.messages.length ? (
                ticket.messages.map((m) => {
                  const who = m.kind === "system" ? null : memberById.get(m.authorId);
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
                })
              ) : (
                <p className="m-0 text-sm text-muted-foreground" role="status">
                  {loadingTicketId === ticket.id ? "Carregando conversa…" : "Nenhuma mensagem registrada neste atendimento."}
                </p>
              )}
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

        </TabsContent>
        <TabsContent value="panel" className="mt-4 space-y-5">
          <div><h2 className="m-0 text-xl font-semibold tracking-tight">Prepare o primeiro painel</h2><p className="m-0 mt-1 max-w-2xl text-sm text-muted-foreground">Escolha onde ele aparece e quem atende. O restante pode ficar como está até você precisar.</p></div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,.82fr)]">
          <div className="min-w-0 space-y-4">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">1</span><div><h3 className="m-0 text-base font-semibold">Onde a pessoa encontra ajuda?</h3><p className="m-0 mt-1 text-sm text-muted-foreground">Escolha o canal público e a categoria para os canais privados.</p></div></div>
            <Field label="Canal do painel de atendimento">
              <DiscordSelect kind="text" value={asString(tcfg.config.panelChannelId)} onChange={(panelChannelId) => updateConfig("tickets", { panelChannelId })} placeholder="Selecione um canal" />
            </Field>
            <Field label="Categoria onde os canais privados serão criados">
              <DiscordSelect kind="category" value={asString(tcfg.config.categoryId)} onChange={(categoryId) => updateConfig("tickets", { categoryId })} placeholder="Selecione uma categoria" />
            </Field>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3">
              <div><Label>Atendimento ligado</Label><p className="m-0 text-xs text-muted-foreground">Desligue para pausar a abertura de novos tickets.</p></div>
              <Switch checked={tcfg.enabled} onCheckedChange={(v) => setEnabled("tickets", v)} />
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">2</span><div><h3 className="m-0 text-base font-semibold">Dê contexto ao painel</h3><p className="m-0 mt-1 text-sm text-muted-foreground">A pessoa verá esta mensagem antes de escolher o tipo de atendimento.</p></div></div>
            <Field label="Título do painel"><Input maxLength={100} value={asString(tcfg.config.panelTitle)} onChange={(e) => updateConfig("tickets", { panelTitle: e.target.value })} /></Field>
            <Field label="Descrição do painel"><Textarea maxLength={4000} value={asString(tcfg.config.panelDescription)} onChange={(e) => updateConfig("tickets", { panelDescription: e.target.value })} /></Field>
          </div>
          <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">3</span><div><h3 className="m-0 text-base font-semibold">Escolha quem responde</h3><p className="m-0 mt-1 text-sm text-muted-foreground">Cargos selecionados poderão acessar os canais privados.</p></div></div>
            <Field label="Cargos da equipe"><DiscordMultiSelect value={asList(tcfg.config.staffRoleIds)} onChange={(staffRoleIds) => updateConfig("tickets", { staffRoleIds })} /></Field>
          </div>
          <details className="rounded-2xl border border-border bg-card p-4">
            <summary className="cursor-pointer font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Mais configurações de atendimento</summary>
            <p className="mb-4 mt-2 text-sm text-muted-foreground">Prazos, automações, registros e aparência. Você pode voltar a elas quando quiser.</p>
            <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <p className="m-0 self-center text-xs text-muted-foreground">O painel usa os componentes modernos do Discord.</p>
              <Field label="Cor de destaque"><Input type="color" className="h-11 p-1" value={asString(tcfg.config.panelAccentColor, "#28655b")} onChange={(e) => updateConfig("tickets", { panelAccentColor: e.target.value })} /></Field>
            </div>
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
              <div className="space-y-4">
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
                    <DiscordSelect kind="text" value={asString(tcfg.config.transcriptChannelId)} onChange={(transcriptChannelId) => updateConfig("tickets", { transcriptChannelId })} placeholder="Selecione um canal" />
                  </Field>
                  <Field label="Canal de auditoria">
                    <DiscordSelect kind="text" value={asString(tcfg.config.logChannelId)} onChange={(logChannelId) => updateConfig("tickets", { logChannelId })} placeholder="Selecione um canal" />
                  </Field>
                </div>
                <Field label="Apagar mensagens após (dias; 0 mantém sem prazo)">
                  <Input type="number" min={0} max={3650} defaultValue={Number(tcfg.config.ticketMessageRetentionDays ?? 0)} onBlur={(e) => updateConfig("tickets", { ticketMessageRetentionDays: Math.max(0, Math.min(3650, Number(e.target.value) || 0)) })} />
                  <p className="m-0 text-xs text-muted-foreground">Remove mensagens e transcripts rastreados de tickets encerrados. O resumo permanece para estatísticas; arquivos antigos sem referência não podem ser apagados automaticamente.</p>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><Label>Notificar a equipe</Label><p className="m-0 text-xs text-muted-foreground">Menciona os cargos ao abrir.</p></div><Switch checked={Boolean(tcfg.config.pingStaffOnOpen)} onCheckedChange={(value) => updateConfig("tickets", { pingStaffOnOpen: value })} /></div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><Label>Permitir reabertura</Label><p className="m-0 text-xs text-muted-foreground">A pessoa pode voltar ao canal.</p></div><Switch checked={Boolean(tcfg.config.reopenEnabled)} onCheckedChange={(value) => updateConfig("tickets", { reopenEnabled: value })} /></div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><Label>Prioridade</Label><p className="m-0 text-xs text-muted-foreground">A equipe classifica urgência.</p></div><Switch checked={Boolean(tcfg.config.priorityEnabled)} onCheckedChange={(value) => updateConfig("tickets", { priorityEnabled: value })} /></div>
                  <Field label="Prazo para fechar automaticamente (horas; 0 desliga)"><Input type="number" min={0} max={8760} defaultValue={Number(tcfg.config.closeAfterHours ?? 48)} onBlur={(e) => updateConfig("tickets", { closeAfterHours: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                  <Field label="Prazo de inatividade (horas; 0 desliga)"><Input type="number" min={0} max={8760} defaultValue={Number(tcfg.config.autoCloseInactiveHours ?? 24)} onBlur={(e) => updateConfig("tickets", { autoCloseInactiveHours: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Meta para primeira resposta (minutos)">
                    <Input type="number" min={5} max={10080} defaultValue={Number(staffConfig.config.responseTimeGoalMinutes ?? 30)} onBlur={(e) => updateConfig("staff", { responseTimeGoalMinutes: Math.max(5, Math.min(10080, Number(e.target.value) || 30)) })} />
                  </Field>
                  <Field label="Tickets simultâneos por atendente">
                    <Input type="number" min={1} max={100} defaultValue={Number(staffConfig.config.maxConcurrentTickets ?? 5)} onBlur={(e) => updateConfig("staff", { maxConcurrentTickets: Math.max(1, Math.min(100, Number(e.target.value) || 5)) })} />
                  </Field>
                </div>
                <Field label="Mensagem de boas-vindas no canal privado">
                  <Textarea rows={3} defaultValue={asString(tcfg.config.welcomeMessage)} onBlur={(e) => updateConfig("tickets", { welcomeMessage: e.target.value })} />
                  <p className="m-0 text-xs text-muted-foreground">Enviada automaticamente quando o atendimento é aberto.</p>
                </Field>
                <ToggleRow label="IA de apoio à equipe" description="Gera sugestões privadas para os atendentes." checked={Boolean(tcfg.config.aiSupportEnabled)} onChange={(value) => updateConfig("tickets", { aiSupportEnabled: value })} />
                <ToggleRow label="Incluir conversa nas análises por IA" description="Quando desligado, o conteúdo das mensagens não é enviado à IA." checked={Boolean(tcfg.config.aiIncludeConversation)} onChange={(value) => updateConfig("tickets", { aiIncludeConversation: value })} />
            </div>
            </div>
          </details>
          <div className="space-y-2 rounded-2xl border border-border p-4">
            <h3 className="m-0 text-base font-semibold">Publicar no Discord</h3>
            <p className="m-0 text-sm text-muted-foreground">A publicação só aparece como concluída depois que o bot confirmar no Discord.</p>
            {!asString(tcfg.config.panelChannelId).trim() ? <p className="m-0 text-sm text-warn">Escolha o canal do painel acima para continuar.</p> : null}
                <Button
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
                      announce(publishResultMessage(result));
                    } catch (cause) {
                      announce(cause instanceof Error ? cause.message : "Não foi possível pedir a publicação ao bot.", "error");
                    } finally {
                      setPubBusy(false);
                    }
                  }}
                >
                  {pubBusy ? "Aguardando confirmação do bot…" : "Publicar painel no Discord"}
                </Button>
            {notice ? <p role="status" className="m-0 rounded-lg bg-muted px-3 py-2 text-sm">{notice}</p> : null}
          </div>
          </div>
          <aside className="min-w-0 space-y-2 xl:sticky xl:top-24 xl:self-start">
            <div><p className="m-0 text-sm font-semibold">Prévia do painel</p><p className="m-0 mt-1 text-xs text-muted-foreground">Amostra das configurações atuais. A confirmação real depende do bot.</p></div>
            <DiscordPanel channel={asString(tcfg.config.panelChannelId, "abrir-ticket").replace(/^#/, "") || "abrir-ticket"} title={asString(tcfg.config.panelTitle, "Precisa de ajuda?")} description={asString(tcfg.config.panelDescription, "Escolha uma opção para falar com nossa equipe.")} accent={asString(tcfg.config.panelAccentColor, "#28655b")} buttons={departments} />
          </aside>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogTitle>Encerrar atendimento</DialogTitle>
          <DialogDesc>Informe o motivo. O bot registrará no histórico e encerrará o canal. Se houver transcrição configurada e disponível no seu plano, ela será enviada ao canal escolhido.</DialogDesc>
          <Field label="Motivo do encerramento">
            <Textarea rows={3} maxLength={500} value={closeReason} onChange={(event) => setCloseReason(event.target.value)} placeholder="Ex.: dúvida resolvida, solicitação concluída…" />
          </Field>
          <Button
            className="mt-4 w-full"
            disabled={actionBusy || !closeReason.trim()}
            onClick={() => void runTicketAction("close", { reason: closeReason.trim() }).then((ok) => { if (ok) { setCloseOpen(false); setCloseReason(""); } })}
          >
            Encerrar atendimento
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

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div className="min-w-0"><Label>{label}</Label><p className="m-0 mt-0.5 text-xs text-muted-foreground">{description}</p></div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
