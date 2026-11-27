import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Layers, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { asList, asString, planAllows } from "@/lib/wumpus/engine";
import { useActiveGuild, useModule, useWumpus } from "@/lib/wumpus/store";
import { usePublishPanel } from "@/lib/wumpus/use-publish-panel";
import { ExclusiveButton } from "@/components/exclusive-button";
import { DiscordMultiSelect, DiscordSelect } from "@/components/discord-select";
import { DiscordPanel, DiscordModalPreview } from "@/components/discord-panel";
import { ticketPanelPreflight } from "@/lib/wumpus/preflight";
import {
  normalizeTicketPanels,
  panelTicketTypes,
  type TicketPanel,
} from "@/lib/wumpus/ticket-panels";
import type { TicketDepartmentConfig } from "@/lib/wumpus/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { NumberField } from "@/components/protect/helpers";

export const Route = createFileRoute("/app/config/tickets")({
  component: TicketPanelSettings,
});

const discordButtonStyles = [
  { value: 1, label: "Azul", preview: "primary" as const },
  { value: 2, label: "Cinza", preview: "secondary" as const },
  { value: 3, label: "Verde", preview: "success" as const },
  { value: 4, label: "Vermelho", preview: "danger" as const },
];

const TICKETS_MODULE = "tickets" as const;

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

