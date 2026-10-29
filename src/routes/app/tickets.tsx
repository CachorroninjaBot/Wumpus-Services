import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Inbox,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Badge } from "@/components/ui/badge";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { asList, asString, planAllows } from "@/lib/wumpus/engine";
import { useActiveGuild, useModule, useWumpus } from "@/lib/wumpus/store";
import { usePublishPanel } from "@/lib/wumpus/use-publish-panel";
import { getGuildTickets } from "@/lib/wumpus/runtime-store";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import { ExclusiveButton } from "@/components/exclusive-button";
import { DiscordMultiSelect, DiscordSelect } from "@/components/discord-select";
import { DiscordPanel, DiscordModalPreview } from "@/components/discord-panel";
import type { TicketDepartmentConfig } from "@/lib/wumpus/types";
import { cn, formatRelative } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { NumberField } from "@/components/protect/helpers";

export const Route = createFileRoute("/app/tickets")({ component: TicketsPage });

const discordButtonStyles = [
  { value: 1, label: "Azul", preview: "primary" as const },
  { value: 2, label: "Cinza", preview: "secondary" as const },
  { value: 3, label: "Verde", preview: "success" as const },
  { value: 4, label: "Vermelho", preview: "danger" as const },
];

const statusLabel: Record<string, string> = {
  open: "Aberto",
  claimed: "Em atendimento",
  closed: "Encerrado",
  archived: "Arquivado",
};

