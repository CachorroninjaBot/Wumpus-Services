import { PageHeader } from "@/components/page-header";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Clock3, FilePlus2, History, RotateCcw, Search, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DiscordSelect } from "@/components/discord-select";
import { Dialog, DialogContent, DialogDesc, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getGuildKnowledgeFaqSuggestions, updateGuildKnowledgeFaqSuggestion } from "@/lib/wumpus/runtime-store";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import { scoreKnowledgeArticle, searchArticles } from "@/lib/wumpus/engine";
import type { KnowledgeFaqSuggestion } from "@/lib/wumpus/runtime-store";
import type { Article } from "@/lib/wumpus/types";
import { formatRelative } from "@/lib/utils";
import { useModule, useWumpus } from "@/lib/wumpus/store";
import { EmptyState } from "@/components/empty-state";
import { SettingRow } from "@/components/ui/setting-row";
import { Notice } from "@/components/ui/notice";
import { NumberField } from "@/components/protect/helpers";

export const Route = createFileRoute("/app/knowledge")({ component: KnowledgePage });

type ArticleStatus = "all" | "approved" | "review" | "draft";
type EditorDraft = { title: string; body: string; category: string; tags: string; examples: string };
const EMPTY_DRAFT: EditorDraft = { title: "", body: "", category: "Geral", tags: "", examples: "" };

function statusOf(article: Article): Exclude<ArticleStatus, "all"> {
  if (article.approved) return "approved";
  return article.reviewRequested ? "review" : "draft";
}

function KnowledgePage() {
  const gid = useWumpus((s) => s.activeGuildId);
  return <KnowledgeWorkspace key={gid} gid={gid} />;
}