function TicketPanelSettings() {
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

  const maxPanels = canUseDepartments ? (guild.plan === "vitalicio" ? 25 : 5) : 1;
  const panels = useMemo(
    () => normalizeTicketPanels(tcfg.config).slice(0, maxPanels),
    [maxPanels, tcfg.config],
  );
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const panel = panels.find((entry) => entry.id === selectedPanelId) ?? panels[0];
  const panelTypes = useMemo(
    () => (panel ? panelTicketTypes(tcfg.config, panel) : []),
    [panel, tcfg.config],
  );

  const savedReplies = useMemo<Array<{ title: string; body: string }>>(() => {
    const raw = Array.isArray(tcfg.config.savedReplies) ? tcfg.config.savedReplies : [];
    return raw
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
      .map((entry) => ({ title: asString(entry.title), body: asString(entry.body) }))
      .slice(0, 25);
  }, [tcfg.config.savedReplies]);

  const departmentDisplayMode = panel?.displayMode ?? "select";
  const panelButtonStyle = discordButtonStyles.find((style) => style.value === (panel?.buttonStyle ?? 1)) ?? discordButtonStyles[0]!;
  const departmentButtonStyle = discordButtonStyles.find((style) => style.value === (panel?.buttonDisplayStyle ?? 2)) ?? discordButtonStyles[1]!;
  const [selectedTemplate, setSelectedTemplate] = useState("support");
  const [templateNotice, setTemplateNotice] = useState("");
  const [previewMode, setPreviewMode] = useState<"panel" | "modal">("panel");
  const [dirty, setDirty] = useState(false);
  const [pubNotice, setPubNotice] = useState<string | null>(null);
  const [pubTone, setPubTone] = useState<"ok" | "error" | "neutral">("neutral");

  const preflight = useMemo(() => ticketPanelPreflight(tcfg.config), [tcfg.config]);
  const blockingIssues = preflight.filter((issue) => issue.level === "error");
  const warnings = preflight.filter((issue) => issue.level === "warn");

  /** Toda edição passa por aqui: grava a config e marca o rascunho como não publicado. */
  function patchTickets(patch: Record<string, unknown>) {
    updateConfig(TICKETS_MODULE, patch);
    setDirty(true);
  }

  /**
   * Grava a lista de paineis. O primeiro painel também alimenta os campos
   * antigos (`panelChannelId`, `panelTitle`, ...) para o que ainda lê deles
   * continuar coerente.
   */
  function savePanels(next: TicketPanel[]) {
    const primary = next[0];
    patchTickets({
      ticketPanels: next,
      ...(primary
        ? {
            panelChannelId: primary.channelId,
            panelTitle: primary.title,
            panelDescription: primary.description,
            panelAccentColor: primary.accentColor,
            panelFooter: primary.footer,
            panelButtonLabel: primary.buttonLabel,
            panelButtonEmoji: primary.buttonEmoji,
            panelButtonStyle: primary.buttonStyle,
            departmentDisplayMode: primary.displayMode,
            departmentButtonStyle: primary.buttonDisplayStyle,
            departmentMenuPrompt: primary.menuPrompt,
            departmentMenuPlaceholder: primary.menuPlaceholder,
          }
        : {}),
    });
  }

  function patchPanel(patch: Partial<TicketPanel>) {
    if (!panel) return;
    savePanels(panels.map((entry) => (entry.id === panel.id ? { ...entry, ...patch } : entry)));
  }

  function addPanel() {
    if (panels.length >= maxPanels || !panel) return;
    const id = `panel-${crypto.randomUUID()}`;
    const next: TicketPanel[] = [
      ...panels,
      {
        ...panel,
        id,
        name: `Painel ${panels.length + 1}`,
        channelId: "",
        typeIds: panel.typeIds.length ? panel.typeIds : departmentSettings.map((type) => type.id),
      },
    ];
    savePanels(next);
    setSelectedPanelId(id);
  }

  function removePanel(id: string) {
    if (panels.length <= 1) return;
    const next = panels.filter((entry) => entry.id !== id);
    savePanels(next);
    if (selectedPanelId === id) setSelectedPanelId(next[0]?.id ?? null);
  }

  function saveDepartments(next: TicketDepartmentConfig[]) {
    const limited = canUseDepartments ? next.slice(0, 25) : next.slice(0, 1);
    const previous = new Set(departmentSettings.map((type) => type.id));
    const added = limited.filter((type) => !previous.has(type.id)).map((type) => type.id);
    patchTickets({
      departments: limited.map((department) => department.name.trim()).filter(Boolean),
      departmentSettings: limited,
      // Tipo novo entra em todos os paineis existentes: é o comportamento que
      // a pessoa espera ao clicar em "Adicionar tipo".
      ...(added.length && Array.isArray(tcfg.config.ticketPanels)
        ? {
            ticketPanels: panels.map((entry) => ({
              ...entry,
              typeIds: [...new Set([...entry.typeIds, ...added])],
            })),
          }
        : {}),
    });
  }

  function applyTicketTemplate(templateId: string) {
    const template = ticketTemplates[templateId];
    if (!template) return;
    const presetDepartments = template.config.departmentSettings as TicketDepartmentConfig[];
    const limitedDepartments = canUseDepartments ? presetDepartments : presetDepartments.slice(0, 1);
    const typeIds = limitedDepartments.map((department) => department.id);
    const templatePanels = panel
      ? panels.map((entry) =>
          entry.id === panel.id
            ? {
                ...entry,
                title: asString(template.config.panelTitle, entry.title),
                description: asString(template.config.panelDescription, entry.description),
                buttonLabel: asString(template.config.panelButtonLabel, entry.buttonLabel),
                buttonEmoji: asString(template.config.panelButtonEmoji, entry.buttonEmoji),
                typeIds,
              }
            : entry,
        )
      : panels;
    const primary = templatePanels[0];
    patchTickets({
      ...template.config,
      departments: limitedDepartments.map((department) => department.name),
      departmentSettings: limitedDepartments,
      ticketPanels: templatePanels,
      ...(primary
        ? {
            panelTitle: primary.title,
            panelDescription: primary.description,
            panelButtonLabel: primary.buttonLabel,
            panelButtonEmoji: primary.buttonEmoji,
          }
        : {}),
    });
    setTemplateNotice(`Modelo “${template.label}” aplicado. Ajuste o que quiser e publique o painel.`);
  }

  async function publish() {
    setPubNotice(null);
    const channelRef = panels.map((entry) => entry.channelId).find(Boolean) ?? "";
    const result = await publishPanel("tickets", channelRef);
    if (result) {
      setPubNotice(result.status === "done" ? "Painel publicado no Discord." : result.status === "failed" ? result.detail ?? "O bot não conseguiu publicar o painel." : "Pedido enviado; o bot vai confirmar em instantes.");
      setPubTone(result.status === "done" ? "ok" : result.status === "failed" ? "error" : "neutral");
      if (result.status === "done") setDirty(false);
    }
  }

  return (
    <div key={gid} className="mx-auto flex max-w-7xl flex-col gap-8">
      <PageHeader
        title="Painéis de atendimento"
        description="Monte os painéis que recebem pedidos de ajuda. A fila e a conversa com os membros ficam em Atendimento; aqui você cuida das categorias, equipe, mensagens e regras."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/app/config"><Button size="sm" variant="ghost">Configurações</Button></Link>
            <Link to="/app/tickets"><Button size="sm" variant="outline">Abrir fila</Button></Link>
          </div>
        }
      />

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
            {!canUseDepartments ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="m-0 text-xs text-muted-foreground">Seu plano permite um tipo de atendimento. Os modelos serão aplicados com uma categoria; departamentos extras são exclusivos dos planos Pro e Vitalício.</p><ExclusiveButton /></div> : null}
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-labelledby="ticket-panels-heading">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 id="ticket-panels-heading" className="m-0 text-base font-semibold">Painéis publicados</h3>
                <p className="m-0 mt-1 text-sm text-muted-foreground">Cada painel tem seu canal, sua mensagem e a seleção de tipos. Ao publicar, o bot atualiza todos de uma vez.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={panels.length >= maxPanels ? "warn" : "default"}>{panels.length}/{maxPanels}</Badge>
                <Button type="button" size="sm" variant="outline" onClick={addPanel} disabled={panels.length >= maxPanels}>
                  <Plus aria-hidden="true" className="size-4" />
                  Novo painel
                </Button>
              </div>
            </header>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Painéis de atendimento">
              {panels.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={panel?.id === entry.id}
                  onClick={() => setSelectedPanelId(entry.id)}
                  className={cn(
                    "min-w-40 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    panel?.id === entry.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                  )}
                >
                  <span className="block truncate text-sm font-medium">{entry.name}</span>
                  <span className="block text-xs text-muted-foreground">{entry.channelId ? "Canal definido" : "Sem canal"}</span>
                </button>
              ))}
            </div>
            {!canUseDepartments ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="m-0 text-xs text-muted-foreground">O plano Gratuito publica um painel. Vários painéis (5 no Pro, ilimitados no Vitalício) fazem parte dos planos pagos.</p>
                <ExclusiveButton />
              </div>
            ) : null}
            {panel ? (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <Field label="Nome interno do painel">
                  <Input maxLength={60} value={panel.name} onChange={(event) => patchPanel({ name: event.target.value })} />
                </Field>
                <Field label="Canal onde este painel é publicado">
                  <DiscordSelect kind="text" value={panel.channelId} onChange={(channelId) => patchPanel({ channelId })} placeholder="Selecione um canal" />
                </Field>
                <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={panels.length <= 1} onClick={() => removePanel(panel.id)}>
                  <Trash2 aria-hidden="true" className="size-4" />
                  Excluir
                </Button>
              </div>
            ) : null}
          </section>

          <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
            <div className="min-w-0 space-y-8">
              <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-labelledby="ticket-location-heading">
                <header>
                  <h3 id="ticket-location-heading" className="m-0 text-base font-semibold">Onde os tickets são criados?</h3>
                  <p className="m-0 mt-1 text-sm text-muted-foreground">O canal de cada painel fica na seção acima. Aqui você define a categoria dos canais privados.</p>
                </header>
                <Field label="Categoria onde os canais privados serão criados">
                  <DiscordSelect kind="category" value={asString(tcfg.config.categoryId)} onChange={(categoryId) => patchTickets({ categoryId })} placeholder="Selecione uma categoria" />
                </Field>
                <ToggleRow label="Atendimento ligado" description="Desligue para pausar a abertura de novos tickets." checked={tcfg.enabled} onChange={(value) => setEnabled("tickets", value)} />
              </section>

              <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-labelledby="ticket-context-heading">
                <header>
                  <h3 id="ticket-context-heading" className="m-0 text-base font-semibold">Dê contexto ao painel{panel ? ` “${panel.name}”` : ""}</h3>
                  <p className="m-0 mt-1 text-sm text-muted-foreground">A pessoa verá esta mensagem antes de escolher o tipo de atendimento.</p>
                </header>
                <Field label="Título do painel">
                  <Input maxLength={100} value={panel?.title ?? ""} onChange={(e) => patchPanel({ title: e.target.value })} />
                  <CharCounter current={(panel?.title ?? "").length} max={100} />
                </Field>
                <Field label="Descrição do painel">
                  <Textarea maxLength={4000} value={panel?.description ?? ""} onChange={(e) => patchPanel({ description: e.target.value })} />
                  <CharCounter current={(panel?.description ?? "").length} max={4000} />
                </Field>
                <Field label="Cor de destaque">
                  <div className="flex gap-2">
                    <input type="color" value={panel?.accentColor ?? "#28655b"} onChange={(e) => patchPanel({ accentColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded border border-border bg-background" />
                    <Input value={panel?.accentColor ?? "#28655b"} onChange={(e) => patchPanel({ accentColor: e.target.value })} placeholder="#28655b" />
                  </div>
                </Field>
                <Field label="Como mostrar as opções de atendimento?">
                  <div className="grid gap-2 sm:grid-cols-1 md:grid-cols-2" role="group" aria-label="Formato das opções de atendimento">
                    <button type="button" aria-pressed={departmentDisplayMode === "select"} onClick={() => patchPanel({ displayMode: "select" })} className={cn("min-h-16 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", departmentDisplayMode === "select" ? "border-primary bg-primary/5 text-foreground" : "border-border hover:bg-muted/50")}>
                      <span className="block text-sm font-semibold">Menu suspenso</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Uma lista compacta que aceita até 25 opções.</span>
                    </button>
                    <button type="button" aria-pressed={departmentDisplayMode === "buttons"} disabled={panelTypes.length > 5} onClick={() => patchPanel({ displayMode: "buttons" })} className={cn("min-h-16 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", departmentDisplayMode === "buttons" ? "border-primary bg-primary/5 text-foreground" : "border-border hover:bg-muted/50")}>
                      <span className="block text-sm font-semibold">Botões no painel</span>
                      <span className="mt-1 block text-xs text-muted-foreground">Cada tipo aparece direto na publicação, até 5.</span>
                    </button>
                  </div>
                  {panelTypes.length > 5 ? <p className="m-0 text-xs text-muted-foreground">Para usar botões, deixe no máximo 5 tipos marcados neste painel.</p> : null}
                </Field>
                {departmentDisplayMode === "select" ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                      <Field label="Texto do botão de abertura"><Input maxLength={80} value={panel?.buttonLabel ?? ""} onChange={(e) => patchPanel({ buttonLabel: e.target.value })} placeholder="Abrir atendimento" /></Field>
                      <Field label="Emoji"><Input maxLength={32} value={panel?.buttonEmoji ?? ""} onChange={(e) => patchPanel({ buttonEmoji: e.target.value })} placeholder="🎫" /></Field>
                    </div>
                    <Field label="Mensagem ao escolher um tipo">
                      <Textarea rows={2} maxLength={2000} value={panel?.menuPrompt ?? ""} onChange={(event) => patchPanel({ menuPrompt: event.target.value })} />
                    </Field>
                    <Field label="Texto dentro do menu">
                      <Input maxLength={150} value={panel?.menuPlaceholder ?? ""} onChange={(event) => patchPanel({ menuPlaceholder: event.target.value })} />
                    </Field>
                    <Field label="Cor do botão de abertura">
                      <NativeSelect value={String(panelButtonStyle.value)} onChange={(event) => patchPanel({ buttonStyle: Number(event.target.value) as 1 | 2 | 3 | 4 })}>
                        {discordButtonStyles.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}
                      </NativeSelect>
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Cor dos botões de opção">
                      <NativeSelect value={String(departmentButtonStyle.value)} onChange={(event) => patchPanel({ buttonDisplayStyle: Number(event.target.value) as 1 | 2 | 3 | 4 })}>
                        {discordButtonStyles.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}
                      </NativeSelect>
                    </Field>
                    <p className="m-0 text-xs text-muted-foreground">O Discord não exibe as descrições no formato de botões; elas aparecem no menu suspenso.</p>
                  </>
                )}
                <Field label="Texto complementar no rodapé (opcional)">
                  <Textarea rows={2} maxLength={300} value={panel?.footer ?? ""} onChange={(event) => patchPanel({ footer: event.target.value })} placeholder="Ex.: Horário de atendimento: 9h às 18h" />
                  <CharCounter current={(panel?.footer ?? "").length} max={300} />
                  <p className="m-0 text-xs text-muted-foreground">Aparece em texto discreto abaixo do painel.</p>
                </Field>
              </section>

              <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-labelledby="ticket-staff-heading">
                <header>
                  <h3 id="ticket-staff-heading" className="m-0 text-base font-semibold">Escolha quem responde</h3>
                  <p className="m-0 mt-1 text-sm text-muted-foreground">Cargos selecionados poderão acessar os canais privados.</p>
                </header>
                <Field label="Cargos da equipe"><DiscordMultiSelect value={asList(tcfg.config.staffRoleIds)} onChange={(staffRoleIds) => { patchTickets({ staffRoleIds }); setDirty(true); }} /></Field>
              </section>

              <details className="motion-disclosure rounded-2xl border border-border bg-card p-3.5">
                <summary className="cursor-pointer font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Mais configurações de atendimento</summary>
                <p className="mb-4 mt-2 text-sm text-muted-foreground">Prazos, automações, registros e aparência. Você pode voltar a elas quando quiser.</p>
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                    <NumberField id="ticket-max-open" label="Máximo de tickets abertos por pessoa" min={1} max={25} value={Number(tcfg.config.maxOpenPerUser ?? 1)} onChange={(maxOpenPerUser) => patchTickets({ maxOpenPerUser })} />
                    <Field label="Nome do canal · use {user}, {department} e {number}">
                      <Input key={asString(tcfg.config.namingPattern, "atendimento-{user}")} defaultValue={asString(tcfg.config.namingPattern, "atendimento-{user}")} onBlur={(e) => patchTickets({ namingPattern: e.target.value.trim() || "atendimento-{user}" })} />
                    </Field>
                  </div>
                  <NumberField id="ticket-sla-warning" label="Avisar a equipe depois de (minutos; 0 desliga)" min={0} max={10080} value={Number(tcfg.config.slaWarningMinutes ?? 60)} onChange={(slaWarningMinutes) => patchTickets({ slaWarningMinutes })} />
                  <ToggleRow label="Pedir avaliação ao encerrar" description="Receba uma nota e um comentário do cliente." checked={Boolean(tcfg.config.feedbackEnabled)} onChange={(value) => patchTickets({ feedbackEnabled: value })} />
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
                    <div className="rounded-xl border border-border p-3">
                      <p className="m-0 text-xs font-medium">Tipos que aparecem neste painel</p>
                      <p className="m-0 mt-1 text-xs text-muted-foreground">Marque o que a pessoa vê em “{panel?.name ?? "painel"}”. Os tipos continuam compartilhados entre os painéis.</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {departmentSettings.map((type) => {
                          const active = panel?.typeIds.includes(type.id) ?? false;
                          return (
                            <button
                              key={type.id}
                              type="button"
                              aria-pressed={active}
                              onClick={() => {
                                if (!panel) return;
                                const typeIds = active
                                  ? panel.typeIds.filter((id) => id !== type.id)
                                  : [...panel.typeIds, type.id];
                                patchPanel({ typeIds });
                              }}
                              className={cn(
                                "rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted/50",
                              )}
                            >
                              {type.emoji || "🎫"} {type.name || "Sem nome"}
                            </button>
                          );
                        })}
                        {!departmentSettings.length ? <p className="m-0 text-xs text-muted-foreground">Crie um tipo para poder marcá-lo aqui.</p> : null}
                      </div>
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
                        <DiscordSelect kind="text" value={asString(tcfg.config.transcriptChannelId)} onChange={(transcriptChannelId) => patchTickets({ transcriptChannelId })} placeholder="Selecione um canal" />
                      </Field>
                      <Field label="Canal de auditoria">
                        <DiscordSelect kind="text" value={asString(tcfg.config.logChannelId)} onChange={(logChannelId) => patchTickets({ logChannelId })} placeholder="Selecione um canal" />
                      </Field>
                    </div>
                    <div>
                      <NumberField id="ticket-message-retention" label="Apagar mensagens após (dias; 0 mantém sem prazo)" min={0} max={3650} value={Number(tcfg.config.ticketMessageRetentionDays ?? 0)} onChange={(ticketMessageRetentionDays) => patchTickets({ ticketMessageRetentionDays })} />
                      <p className="m-0 text-xs text-muted-foreground">Remove mensagens e anexos locais após o prazo. Tickets novos com retenção configurada usam apenas a exportação local; transcripts externos já gerados não podem ser apagados pelo bot. O resumo permanece para estatísticas.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="divide-y divide-border">
                        <ToggleRow label="Notificar a equipe" description="Menciona os cargos ao abrir." checked={Boolean(tcfg.config.pingStaffOnOpen)} onChange={(value) => patchTickets({ pingStaffOnOpen: value })} />
                        <ToggleRow label="Permitir reabertura" description="A pessoa pode voltar ao canal." checked={Boolean(tcfg.config.reopenEnabled)} onChange={(value) => patchTickets({ reopenEnabled: value })} />
                        <ToggleRow label="Prioridade" description="A equipe classifica urgência." checked={Boolean(tcfg.config.priorityEnabled)} onChange={(value) => patchTickets({ priorityEnabled: value })} />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <NumberField id="ticket-close-after" label="Prazo para fechar automaticamente (horas; 0 desliga)" min={0} max={8760} value={Number(tcfg.config.closeAfterHours ?? 48)} onChange={(closeAfterHours) => patchTickets({ closeAfterHours })} />
                        <NumberField id="ticket-inactive-close" label="Prazo de inatividade (horas; 0 desliga)" min={0} max={8760} value={Number(tcfg.config.autoCloseInactiveHours ?? 24)} onChange={(autoCloseInactiveHours) => patchTickets({ autoCloseInactiveHours })} />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                      <NumberField id="staff-response-goal" label="Meta para primeira resposta (minutos)" min={5} max={10080} value={Number(staffConfig.config.responseTimeGoalMinutes ?? 30)} onChange={(responseTimeGoalMinutes) => updateConfig("staff", { responseTimeGoalMinutes })} />
                      <NumberField id="staff-max-concurrent" label="Tickets simultâneos por atendente" min={1} max={100} value={Number(staffConfig.config.maxConcurrentTickets ?? 5)} onChange={(maxConcurrentTickets) => updateConfig("staff", { maxConcurrentTickets })} />
                    </div>
                    <Field label="Mensagem de boas-vindas no canal privado">
                      <Textarea key={asString(tcfg.config.welcomeMessage)} rows={3} defaultValue={asString(tcfg.config.welcomeMessage)} onBlur={(e) => patchTickets({ welcomeMessage: e.target.value })} />
                      <p className="m-0 text-xs text-muted-foreground">Enviada automaticamente quando o atendimento é aberto.</p>
                    </Field>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <Label>Respostas prontas</Label>
                          <p className="m-0 mt-0.5 text-xs text-muted-foreground">Atalhos que a equipe insere na conversa com um clique.</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={savedReplies.length >= 25}
                          onClick={() => patchTickets({ savedReplies: [...savedReplies, { title: `Resposta ${savedReplies.length + 1}`, body: "" }] })}
                        >
                          <Plus aria-hidden="true" className="size-4" />
                          Adicionar resposta
                        </Button>
                      </div>
                      {savedReplies.map((macro, index) => (
                        <div key={`macro-${index}`} className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-start">
                          <Input
                            aria-label={`Atalho da resposta ${index + 1}`}
                            maxLength={40}
                            value={macro.title}
                            placeholder="Atalho"
                            onChange={(event) => {
                              const next = [...savedReplies];
                              next[index] = { ...macro, title: event.target.value };
                              patchTickets({ savedReplies: next });
                            }}
                          />
                          <Textarea
                            aria-label={`Texto da resposta ${index + 1}`}
                            rows={2}
                            maxLength={1500}
                            value={macro.body}
                            placeholder="Texto enviado ao solicitante"
                            onChange={(event) => {
                              const next = [...savedReplies];
                              next[index] = { ...macro, body: event.target.value };
                              patchTickets({ savedReplies: next });
                            }}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Remover resposta ${index + 1}`}
                            onClick={() => patchTickets({ savedReplies: savedReplies.filter((_, itemIndex) => itemIndex !== index) })}
                          >
                            <Trash2 aria-hidden="true" className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-4 divide-y divide-border">
                      <ToggleRow label="IA de apoio à equipe" description="Sugestões privadas aparecem no canal para os atendentes." checked={Boolean(tcfg.config.aiSupportEnabled)} onChange={(value) => patchTickets({ aiSupportEnabled: value })} />
                      <ToggleRow label="Incluir conversa nas análises por IA" description="Quando desligado, o conteúdo das mensagens não é enviado à IA." checked={Boolean(tcfg.config.aiIncludeConversation)} onChange={(value) => patchTickets({ aiIncludeConversation: value })} />
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
                <DiscordModalPreview title={panelTypes[0]?.name || "Abrir atendimento"} questions={panelTypes[0]?.intakeQuestions.length ? panelTypes[0].intakeQuestions : ["Como podemos ajudar?"]} />
              ) : (
                <DiscordPanel
                  channel={(panel?.channelId || "abrir-ticket").replace(/^#/, "") || "abrir-ticket"}
                  title={panel?.title || "Precisa de ajuda?"}
                  description={panel?.description || "Escolha uma opção para falar com nossa equipe."}
                  accent={panel?.accentColor || "#28655b"}
                  buttons={[`${panel?.buttonEmoji || "🎫"} ${panel?.buttonLabel || "Abrir atendimento"}`]}
                  choiceOptions={panelTypes}
                  choiceDisplayMode={departmentDisplayMode}
                  choiceButtonStyle={departmentDisplayMode === "buttons" ? departmentButtonStyle.preview : panelButtonStyle.preview}
                  menuPrompt={panel?.menuPrompt || "Escolha o tipo para abrir o atendimento:"}
                  menuPlaceholder={panel?.menuPlaceholder || "Escolha o tipo"}
                  footer={panel?.footer ?? ""}
                />
              )}
              <div className="space-y-2 rounded-2xl border border-border p-4">
                <h3 className="m-0 text-base font-semibold">Publicar no Discord</h3>
                <p className="m-0 text-sm text-muted-foreground">O bot publica ou atualiza os {panels.length} painel(is) configurado(s) e só confirma quando o Discord responder.</p>
                <ul className="m-0 space-y-1 pl-0 text-sm" aria-live="polite">
                  {blockingIssues.map((issue) => (
                    <li key={issue.message} className="flex gap-2 text-destructive"><span aria-hidden="true">•</span><span>{issue.message}</span></li>
                  ))}
                  {warnings.map((issue) => (
                    <li key={issue.message} className="flex gap-2 text-warn"><span aria-hidden="true">•</span><span>{issue.message}</span></li>
                  ))}
                  {!blockingIssues.length && !warnings.length ? <li className="text-ok">Tudo pronto para publicar.</li> : null}
                </ul>
                {pubNotice ? <p role="status" className={cn("m-0 rounded-lg px-3 py-2 text-sm", pubTone === "ok" && "bg-ok/10 text-ok", pubTone === "error" && "bg-warn/15 text-warn", pubTone === "neutral" && "bg-muted text-foreground")}>{pubNotice}</p> : null}
                <Button
                  className="w-full"
                  disabled={pubBusy || blockingIssues.length > 0}
                  onClick={() => void publish()}
                >
                  {pubBusy ? "Aguardando confirmação do bot…" : dirty ? "Publicar alterações" : "Publicar painel no Discord"}
                </Button>
              </div>
            </aside>
          </div>
        </div>
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
