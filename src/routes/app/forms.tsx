import { PageHeader } from "@/components/page-header";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
import { EmptyState } from "@/components/empty-state";
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Eye,
  FilePlus2,
  Inbox,
  LoaderCircle,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { DiscordFormPreview } from "@/components/discord-panel";
import { DiscordMultiSelect, DiscordSelect } from "@/components/discord-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownContent } from "@/components/markdown-content";
import { analyzeWithGrok } from "@/lib/wumpus/analyze";
import { asString, planAllows } from "@/lib/wumpus/engine";
import { formatRelative, uid } from "@/lib/utils";
import { useActiveGuild, useGuildMembers, useModule, useWumpus, type FormFieldConfig } from "@/lib/wumpus/store";
import type { FormSubmission } from "@/lib/wumpus/types";
import { getFormReviewStatus, getGuildFormSubmissions, requestFormReview } from "@/lib/wumpus/runtime-store";
import { publishPanelAndWait, publishResultMessage } from "@/lib/wumpus/publish-panel";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import { ExclusiveButton } from "@/components/exclusive-button";

export const Route = createFileRoute("/app/forms")({ component: FormsPage });

type SubmissionFilter = "pending" | "all" | "approved" | "rejected";

const STATUS: Record<FormSubmission["status"], { label: string; tone: "warn" | "ok" | "danger" }> = {
  pending: { label: "Aguardando", tone: "warn" },
  approved: { label: "Aprovado", tone: "ok" },
  rejected: { label: "Recusado", tone: "danger" },
};

const templates: Array<{
  id: string;
  title: string;
  description: string;
  name: string;
  fields: Array<{ label: string; type: FormFieldConfig["type"]; options?: string[]; placeholder: string }>;
}> = [
  {
    id: "support",
    title: "Pedido de suporte",
    description: "Conte o que aconteceu para a equipe direcionar sua solicitação.",
    name: "Atendimento",
    fields: [
      { label: "Qual é o assunto?", type: "select", options: ["Dúvida", "Problema", "Sugestão"], placeholder: "Escolha uma opção" },
      { label: "Qual é o assunto em uma frase?", type: "short", placeholder: "Ex.: não consigo acessar minha conta" },
      { label: "Conte o que aconteceu", type: "paragraph", placeholder: "Inclua o que você já tentou e qualquer detalhe útil" },
    ],
  },
  {
    id: "team",
    title: "Inscrição para a equipe",
    description: "Conheça a pessoa e a área em que ela gostaria de ajudar.",
    name: "Inscrição para a equipe",
    fields: [
      { label: "Como devemos chamar você?", type: "short", placeholder: "Seu nome ou apelido" },
      { label: "Em qual área quer ajudar?", type: "select", options: ["Moderação", "Suporte", "Eventos"], placeholder: "Escolha uma área" },
      { label: "Por que quer participar?", type: "paragraph", placeholder: "Conte o que motiva você" },
    ],
  },
  {
    id: "report",
    title: "Denúncia",
    description: "Reúna as informações necessárias para a equipe analisar o relato.",
    name: "Denúncia",
    fields: [
      { label: "O que você quer denunciar?", type: "select", options: ["Spam", "Assédio", "Golpe", "Outro"], placeholder: "Escolha uma categoria" },
      { label: "Quem está envolvido?", type: "short", placeholder: "Nome de usuário ou link do perfil" },
      { label: "Descreva o que aconteceu", type: "paragraph", placeholder: "Inclua datas, contexto e provas disponíveis" },
    ],
  },
];

function labelForStatus(status: FormSubmission["status"]) {
  return STATUS[status]?.label ?? status;
}

function makeFields(template: (typeof templates)[number]): FormFieldConfig[] {
  return template.fields.map((field) => ({
    id: uid("field"),
    label: field.label,
    type: field.type,
    required: true,
    options: field.options ?? [],
    maxLength: field.type === "short" ? 100 : 1000,
    minLength: 0,
    placeholder: field.placeholder,
  }));
}