function KnowledgeWorkspace({ gid }: { gid: string }) {
  const user = useWumpus((s) => s.sessionUser);
  const allArticles = useWumpus((s) => s.articles);
  const add = useWumpus((s) => s.addArticle);
  const update = useWumpus((s) => s.updateArticle);
  const remove = useWumpus((s) => s.deleteArticle);
  const kcfg = useModule("knowledge");
  const updateConfig = useWumpus((s) => s.updateConfig);
  const [query, setQuery] = useState("");
  const [testQuestion, setTestQuestion] = useState("");
  const [statusFilter, setStatusFilter] = useState<ArticleStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditorDraft>(EMPTY_DRAFT);
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);
  const [faqSuggestionId, setFaqSuggestionId] = useState<string | null>(null);
  const [faqSuggestions, setFaqSuggestions] = useState<KnowledgeFaqSuggestion[]>([]);
  const [faqSuggestionsLoading, setFaqSuggestionsLoading] = useState(true);
  const [faqSuggestionsError, setFaqSuggestionsError] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const articles = useMemo(() => allArticles.filter((article) => article.guildId === gid), [allArticles, gid]);
  const categoryNames = useMemo(() => [...new Set(articles.map((article) => article.category?.trim() || "Geral"))].sort((a, b) => a.localeCompare(b, "pt-BR")), [articles]);
  const visibleArticles = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return articles.filter((article) => {
      const text = `${article.title} ${article.body} ${article.category ?? "Geral"} ${article.tags.join(" ")} ${(article.exampleQuestions ?? []).join(" ")}`.toLocaleLowerCase("pt-BR");
      return (!normalized || text.includes(normalized))
        && (statusFilter === "all" || statusOf(article) === statusFilter)
        && (categoryFilter === "all" || (article.category?.trim() || "Geral") === categoryFilter);
    }).sort((a, b) => Number(b.approved) - Number(a.approved) || b.updatedAt - a.updatedAt);
  }, [articles, categoryFilter, query, statusFilter]);
  const minQuestionLength = Number(kcfg.config.minQuestionLength ?? 12);
  const similarityThreshold = Number(kcfg.config.similarityThreshold ?? 0.6);
  const maxArticlesPerSearch = Number(kcfg.config.maxArticlesPerSearch ?? 5);
  const testHits = useMemo(() => testQuestion.trim().length >= minQuestionLength
    ? searchArticles(testQuestion, articles, Boolean(kcfg.config.requireApprovedArticles), similarityThreshold).slice(0, maxArticlesPerSearch)
    : [], [testQuestion, articles, kcfg.config.requireApprovedArticles, minQuestionLength, maxArticlesPerSearch, similarityThreshold]);
  const counts = useMemo(() => ({
    approved: articles.filter((article) => article.approved).length,
    review: articles.filter((article) => !article.approved && article.reviewRequested).length,
    draft: articles.filter((article) => !article.approved && !article.reviewRequested).length,
  }), [articles]);

  const refreshFaqSuggestions = useCallback(async () => {
    const token = getStoredSessionToken();
    if (!token || !gid) {
      setFaqSuggestions([]);
      setFaqSuggestionsError(gid ? "Sua sessão expirou. Entre novamente para carregar as FAQs sugeridas." : null);
      setFaqSuggestionsLoading(false);
      return;
    }
    try {
      const suggestions = await getGuildKnowledgeFaqSuggestions({ data: { token, guildId: gid } });
      setFaqSuggestions(suggestions);
      setFaqSuggestionsError(null);
    } catch (error) {
      setFaqSuggestionsError(error instanceof Error ? error.message : "Não foi possível carregar as FAQs sugeridas.");
    } finally {
      setFaqSuggestionsLoading(false);
    }
  }, [gid]);

  useEffect(() => {
    setFaqSuggestionsLoading(true);
    void refreshFaqSuggestions();
    const timer = window.setInterval(() => void refreshFaqSuggestions(), 30_000);
    return () => window.clearInterval(timer);
  }, [refreshFaqSuggestions]);

  useEffect(() => {
    if (!editorOpen) return;
    const frame = window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      editorRef.current?.querySelector<HTMLInputElement>("#article-title")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editorOpen, editingId, faqSuggestionId]);

  function startNew() {
    if (editorOpen) return;
    setEditingId(null);
    setFaqSuggestionId(null);
    setDraft(EMPTY_DRAFT);
    setSaveNotice(null);
    setEditorOpen(true);
  }

  function edit(article: Article) {
    setEditingId(article.id);
    setFaqSuggestionId(null);
    setDraft({ title: article.title, body: article.body, category: article.category ?? "Geral", tags: article.tags.join(", "), examples: (article.exampleQuestions ?? []).join("\n") });
    setSaveNotice(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId(null);
    setFaqSuggestionId(null);
    setDraft(EMPTY_DRAFT);
  }

  function startFromFaq(suggestion: KnowledgeFaqSuggestion) {
    setEditingId(null);
    setFaqSuggestionId(suggestion.id);
    setDraft({
      title: suggestion.title,
      body: "",
      category: suggestion.category || "Geral",
      tags: suggestion.tags.join(", "),
      examples: suggestion.exampleQuestions.join("\n"),
    });
    setSaveNotice(`FAQ detectada ${suggestion.occurrenceCount} vezes por ${suggestion.uniqueUserCount} pessoas. Escreva a resposta oficial antes de enviar para revisão.`);
    setEditorOpen(true);
  }

  async function dismissFaqSuggestion(suggestionId: string) {
    const token = getStoredSessionToken();
    if (!token) {
      setFaqSuggestionsError("Sua sessão expirou. Entre novamente para atualizar esta sugestão.");
      return;
    }
    try {
      await updateGuildKnowledgeFaqSuggestion({ data: { token, guildId: gid, suggestionId, status: "dismissed" } });
      setFaqSuggestions((current) => current.filter((suggestion) => suggestion.id !== suggestionId));
      setFaqSuggestionsError(null);
    } catch (error) {
      setFaqSuggestionsError(error instanceof Error ? error.message : "Não foi possível descartar a sugestão.");
    }
  }

  function save(mode: "draft" | "review") {
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title || !body) return;
    const tags = [...new Set(draft.tags.split(",").map((tag) => tag.trim().slice(0, 64)).filter(Boolean))].slice(0, 25);
    const exampleQuestions = [...new Set(draft.examples.split("\n").map((question) => question.trim().slice(0, 200)).filter(Boolean))].slice(0, 12);
    const content = { title, body, category: draft.category.trim() || "Geral", tags, exampleQuestions };
    if (editingId) update(editingId, { ...content, approved: false, reviewRequested: mode === "review", reviewedBy: undefined, reviewedAt: undefined });
    else add(title, body, tags, { category: content.category, exampleQuestions, approved: false, reviewRequested: mode === "review" });
    const convertedSuggestionId = faqSuggestionId;
    setSaveNotice(mode === "review" ? "Artigo enviado para revisão." : "Rascunho salvo.");
    closeEditor();
    if (convertedSuggestionId) {
      const token = getStoredSessionToken();
      if (token) {
        void updateGuildKnowledgeFaqSuggestion({ data: { token, guildId: gid, suggestionId: convertedSuggestionId, status: "converted" } })
          .then(() => {
            setFaqSuggestions((current) => current.filter((suggestion) => suggestion.id !== convertedSuggestionId));
            setFaqSuggestionsError(null);
          })
          .catch((error: unknown) => {
            setFaqSuggestionsError(error instanceof Error ? error.message : "O artigo foi criado, mas a sugestão ainda aparece na lista.");
          });
      } else {
        setFaqSuggestionsError("O artigo foi criado, mas sua sessão expirou e a sugestão não foi arquivada.");
      }
    }
  }

  function approve(article: Article) {
    update(article.id, { approved: true, reviewRequested: false, reviewedAt: Date.now(), reviewedBy: user.globalName });
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-7">
      <PageHeader
        title="Base de conhecimento"
        description="Artigos que a IA e a equipe usam para responder."
        actions={<Button onClick={startNew} disabled={editorOpen}><FilePlus2 className="size-4" />{editorOpen ? "Editor aberto" : "Novo artigo"}</Button>}
      />

      {saveNotice ? <Notice tone="info" className="m-0">{saveNotice}</Notice> : null}

      <section aria-label="Resumo dos artigos" className="grid gap-3 sm:grid-cols-1 md:grid-cols-3">
        <SummaryCard icon={<Check className="size-4" />} label="Aprovados" value={counts.approved} detail="Disponíveis para a IA" tone="ok" />
        <SummaryCard icon={<Clock3 className="size-4" />} label="Aguardando revisão" value={counts.review} detail="Precisam da aprovação da equipe" tone="warn" />
        <SummaryCard icon={<FilePlus2 className="size-4" />} label="Rascunhos" value={counts.draft} detail="Ainda não entram na revisão" />
      </section>

      <Card className="space-y-4 p-4 sm:p-5" aria-label="Perguntas frequentes sugeridas pela IA">
        <div>
          <h2 className="m-0 text-base font-semibold">FAQs detectadas</h2>
          <p className="mb-0 mt-1 max-w-3xl text-sm text-muted-foreground">
            A IA agrupa perguntas parecidas em todos os canais que o bot consegue ler, inclusive privados. Uma sugestão só aparece após 5 ocorrências de pelo menos 3 pessoas em 30 dias. Amostras recorrentes, sem nomes ou IDs, são enviadas ao provedor de IA para sugerir o tema; a resposta oficial fica com sua equipe.
          </p>
        </div>
        {faqSuggestionsError ? <Notice tone="error" className="m-0">{faqSuggestionsError}</Notice> : null}
        {faqSuggestionsLoading && !faqSuggestions.length ? <p className="m-0 text-sm text-muted-foreground">Carregando sugestões…</p>
          : faqSuggestions.length ? <ul className="m-0 divide-y divide-border p-0">
            {faqSuggestions.map((suggestion) => <li key={suggestion.id} className="list-none py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="m-0 text-sm font-semibold">{suggestion.title}</h3><Badge tone="warn">Tema sugerido</Badge></div>
                  <p className="mb-0 mt-1 text-xs text-muted-foreground">
                    {suggestion.occurrenceCount} ocorrências · {suggestion.uniqueUserCount} pessoas · {suggestion.channelCount} canais · categoria {suggestion.category}
                  </p>
                  <ul className="mb-0 mt-2 space-y-1 pl-5 text-sm text-muted-foreground">
                    {suggestion.exampleQuestions.slice(0, 3).map((question) => <li key={question}>{question}</li>)}
                  </ul>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button size="sm" onClick={() => startFromFaq(suggestion)}><FilePlus2 className="size-3.5" />Completar artigo</Button>
                  <Button size="sm" variant="ghost" onClick={() => void dismissFaqSuggestion(suggestion.id)}>Descartar</Button>
                </div>
              </div>
            </li>)}
          </ul>
          : faqSuggestionsError ? null
          : <p className="m-0 rounded-lg bg-muted px-3 py-3 text-sm text-muted-foreground">
            {kcfg.config.autoSuggest ? "Ainda não há perguntas frequentes suficientes para sugerir um artigo." : "Ative a detecção automática abaixo para encontrar FAQs recorrentes."}
          </p>}
      </Card>

      {editorOpen ? <div ref={editorRef} className="scroll-mt-6">
        <Card className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="m-0 text-lg font-semibold">{editingId ? "Editar artigo" : "Criar artigo"}</h2><p className="mb-0 mt-1 text-sm text-muted-foreground">{faqSuggestionId ? "Complete a resposta com as informações oficiais do servidor antes de enviar para revisão." : "Novos artigos começam como rascunho. Envie para revisão para que a equipe possa aprová-los."}</p></div>
            <Button variant="ghost" onClick={closeEditor}>{editingId ? "Cancelar edição" : "Fechar"}</Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-1 md:grid-cols-2">
            <EditorField id="article-title" label="Título"><Input id="article-title" maxLength={200} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Como recuperar minha conta?" /></EditorField>
            <EditorField id="article-category" label="Categoria"><Input id="article-category" maxLength={80} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Suporte" /></EditorField>
            <div className="lg:col-span-2">
              <EditorField id="article-body" label="Resposta"><Textarea id="article-body" rows={5} maxLength={8000} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} placeholder="Escreva a resposta que a equipe gostaria que o bot usasse. Inclua passos claros e links confiáveis." /><p className="m-0 text-right text-xs text-muted-foreground">{draft.body.length}/8000</p></EditorField>
            </div>
            <EditorField id="article-tags" label="Tags"><Input id="article-tags" value={draft.tags} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} placeholder="conta, acesso, senha" /><p className="m-0 text-xs text-muted-foreground">Separe as tags por vírgula.</p></EditorField>
            <EditorField id="article-examples" label="Perguntas relacionadas"><Textarea id="article-examples" rows={3} value={draft.examples} onChange={(event) => setDraft((current) => ({ ...current, examples: event.target.value }))} placeholder={"Como recupero meu acesso?\nEsqueci a senha, o que faço?"} /><p className="m-0 text-xs text-muted-foreground">Uma forma de perguntar por linha ajuda a IA a encontrar este artigo.</p></EditorField>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="m-0 text-xs text-muted-foreground">{!draft.title.trim() || !draft.body.trim() ? "Preencha o título e a resposta para salvar." : "Você pode salvar agora ou enviar diretamente para revisão."}</p>
            <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!draft.title.trim() || !draft.body.trim()} onClick={() => save("draft")}>Salvar rascunho</Button><Button disabled={!draft.title.trim() || !draft.body.trim()} onClick={() => save("review")}><Send className="size-4" />Enviar para revisão</Button></div>
          </div>
        </Card>
      </div> : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(350px,0.75fr)]">
        <Card className="min-w-0 space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="m-0 text-base font-semibold">Artigos do servidor</h2><p className="m-0 mt-1 text-xs text-muted-foreground">{articles.length} {articles.length === 1 ? "artigo" : "artigos"} no total</p></div>
            <div className="flex flex-wrap gap-2">
              <NativeSelect aria-label="Filtrar por status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ArticleStatus)} className="h-9 w-auto min-w-36 text-xs">
                <option value="all">Todos os status</option><option value="approved">Aprovados</option><option value="review">Aguardando revisão</option><option value="draft">Rascunhos</option>
              </NativeSelect>
              <NativeSelect aria-label="Filtrar por categoria" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-9 w-auto min-w-32 text-xs">
                <option value="all">Todas as categorias</option>{categoryNames.map((category) => <option key={category} value={category}>{category}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar artigos" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título, resposta, categoria ou tag" />
          </div>
          {visibleArticles.length ? <ul className="m-0 divide-y divide-border p-0">
            {visibleArticles.map((article) => {
              const status = statusOf(article);
              const selected = editingId === article.id;
              return <li key={article.id} className={`list-none py-4 first:pt-0 last:pb-0 ${selected ? "bg-primary/5" : ""}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="m-0 text-sm font-semibold">{article.title}</h3><StatusBadge status={status} /><Badge>{article.category || "Geral"}</Badge></div>
                    <p className="mb-0 mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{article.body}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">{article.tags.map((tag) => <Badge key={tag} className="font-normal">#{tag}</Badge>)}{article.reviewedBy ? <span className="ml-auto text-xs text-muted-foreground">Revisado por {article.reviewedBy}{article.reviewedAt ? ` · ${formatRelative(article.reviewedAt)}` : ""}</span> : null}<span className="text-xs text-muted-foreground">Atualizado {formatRelative(article.updatedAt)}</span></div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <Button size="sm" variant="outline" onClick={() => edit(article)}>{selected ? "Editando" : "Editar artigo"}</Button>
                  {status === "review" ? <><Button size="sm" onClick={() => approve(article)}><Check className="size-3.5" />Aprovar</Button><Button size="sm" variant="outline" onClick={() => update(article.id, { approved: false, reviewRequested: false, reviewedBy: undefined, reviewedAt: undefined })}>Devolver para rascunho</Button></> : status === "approved" ? <Button size="sm" variant="ghost" onClick={() => update(article.id, { approved: false, reviewRequested: false })}>Voltar para rascunho</Button> : <Button size="sm" variant="secondary" onClick={() => update(article.id, { reviewRequested: true })}><Send className="size-3.5" />Enviar para revisão</Button>}
                  {article.history?.length ? <details className="ml-auto text-xs text-muted-foreground"><summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-2 hover:bg-muted"><History className="size-3.5" />Histórico ({article.history.length})</summary><ol className="mt-2 max-h-64 space-y-2 overflow-y-auto border-t border-border pt-2">{[...article.history].reverse().slice(0, 5).map((revision, index) => <li key={`${revision.at}-${index}`}><details><summary className="cursor-pointer font-medium text-foreground">{revision.title} · {formatRelative(revision.at)}</summary><p className="mb-1 mt-2 whitespace-pre-wrap leading-5">{revision.body}</p><p className="m-0 text-xs">{revision.category || "Geral"}{revision.tags.length ? ` · ${revision.tags.map((tag) => `#${tag}`).join(" ")}` : ""}</p>{revision.exampleQuestions?.length ? <p className="mb-2 mt-1 whitespace-pre-wrap text-xs">Perguntas: {revision.exampleQuestions.join(" · ")}</p> : null}<Button size="sm" variant="outline" className="mt-2" onClick={() => update(article.id, { title: revision.title, body: revision.body, category: revision.category ?? "Geral", tags: [...revision.tags], exampleQuestions: [...(revision.exampleQuestions ?? [])], approved: false, reviewRequested: false, reviewedBy: undefined, reviewedAt: undefined })}><RotateCcw className="size-3.5" />Restaurar como rascunho</Button></details></li>)}</ol></details> : null}
                  <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" aria-label={`Remover ${article.title}`} onClick={() => setDeleteTarget(article)}><Trash2 className="size-4" /></Button>
                </div>
              </li>;
            })}
          </ul> : <div className="py-4">
            <EmptyState
              title={articles.length ? "Nenhum artigo corresponde" : "Sua base começa aqui"}
              description={articles.length ? "Mude a busca ou os filtros para encontrar outro artigo." : "Adicione respostas aprovadas para perguntas recorrentes, regras e procedimentos do servidor."}
              action={!articles.length && !editorOpen ? <Button size="sm" onClick={startNew}><FilePlus2 className="size-4" />Criar primeiro artigo</Button> : undefined}
            />
          </div>}
        </Card>

        <div className="space-y-4">
          <Card className="space-y-4 p-4 sm:p-5">
            <div><h2 className="m-0 text-base font-semibold">Que resposta o bot encontraria?</h2><p className="mb-0 mt-1 text-sm text-muted-foreground">A busca segue o filtro de aprovação e as regras atuais do servidor.</p></div>
            <Input aria-label="Pergunta de teste" value={testQuestion} onChange={(event) => setTestQuestion(event.target.value)} placeholder="Ex.: esqueci a senha, como entro?" />
            {testQuestion.trim().length < minQuestionLength ? <p className="m-0 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">Digite uma pergunta com pelo menos {minQuestionLength} caracteres, como um membro faria no Discord.</p> : testHits.length ? <ol className="m-0 space-y-2 p-0">{testHits.map((article, index) => <li key={article.id} className="list-none rounded-xl bg-muted/60 p-3"><div className="flex flex-wrap items-center gap-2"><Badge tone={index === 0 ? "primary" : "default"}>{index === 0 ? "Melhor resultado" : `Resultado ${index + 1}`}</Badge><Badge>{article.category || "Geral"}</Badge><span className="ml-auto text-xs text-muted-foreground">Correspondência {Math.round(scoreKnowledgeArticle(article, testQuestion) * 100)}%</span></div><p className="mb-1 mt-2 text-sm font-medium">{article.title}</p><p className="m-0 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{article.body}</p></li>)}</ol> : <p className="m-0 rounded-xl bg-warn/10 px-3 py-2 text-sm text-muted-foreground">Nenhum artigo passou pelo limite de correspondência atual ({Math.round(similarityThreshold * 100)}%). Revise tags, perguntas relacionadas ou conteúdo.</p>}
            <details className="border-t border-border pt-4">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Como o bot responde
              </summary>
              <div className="mt-4 space-y-4">
              <EditorField id="knowledge-channel" label="Canal de perguntas">
                <DiscordSelect id="knowledge-channel" kind="text" value={String(kcfg.config.answerChannelId ?? "")} onChange={(answerChannelId) => updateConfig("knowledge", { answerChannelId })} placeholder="Selecione um canal" />
              </EditorField>
              <div className="divide-y divide-border">
                <SettingRow label="Respostas com IA ligadas" description="O bot responde apenas quando encontra material suficiente." control={<Switch aria-label="Respostas com IA ligadas" checked={Boolean(kcfg.config.useAi)} onCheckedChange={(value) => updateConfig("knowledge", { useAi: value })} />} />
                <SettingRow label="Detectar perguntas frequentes" description="Analisa perguntas nos canais acessíveis ao bot e sugere temas. Não cria nem publica respostas automaticamente." control={<Switch aria-label="Detectar perguntas frequentes" checked={Boolean(kcfg.config.autoSuggest)} onCheckedChange={(value) => updateConfig("knowledge", { autoSuggest: value })} />} />
                <SettingRow label="Exigir artigos aprovados" description="Recomendado para respostas consistentes." control={<Switch aria-label="Exigir artigos aprovados" checked={Boolean(kcfg.config.requireApprovedArticles)} onCheckedChange={(value) => updateConfig("knowledge", { requireApprovedArticles: value })} />} />
                <SettingRow label="Exigir menção no canal de perguntas" description="Sem isso, o bot responde perguntas enviadas diretamente no canal escolhido." control={<Switch aria-label="Exigir menção no canal de perguntas" checked={Boolean(kcfg.config.mentionRequired)} onCheckedChange={(value) => updateConfig("knowledge", { mentionRequired: value })} />} />
                <SettingRow label="Aceitar menções em outros canais" description="Permite respostas quando alguém mencionar o bot fora do canal escolhido." control={<Switch aria-label="Aceitar menções em outros canais" checked={Boolean(kcfg.config.suggestInAllChannels)} onCheckedChange={(value) => updateConfig("knowledge", { suggestInAllChannels: value })} />} />
                <SettingRow label="Responder perguntas em qualquer canal" description="Sem menção, em qualquer canal legível pelo bot, conforme o filtro de aprovação." control={<Switch aria-label="Responder perguntas em qualquer canal" checked={Boolean(kcfg.config.respondInAllChannels)} onCheckedChange={(value) => updateConfig("knowledge", { respondInAllChannels: value })} />} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <NumberField id="minimum-length" label="Tamanho mínimo da pergunta" min={1} max={2000} value={minQuestionLength} onChange={(minQuestionLength) => updateConfig("knowledge", { minQuestionLength })} />
                <NumberField id="knowledge-similarity" label="Correspondência mínima (%)" min={10} max={100} value={Math.round(similarityThreshold * 100)} onChange={(value) => updateConfig("knowledge", { similarityThreshold: value / 100 })} />
              </div>
              <NumberField id="max-articles" label="Artigos de contexto por resposta" min={1} max={10} value={maxArticlesPerSearch} onChange={(maxArticlesPerSearch) => updateConfig("knowledge", { maxArticlesPerSearch })} />
              <NumberField id="knowledge-cooldown" label="Intervalo entre respostas (segundos)" min={0} max={3600} value={Number(kcfg.config.cooldownSeconds ?? 20)} onChange={(cooldownSeconds) => updateConfig("knowledge", { cooldownSeconds })} />
              <div className="border-t border-border pt-2">
                <SettingRow label="Registrar buscas na auditoria" description="Inclui a pergunta e os artigos usados nos logs." control={<Switch aria-label="Registrar buscas na auditoria" checked={Boolean(kcfg.config.logSearches)} onCheckedChange={(value) => updateConfig("knowledge", { logSearches: value })} />} />
              </div>
              </div>
            </details>
          </Card>
        </div>
      </div>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogTitle>Remover artigo?</DialogTitle>
          <DialogDesc>“{deleteTarget?.title}” deixará de aparecer para a equipe e para a IA.</DialogDesc>
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button><Button variant="destructive" onClick={() => { if (deleteTarget) remove(deleteTarget.id); setDeleteTarget(null); }}>Remover artigo</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ icon, label, value, detail, tone = "default" }: { icon: React.ReactNode; label: string; value: number; detail: string; tone?: "default" | "ok" | "warn" }) {
  return <Card className="flex items-center gap-3 p-4"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone === "ok" ? "bg-ok/10 text-ok" : tone === "warn" ? "bg-warn/10 text-warn" : "bg-muted text-muted-foreground"}`}>{icon}</span><div className="min-w-0"><p className="m-0 text-xs text-muted-foreground">{label}</p><p className="mb-0 mt-0.5 text-2xl font-semibold">{value}</p><p className="m-0 truncate text-xs text-muted-foreground">{detail}</p></div></Card>;
}

function StatusBadge({ status }: { status: Exclude<ArticleStatus, "all"> }) {
  const labels = { approved: "Aprovado", review: "Em revisão", draft: "Rascunho" };
  const tones = { approved: "ok", review: "warn", draft: "default" } as const;
  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}

function EditorField({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
