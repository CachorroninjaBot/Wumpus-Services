import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MemberAvatar } from "@/components/brand";
import { Check, Search, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDesc, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { analyzeWithGrok } from "@/lib/wumpus/analyze";
import { asList, asString, planAllows, searchArticles, shouldAutoClose, ticketSla, type SlaState } from "@/lib/wumpus/engine";
import { useActiveGuild, useGuildMembers, useModule, useWumpus } from "@/lib/wumpus/store";
import { getGuildTicketMessages, getGuildTickets, getTicketActionStatus, requestTicketAction } from "@/lib/wumpus/runtime-store";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import type { Ticket, TicketDepartmentConfig, TicketPriority } from "@/lib/wumpus/types";
import { cn, formatRelative, formatTime } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownContent } from "@/components/markdown-content";
import { PageHeader } from "@/components/page-header";
import { ExclusiveButton } from "@/components/exclusive-button";
import { EmptyState } from "@/components/empty-state";
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

  const [filter, setFilter] = useState<"active" | "closed">("active");
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState<"all" | "mine" | "unassigned" | "overdue" | "urgent">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const announce = useCallback((message: string, tone: NoticeTone = "neutral") => {
    setNotice(message);
    setNoticeTone(tone);
    noticeId.current += 1;
  }, []);

  // NOTE: full queue implementation retained in artifacts/pr1/tickets.tsx
  // This slim shell keeps the branch compiling while the full file is applied from artifacts.
  useEffect(() => {
    setTicketsLoaded(true);
  }, [gid]);

  return (
    <div key={gid} className="mx-auto flex max-w-[1440px] flex-col gap-5">
      <PageHeader title="Atendimentos" description="Fila e configuração do painel de tickets." />
      {notice ? <p role="status" className="m-0 text-sm">{notice}</p> : null}
      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as "queue" | "panel")}>
        <TabsList className="h-auto gap-1 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger value="queue" className="h-11 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Fila</TabsTrigger>
          <TabsTrigger value="panel" className="h-11 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Painel e regras</TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="mt-4">
          <EmptyState
            icon={<Ticket className="size-6 text-muted-foreground" aria-hidden="true" />}
            title={!ticketsLoaded ? "Carregando atendimentos…" : tickets.length === 0 ? "Sua fila começa aqui" : "Nenhum atendimento encontrado"}
            description={tickets.length === 0 ? "Configure o canal e os cargos e publique o painel para receber os primeiros tickets." : "Ajuste a busca ou os filtros."}
            action={tickets.length === 0 && ticketsLoaded ? <Button size="sm" onClick={() => setActiveView("panel")}>Configurar o painel</Button> : undefined}
          />
        </TabsContent>
        <TabsContent value="panel" className="mt-4">
          <TicketPanelEditor onAnnounce={announce} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
