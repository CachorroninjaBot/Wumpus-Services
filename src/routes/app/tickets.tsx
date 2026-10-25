import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MemberAvatar } from "@/components/brand";
import { DiscordMultiSelect, DiscordSelect } from "@/components/discord-select";
import { Check, Search, Ticket as TicketIcon, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDesc, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { analyzeWithGrok } from "@/lib/wumpus/analyze";
import { asString, planAllows, searchArticles, shouldAutoClose, ticketSla, type SlaState } from "@/lib/wumpus/engine";
import { useActiveGuild, useGuildMembers, useModule, useWumpus } from "@/lib/wumpus/store";
import { getGuildTicketMessages, getGuildTickets, getTicketActionStatus, requestTicketAction } from "@/lib/wumpus/runtime-store";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import { ExclusiveButton } from "@/components/exclusive-button";
import type { Ticket, TicketPriority } from "@/lib/wumpus/types";
import { cn, formatRelative, formatTime } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownContent } from "@/components/markdown-content";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { readSavedReplies } from "@/components/tickets/ticket-panel-data";
import { TicketPanelEditor } from "@/components/tickets/ticket-panel-editor";

export const Route = createFileRoute("/app/tickets")({ component: TicketsPage });

const slaTone: Record<SlaState, "ok" | "warn" | "danger"> = {
  ok: "ok",
  warning: "warn",
  breach: "danger",
};

const priorityTone: Record<TicketPriority, "default" | "info" | "warn" | "danger"> = {
  low: "default",
  normal: "info",
  high: "warn",
  urgent: "danger",
};

