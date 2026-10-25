import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { DiscordMultiSelect, DiscordSelect } from "@/components/discord-select";
import { DiscordPanel, DiscordModalPreview } from "@/components/discord-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ExclusiveButton } from "@/components/exclusive-button";
import { asList, asString, planAllows } from "@/lib/wumpus/engine";
import { useActiveGuild, useModule, useWumpus } from "@/lib/wumpus/store";
import { usePublishPanel } from "@/lib/wumpus/use-publish-panel";
import type { TicketDepartmentConfig } from "@/lib/wumpus/types";
import { cn } from "@/lib/utils";
import {
  discordButtonStyles,
  readSavedReplies,
  ticketTemplates,
  type SavedReply,
} from "@/components/tickets/ticket-panel-data";

export type TicketPanelNoticeTone = "neutral" | "success" | "error";

export function TicketPanelEditor({
  guildId,
  onNotice,
}: {
  guildId: string;
  onNotice?: (message: string, tone?: TicketPanelNoticeTone) => void;
}) {
  const guild = useActiveGuild();
  const tcfg = useModule("tickets");
  const staffConfig = useModule("staff");
  const updateConfig = useWumpus((s) => s.updateConfig);
  const setEnabled = useWumpus((s) => s.setModuleEnabled);
  const canUseDepartments = planAllows(guild.plan, "multiDepartment");
  const { busy: pubBusy, publish: publishPanel } = usePublishPanel(guildId);
  const configuredSavedReplies = readSavedReplies(tcfg.config.savedReplies);
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
  const departmentDisplayMode = asString(tcfg.config.departmentDisplayMode, "select") === "buttons" ? "buttons" : "select";
  const panelButtonStyle = discordButtonStyles.find((style) => style.value === Number(tcfg.config.panelButtonStyle)) ?? discordButtonStyles[0]!;
  const departmentButtonStyle = discordButtonStyles.find((style) => style.value === Number(tcfg.config.departmentButtonStyle)) ?? discordButtonStyles[1]!;
  const departmentNames = departmentSettings.map((department) => department.name.trim().toLocaleLowerCase("pt-BR"));
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

  function saveDepartments(next: TicketDepartmentConfig[]) {
    const limited = canUseDepartments ? next.slice(0, 25) : next.slice(0, 1);
    updateConfig("tickets", {
      departments: limited.map((department) => department.name.trim()).filter(Boolean),
      departmentSettings: limited,
    });
    setDirty(true);
  }

  function saveSavedReplies(next: SavedReply[]) {
    updateConfig("tickets", { savedReplies: next.slice(0, 20) });
    setDirty(true);
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
    setDirty(true);
  }

  async function handlePublish() {
    const result = await publishPanel("tickets", asString(tcfg.config.panelChannelId));
    if (result) {
      onNotice?.(result.status === "done" ? "Publicado." : "Pedido enviado.", result.status === "done" ? "success" : "neutral");
      setDirty(false);
    }
  }

  return (
    <div className="mt-4 min-w-0 space-y-5 pb-20 sm:pb-0">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="m-0 text-xl font-semibold tracking-tight">Monte seu sistema de tickets</h2><p className="m-0 mt-1 max-w-2xl text-sm text-muted-foreground">Comece com um modelo e personalize categorias, equipe, canais e regras. As alterações só chegam ao Discord quando você publica o painel.</p></div>{dirty ? <Badge tone="warn">Alterações não publicadas</Badge> : null}</div>
        <section className="space-y-3" aria-labelledby="ticket-template-heading">
          <div>
            <h3 id="ticket-template-heading" className="m-0 text-sm font-semibold">Comece com um modelo</h3>
            <p className="m-0 mt-1 text-xs text-muted-foreground">Clique para aplicar um pacote pronto. Você pode ajustar depois.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-1 md:grid-cols-3">
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
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,.82fr)]">
        <div className="min-w-0 space-y-4">
        <div className="space-y-3 rounded-2xl border border-border bg-card p-3.5">
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
        <div className="space-y-3 rounded-2xl border border-border bg-card p-3.5">
          <div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">2</span><div><h3 className="m-0 text-base font-semibold">Dê contexto ao painel</h3><p className="m-0 mt-1 text-sm text-muted-foreground">A pessoa verá esta mensagem antes de escolher o tipo de atendimento.</p></div></div>
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
              <button type="button" aria-pressed={departmentDisplayMode === "select"} onClick={() => updateConfig("tickets", { departmentDisplayMode: "select" })} className={cn("min-h-16 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", departmentDisplayMode === "select" ? "border-primary bg-primary/5 text-foreground" : "border-border hover:bg-muted/50")}>
                <span className="block text-sm font-semibold">Menu suspenso</span>
                <span className="mt-1 block text-xs text-muted-foreground">Uma lista compacta que aceita até 25 opções.</span>
              </button>
              <button type="button" aria-pressed={departmentDisplayMode === "buttons"} disabled={departmentSettings.length > 5} onClick={() => updateConfig("tickets", { departmentDisplayMode: "buttons" })} className={cn("min-h-16 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", departmentDisplayMode === "buttons" ? "border-primary bg-primary/5 text-foreground" : "border-border hover:bg-muted/50")}>
                <span className="block text-sm font-semibold">Botões no painel</span>
                <span className="mt-1 block text-xs text-muted-foreground">Cada tipo aparece direto na publicação, até 5.</span>
              </button>
            </div>
            {departmentSettings.length > 5 ? <p className="m-0 text-xs text-muted-foreground">Para usar botões, reduza os tipos de atendimento para no máximo 5.</p> : null}
          </Field>
          {departmentDisplayMode === "select" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <Field label="Texto do botão de abertura"><Input maxLength={80} value={asString(tcfg.config.panelButtonLabel, "Abrir atendimento")} onChange={(e) => updateConfig("tickets", { panelButtonLabel: e.target.value })} placeholder="Abrir atendimento" /></Field>
                <Field label="Emoji"><Input maxLength={32} value={asString(tcfg.config.panelButtonEmoji, "🎫")} onChange={(e) => updateConfig("tickets", { panelButtonEmoji: e.target.value })} placeholder="🎫" /></Field>
              </div>
              <Field label="Mensagem ao escolher um tipo">
                <Textarea rows={2} maxLength={2000} value={asString(tcfg.config.departmentMenuPrompt, "Escolha o departamento para abrir o atendimento:")} onChange={(event) => updateConfig("tickets", { departmentMenuPrompt: event.target.value })} />
              </Field>
              <Field label="Texto dentro do menu">
                <Input maxLength={150} value={asString(tcfg.config.departmentMenuPlaceholder, "Escolha o departamento")} onChange={(event) => updateConfig("tickets", { departmentMenuPlaceholder: event.target.value })} />
              </Field>
              <Field label="Cor do botão de abertura">
                <NativeSelect value={String(panelButtonStyle.value)} onChange={(event) => updateConfig("tickets", { panelButtonStyle: Number(event.target.value) })}>
                  {discordButtonStyles.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}
                </NativeSelect>
              </Field>
            </>
          ) : (
            <>
              <Field label="Cor dos botões de opção">
                <NativeSelect value={String(departmentButtonStyle.value)} onChange={(event) => updateConfig("tickets", { departmentButtonStyle: Number(event.target.value) })}>
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
        </div>
        <div className="space-y-3 rounded-2xl border border-border bg-card p-3.5">
          <div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">3</span><div><h3 className="m-0 text-base font-semibold">Escolha quem responde</h3><p className="m-0 mt-1 text-sm text-muted-foreground">Cargos selecionados poderão acessar os canais privados.</p></div></div>
          <Field label="Cargos da equipe"><DiscordMultiSelect value={asList(tcfg.config.staffRoleIds)} onChange={(staffRoleIds) => updateConfig("tickets", { staffRoleIds })} /></Field>
        </div>
        <details className="rounded-2xl border border-border bg-card p-3.5">
          <summary className="cursor-pointer font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Mais configurações de atendimento</summary>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">Prazos, automações, registros e aparência. Você pode voltar a elas quando quiser.</p>
          <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
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
              <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
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
              <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><Label>Notificar a equipe</Label><p className="m-0 text-xs text-muted-foreground">Menciona os cargos ao abrir.</p></div><Switch checked={Boolean(tcfg.config.pingStaffOnOpen)} onCheckedChange={(value) => updateConfig("tickets", { pingStaffOnOpen: value })} /></div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><Label>Permitir reabertura</Label><p className="m-0 text-xs text-muted-foreground">A pessoa pode voltar ao canal.</p></div><Switch checked={Boolean(tcfg.config.reopenEnabled)} onCheckedChange={(value) => updateConfig("tickets", { reopenEnabled: value })} /></div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><Label>Prioridade</Label><p className="m-0 text-xs text-muted-foreground">A equipe classifica urgência.</p></div><Switch checked={Boolean(tcfg.config.priorityEnabled)} onCheckedChange={(value) => updateConfig("tickets", { priorityEnabled: value })} /></div>
                <Field label="Prazo para fechar automaticamente (horas; 0 desliga)"><Input key={String(tcfg.config.closeAfterHours ?? 48)} type="number" min={0} max={8760} defaultValue={Number(tcfg.config.closeAfterHours ?? 48)} onBlur={(e) => updateConfig("tickets", { closeAfterHours: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                <Field label="Prazo de inatividade (horas; 0 desliga)"><Input key={String(tcfg.config.autoCloseInactiveHours ?? 24)} type="number" min={0} max={8760} defaultValue={Number(tcfg.config.autoCloseInactiveHours ?? 24)} onBlur={(e) => updateConfig("tickets", { autoCloseInactiveHours: Math.max(0, Number(e.target.value) || 0) })} /></Field>
              </div>
              <p className="m-0 text-xs text-muted-foreground">Metas de equipe são usadas pelo bot em alertas de sobrecarga e no comando /stats.</p>
              <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
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
          <div className="space-y-2 rounded-2xl border border-border p-3">
          <h3 className="m-0 text-base font-semibold">Publicar no Discord</h3>
          <p className="m-0 text-sm text-muted-foreground">A publicação só aparece como concluída depois que o bot confirmar no Discord.</p>
          {!asString(tcfg.config.panelChannelId).trim() ? <p className="m-0 text-sm text-warn">Escolha o canal do painel acima para continuar.</p> : null}
          {!validDepartmentSettings ? <p role="alert" className="m-0 text-sm text-destructive">Revise os tipos: os nomes devem ser únicos, e cada pergunta precisa ter até 45 caracteres (máximo de 5 por tipo).</p> : null}
              <Button
                disabled={pubBusy || !asString(tcfg.config.panelChannelId).trim() || !validDepartmentSettings}
                onClick={() => void handlePublish()}
              >
                {pubBusy ? "Aguardando confirmação do bot…" : "Publicar painel no Discord"}
              </Button>
        </div>
        </div>
        <aside className="min-w-0 space-y-2 xl:sticky xl:top-24 xl:self-start">
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
        </aside>
        </div>
        
          <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 p-3 backdrop-blur sm:hidden">
            <Button className="w-full" disabled={pubBusy || !validDepartmentSettings} onClick={() => void handlePublish()}>
              {pubBusy ? "Publicando…" : dirty ? "Publicar alterações" : "Publicar painel"}
            </Button>
          </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
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
