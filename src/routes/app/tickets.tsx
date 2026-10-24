import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MemberAvatar } from "@/components/brand";
import { DiscordMultiSelect, DiscordSelect } from "@/components/discord-select";
import { ArrowDown, ArrowUp, Check, Plus, Search, Trash2, WandSparkles } from "lucide-react";
import { DiscordModalPreview, DiscordPanel } from "@/components/discord-panel";
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
import { ExclusiveButton } from "@/components/exclusive-button";
import type { Ticket, TicketDepartmentConfig, TicketPriority } from "@/lib/wumpus/types";
import { cn, formatRelative, formatTime } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownContent } from "@/components/markdown-content";

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
type SavedReply = { id: string; label: string; content: string };

function readSavedReplies(value: unknown): SavedReply[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): SavedReply[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.label !== "string" || typeof row.content !== "string") return [];
    return [{ id: row.id, label: row.label, content: row.content }];
  }).slice(0, 20);
}

const ticketTemplates: Record<string, { label: string; description: string; config: Partial<Record<string, unknown>> }> = {
  support: {
    label: "Suporte geral",
    description: "Dúvidas, problemas técnicos e denúncias.",
    config: {
      panelTitle: "Central de atendimento",
      panelDescription: "Escolha o assunto e conte à equipe como podemos ajudar.",
      panelButtonLabel: "Abrir atendimento",
      panelButtonEmoji: "🎫",
      departments: ["Suporte", "Denúncia", "Parcerias"],
      departmentSettings: [
        { id: "support", name: "Suporte", description: "Dúvidas e problemas técnicos.", emoji: "🛟", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Como podemos ajudar?"] },
        { id: "report", name: "Denúncia", description: "Reporte um problema com segurança.", emoji: "⚠️", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Descreva o que aconteceu."] },
        { id: "partnership", name: "Parcerias", description: "Fale sobre uma parceria com o servidor.", emoji: "🤝", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Conte um pouco sobre sua proposta."] },
      ],
      maxOpenPerUser: 1,
      pingStaffOnOpen: true,
      feedbackEnabled: true,
      reopenEnabled: true,
    },
  },
  store: {
    label: "Loja e pedidos",
    description: "Organiza compras, pagamentos e reembolsos.",
    config: {
      panelTitle: "Atendimento da loja",
      panelDescription: "Selecione o tema do seu pedido para falar com a equipe certa.",
      panelButtonLabel: "Falar com a loja",
      panelButtonEmoji: "🛒",
      departments: ["Compras", "Pagamento", "Reembolso"],
      departmentSettings: [
        { id: "purchase", name: "Compras", description: "Dúvidas antes de fazer um pedido.", emoji: "🛍️", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["O que você deseja comprar?"] },
        { id: "payment", name: "Pagamento", description: "Ajuda com pagamentos e pedidos.", emoji: "💳", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Conte o que houve com o pagamento."] },
        { id: "refund", name: "Reembolso", description: "Solicite ajuda com um reembolso.", emoji: "↩️", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Qual pedido você quer reembolsar?"] },
      ],
      maxOpenPerUser: 1,
      pingStaffOnOpen: true,
      feedbackEnabled: true,
    },
  },
  community: {
    label: "Comunidade",
    description: "Suporte, denúncias, recursos e contato com a equipe.",
    config: {
      panelTitle: "Fale com a equipe",
      panelDescription: "Escolha uma categoria para direcionar sua solicitação.",
      panelButtonLabel: "Criar ticket",
      panelButtonEmoji: "💬",
      departments: ["Ajuda", "Denúncia", "Recurso", "Equipe"],
      departmentSettings: [
        { id: "help", name: "Ajuda", description: "Dúvidas sobre o servidor.", emoji: "❓", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Qual é a sua dúvida?"] },
        { id: "report", name: "Denúncia", description: "Reporte uma situação à moderação.", emoji: "🚩", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Descreva a situação e inclua evidências."] },
        { id: "appeal", name: "Recurso", description: "Peça a revisão de uma decisão.", emoji: "⚖️", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Qual decisão você gostaria de revisar?"] },
        { id: "staff", name: "Equipe", description: "Outros assuntos para a equipe.", emoji: "👥", categoryId: "", staffRoleIds: [], inheritStaff: true, welcomeMessage: "", intakeQuestions: ["Como podemos ajudar?"] },
      ],
      maxOpenPerUser: 2,
      pingStaffOnOpen: true,
      feedbackEnabled: true,
      reopenEnabled: true,
    },
  },
};

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
  const configuredSavedReplies = readSavedReplies(tcfg.config.savedReplies);
  const savedReplies = configuredSavedReplies.filter((item) => item.label.trim() && item.content.trim());
  const canUseDepartments = planAllows(guild.plan, "multiDepartment");
  const departmentSettings = useMemo<TicketDepartmentConfig[]>(() => {
    const saved = Array.isArray(tcfg.config.departmentSettings)
      ? tcfg.config.departmentSettings.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      : [];
    const normalized: TicketDepartmentConfig[] = saved.length
      ? saved.map((item, index) => ({
          id: asString(item.id, `legacy-${index}`),
          name: asString(item.name),
          description: asString(item.description),
          emoji: asString(item.emoji, "🎫"),
          categoryId: asString(item.categoryId),
          staffRoleIds: asList(item.staffRoleIds),
          inheritStaff: item.inheritStaff !== false,
          welcomeMessage: asString(item.welcomeMessage),
          intakeQuestions: asList(item.intakeQuestions),
        }))
      : asList(tcfg.config.departments).map((name) => ({
          id: `legacy-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          name,
          description: "",
          emoji: "🎫",
          categoryId: "",
          staffRoleIds: [],
          inheritStaff: true,
          welcomeMessage: "",
          intakeQuestions: [],
        }));
    return canUseDepartments ? normalized.slice(0, 25) : normalized.slice(0, 1);
  }, [canUseDepartments, tcfg.config.departmentSettings, tcfg.config.departments]);
  const departments = departmentSettings.map((department) => department.name);
  const departmentNames = departments.map((name) => name.trim().toLocaleLowerCase("pt-BR"));
  const validDepartmentSettings = departmentSettings.length > 0
    && departmentSettings.every((department) =>
      department.name.trim().length > 0
      && department.name.length <= 100
      && department.intakeQuestions.length <= 5
      && department.intakeQuestions.every((question) => question.trim().length > 0 && question.length <= 45)
    )
    && new Set(departmentNames).size === departmentNames.length;
  const [selectedTemplate, setSelectedTemplate] = useState("support");
  const [templateNotice, setTemplateNotice] = useState("");

  function saveDepartments(next: TicketDepartmentConfig[]) {
    const limited = canUseDepartments ? next.slice(0, 25) : next.slice(0, 1);
    updateConfig("tickets", {
      departments: limited.map((department) => department.name.trim()).filter(Boolean),
      departmentSettings: limited,
    });
  }

  function saveSavedReplies(next: SavedReply[]) {
    updateConfig("tickets", { savedReplies: next.slice(0, 20) });
  }

  function applyTicketTemplate(templateId: string) {
    const template = ticketTemplates[templateId];
    if (!template) return;
    const presetDepartments = template.config.departmentSettings as TicketDepartmentConfig[];
    const limitedDepartments = canUseDepartments ? presetDepartments : presetDepartments.slice(0, 1);
    updateConfig("tickets", {
      ...template.config,
      departments: limitedDepartments.map((department) => department.name),
      departmentSettings: limitedDepartments,
    });
    setTemplateNotice(`Modelo “${template.label}” aplicado. Você pode ajustar cada opção antes de publicar.`);
  }

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
        <TabsContent value="panel" className="mt-4 space-y-5">
          <div><h2 className="m-0 text-xl font-semibold tracking-tight">Monte seu sistema de tickets</h2><p className="m-0 mt-1 max-w-2xl text-sm text-muted-foreground">Comece com um modelo e personalize categorias, equipe, canais e regras. As alterações só chegam ao Discord quando você publica o painel.</p></div>
          <section className="space-y-3 rounded-2xl border border-border bg-card p-4" aria-labelledby="ticket-template-heading">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <Label htmlFor="ticket-template">Modelo para começar</Label>
                <NativeSelect id="ticket-template" className="mt-1.5" value={selectedTemplate} onChange={(event) => { setSelectedTemplate(event.target.value); setTemplateNotice(""); }}>
                  {Object.entries(ticketTemplates).map(([id, template]) => <option key={id} value={id}>{template.label} — {template.description}</option>)}
                </NativeSelect>
              </div>
              <Button type="button" variant="secondary" onClick={() => applyTicketTemplate(selectedTemplate)}>
                <WandSparkles aria-hidden="true" className="size-4" />
                Usar modelo
              </Button>
            </div>
            {templateNotice ? <p role="status" className="m-0 text-sm text-ok">{templateNotice}</p> : null}
            {!canUseDepartments ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="m-0 text-xs text-muted-foreground">Seu plano permite um tipo de atendimento. Os modelos serão aplicados com uma categoria; departamentos extras são exclusivos dos planos Escala e Vitalício.</p><ExclusiveButton /></div> : null}
          </section>
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
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <Field label="Texto do botão"><Input maxLength={80} value={asString(tcfg.config.panelButtonLabel, "Abrir atendimento")} onChange={(e) => updateConfig("tickets", { panelButtonLabel: e.target.value })} placeholder="Abrir atendimento" /></Field>
              <Field label="Emoji"><Input maxLength={32} value={asString(tcfg.config.panelButtonEmoji, "����")} onChange={(e) => updateConfig("tickets", { panelButtonEmoji: e.target.value })} placeholder="🎫" /></Field>
            </div>
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
                <Input key={String(tcfg.config.maxOpenPerUser ?? 1)} type="number" min={1} max={25} defaultValue={Number(tcfg.config.maxOpenPerUser ?? 1)} onBlur={(e) => updateConfig("tickets", { maxOpenPerUser: Math.max(1, Math.min(25, Number(e.target.value) || 1)) })} />
              </Field>
              <Field label="Nome do canal · use {user}, {department} e {number}">
                <Input key={asString(tcfg.config.namingPattern, "atendimento-{user}")} defaultValue={asString(tcfg.config.namingPattern, "atendimento-{user}")} onBlur={(e) => updateConfig("tickets", { namingPattern: e.target.value.trim() || "atendimento-{user}" })} />
              </Field>
            </div>
            <Field label="Avisar a equipe depois de (minutos; 0 desliga)">
              <Input
                type="number"
                min={0}
                max={10080}
                key={String(tcfg.config.slaWarningMinutes ?? 60)}
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
              <section className="space-y-3" aria-labelledby="ticket-departments-heading">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 id="ticket-departments-heading" className="m-0 text-sm font-semibold">Tipos de atendimento</h3>
                    <p className="m-0 mt-1 text-xs text-muted-foreground">Cada tipo pode encaminhar para outra categoria do Discord e outra equipe.</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={departmentSettings.length >= (canUseDepartments ? 25 : 1)}
                    onClick={() => saveDepartments([...departmentSettings, {
                      name: `Novo tipo ${departmentSettings.length + 1}`,
                      id: `custom-${crypto.randomUUID()}`,
                      description: "",
                      emoji: "🎫",
                      categoryId: "",
                      staffRoleIds: [],
                      inheritStaff: true,
                      welcomeMessage: "",
                      intakeQuestions: [],
                    }])}
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    Adicionar tipo
                  </Button>
                </div>
                <div className="divide-y divide-border rounded-xl border border-border px-3">
                  {departmentSettings.map((department, index) => (
                    <details key={department.id} className="group py-3" open={index === 0}>
                      <summary className="flex cursor-pointer list-none items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span aria-hidden="true">{department.emoji || "🎫"}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{department.name || `Tipo ${index + 1}`}</span>
                        <span className="text-xs text-muted-foreground">{department.inheritStaff ? "Equipe padrão" : "Equipe própria"}</span>
                      </summary>
                      <div className="space-y-3 pb-1 pt-3">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
                          <Field label="Nome da opção">
                            <Input maxLength={100} value={department.name} onChange={(event) => {
                              const next = [...departmentSettings];
                              next[index] = { ...department, name: event.target.value };
                              saveDepartments(next);
                            }} />
                          </Field>
                          <Field label="Emoji">
                            <Input maxLength={32} value={department.emoji} onChange={(event) => {
                              const next = [...departmentSettings];
                              next[index] = { ...department, emoji: event.target.value };
                              saveDepartments(next);
                            }} />
                          </Field>
                        </div>
                        <Field label="Descrição no menu do Discord">
                          <Input maxLength={100} value={department.description} onChange={(event) => {
                            const next = [...departmentSettings];
                            next[index] = { ...department, description: event.target.value };
                            saveDepartments(next);
                          }} placeholder="Explique brevemente quando escolher esta opção" />
                        </Field>
                        <Field label="Categoria para criar os tickets">
                          <DiscordSelect kind="category" value={department.categoryId} onChange={(categoryId) => {
                            const next = [...departmentSettings];
                            next[index] = { ...department, categoryId };
                            saveDepartments(next);
                          }} placeholder="Usar categoria padrão" />
                        </Field>
                        <div className="flex items-start justify-between gap-3 rounded-lg bg-muted/40 p-3">
                          <div className="min-w-0">
                            <Label htmlFor={`inherit-staff-${index}`}>Usar cargos da equipe padrão</Label>
                            <p className="m-0 mt-0.5 text-xs text-muted-foreground">Desative para definir uma equipe exclusiva para esta categoria.</p>
                          </div>
                          <Switch id={`inherit-staff-${index}`} checked={department.inheritStaff} onCheckedChange={(inheritStaff) => {
                            const next = [...departmentSettings];
                            next[index] = { ...department, inheritStaff };
                            saveDepartments(next);
                          }} />
                        </div>
                        {!department.inheritStaff ? (
                          <Field label="Cargos desta equipe">
                            <DiscordMultiSelect value={department.staffRoleIds} onChange={(staffRoleIds) => {
                              const next = [...departmentSettings];
                              next[index] = { ...department, staffRoleIds };
                              saveDepartments(next);
                            }} />
                          </Field>
                        ) : null}
                        <Field label="Mensagem de boas-vindas específica">
                          <Textarea rows={2} maxLength={2000} value={department.welcomeMessage} onChange={(event) => {
                            const next = [...departmentSettings];
                            next[index] = { ...department, welcomeMessage: event.target.value };
                            saveDepartments(next);
                          }} placeholder="Vazio usa a mensagem padrão do painel" />
                        </Field>
                        <Field label="Perguntas antes de abrir (até 5)">
                          <div className="space-y-2">
                            {department.intakeQuestions.map((question, questionIndex) => (
                              <div key={`${department.id}-question-${questionIndex}`} className="flex gap-2">
                                <Input
                                  maxLength={45}
                                  value={question}
                                  aria-label={`Pergunta ${questionIndex + 1} de ${department.name}`}
                                  onChange={(event) => {
                                    const next = [...departmentSettings];
                                    const intakeQuestions = [...department.intakeQuestions];
                                    intakeQuestions[questionIndex] = event.target.value;
                                    next[index] = { ...department, intakeQuestions };
                                    saveDepartments(next);
                                  }}
                                />
                                <Button type="button" size="icon" variant="ghost" aria-label={`Remover pergunta ${questionIndex + 1}`} onClick={() => {
                                  const next = [...departmentSettings];
                                  next[index] = { ...department, intakeQuestions: department.intakeQuestions.filter((_, itemIndex) => itemIndex !== questionIndex) };
                                  saveDepartments(next);
                                }}>
                                  <Trash2 aria-hidden="true" className="size-4" />
                                </Button>
                              </div>
                            ))}
                            {department.intakeQuestions.length < 5 ? (
                              <Button type="button" size="sm" variant="outline" onClick={() => {
                                const next = [...departmentSettings];
                                next[index] = { ...department, intakeQuestions: [...department.intakeQuestions, "Nova pergunta"] };
                                saveDepartments(next);
                              }}>
                                <Plus aria-hidden="true" className="size-4" />
                                Adicionar pergunta
                              </Button>
                            ) : null}
                          </div>
                          <p className="m-0 text-xs text-muted-foreground">A pessoa responde em um formulário do Discord antes da criação do canal. O limite da plataforma é de 5 perguntas por formulário.</p>
                        </Field>
                        {departmentSettings.length > 1 ? (
                          <div className="flex justify-between gap-2">
                            <div className="flex gap-1">
                              <Button type="button" size="icon" variant="ghost" aria-label={`Mover ${department.name} para cima`} disabled={index === 0} onClick={() => {
                                const next = [...departmentSettings];
                                [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                                saveDepartments(next);
                              }}><ArrowUp aria-hidden="true" className="size-4" /></Button>
                              <Button type="button" size="icon" variant="ghost" aria-label={`Mover ${department.name} para baixo`} disabled={index === departmentSettings.length - 1} onClick={() => {
                                const next = [...departmentSettings];
                                [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
                                saveDepartments(next);
                              }}><ArrowDown aria-hidden="true" className="size-4" /></Button>
                            </div>
                            <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => saveDepartments(departmentSettings.filter((_, itemIndex) => itemIndex !== index))}>
                              <Trash2 aria-hidden="true" className="size-4" />
                              Remover tipo
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Canal de transcrições">
                    <DiscordSelect kind="text" value={asString(tcfg.config.transcriptChannelId)} onChange={(transcriptChannelId) => updateConfig("tickets", { transcriptChannelId })} placeholder="Selecione um canal" />
                  </Field>
                  <Field label="Canal de auditoria">
                    <DiscordSelect kind="text" value={asString(tcfg.config.logChannelId)} onChange={(logChannelId) => updateConfig("tickets", { logChannelId })} placeholder="Selecione um canal" />
                  </Field>
                </div>
                <Field label="Apagar mensagens após (dias; 0 mantém sem prazo)">
                  <Input key={String(tcfg.config.ticketMessageRetentionDays ?? 0)} type="number" min={0} max={3650} defaultValue={Number(tcfg.config.ticketMessageRetentionDays ?? 0)} onBlur={(e) => updateConfig("tickets", { ticketMessageRetentionDays: Math.max(0, Math.min(3650, Number(e.target.value) || 0)) })} />
                  <p className="m-0 text-xs text-muted-foreground">Remove mensagens e anexos locais após o prazo. Tickets novos com retenção configurada usam apenas a exportação local; transcripts externos já gerados não podem ser apagados pelo bot. O resumo permanece para estatísticas.</p>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><Label>Notificar a equipe</Label><p className="m-0 text-xs text-muted-foreground">Menciona os cargos ao abrir.</p></div><Switch checked={Boolean(tcfg.config.pingStaffOnOpen)} onCheckedChange={(value) => updateConfig("tickets", { pingStaffOnOpen: value })} /></div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><Label>Permitir reabertura</Label><p className="m-0 text-xs text-muted-foreground">A pessoa pode voltar ao canal.</p></div><Switch checked={Boolean(tcfg.config.reopenEnabled)} onCheckedChange={(value) => updateConfig("tickets", { reopenEnabled: value })} /></div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><Label>Prioridade</Label><p className="m-0 text-xs text-muted-foreground">A equipe classifica urgência.</p></div><Switch checked={Boolean(tcfg.config.priorityEnabled)} onCheckedChange={(value) => updateConfig("tickets", { priorityEnabled: value })} /></div>
                  <Field label="Prazo para fechar automaticamente (horas; 0 desliga)"><Input key={String(tcfg.config.closeAfterHours ?? 48)} type="number" min={0} max={8760} defaultValue={Number(tcfg.config.closeAfterHours ?? 48)} onBlur={(e) => updateConfig("tickets", { closeAfterHours: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                  <Field label="Prazo de inatividade (horas; 0 desliga)"><Input key={String(tcfg.config.autoCloseInactiveHours ?? 24)} type="number" min={0} max={8760} defaultValue={Number(tcfg.config.autoCloseInactiveHours ?? 24)} onBlur={(e) => updateConfig("tickets", { autoCloseInactiveHours: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Meta para primeira resposta (minutos)">
                    <Input key={String(staffConfig.config.responseTimeGoalMinutes ?? 30)} type="number" min={5} max={10080} defaultValue={Number(staffConfig.config.responseTimeGoalMinutes ?? 30)} onBlur={(e) => updateConfig("staff", { responseTimeGoalMinutes: Math.max(5, Math.min(10080, Number(e.target.value) || 30)) })} />
                  </Field>
                  <Field label="Tickets simultâneos por atendente">
                    <Input key={String(staffConfig.config.maxConcurrentTickets ?? 5)} type="number" min={1} max={100} defaultValue={Number(staffConfig.config.maxConcurrentTickets ?? 5)} onBlur={(e) => updateConfig("staff", { maxConcurrentTickets: Math.max(1, Math.min(100, Number(e.target.value) || 5)) })} />
                  </Field>
                </div>
                <Field label="Mensagem de boas-vindas no canal privado">
                  <Textarea key={asString(tcfg.config.welcomeMessage)} rows={3} defaultValue={asString(tcfg.config.welcomeMessage)} onBlur={(e) => updateConfig("tickets", { welcomeMessage: e.target.value })} />
                  <p className="m-0 text-xs text-muted-foreground">Enviada automaticamente quando o atendimento é aberto.</p>
                </Field>
                <section className="space-y-3" aria-labelledby="ticket-saved-replies-heading">
                  <div>
                    <h3 id="ticket-saved-replies-heading" className="m-0 text-sm font-semibold">Respostas salvas</h3>
                    <p className="m-0 mt-1 text-xs text-muted-foreground">Atalhos para mensagens frequentes da equipe. Elas só são enviadas depois da confirmação no ticket.</p>
                  </div>
                  {configuredSavedReplies.map((item, index) => (
                    <div key={item.id} className="space-y-2 rounded-xl border border-border p-3">
                      <div className="flex gap-2">
                        <Input
                          aria-label={`Nome da resposta salva ${index + 1}`}
                          maxLength={60}
                          value={item.label}
                          placeholder="Nome da resposta"
                          onChange={(event) => {
                            const next = [...configuredSavedReplies];
                            next[index] = { ...item, label: event.target.value };
                            saveSavedReplies(next);
                          }}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Remover resposta salva ${index + 1}`}
                          onClick={() => saveSavedReplies(configuredSavedReplies.filter((_, replyIndex) => replyIndex !== index))}
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      </div>
                      <Textarea
                        aria-label={`Texto da resposta salva ${index + 1}`}
                        rows={2}
                        maxLength={2000}
                        value={item.content}
                        placeholder="Texto que será inserido no campo de resposta"
                        onChange={(event) => {
                          const next = [...configuredSavedReplies];
                          next[index] = { ...item, content: event.target.value };
                          saveSavedReplies(next);
                        }}
                      />
                    </div>
                  ))}
                  {configuredSavedReplies.length < 20 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => saveSavedReplies([
                        ...configuredSavedReplies,
                        { id: `reply-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, label: "", content: "" },
                      ])}
                    >
                      <Plus aria-hidden="true" className="size-4" />
                      Adicionar resposta salva
                    </Button>
                  ) : <p className="m-0 text-xs text-muted-foreground">Limite de 20 respostas salvas atingido.</p>}
                </section>
                <ToggleRow label="IA de apoio à equipe" description="Gera sugestões privadas para os atendentes." checked={Boolean(tcfg.config.aiSupportEnabled)} onChange={(value) => updateConfig("tickets", { aiSupportEnabled: value })} />
                <ToggleRow label="Incluir conversa nas análises por IA" description="Quando desligado, o conteúdo das mensagens não é enviado à IA." checked={Boolean(tcfg.config.aiIncludeConversation)} onChange={(value) => updateConfig("tickets", { aiIncludeConversation: value })} />
              </section>
            </div>
          </details>
          <div className="space-y-2 rounded-2xl border border-border p-4">
            <h3 className="m-0 text-base font-semibold">Publicar no Discord</h3>
            <p className="m-0 text-sm text-muted-foreground">A publicação só aparece como concluída depois que o bot confirmar no Discord.</p>
            {!asString(tcfg.config.panelChannelId).trim() ? <p className="m-0 text-sm text-warn">Escolha o canal do painel acima para continuar.</p> : null}
            {!validDepartmentSettings ? <p role="alert" className="m-0 text-sm text-destructive">Revise os tipos: os nomes devem ser únicos, e cada pergunta precisa ter até 45 caracteres (máximo de 5 por tipo).</p> : null}
                <Button
                  disabled={pubBusy || !asString(tcfg.config.panelChannelId).trim() || !validDepartmentSettings}
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
            <DiscordPanel
              channel={asString(tcfg.config.panelChannelId, "abrir-ticket").replace(/^#/, "") || "abrir-ticket"}
              title={asString(tcfg.config.panelTitle, "Precisa de ajuda?")}
              description={asString(tcfg.config.panelDescription, "Escolha uma opção para falar com nossa equipe.")}
              accent={asString(tcfg.config.panelAccentColor, "#28655b")}
              buttons={[`${asString(tcfg.config.panelButtonEmoji, "🎫")} ${asString(tcfg.config.panelButtonLabel, "Abrir atendimento")}`]}
              choiceOptions={departmentSettings}
            />
            {departmentSettings[0]?.intakeQuestions.length ? (
              <DiscordModalPreview title={departmentSettings[0].name} questions={departmentSettings[0].intakeQuestions} />
            ) : null}
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