const priorityLabel: Record<TicketPriority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
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
  const updateConfig = useWumpus((s) => s.updateConfig);
  const setEnabled = useWumpus((s) => s.setModuleEnabled);
  const articles = useWumpus((s) => s.articles);
  const kcfg = useModule("knowledge");
  const aiAllowed = planAllows(guild.plan, "ai") && Boolean(tcfg.config.aiSupportEnabled);
  const configuredSavedReplies = readSavedReplies(tcfg.config.savedReplies);
  const savedReplies = configuredSavedReplies.filter((item) => item.label.trim() && item.content.trim());

  const [filter, setFilter] = useState<"active" | "closed">("active");
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState<"all" | "mine" | "unassigned" | "overdue" | "urgent">("all");
  const [selectedId, setSelectedId] = useState<string | null>(tickets[0]?.id ?? null);
  const [showTicketOnMobile, setShowTicketOnMobile] = useState(false);
  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [transferStaffInput, setTransferStaffInput] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [activeView, setActiveView] = useState<"queue" | "panel">("queue");
  const [ai, setAi] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("neutral");
  const noticeId = useRef(0);
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
                && previous.subject === row.subject
                && previous.status === row.status
                && previous.priority === row.priority
                && previous.claimedBy === row.claimedBy
                && previous.waitingOn === row.waitingOn
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

  async function runTicketAction(action: "claim" | "reply" | "note" | "close" | "priority" | "transfer" | "escalate" | "waiting_user" | "waiting_staff" | "resume", input: { content?: string; priority?: TicketPriority; reason?: string; targetStaffId?: string } = {}) {
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
        if (quickFilter === "mine") return t.claimedBy === user.id;
        if (quickFilter === "unassigned") return !t.claimedBy;
        if (quickFilter === "overdue") return ticketSla(t, tcfg.config) === "breach";
        if (quickFilter === "urgent") return t.priority === "urgent";
        return true;
      })
      .filter((t) => {
        const opener = memberById.get(t.openerId)?.displayName ?? t.openerId;
        const haystack = `#${t.number} ${t.subject} ${t.department} ${opener} ${t.claimedBy ?? ""}`;
        return haystack.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [tickets, filter, departmentFilter, priorityFilter, quickFilter, normalizedQuery, memberById, user.id, tcfg.config]);

  const ticket = list.find((t) => t.id === selectedId) ?? list[0] ?? null;
  const selectedTicketId = ticket?.id;
  const selectedTicketNumber = ticket?.number;
  useEffect(() => {
    if (!selectedTicketId || !selectedTicketNumber || !gid) return;
    let stopped = false;
    let inFlight = false;
    let firstRequest = true;
    let errorAnnounced = false;
    const refreshMessages = async () => {
      if (stopped || inFlight || document.visibilityState === "hidden") return;
      const token = getStoredSessionToken();
      if (!token) return;
      inFlight = true;
      if (firstRequest) setLoadingTicketId(selectedTicketId);
      try {
        const detail = await getGuildTicketMessages({ data: { token, guildId: gid, ticketId: selectedTicketNumber } });
        if (stopped) return;
        setTickets((current) => current.map((row) => row.id === selectedTicketId
          ? { ...row, subject: detail.subject, messages: detail.messages }
          : row));
        errorAnnounced = false;
      } catch (error) {
        if (!stopped && !errorAnnounced) {
          announce(error instanceof Error ? error.message : "Não foi possível carregar a conversa.", "error");
          errorAnnounced = true;
        }
      } finally {
        inFlight = false;
        const wasFirstRequest = firstRequest;
        firstRequest = false;
        if (!stopped && wasFirstRequest) setLoadingTicketId((current) => current === selectedTicketId ? null : current);
      }
    };
    void refreshMessages();
    const timer = window.setInterval(() => void refreshMessages(), 5_000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [announce, gid, selectedTicketId, selectedTicketNumber]);

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
      ? t.messages.filter((message) => message.kind !== "internal").map((m) => `${m.kind}: ${redact(m.content)}`).join("\n")
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
      <div key={gid} className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Atendimento"
        description="Configure o painel e acompanhe cada conversa com sua equipe."
      />

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-sm text-muted-foreground">A análise com IA é exclusiva dos planos Pro, Escala e Vitalício.</p>
          <ExclusiveButton />
        </div>
      ) : null}
      {!planAllows(guild.plan, "transcripts") ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-sm text-muted-foreground">A exportação de transcrições é exclusiva dos planos Pro, Escala e Vitalício.</p>
          <ExclusiveButton />
        </div>
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

      {filter === "active" ? (
        <div className="flex flex-wrap gap-2" aria-label="Filtros rápidos da fila">
          {([
            ["all", "Todos"],
            ["mine", "Meus tickets"],
            ["unassigned", "Sem responsável"],
            ["overdue", "SLA estourado"],
            ["urgent", "Urgentes"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={quickFilter === value}
              onClick={() => setQuickFilter(value)}
              className={cn(
                "min-h-10 rounded-full border px-3 text-sm transition-colors",
                quickFilter === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

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
            <EmptyState
              icon={TicketIcon}
              title={!ticketsLoaded ? "Carregando atendimentos…" : ticketLoadError ? "Não foi possível carregar a fila" : tickets.length === 0 ? "Sua fila começa aqui" : "Nenhum atendimento encontrado"}
              description={!ticketsLoaded ? "Buscando os atendimentos registrados pelo bot." : ticketLoadError ? "A fila tentará carregar novamente em instantes." : tickets.length === 0 ? "Configure o canal e os cargos e publique o painel para receber os primeiros tickets." : "Ajuste a busca ou os filtros."}
              action={tickets.length === 0 && ticketsLoaded && !ticketLoadError ? <Button size="sm" onClick={() => setActiveView("panel")}>Configurar o painel</Button> : undefined}
            />
          ) : (
            list.map((t) => {
              const sla = ticketSla(t, tcfg.config);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={ticket?.id === t.id}
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
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    #{t.number}
                    <Badge tone={priorityTone[t.priority]}>{priorityLabel[t.priority]}</Badge>
                    <Badge tone={slaTone[sla]}>{sla === "breach" ? "SLA vencido" : sla === "warning" ? "SLA atenção" : "SLA no prazo"}</Badge>
                    {t.waitingOn ? <Badge tone="warn">{t.waitingOn === "user" ? "Aguardando usuário" : "Aguardando equipe"}</Badge> : null}
                    {shouldAutoClose(t, tcfg.config) ? <Badge tone="warn">ocioso</Badge> : null}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">{t.subject}</span>
                  <span className="flex min-w-0 justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">{t.department} · {t.claimedBy ? memberById.get(t.claimedBy)?.displayName ?? "com responsável" : "sem responsável"}</span>
                    <span className="shrink-0">{formatRelative(t.createdAt)}</span>
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
                {ticket.waitingOn ? <Badge tone="warn">{ticket.waitingOn === "user" ? "Aguardando usuário" : "Aguardando equipe"} · SLA ativo</Badge> : null}
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
                    <Button size="sm" variant="outline" disabled={actionBusy || ticket.waitingOn === "user"} onClick={() => void runTicketAction("waiting_user")}>
                      Aguardar usuário
                    </Button>
                    <Button size="sm" variant="outline" disabled={actionBusy || ticket.waitingOn === "staff"} onClick={() => void runTicketAction("waiting_staff")}>
                      Aguardar equipe
                    </Button>
                    {ticket.waitingOn ? (
                      <Button size="sm" variant="secondary" disabled={actionBusy} onClick={() => void runTicketAction("resume")}>
                        Retomar
                      </Button>
                    ) : null}
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
                  const who = m.kind === "system" || m.kind === "internal" ? null : memberById.get(m.authorId);
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex gap-2 rounded-lg px-2 py-1",
                        m.kind === "internal" && "bg-warn/10",
                      )}
                    >
                      {who ? <MemberAvatar name={who.displayName} hue={who.hue} size={28} /> : <span className="size-7" />}
                      <div className="min-w-0">
                        <p className="m-0 text-[11px] text-muted-foreground">
                          {m.kind === "internal" ? "Nota interna · " : ""}
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
                <div className="rounded-xl bg-primary/10 px-3 py-2 text-sm leading-6"><MarkdownContent content={ai} /></div>
              ) : null}
              {ticket.transcript && ticket.status !== "open" ? (
                <details className="rounded-xl bg-muted px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-medium">Transcrição</summary>
                  <pre className="mt-2 mb-0 overflow-x-auto whitespace-pre-wrap font-sans text-muted-foreground">
                    {ticket.transcript}
                  </pre>
                </details>
              ) : null}
              {ticket.transcriptUrl && /^https:\/\/haiz-transcript\.shardweb\.app\/transcript\/\d{17,20}$/.test(ticket.transcriptUrl) ? (
                <a
                  className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
                  href={ticket.transcriptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir transcrição completa
                </a>
              ) : null}
              {ticket.feedback ? (
                <p className="m-0 text-sm">
                  Feedback: {ticket.feedback.rating}/5 — {ticket.feedback.comment}
                </p>
              ) : null}
            </div>

            {ticket.status === "open" || ticket.status === "claimed" ? (
              <form
                className="space-y-2 border-t border-border p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!reply.trim()) return;
                  void runTicketAction(internalNote ? "note" : "reply", { content: reply.trim() }).then((ok) => {
                    if (ok) {
                      setReply("");
                      setInternalNote(false);
                    }
                  });
                }}
              >
                {savedReplies.length ? (
                  <NativeSelect
                    aria-label="Inserir resposta salva"
                    value=""
                    onChange={(event) => {
                      const selectedReply = savedReplies.find((item) => item.id === event.target.value);
                      if (selectedReply) {
                        setInternalNote(false);
                        setReply(selectedReply.content);
                      }
                    }}
                  >
                    <option value="">Inserir resposta salva…</option>
                    {savedReplies.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </NativeSelect>
                ) : null}
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  aria-label={internalNote ? "Nota interna para a equipe" : "Resposta ao usuário"}
                  placeholder={internalNote ? "Escreva uma nota visível apenas para a equipe…" : "Responder ao usuário…"}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <Switch checked={internalNote} onCheckedChange={setInternalNote} />
                    Nota interna
                  </label>
                  <Button type="submit" disabled={actionBusy || !reply.trim()}>
                    {actionBusy ? "Enviando…" : internalNote ? "Registrar nota" : "Enviar resposta"}
                  </Button>
                </div>
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
        <TicketPanelEditor guildId={gid} onNotice={announce} />
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

function CharCounter({ current, max }: { current: number; max: number }) {
  const over = current > max;
  return <p className={cn("m-0 mt-1 text-[10px]", over ? "text-destructive" : "text-muted-foreground")}>{current}/{max}</p>;
}