function FormsPage() {
  const gid = useWumpus((state) => state.activeGuildId);
  const questionsMap = useWumpus((state) => state.formQuestions);
  const legacyQuestions = questionsMap[gid] ?? [];
  const members = useGuildMembers();
  const user = useWumpus((state) => state.sessionUser);
  const channels = useWumpus((state) => state.channels[state.activeGuildId] ?? []);
  const guild = useActiveGuild();
  const fcfg = useModule("forms");
  const updateConfig = useWumpus((state) => state.updateConfig);
  const setEnabled = useWumpus((state) => state.setModuleEnabled);
  const setFieldsInStore = useWumpus((state) => state.setFormFields);
  const formsAllowed = planAllows(guild.plan, "forms");
  const aiAllowed = planAllows(guild.plan, "ai") && Boolean(fcfg.config.useAiPreReview);

  const savedFields = Array.isArray(fcfg.config.fields) ? fcfg.config.fields as FormFieldConfig[] : [];
  const fields: FormFieldConfig[] = savedFields.length
    ? savedFields
    : legacyQuestions.map((question) => ({
        id: question.id,
        label: question.label,
        type: "paragraph",
        required: question.required,
        options: [],
        maxLength: 1000,
        minLength: 0,
        placeholder: "",
      }));

  const [tab, setTab] = useState("inbox");
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<SubmissionFilter>("pending");
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotes, setAiNotes] = useState<Record<string, string>>({});
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishNotice, setPublishNotice] = useState<string | null>(null);
  const [builderNotice, setBuilderNotice] = useState<string | null>(null);

  async function refreshSubmissions(showLoading = false) {
    const token = getStoredSessionToken();
    if (!token || !gid) {
      setSubmissions([]);
      setLoadError("Entre com Discord para receber as respostas deste servidor.");
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      const rows = await getGuildFormSubmissions({ data: { token, guildId: gid } });
      setSubmissions(rows as FormSubmission[]);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível carregar as respostas do bot.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const token = getStoredSessionToken();
      if (!token || !gid) {
        if (active) { setSubmissions([]); setLoadError("Entre com Discord para receber as respostas deste servidor."); setLoading(false); }
        return;
      }
      try {
        const rows = await getGuildFormSubmissions({ data: { token, guildId: gid } });
        if (active) { setSubmissions(rows as FormSubmission[]); setLoadError(null); setLoading(false); }
      } catch (error) {
        if (active) { setLoadError(error instanceof Error ? error.message : "Não foi possível carregar as respostas do bot."); setLoading(false); }
      }
    };
    setLoading(true);
    setSubmissions([]);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [gid]);

  const visibleSubmissions = useMemo(() => submissions
    .filter((submission) => filter === "all" || submission.status === filter)
    .filter((submission) => {
      const name = members.find((member) => member.id === submission.userId)?.displayName ?? submission.userId;
      const haystack = `${name} ${Object.entries(submission.answers).map(([question, answer]) => `${question} ${answer}`).join(" ")}`;
      return haystack.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"));
    }), [filter, members, query, submissions]);

  const selected = submissions.find((submission) => submission.id === selectedId) ?? visibleSubmissions[0] ?? null;
  const pendingCount = submissions.filter((submission) => submission.status === "pending").length;
  const textCount = fields.filter((field) => field.type !== "select").length;
  const selectCount = fields.filter((field) => field.type === "select").length;
  const canAddText = fields.length < 10 && textCount < 5;
  const canAddSelect = fields.length < 10 && selectCount < 5;

  useEffect(() => {
    if (selectedId && visibleSubmissions.some((submission) => submission.id === selectedId)) return;
    const next = visibleSubmissions[0] ?? null;
    setSelectedId(next?.id ?? null);
    setReason(next?.reason ?? "");
  }, [selectedId, submissions, visibleSubmissions]);

  const setFields = (next: FormFieldConfig[]) => {
    setBuilderNotice(null);
    setFieldsInStore(next);
  };
  const patchField = (id: string, patch: Partial<FormFieldConfig>) =>
    setFields(fields.map((field) => field.id === id ? { ...field, ...patch } : field));
  const moveField = (id: string, direction: -1 | 1) => {
    const index = fields.findIndex((field) => field.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= fields.length) return;
    const next = [...fields];
    [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
    setFields(next);
  };
  const addField = (type: FormFieldConfig["type"]) => {
    if (fields.length >= 10 || (type === "select" ? selectCount >= 5 : textCount >= 5)) {
      setBuilderNotice(type === "select" ? "O Discord permite até cinco perguntas de escolha." : "O modal do Discord permite até cinco perguntas de texto.");
      return;
    }
    setFields([...fields, {
      id: uid("field"),
      label: "Nova pergunta",
      type,
      required: true,
      options: type === "select" ? ["Opção 1", "Opção 2"] : [],
      maxLength: type === "short" ? 100 : 1000,
      minLength: 0,
      placeholder: "",
    }]);
  };
  const duplicateField = (field: FormFieldConfig) => {
    if (fields.length >= 10 || (field.type === "select" ? selectCount >= 5 : textCount >= 5)) {
      setBuilderNotice("O Discord permite até cinco perguntas de texto e cinco escolhas por formulário.");
      return;
    }
    const index = fields.findIndex((item) => item.id === field.id);
    const next = [...fields];
    next.splice(index + 1, 0, { ...field, id: uid("field"), label: `${field.label} (cópia)` });
    setFields(next);
  };
  const applyTemplate = (template: (typeof templates)[number]) => {
    setFields(makeFields(template));
    updateConfig("forms", { panelTitle: template.name, panelDescription: template.description });
  };

  async function reviewSubmission(decision: "approved" | "rejected") {
    if (!selected) return;
    if (decision === "rejected" && Boolean(fcfg.config.requireReasonOnReject) && !reason.trim()) {
      setReviewNotice("Escreva um motivo para que a pessoa entenda a decisão.");
      return;
    }
    const token = getStoredSessionToken();
    if (!token) { setReviewNotice("Entre novamente com Discord antes de revisar."); return; }
    setReviewBusy(true);
    setReviewNotice(null);
    try {
      const { jobId } = await requestFormReview({ data: {
        token,
        guildId: gid,
        formId: Number(selected.id),
        actorId: user.id,
        decision,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      } });
      for (let attempt = 0; attempt < 24; attempt++) {
        await new Promise((resolve) => window.setTimeout(resolve, 750));
        const result = await getFormReviewStatus({ data: { token, guildId: gid, jobId } });
        if (result.status === "done" || result.status === "failed") {
          setReviewNotice(result.detail ?? (result.status === "done" ? "Decisão registrada." : "O bot não conseguiu registrar a decisão."));
          if (result.status === "done") {
            await refreshSubmissions();
            setReason("");
          }
          return;
        }
      }
      setReviewNotice("O bot ainda está processando. A caixa será atualizada automaticamente.");
    } catch (error) {
      setReviewNotice(error instanceof Error ? error.message : "Não foi possível enviar a decisão ao bot.");
    } finally {
      setReviewBusy(false);
    }
  }

  async function runAiReview() {
    if (!selected) return;
    const token = getStoredSessionToken();
    if (!token) {
      setAiNotes((current) => ({ ...current, [selected.id]: "Entre novamente com Discord para usar a análise por IA." }));
      return;
    }
    setAiBusy(true);
    try {
      const body = Object.entries(selected.answers).map(([question, answer]) => `${question}: ${answer}`).join("\n");
      const result = await analyzeWithGrok({ data: { token, guildId: gid, kind: "form", title: asString(fcfg.config.panelTitle, "Formulário"), body } });
      setAiNotes((current) => ({ ...current, [selected.id]: result.ok ? result.text : result.error }));
    } catch (error) {
      setAiNotes((current) => ({ ...current, [selected.id]: error instanceof Error ? error.message : "A análise não ficou disponível." }));
    } finally {
      setAiBusy(false);
    }
  }

  async function publishFormPanel() {
    const channelRef = asString(fcfg.config.panelChannelId).trim();
    if (!channelRef) { setPublishNotice("Escolha o canal onde o painel deve aparecer."); return; }
    setPublishBusy(true);
    setPublishNotice(null);
    try {
      const result = await publishPanelAndWait({ guildId: gid, target: "forms", channelRef });
      setPublishNotice(publishResultMessage(result));
    } catch (error) {
      setPublishNotice(error instanceof Error ? error.message : "Não foi possível pedir a publicação ao bot.");
    } finally {
      setPublishBusy(false);
    }
  }

  return (
    <div key={gid} className="mx-auto flex max-w-[1440px] flex-col gap-7">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <PageHeader title="Formulários" description="Candidaturas e formulários enviados pelos membros." />
          <p className="mb-0 mt-1 text-sm text-muted-foreground">Crie perguntas claras para a comunidade e acompanhe cada resposta da equipe.</p>
        </div>
        {formsAllowed
          ? <Button onClick={() => setTab("builder")}><FilePlus2 className="size-4" /> Criar formulário</Button>
          : <ExclusiveButton />}
      </div>

      {!formsAllowed ? (
        <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <span>O plano atual não inclui formulários. Consulte as opções de assinatura para publicar neste servidor.</span>
          <ExclusiveButton />
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto gap-1 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger value="inbox" className="h-11 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            <Inbox className="mr-2 size-4" /> Respostas <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{pendingCount}</span>
          </TabsTrigger>
          <TabsTrigger value="builder" className="h-11 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            <ClipboardCheck className="mr-2 size-4" /> Criador de formulário
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-5">
          {loadError ? <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{loadError}</p> : null}
          {reviewNotice ? <p role="status" className="mb-4 rounded-lg bg-muted px-4 py-3 text-sm">{reviewNotice}</p> : null}
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
            <section className="min-w-0" aria-label="Caixa de respostas">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <NativeSelect aria-label="Filtrar respostas" value={filter} onChange={(event) => setFilter(event.target.value as SubmissionFilter)} className="h-10 w-auto min-w-40 bg-card">
                  <option value="pending">Aguardando ({pendingCount})</option>
                  <option value="all">Todas as respostas</option>
                  <option value="approved">Aprovadas</option>
                  <option value="rejected">Recusadas</option>
                </NativeSelect>
                <label className="relative min-w-40 flex-1">
                  <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar respostas" className="h-10 pl-9" aria-label="Buscar respostas" />
                </label>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {loading ? (
                  <p className="m-0 flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Carregando respostas do bot…</p>
                ) : visibleSubmissions.length ? visibleSubmissions.map((submission) => {
                  const memberName = members.find((member) => member.id === submission.userId)?.displayName ?? `Membro ${submission.userId.slice(-4)}`;
                  const status = STATUS[submission.status];
                  return (
                    <button
                      key={submission.id}
                      type="button"
                      onClick={() => { setSelectedId(submission.id); setReason(submission.reason); setReviewNotice(null); }}
                      aria-pressed={selected?.id === submission.id}
                      className={`flex min-h-[74px] w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-0 ${selected?.id === submission.id ? "bg-secondary/75" : "hover:bg-muted/60"}`}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-foreground">{memberName.slice(0, 1).toUpperCase()}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{memberName}</span>
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">{Object.values(submission.answers).find(Boolean) || "Sem resposta em texto"}</span>
                      </span>
                      <span className="shrink-0 text-right text-[11px] text-muted-foreground">{formatRelative(submission.createdAt)}</span>
                    </button>
                  );
                }) : (
                  <div className="px-5 py-10">
                    <Inbox className="mb-3 size-5 text-primary" />
                    <EmptyState
                      title={submissions.length ? "Nenhuma resposta nesta lista" : "A caixa está pronta"}
                      action={!submissions.length ? <Button size="sm">Criar primeiro formulário</Button> : undefined}
                    />
                    <p className="mb-4 mt-1 max-w-[34ch] text-sm leading-6 text-muted-foreground">
                      {submissions.length ? "Mude o filtro ou a busca para encontrar outra resposta." : "Publique seu primeiro formulário e as respostas aparecerão aqui para revisão."}
                    </p>
                    {!submissions.length ? <Button variant="outline" size="sm" onClick={() => setTab("builder")}>Configurar formulário <ChevronRight className="size-4" /></Button> : null}
                  </div>
                )}
              </div>
            </section>

            {selected ? (
              <article className="min-w-0 rounded-xl border border-border bg-card">
                <header className="flex flex-wrap items-start gap-3 border-b border-border px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="m-0 truncate text-lg font-semibold">{members.find((member) => member.id === selected.userId)?.displayName ?? `Membro ${selected.userId.slice(-4)}`}</h2>
                    <p className="mb-0 mt-1 text-xs text-muted-foreground">Enviado {formatRelative(selected.createdAt)} · resposta #{selected.id}</p>
                  </div>
                  <Badge tone={STATUS[selected.status].tone}>{labelForStatus(selected.status)}</Badge>
                </header>
                <div className="space-y-5 px-5 py-5">
                  <dl className="m-0 divide-y divide-border">
                    {Object.entries(selected.answers).map(([question, answer]) => (
                      <div key={question} className="grid gap-1 py-4 first:pt-0 sm:grid-cols-[minmax(150px,0.38fr)_minmax(0,1fr)] sm:gap-5">
                        <dt className="text-sm font-medium text-muted-foreground">{question}</dt>
                        <dd className="m-0 whitespace-pre-wrap text-sm leading-6">{answer || <span className="text-muted-foreground">Sem resposta</span>}</dd>
                      </div>
                    ))}
                  </dl>
                  {aiNotes[selected.id] ? <div className="rounded-lg bg-secondary/70 px-4 py-3 text-sm leading-6"><p className="mb-1 mt-0 font-semibold"><Sparkles className="mr-1 inline size-4" /> Nota de apoio da IA</p><MarkdownContent content={aiNotes[selected.id]} /></div> : null}
                  {selected.status === "pending" ? (
                    <div className="border-t border-border pt-5">
                      {fcfg.config.requireReasonOnReject ? (
                        <div className="mb-4 space-y-1.5">
                          <Label htmlFor="review-reason">Motivo da decisão <span className="font-normal text-muted-foreground">(exigido ao recusar)</span></Label>
                          <Textarea id="review-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Escreva uma explicação útil para a pessoa…" />
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button disabled={reviewBusy} onClick={() => void reviewSubmission("approved")}><Check className="size-4" /> Aprovar</Button>
                        <Button variant="destructive" disabled={reviewBusy || (Boolean(fcfg.config.requireReasonOnReject) && !reason.trim())} onClick={() => void reviewSubmission("rejected")}>Recusar</Button>
                        {aiAllowed ? <Button variant="outline" disabled={aiBusy} onClick={() => void runAiReview()}>{aiBusy ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Apoio da IA</Button> : null}
                      </div>
                      {reviewBusy ? <p role="status" className="mb-0 mt-3 text-xs text-muted-foreground">Enviando a decisão ao bot…</p> : null}
                    </div>
                  ) : (
                    <p className="m-0 border-t border-border pt-4 text-sm text-muted-foreground">
                      {selected.status === "approved" ? "Esta resposta foi aprovada." : `Recusado${selected.reason ? `: ${selected.reason}` : "."}`}
                      {selected.reviewerId ? ` · por ${members.find((member) => member.id === selected.reviewerId)?.displayName ?? "um atendente"}` : ""}
                    </p>
                  )}
                </div>
              </article>
            ) : (
              <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-border bg-card/50 px-6 text-center">
                <div><Eye className="mx-auto mb-3 size-5 text-muted-foreground" /><p className="m-0 text-sm text-muted-foreground">Selecione uma resposta para ler e revisar.</p></div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="builder" className="mt-5">
          <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.85fr)]">
            <section className="min-w-0 space-y-6">
              <div className="flex flex-wrap items-start gap-4 border-b border-border pb-5">
                <div className="min-w-0 flex-1">
                  <h2 className="m-0 text-lg font-semibold">Monte seu formulário</h2>
                  <p className="mb-0 mt-1 max-w-[58ch] text-sm leading-6 text-muted-foreground">Comece por um modelo ou escreva suas próprias perguntas. As mudanças aparecem na prévia ao lado.</p>
                </div>
                <label className="flex min-h-10 items-center gap-3 rounded-lg border border-border bg-card px-3">
                  <span className="text-sm font-medium">Formulário ativo</span>
                  <Switch checked={fcfg.enabled} onCheckedChange={(value) => setEnabled("forms", value)} aria-label="Ativar formulários" />
                </label>
              </div>

              <section aria-labelledby="template-title">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div><h3 id="template-title" className="m-0 text-sm font-semibold">Comece com um modelo</h3><p className="mb-0 mt-1 text-xs text-muted-foreground">Você pode editar cada pergunta depois.</p></div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {templates.map((template) => (
                    <button key={template.id} type="button" onClick={() => applyTemplate(template)} className="group min-h-[92px] rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary/40">
                      <span className="flex items-center gap-2 text-sm font-semibold"><FilePlus2 className="size-4 text-primary" />{template.title}</span>
                      <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">{template.fields.length} perguntas · texto e escolhas</span>
                    </button>
                  ))}
                </div>
              </section>

              <section aria-labelledby="questions-title">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                  <div><h3 id="questions-title" className="m-0 text-sm font-semibold">Perguntas</h3><p className="mb-0 mt-1 text-xs text-muted-foreground">Escolhas aparecem antes das perguntas de texto no Discord.</p></div>
                  <span className="text-xs tabular-nums text-muted-foreground">{textCount}/5 texto · {selectCount}/5 escolhas</span>
                </div>
                <details className="mb-4 rounded-xl border border-border bg-card px-4 py-3 2xl:hidden">
                  <summary className="cursor-pointer text-sm font-semibold">Ver prévia atualizada no Discord</summary>
                  <p className="mb-3 mt-2 text-xs text-muted-foreground">A prévia acompanha as alterações. Publique quando estiver pronto para enviar ao servidor.</p>
                  <DiscordFormPreview
                    title={asString(fcfg.config.panelTitle, "Formulário")}
                    description={asString(fcfg.config.panelDescription)}
                    buttonLabel={asString(fcfg.config.panelButtonLabel, "Preencher formulário")}
                    fields={fields}
                  />
                </details>
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <article key={field.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                      <div className="mb-4 flex items-center gap-3">
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">{index + 1}</span>
                        <span className="text-xs font-semibold text-muted-foreground">{field.type === "select" ? "ESCOLHA" : field.type === "short" ? "TEXTO CURTO" : "TEXTO LONGO"}</span>
                        <div className="ml-auto flex items-center">
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => moveField(field.id, -1)} disabled={index === 0} aria-label={`Mover pergunta ${index + 1} para cima`}><ArrowUp className="size-4" /></Button>
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => moveField(field.id, 1)} disabled={index === fields.length - 1} aria-label={`Mover pergunta ${index + 1} para baixo`}><ArrowDown className="size-4" /></Button>
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => duplicateField(field)} aria-label={`Duplicar pergunta ${index + 1}`}><Copy className="size-4" /></Button>
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setFields(fields.filter((item) => item.id !== field.id))} disabled={fields.length <= 1} aria-label={`Remover pergunta ${index + 1}`}><Trash2 className="size-4" /></Button>
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_190px]">
                        <div className="space-y-1.5">
                          <Label htmlFor={`label-${field.id}`}>Pergunta para a comunidade</Label>
                          <Input id={`label-${field.id}`} value={field.label} maxLength={45} onChange={(event) => patchField(field.id, { label: event.target.value })} placeholder="Ex.: O que você precisa resolver?" />
                          <p className="m-0 text-right text-[11px] tabular-nums text-muted-foreground">{field.label.length}/45</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`type-${field.id}`}>Tipo de resposta</Label>
                          <NativeSelect id={`type-${field.id}`} value={field.type} onChange={(event) => {
                            const type = event.target.value as FormFieldConfig["type"];
                            const nextCount = type === "select" ? selectCount : textCount;
                            if (type !== field.type && nextCount >= 5) {
                              setBuilderNotice(type === "select" ? "O Discord permite até cinco escolhas por formulário." : "O Discord permite até cinco perguntas de texto por formulário.");
                              return;
                            }
                            patchField(field.id, { type, options: type === "select" ? (field.options.length >= 2 ? field.options : ["Opção 1", "Opção 2"]) : [] });
                          }}>
                            <option value="short">Texto curto</option>
                            <option value="paragraph">Texto longo</option>
                            <option value="select">Escolher uma opção</option>
                          </NativeSelect>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-4">
                        <label className="flex min-h-9 items-center gap-2 text-sm"><Switch checked={field.required} onCheckedChange={(required) => patchField(field.id, { required })} />Obrigatória</label>
                        {field.type !== "select" ? <span className="text-xs text-muted-foreground">Resposta de {field.minLength || 0} a {field.maxLength} caracteres</span> : <span className="text-xs text-muted-foreground">Até 25 opções</span>}
                      </div>
                      {field.type === "select" ? (
                        <div className="mt-4 space-y-1.5">
                          <Label htmlFor={`options-${field.id}`}>Opções · uma por linha</Label>
                          <Textarea
                            id={`options-${field.id}`}
                            rows={Math.min(Math.max(field.options.length, 2), 6)}
                            value={field.options.join("\n")}
                            onChange={(event) => {
                              const values = event.target.value.split("\n").map((value) => value.trim().slice(0, 100)).filter(Boolean);
                              patchField(field.id, { options: values.slice(0, 25) });
                            }}
                            placeholder={"Dúvida\nProblema\nSugestão"}
                          />
                          <p className="m-0 text-right text-[11px] tabular-nums text-muted-foreground">{field.options.length}/25 opções</p>
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px_120px]">
                          <div className="space-y-1.5">
                            <Label htmlFor={`placeholder-${field.id}`}>Exemplo de resposta</Label>
                            <Input id={`placeholder-${field.id}`} value={field.placeholder} maxLength={100} onChange={(event) => patchField(field.id, { placeholder: event.target.value })} placeholder="Ex.: explique o que aconteceu" />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`min-${field.id}`}>Mínimo</Label>
                            <Input id={`min-${field.id}`} type="number" min={0} max={4000} value={field.minLength} onChange={(event) => patchField(field.id, { minLength: Math.min(Number(field.maxLength) || 1000, Math.max(0, Number(event.target.value) || 0)) })} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`max-${field.id}`}>Máximo</Label>
                            <Input id={`max-${field.id}`} type="number" min={1} max={4000} value={field.maxLength} onChange={(event) => {
                              const maxLength = Math.min(4000, Math.max(1, Number(event.target.value) || 1));
                              patchField(field.id, { maxLength, minLength: Math.min(field.minLength, maxLength) });
                            }} />
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => addField("short")} disabled={!canAddText}><Plus className="size-4" /> Pergunta de texto</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addField("select")} disabled={!canAddSelect}><Plus className="size-4" /> Pergunta de escolha</Button>
                </div>
                {builderNotice ? <p role="status" className="mb-0 mt-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">{builderNotice}</p> : null}
              </section>

              <section aria-labelledby="delivery-title" className="border-t border-border pt-6">
                <h3 id="delivery-title" className="m-0 text-base font-semibold">Onde o formulário aparece</h3>
                <p className="mb-4 mt-1 text-sm text-muted-foreground">O painel é a mensagem que a comunidade encontra no Discord.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="form-channel">Canal do painel</Label><DiscordSelect id="form-channel" kind="text" value={asString(fcfg.config.panelChannelId)} onChange={(panelChannelId) => updateConfig("forms", { panelChannelId })} placeholder="Selecione um canal" /></div>
                  <div className="space-y-1.5"><Label htmlFor="form-review-channel">Canal para revisar respostas</Label><DiscordSelect id="form-review-channel" kind="text" value={asString(fcfg.config.reviewChannelId)} onChange={(reviewChannelId) => updateConfig("forms", { reviewChannelId })} placeholder="Selecione um canal" /></div>
                  <datalist id="form-text-channels">{channels.filter((channel) => channel.type === "text").flatMap((channel) => [<option key={channel.id} value={channel.name} />, <option key={`${channel.id}-hash`} value={`#${channel.name}`} />, <option key={`${channel.id}-id`} value={channel.id} />])}</datalist>
                  <div className="space-y-1.5"><Label htmlFor="form-title">Título do painel</Label><Input id="form-title" value={asString(fcfg.config.panelTitle)} maxLength={256} onChange={(event) => updateConfig("forms", { panelTitle: event.target.value })} /></div>
                  <div className="space-y-1.5"><Label htmlFor="form-button">Texto do botão</Label><Input id="form-button" value={asString(fcfg.config.panelButtonLabel, "Preencher formulário")} maxLength={80} onChange={(event) => updateConfig("forms", { panelButtonLabel: event.target.value })} /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="form-description">Explicação para quem vai responder</Label><Textarea id="form-description" value={asString(fcfg.config.panelDescription)} maxLength={3000} onChange={(event) => updateConfig("forms", { panelDescription: event.target.value })} rows={3} placeholder="Explique o que a pessoa precisa preparar antes de começar." /></div>
                </div>
              </section>

              <section aria-labelledby="review-settings-title" className="border-t border-border pt-6">
                <h3 id="review-settings-title" className="m-0 text-base font-semibold">Como a equipe recebe e revisa</h3>
                <p className="mb-4 mt-1 text-sm text-muted-foreground">Essas regras são aplicadas pelo bot quando uma pessoa envia o formulário.</p>
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  <label className="flex min-h-10 items-center justify-between gap-4 text-sm"><span>Avisar cargos revisores</span><Switch checked={Boolean(fcfg.config.notifyReviewers)} onCheckedChange={(value) => updateConfig("forms", { notifyReviewers: value })} /></label>
                  <label className="flex min-h-10 items-center justify-between gap-4 text-sm"><span>Exigir motivo ao recusar</span><Switch checked={Boolean(fcfg.config.requireReasonOnReject)} onCheckedChange={(value) => updateConfig("forms", { requireReasonOnReject: value })} /></label>
                  <div className="space-y-1.5"><Label htmlFor="form-cooldown">Intervalo entre envios (horas)</Label><Input id="form-cooldown" type="number" min={0} max={8760} value={Number(fcfg.config.cooldownHours ?? 24)} onChange={(event) => updateConfig("forms", { cooldownHours: Math.max(0, Number(event.target.value) || 0) })} /></div>
                  <div className="space-y-1.5"><Label htmlFor="form-limit">Envios por pessoa</Label><Input id="form-limit" type="number" min={1} max={100} value={Number(fcfg.config.maxSubmissionsPerUser ?? 3)} onChange={(event) => updateConfig("forms", { maxSubmissionsPerUser: Math.max(1, Number(event.target.value) || 1) })} /></div>
                  <div className="space-y-1.5"><Label htmlFor="form-account-age">Idade mínima da conta (dias)</Label><Input id="form-account-age" type="number" min={0} max={3650} value={Number(fcfg.config.minAccountAgeDays ?? 0)} onChange={(event) => updateConfig("forms", { minAccountAgeDays: Math.max(0, Number(event.target.value) || 0) })} /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="form-reviewers">Cargos que revisam</Label><DiscordMultiSelect value={Array.isArray(fcfg.config.reviewerRoleIds) ? fcfg.config.reviewerRoleIds as string[] : []} onChange={(reviewerRoleIds) => updateConfig("forms", { reviewerRoleIds })} /></div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex min-h-10 flex-1 items-center justify-between gap-4 text-sm"><span>Pré-análise com IA</span><Switch checked={Boolean(fcfg.config.useAiPreReview)} onCheckedChange={(value) => updateConfig("forms", { useAiPreReview: value })} disabled={!planAllows(guild.plan, "ai")} /></label>
                    {!planAllows(guild.plan, "ai") ? <ExclusiveButton /> : null}
                  </div>
                </div>
              </section>

              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
                {formsAllowed
                  ? <Button onClick={() => void publishFormPanel()} disabled={publishBusy}><Send className="size-4" />{publishBusy ? "Aguardando o bot…" : "Publicar painel no Discord"}</Button>
                  : <ExclusiveButton />}
                {publishNotice ? <p role="status" className="m-0 text-sm text-muted-foreground">{publishNotice}</p> : null}
              </div>
            </section>

            <aside className="hidden min-w-0 2xl:sticky 2xl:top-24 2xl:block 2xl:self-start" aria-label="Prévia do formulário no Discord">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Eye className="size-4 text-primary" /> Prévia no Discord <span className="ml-auto text-xs font-normal text-muted-foreground">rascunho · não publicado</span></div>
              <DiscordFormPreview
                title={asString(fcfg.config.panelTitle, "Formulário")}
                description={asString(fcfg.config.panelDescription)}
                buttonLabel={asString(fcfg.config.panelButtonLabel, "Preencher formulário")}
                fields={fields}
              />
              <div className="mt-4 rounded-lg border border-border bg-card px-4 py-3">
                <p className="m-0 flex items-center gap-2 text-sm font-semibold"><Check className="size-4 text-primary" /> Limites do Discord</p>
                <p className="mb-0 mt-1 text-xs leading-5 text-muted-foreground">Até 5 perguntas de texto no modal e 5 escolhas na etapa anterior. Cada escolha aceita até 25 opções.</p>
              </div>
            </aside>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