type ArchiveTicket = {
  id: string;
  number: number;
  subject: string;
  department: string;
  status: string;
  createdAt: number;
};

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
  const { busy: pubBusy, publish: publishPanel } = usePublishPanel(gid);
  const guild = useActiveGuild();
  const tcfg = useModule("tickets");
  const staffConfig = useModule("staff");
  const updateConfig = useWumpus((s) => s.updateConfig);
  const setEnabled = useWumpus((s) => s.setModuleEnabled);
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
  const departmentDisplayMode = asString(tcfg.config.departmentDisplayMode, "select") === "buttons" ? "buttons" : "select";
  const panelButtonStyle = discordButtonStyles.find((style) => style.value === Number(tcfg.config.panelButtonStyle)) ?? discordButtonStyles[0]!;
  const departmentButtonStyle = discordButtonStyles.find((style) => style.value === Number(tcfg.config.departmentButtonStyle)) ?? discordButtonStyles[1]!;
  const departmentNames = departments.map((name) => name.trim().toLocaleLowerCase("pt-BR"));
  const validDepartmentSettings = departmentSettings.length > 0
    && (departmentDisplayMode !== "buttons" || departmentSettings.length <= 5)
    && departmentSettings.every((department) =>
      department.name.trim().length > 0
      && department.name.length <= 100
      && department.intakeQuestions.length <= 5
      && department.intakeQuestions.every((question) => question.trim().length > 0 && question.length <= 45)
    )
    && new Set(departmentNames).size === departmentNames.length;

  const [selectedTemplate, setSelectedTemplate] = useState("support");
  const [templateNotice, setTemplateNotice] = useState("");
  const [previewMode, setPreviewMode] = useState<"panel" | "modal">("panel");
  const [dirty, setDirty] = useState(false);
  const [activeView, setActiveView] = useState<"panel" | "archive">("panel");
  const [pubNotice, setPubNotice] = useState<string | null>(null);
  const [pubTone, setPubTone] = useState<"ok" | "error" | "neutral">("neutral");

  function saveDepartments(next: TicketDepartmentConfig[]) {
    const limited = canUseDepartments ? next.slice(0, 25) : next.slice(0, 1);
    updateConfig("tickets", {
      departments: limited.map((department) => department.name.trim()).filter(Boolean),
      departmentSettings: limited,
    });
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
    setTemplateNotice(`Modelo “${template.label}” aplicado. Ajuste o que quiser e publique o painel.`);
  }

  async function publish() {
    setPubNotice(null);
    const result = await publishPanel("tickets", asString(tcfg.config.panelChannelId));
    if (result) {
      setPubNotice(result.status === "done" ? "Painel publicado no Discord." : result.status === "failed" ? result.detail ?? "O bot não conseguiu publicar o painel." : "Pedido enviado; o bot vai confirmar em instantes.");
      setPubTone(result.status === "done" ? "ok" : result.status === "failed" ? "error" : "neutral");
      if (result.status === "done") setDirty(false);
    }
  }

  // Registro de consulta: as conversas acontecem no Discord; aqui listamos e linkamos.
  const [archive, setArchive] = useState<ArchiveTicket[]>([]);
  const [archiveQuery, setArchiveQuery] = useState("");
  const [archiveStatus, setArchiveStatus] = useState("open");
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveLoadedFor, setArchiveLoadedFor] = useState<string | null>(null);

  const loadArchive = useCallback(async () => {
    const token = getStoredSessionToken();
    if (!token || !gid) {
      setArchiveError("Entre com Discord para consultar o registro de atendimentos.");
      setArchiveLoadedFor(gid);
      return;
    }
    setArchiveLoading(true);
    setArchiveError(null);
    try {
      const rows = await getGuildTickets({ data: { token, guildId: gid } });
      setArchive(rows.map((row) => ({
        id: row.channelName || row.id,
        number: row.number,
        subject: row.subject,
        department: row.department ?? "Geral",
        status: row.status,
        createdAt: row.createdAt,
      })));
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : "Não foi possível carregar o registro de atendimentos.");
    } finally {
      setArchiveLoading(false);
      setArchiveLoadedFor(gid);
    }
  }, [gid]);

  useEffect(() => {
    setArchive([]);
    setArchiveLoadedFor(null);
    setArchiveError(null);
  }, [gid]);

  const visibleArchive = useMemo(() => {
    const needle = archiveQuery.trim().toLocaleLowerCase("pt-BR");
    return archive
      .filter((t) => archiveStatus === "all" || t.status === archiveStatus)
      .filter((t) => !needle || `#${t.number} ${t.subject} ${t.department}`.toLocaleLowerCase("pt-BR").includes(needle))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
  }, [archive, archiveQuery, archiveStatus]);

  return (
    <div key={gid} className="mx-auto flex max-w-7xl flex-col gap-8">
      <PageHeader
        title="Atendimento"
        description="Monte o painel que recebe pedidos de ajuda. As conversas acontecem no Discord, em canais privados — aqui você só cria o painel e acompanha o histórico."
      />

      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1 w-fit" role="tablist" aria-label="Área de atendimento">
        <button type="button" role="tab" aria-selected={activeView === "panel"} onClick={() => setActiveView("panel")}
          className={cn("min-h-10 rounded-lg px-4 text-sm font-medium transition-colors", activeView === "panel" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
          Criar painel
        </button>
        <button type="button" role="tab" aria-selected={activeView === "archive"} onClick={() => setActiveView("archive")}
          className={cn("min-h-10 rounded-lg px-4 text-sm font-medium transition-colors", activeView === "archive" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
          Atendimentos
        </button>
      </div>

      {activeView === "archive" ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-lg font-semibold tracking-tight">Registro de atendimentos</h2>
              <p className="m-0 mt-1 max-w-2xl text-sm text-muted-foreground">
                Cada ticket vive no Discord, no canal privado criado para a pessoa. Abra o canal para responder — a conversa inteira acontece lá.
              </p>
            </div>
            <Button variant="outline" disabled={archiveLoading} onClick={() => void loadArchive()}>
              {archiveLoading ? "Buscando…" : archiveLoadedFor === gid ? "Atualizar" : "Carregar atendimentos"}
            </Button>
          </div>
          {archiveError ? <Notice tone="warning" className="m-0">{archiveError}</Notice> : null}
          <div className="grid gap-2 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-[minmax(200px,1fr)_180px]">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Buscar atendimentos" className="pl-9" value={archiveQuery} onChange={(event) => setArchiveQuery(event.target.value)} placeholder="Buscar por assunto ou número" />
            </div>
            <NativeSelect aria-label="Filtrar por status" value={archiveStatus} onChange={(event) => setArchiveStatus(event.target.value)}>
              <option value="open">Abertos</option>
              <option value="claimed">Em atendimento</option>
              <option value="closed">Encerrados</option>
              <option value="all">Todos</option>
            </NativeSelect>
          </div>
          {visibleArchive.length === 0 ? (
            <EmptyState
              icon={<Inbox aria-hidden="true" className="size-8 text-muted-foreground" />}
              title={archiveLoading ? "Carregando…" : "Nenhum atendimento nesta vista"}
              description="Publique o painel para receber os primeiros tickets ou ajuste os filtros. Cada linha abre o canal no Discord."
            />
          ) : (
            <ul className="m-0 divide-y divide-border p-0">
              {visibleArchive.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="font-mono-num text-sm font-semibold">#{t.number}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{t.subject}</span>
                  <Badge tone="default">{t.department}</Badge>
                  <Badge tone={t.status === "open" ? "ok" : t.status === "claimed" ? "info" : "default"}>{statusLabel[t.status] ?? t.status}</Badge>
                  <span className="hidden text-xs text-muted-foreground sm:inline">{formatRelative(t.createdAt)}</span>
                  <a
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-primary hover:underline"
                    href={`https://discord.com/channels/${gid}/${t.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir no Discord <ExternalLink aria-hidden="true" className="size-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-xl font-semibold tracking-tight">Monte seu sistema de tickets</h2>
              <p className="m-0 mt-1 max-w-2xl text-sm text-muted-foreground">Comece com um modelo e personalize categorias, equipe, canais e regras. As alterações só chegam ao Discord quando você publica o painel.</p>
            </div>
            {dirty ? <Badge tone="warn">Alterações não publicadas</Badge> : null}
          </div>

          <section className="space-y-3" aria-labelledby="ticket-template-heading">
            <div>
              <h3 id="ticket-template-heading" className="m-0 text-sm font-semibold">Comece com um modelo</h3>
              <p className="m-0 mt-1 text-xs text-muted-foreground">Clique para aplicar um pacote pronto. Você pode ajustar depois.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-3">
              {Object.entries(ticketTemplates).map(([id, template]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setSelectedTemplate(id); applyTicketTemplate(id); setDirty(true); }}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    selectedTemplate === id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  )}
                >
                  <span className="block text-sm font-semibold">{template.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{template.description}</span>
                </button>
              ))}
            </div>
            {templateNotice ? <p role="status" className="m-0 text-sm text-ok">{templateNotice}</p> : null}
            {!canUseDepartments ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="m-0 text-xs text-muted-foreground">Seu plano permite um tipo de atendimento. Os modelos serão aplicados com uma categoria; departamentos extras são exclusivos dos planos Escala e Vitalício.</p><ExclusiveButton /></div> : null}
          </section>

          <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
            <div className="min-w-0 space-y-8">
              <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-labelledby="ticket-location-heading">
                <header>
                  <h3 id="ticket-location-heading" className="m-0 text-base font-semibold">Onde a pessoa encontra ajuda?</h3>
                  <p className="m-0 mt-1 text-sm text-muted-foreground">Escolha o canal público e a categoria para os canais privados.</p>
                </header>
                <Field label="Canal do painel de atendimento">
                  <DiscordSelect kind="text" value={asString(tcfg.config.panelChannelId)} onChange={(panelChannelId) => updateConfig("tickets", { panelChannelId })} placeholder="Selecione um canal" />
                </Field>
                <Field label="Categoria onde os canais privados serão criados">
                  <DiscordSelect kind="category" value={asString(tcfg.config.categoryId)} onChange={(categoryId) => updateConfig("tickets", { categoryId })} placeholder="Selecione uma categoria" />
                </Field>
                <ToggleRow label="Atendimento ligado" description="Desligue para pausar a abertura de novos tickets." checked={tcfg.enabled} onChange={(value) => setEnabled("tickets", value)} />
              </section>

              <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-labelledby="ticket-context-heading">
                <header>
                  <h3 id="ticket-context-heading" className="m-0 text-base font-semibold">Dê contexto ao painel</h3>
                  <p className="m-0 mt-1 text-sm text-muted-foreground">A pessoa verá esta mensagem antes de escolher o tipo de atendimento.</p>
                </header>
                <Field label="Título do painel">
                  <Input maxLength={100} value={asString(tcfg.config.panelTitle)} onChange={(e) => { updateConfig("tickets", { panelTitle: e.target.value }); setDirty(true); }} />
                  <CharCounter current={asString(tcfg.config.panelTitle).length} max={100} />
                </Field>
                <Field label="Descrição do painel">
                  <Textarea maxLength={4000} value={asString(tcfg.config.panelDescription)} onChange={(e) => { updateConfig("tickets", { panelDescription: e.target.value }); setDirty(true); }} />
                  <CharCounter current={asString(tcfg.config.panelDescription).length} max={4000} />
                </Field>
                <Field label="Cor de destaque">
                  <div className="flex gap-2">
                    <input type="color" value={asString(tcfg.config.panelAccentColor, "#28655b")} onChange={(e) => { updateConfig("tickets", { panelAccentColor: e.target.value }); setDirty(true); }} className="h-9 w-12 cursor-pointer rounded border border-border bg-background" />
                    <Input value={asString(tcfg.config.panelAccentColor, "#28655b")} onChange={(e) => { updateConfig("tickets", { panelAccentColor: e.target.value }); setDirty(true); }} placeholder="#28655b" />
                  </div>
                </Field>
                <Field label="Como mostrar as opções de atendimento?">
                  <div className="grid gap-2 sm:grid-cols-1 md:grid-cols-2" role="group" aria-label="Formato das opções de atendimento">
                    <button type="button" aria-pressed={departmentDisplayMode === "select"} onClick={() => { updateConfig("tickets", { departmentDisplayMode: "select" }); setDirty(true); }} className={cn("min-h-16 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", departmentDisplayMode === "select" ? "border-primary bg-primary/5 text-foreground" : "border-border hover:bg-muted/50")}>
                      <span className="block text-sm font-semibold">Menu suspenso</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Uma lista compacta que aceita até 25 opções.</span>
                    </button>
                    <button type="button" aria-pressed={departmentDisplayMode === "buttons"} disabled={departmentSettings.length > 5} onClick={() => { updateConfig("tickets", { departmentDisplayMode: "buttons" }); setDirty(true); }} className={cn("min-h-16 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", departmentDisplayMode === "buttons" ? "border-primary bg-primary/5 text-foreground" : "border-border hover:bg-muted/50")}>
                      <span className="block text-sm font-semibold">Botões no painel</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Cada tipo aparece direto na publicação, até 5.</span>
                    </button>
                  </div>
                  {departmentSettings.length > 5 ? <p className="m-0 text-xs text-muted-foreground">Para usar botões, reduza os tipos de atendimento para no máximo 5.</p> : null}
                </Field>
                {departmentDisplayMode === "select" ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                      <Field label="Texto do botão de abertura"><Input maxLength={80} value={asString(tcfg.config.panelButtonLabel, "Abrir atendimento")} onChange={(e) => { updateConfig("tickets", { panelButtonLabel: e.target.value }); setDirty(true); }} placeholder="Abrir atendimento" /></Field>
                      <Field label="Emoji"><Input maxLength={32} value={asString(tcfg.config.panelButtonEmoji, "🎫")} onChange={(e) => { updateConfig("tickets", { panelButtonEmoji: e.target.value }); setDirty(true); }} placeholder="🎫" /></Field>
                    </div>
                    <Field label="Mensagem ao escolher um tipo">
                      <Textarea rows={2} maxLength={2000} value={asString(tcfg.config.departmentMenuPrompt, "Escolha o departamento para abrir o atendimento:")} onChange={(event) => { updateConfig("tickets", { departmentMenuPrompt: event.target.value }); setDirty(true); }} />
                    </Field>
                    <Field label="Texto dentro do menu">
                      <Input maxLength={150} value={asString(tcfg.config.departmentMenuPlaceholder, "Escolha o departamento")} onChange={(event) => { updateConfig("tickets", { departmentMenuPlaceholder: event.target.value }); setDirty(true); }} />
                    </Field>
                    <Field label="Cor do botão de abertura">
                      <NativeSelect value={String(panelButtonStyle.value)} onChange={(event) => { updateConfig("tickets", { panelButtonStyle: Number(event.target.value) }); setDirty(true); }}>
                        {discordButtonStyles.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}
                      </NativeSelect>
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Cor dos botões de opção">
                      <NativeSelect value={String(departmentButtonStyle.value)} onChange={(event) => { updateConfig("tickets", { departmentButtonStyle: Number(event.target.value) }); setDirty(true); }}>
                        {discordButtonStyles.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}
                      </NativeSelect>
                    </Field>
                    <p className="m-0 text-xs text-muted-foreground">O Discord não exibe as descrições no formato de botões; elas aparecem no menu suspenso.</p>
                  </>
                )}
                <Field label="Texto complementar no rodapé (opcional)">
                  <Textarea rows={2} maxLength={300} value={asString(tcfg.config.panelFooter)} onChange={(event) => { updateConfig("tickets", { panelFooter: event.target.value }); setDirty(true); }} placeholder="Ex.: Horário de atendimento: 9h às 18h" />
                  <CharCounter current={asString(tcfg.config.panelFooter).length} max={300} />
                  <p className="m-0 text-xs text-muted-foreground">Aparece em texto discreto abaixo do painel.</p>
                </Field>
              </section>

              <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-labelledby="ticket-staff-heading">
                <header>
                  <h3 id="ticket-staff-heading" className="m-0 text-base font-semibold">Escolha quem responde</h3>
                  <p className="m-0 mt-1 text-sm text-muted-foreground">Cargos selecionados poderão acessar os canais privados.</p>
                </header>
                <Field label="Cargos da equipe"><DiscordMultiSelect value={asList(tcfg.config.staffRoleIds)} onChange={(staffRoleIds) => { updateConfig("tickets", { staffRoleIds }); setDirty(true); }} /></Field>
              </section>

              <details className="motion-disclosure rounded-2xl border border-border bg-card p-3.5">
                <summary className="cursor-pointer font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Mais configurações de atendimento</summary>
                <p className="mb-4 mt-2 text-sm text-muted-foreground">Prazos, automações, registros e aparência. Você pode voltar a elas quando quiser.</p>
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                    <NumberField id="ticket-max-open" label="Máximo de tickets abertos por pessoa" min={1} max={25} value={Number(tcfg.config.maxOpenPerUser ?? 1)} onChange={(maxOpenPerUser) => updateConfig("tickets", { maxOpenPerUser })} />
                    <Field label="Nome do canal · use {user}, {department} e {number}">
                      <Input key={asString(tcfg.config.namingPattern, "atendimento-{user}")} defaultValue={asString(tcfg.config.namingPattern, "atendimento-{user}")} onBlur={(e) => updateConfig("tickets", { namingPattern: e.target.value.trim() || "atendimento-{user}" })} />
                    </Field>
                  </div>
                  <NumberField id="ticket-sla-warning" label="Avisar a equipe depois de (minutos; 0 desliga)" min={0} max={10080} value={Number(tcfg.config.slaWarningMinutes ?? 60)} onChange={(slaWarningMinutes) => updateConfig("tickets", { slaWarningMinutes })} />
                  <ToggleRow label="Pedir avaliação ao encerrar" description="Receba uma nota e um comentário do cliente." checked={Boolean(tcfg.config.feedbackEnabled)} onChange={(value) => updateConfig("tickets", { feedbackEnabled: value })} />
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
                        <details key={department.id} className="motion-disclosure group py-3" open={index === 0}>
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
                            <ToggleRow label="Usar cargos da equipe padrão" description="Desative para definir uma equipe exclusiva para esta categoria." checked={department.inheritStaff} onChange={(inheritStaff) => {
                              const next = [...departmentSettings];
                              next[index] = { ...department, inheritStaff };
                              saveDepartments(next);
                            }} />
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
                    <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                      <Field label="Canal de transcrições">
                        <DiscordSelect kind="text" value={asString(tcfg.config.transcriptChannelId)} onChange={(transcriptChannelId) => updateConfig("tickets", { transcriptChannelId })} placeholder="Selecione um canal" />
                      </Field>
                      <Field label="Canal de auditoria">
                        <DiscordSelect kind="text" value={asString(tcfg.config.logChannelId)} onChange={(logChannelId) => updateConfig("tickets", { logChannelId })} placeholder="Selecione um canal" />
                      </Field>
                    </div>
                    <div>
                      <NumberField id="ticket-message-retention" label="Apagar mensagens após (dias; 0 mantém sem prazo)" min={0} max={3650} value={Number(tcfg.config.ticketMessageRetentionDays ?? 0)} onChange={(ticketMessageRetentionDays) => updateConfig("tickets", { ticketMessageRetentionDays })} />
                      <p className="m-0 text-xs text-muted-foreground">Remove mensagens e anexos locais após o prazo. Tickets novos com retenção configurada usam apenas a exportação local; transcripts externos já gerados não podem ser apagados pelo bot. O resumo permanece para estatísticas.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="divide-y divide-border">
                        <ToggleRow label="Notificar a equipe" description="Menciona os cargos ao abrir." checked={Boolean(tcfg.config.pingStaffOnOpen)} onChange={(value) => updateConfig("tickets", { pingStaffOnOpen: value })} />
                        <ToggleRow label="Permitir reabertura" description="A pessoa pode voltar ao canal." checked={Boolean(tcfg.config.reopenEnabled)} onChange={(value) => updateConfig("tickets", { reopenEnabled: value })} />
                        <ToggleRow label="Prioridade" description="A equipe classifica urgência." checked={Boolean(tcfg.config.priorityEnabled)} onChange={(value) => updateConfig("tickets", { priorityEnabled: value })} />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <NumberField id="ticket-close-after" label="Prazo para fechar automaticamente (horas; 0 desliga)" min={0} max={8760} value={Number(tcfg.config.closeAfterHours ?? 48)} onChange={(closeAfterHours) => updateConfig("tickets", { closeAfterHours })} />
                        <NumberField id="ticket-inactive-close" label="Prazo de inatividade (horas; 0 desliga)" min={0} max={8760} value={Number(tcfg.config.autoCloseInactiveHours ?? 24)} onChange={(autoCloseInactiveHours) => updateConfig("tickets", { autoCloseInactiveHours })} />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                      <NumberField id="staff-response-goal" label="Meta para primeira resposta (minutos)" min={5} max={10080} value={Number(staffConfig.config.responseTimeGoalMinutes ?? 30)} onChange={(responseTimeGoalMinutes) => updateConfig("staff", { responseTimeGoalMinutes })} />
                      <NumberField id="staff-max-concurrent" label="Tickets simultâneos por atendente" min={1} max={100} value={Number(staffConfig.config.maxConcurrentTickets ?? 5)} onChange={(maxConcurrentTickets) => updateConfig("staff", { maxConcurrentTickets })} />
                    </div>
                    <Field label="Mensagem de boas-vindas no canal privado">
                      <Textarea key={asString(tcfg.config.welcomeMessage)} rows={3} defaultValue={asString(tcfg.config.welcomeMessage)} onBlur={(e) => updateConfig("tickets", { welcomeMessage: e.target.value })} />
                      <p className="m-0 text-xs text-muted-foreground">Enviada automaticamente quando o atendimento é aberto.</p>
                    </Field>
                    <div className="space-y-4 divide-y divide-border">
                      <ToggleRow label="IA de apoio à equipe" description="Sugestões privadas aparecem no canal para os atendentes." checked={Boolean(tcfg.config.aiSupportEnabled)} onChange={(value) => updateConfig("tickets", { aiSupportEnabled: value })} />
                      <ToggleRow label="Incluir conversa nas análises por IA" description="Quando desligado, o conteúdo das mensagens não é enviado à IA." checked={Boolean(tcfg.config.aiIncludeConversation)} onChange={(value) => updateConfig("tickets", { aiIncludeConversation: value })} />
                    </div>
                  </section>
                </div>
              </details>
            </div>

            <aside className="min-w-0 space-y-4 xl:sticky xl:top-24 xl:self-start">
              <div className="flex items-center justify-between">
                <p className="m-0 text-sm font-semibold">Prévia</p>
                <div className="flex gap-1 rounded-lg border p-0.5 text-xs">
                  <button type="button" className={cn("rounded px-2 py-1", previewMode === "panel" && "bg-primary text-primary-foreground")} onClick={() => setPreviewMode("panel")}>Painel</button>
                  <button type="button" className={cn("rounded px-2 py-1", previewMode === "modal" && "bg-primary text-primary-foreground")} onClick={() => setPreviewMode("modal")}>Modal</button>
                </div>
              </div>
              {previewMode === "modal" ? (
                <DiscordModalPreview title={departmentSettings[0]?.name || "Abrir atendimento"} questions={departmentSettings[0]?.intakeQuestions || ["Como podemos ajudar?"]} />
              ) : (
                <DiscordPanel
                  channel={asString(tcfg.config.panelChannelId, "abrir-ticket").replace(/^#/, "") || "abrir-ticket"}
                  title={asString(tcfg.config.panelTitle, "Precisa de ajuda?")}
                  description={asString(tcfg.config.panelDescription, "Escolha uma opção para falar com nossa equipe.")}
                  accent={asString(tcfg.config.panelAccentColor, "#28655b")}
                  buttons={[`${asString(tcfg.config.panelButtonEmoji, "🎫")} ${asString(tcfg.config.panelButtonLabel, "Abrir atendimento")}`]}
                  choiceOptions={departmentSettings}
                  choiceDisplayMode={departmentDisplayMode}
                  choiceButtonStyle={departmentDisplayMode === "buttons" ? departmentButtonStyle.preview : panelButtonStyle.preview}
                  menuPrompt={asString(tcfg.config.departmentMenuPrompt, "Escolha o departamento para abrir o atendimento:")}
                  menuPlaceholder={asString(tcfg.config.departmentMenuPlaceholder, "Escolha o departamento")}
                  footer={asString(tcfg.config.panelFooter)}
                />
              )}
              <div className="space-y-2 rounded-2xl border border-border p-4">
                <h3 className="m-0 text-base font-semibold">Publicar no Discord</h3>
                <p className="m-0 text-sm text-muted-foreground">A publicação só aparece como concluída depois que o bot confirmar no Discord.</p>
                {!asString(tcfg.config.panelChannelId).trim() ? <p className="m-0 text-sm text-warn">Escolha o canal do painel acima para continuar.</p> : null}
                {!validDepartmentSettings ? <p role="alert" className="m-0 text-sm text-destructive">Revise os tipos: os nomes devem ser únicos, e cada pergunta precisa ter até 45 caracteres (máximo de 5 por tipo).</p> : null}
                {pubNotice ? <p role="status" className={cn("m-0 rounded-lg px-3 py-2 text-sm", pubTone === "ok" && "bg-ok/10 text-ok", pubTone === "error" && "bg-warn/15 text-warn", pubTone === "neutral" && "bg-muted text-foreground")}>{pubNotice}</p> : null}
                <Button
                  className="w-full"
                  disabled={pubBusy || !asString(tcfg.config.panelChannelId).trim() || !validDepartmentSettings}
                  onClick={() => void publish()}
                >
                  {pubBusy ? "Aguardando confirmação do bot…" : dirty ? "Publicar alterações" : "Publicar painel no Discord"}
                </Button>
              </div>
            </aside>
          </div>
        </div>
      )}
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
    <div className="flex min-h-14 items-center justify-between gap-4 py-3">
      <div className="min-w-0"><Label>{label}</Label><p className="m-0 mt-0.5 text-xs text-muted-foreground">{description}</p></div>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function CharCounter({ current, max }: { current: number; max: number }) {
  const over = current > max;
  return <p className={cn("m-0 mt-1 text-xs", over ? "text-destructive" : "text-muted-foreground")}>{current}/{max}</p>;
}
