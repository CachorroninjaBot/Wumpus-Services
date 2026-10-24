import { useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ExternalLink, Headset, LoaderCircle, MessageCircle, Plus, Send, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/markdown-content";
import {
  askWumpusAssistant,
  getHumanSupportStatus,
  listAssistantChats,
  listHumanSupportChats,
  loadAssistantChat,
  rateHumanSupport,
  requestHumanSupport,
  saveAssistantChat,
  sendHumanSupportMessage,
} from "@/lib/wumpus/assistant";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import { navItems } from "@/lib/wumpus/brand";
import type { ModuleKey } from "@/lib/wumpus/defaults";
import { useWumpus } from "@/lib/wumpus/store";

type ChatMessage = { role: "user" | "assistant" | "staff"; content: string; id?: string; at?: number; delivery?: "queued" | "sent" | "failed" };
type PastChat = { id: string; page: string; title: string; updatedAt: number; kind: "assistant" | "support"; status?: string };
type HandoffState = {
  status: "idle" | "requesting" | "queued" | "open" | "closed" | "failed";
  jobId?: string;
  guildId?: string;
  detail?: string;
  threadUrl?: string;
  rating?: number | null;
};
const moduleContext: Record<string, ModuleKey[]> = {
  tickets: ["tickets"], forms: ["forms"], staff: ["staff", "tickets"], moderation: ["moderation"],
  protect: ["security", "automod"], knowledge: ["knowledge"], stats: ["statistics"], logs: ["logs"],
  settings: ["servers", "roles", "logs"], overview: ["tickets", "forms", "staff"],
};

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    /secret|token|password|webhook|api.?key/i.test(key) ? "[oculto]" : redact(item),
  ]));
}

function getVisiblePageControls(): string {
  const root = document.querySelector("main") ?? document.body;
  const selectors = "h1,h2,h3,[role=tab],button,[role=button],label,input,select,textarea,[role=status],[role=alert]";
  const entries = Array.from(root.querySelectorAll<HTMLElement>(selectors))
    .filter((element) => element.getClientRects().length > 0)
    .map((element) => {
      const role = element.getAttribute("role");
      const text = element.innerText?.trim().replace(/\s+/g, " ");
      if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
        const label = element.getAttribute("aria-label")
          || element.labels?.[0]?.innerText?.trim()
          || element.getAttribute("placeholder")
          || element.getAttribute("name");
        return label ? `Campo${element.disabled ? " desabilitado" : ""}: ${label}` : "";
      }
      if (!text) return "";
      if (role === "tab") return `Aba${element.getAttribute("aria-selected") === "true" ? " selecionada" : ""}: ${text}`;
      if (element.matches("button,[role=button]")) return `Botão${element instanceof HTMLButtonElement && element.disabled ? " desabilitado" : ""}: ${text}`;
      if (role === "status" || role === "alert") return `Estado visível: ${text}`;
      return `Seção: ${text}`;
    })
    .filter(Boolean);
  return [...new Set(entries)].join("\n").slice(0, 4200);
}

export function ModuleAssistant() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const guild = useWumpus((state) => state.guilds.find((item) => item.id === state.activeGuildId));
  const guildId = useWumpus((state) => state.activeGuildId);
  const modules = useWumpus((state) => state.modules[guildId]);
  const page = navItems.find((item) => pathname === item.path || (item.path !== "/app" && pathname.startsWith(`${item.path}/`))) ?? navItems[0]!;
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | undefined>();
  const [chatPage, setChatPage] = useState<string | undefined>();
  const [chatContext, setChatContext] = useState<string | undefined>();
  const [pastChats, setPastChats] = useState<PastChat[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [error, setError] = useState("");
  const [handoff, setHandoff] = useState<HandoffState>({ status: "idle" });
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const handoffRef = useRef(handoff);
  handoffRef.current = handoff;
  const context = useMemo(() => {
    const relevant = Object.fromEntries((moduleContext[page.id] ?? []).flatMap((key) => modules?.[key] ? [[key, redact(modules[key])]] : []));
    const sections = navItems.map((item) => `${item.label}: ${item.hint}`).join("\n");
    return [
      `Seção atual: ${page.label}. ${page.hint}`,
      `Servidor atualmente selecionado: ${guild?.name ?? "não identificado"}`,
      `Seções disponíveis na dashboard:\n${sections}`,
      `Configuração ativa desta seção (JSON): ${JSON.stringify(relevant).slice(0, 5200) || "Ainda sem configuração publicada."}`,
    ].join("\n\n");
  }, [guild?.name, modules, page]);

  useEffect(() => {
    if (handoffRef.current.guildId === guildId && ["queued", "open", "closed"].includes(handoffRef.current.status)) return;
    setMessages([]);
    setChatId(undefined);
    setChatPage(undefined);
    setChatContext(undefined);
    setError("");
    setHandoff({ status: "idle" });
    setShowHistory(false);
  }, [pathname, guildId]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [messages, busy, handoff]);

  useEffect(() => {
    if (!guildId) return;
    const token = getStoredSessionToken();
    if (!token) return;
    let cancelled = false;
    void Promise.all([
      listAssistantChats({ data: { token, guildId } }),
      listHumanSupportChats({ data: { token, guildId } }),
    ]).then(([assistantChats, supportChats]) => {
      if (cancelled) return;
      setPastChats([
        ...assistantChats.map((chat) => ({ ...chat, kind: "assistant" as const })),
        ...supportChats.map((chat) => ({ ...chat, kind: "support" as const })),
      ].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 25));
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Não foi possível carregar as conversas anteriores.");
    });
    return () => { cancelled = true; };
  }, [guildId]);

  useEffect(() => {
    if (!guildId) return;
    const storedId = window.localStorage.getItem(`wumpus-human-support:${guildId}`);
    if (!storedId || handoffRef.current.guildId === guildId) return;
    const token = getStoredSessionToken();
    if (!token) return;
    let cancelled = false;
    void getHumanSupportStatus({ data: { token, guildId, jobId: storedId } }).then((result) => {
      if (cancelled || result.status === "missing") {
        if (!cancelled) window.localStorage.removeItem(`wumpus-human-support:${guildId}`);
        return;
      }
      const status = result.status === "failed" ? "failed" : result.status === "closed" ? "closed" : result.status === "open" ? "open" : "queued";
      setHandoff({
        status,
        guildId,
        jobId: storedId,
        detail: result.detail ?? (status === "queued" ? "Seu pedido está chegando à equipe." : status === "failed" ? "Não foi possível criar o tópico do atendimento." : "Em breve uma pessoa da equipe entrará em contato por aqui."),
        threadUrl: result.channelId ? `https://discord.com/channels/${result.channelGuildId ?? guildId}/${result.channelId}` : undefined,
        rating: result.rating,
      });
      if (result.messages?.length) setMessages(result.messages);
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Não foi possível recuperar o atendimento.");
    });
    return () => { cancelled = true; };
  }, [guildId]);

  useEffect(() => {
    if (!["queued", "open"].includes(handoff.status) || !handoff.jobId || !guildId) return;
    const jobId = handoff.jobId;
    let cancelled = false;
    let polling = false;
    const timer = window.setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        const token = getStoredSessionToken();
        if (!token) throw new Error("Sua sessão expirou. Entre novamente para consultar o atendimento.");
        const result = await getHumanSupportStatus({ data: { token, guildId, jobId } });
        if (cancelled) return;
        if (result.status === "failed" || result.status === "missing") {
          window.clearInterval(timer);
          setHandoff({ status: "failed", detail: result.detail ?? "Não foi possível confirmar a criação do atendimento." });
        } else if (result.status === "closed") {
          window.clearInterval(timer);
          setHandoff((current) => ({ ...current, status: "closed", rating: result.rating }));
        } else {
          setHandoff((current) => ({
            ...current,
            status: result.status === "open" ? "open" : "queued",
            detail: result.status === "open" ? "Em breve uma pessoa da equipe entrará em contato por aqui." : "Seu pedido está chegando à equipe.",
            threadUrl: result.channelId ? `https://discord.com/channels/${result.channelGuildId ?? guildId}/${result.channelId}` : current.threadUrl,
            rating: result.rating,
          }));
        }
        if (result.messages?.length) setMessages(result.messages);
      } catch (cause) {
        if (cancelled) return;
        window.clearInterval(timer);
        setHandoff({ status: "failed", detail: cause instanceof Error ? cause.message : "Falha ao consultar o atendimento." });
      } finally {
        polling = false;
      }
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [guildId, handoff.jobId, handoff.status]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    const token = getStoredSessionToken();
    if (!text || busy) return;
    if (!token || !guildId) { setError("Entre com Discord e selecione um servidor para pedir ajuda."); return; }
    setQuestion(""); setError(""); setBusy(true);
    try {
      if (handoff.status === "open" && handoff.jobId) {
        const result = await sendHumanSupportMessage({ data: { token, guildId, chatId: handoff.jobId, content: text } });
        setMessages((items) => [...items, { id: result.messageId, role: "user", content: text, at: Date.now(), delivery: "queued" }]);
        return;
      }
      const userMessage: ChatMessage = { role: "user", content: text };
      const pendingMessages = [...messages, userMessage].slice(-40);
      setMessages(pendingMessages);
      const activePage = chatPage ?? page.label;
      const activeContext = chatContext
        ? `Contexto salvo da conversa iniciada em ${chatPage ?? page.label}:\n${chatContext}\n\nEstado atual da página aberta (${page.label}):\n${context}`
        : context;
      const pageControls = getVisiblePageControls();
      const assistantControls = [
        showHistory
          ? "O chat está mostrando a lista de conversas anteriores; os botões disponíveis são “Voltar para a conversa” e “Fechar ajuda”."
          : `O chat tem os botões “Ver conversas anteriores” e “Fechar ajuda”${messages.length || handoff.status === "closed" ? ", além de “Iniciar nova conversa”" : ""}.`,
        messages.some((message) => message.role === "assistant") && ["idle", "failed", "requesting"].includes(handoff.status)
          ? "O botão “Não resolveu? Falar com humano” está disponível após a resposta da IA." : "",
        handoff.status === "open" ? "O atendimento humano está aberto: mensagens enviadas aqui são encaminhadas à equipe pelo tópico do fórum." : "",
        handoff.status === "closed" ? "O atendimento humano foi encerrado: o usuário pode avaliá-lo ou iniciar uma nova conversa." : "",
        `Campo de mensagem: ${handoff.status === "open" ? "escrever para a equipe" : "perguntar à IA"}; Enter envia e Shift+Enter quebra linha.`,
      ].filter(Boolean).join("\n");
      const answer = await askWumpusAssistant({
        data: {
          token,
          guildId,
          page: activePage,
          question: text,
          context: [
            activeContext,
            `Interface atualmente aberta (${page.label}):\n${pageControls || "Não foi possível ler os controles visíveis."}`,
            `Controles e estado deste chat:\n${assistantControls}`,
          ].join("\n\n").slice(0, 16000),
          history: messages.slice(-39).map(({ role, content }) => ({ role, content })),
        },
      });
      const nextMessages = [...pendingMessages, { role: "assistant" as const, content: answer.ok ? answer.text : answer.error }].slice(-40);
      setMessages(nextMessages);
      const saved = await saveAssistantChat({
        data: {
          token,
          guildId,
          chatId,
          page: activePage,
          context: chatContext ?? context,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        },
      });
      setChatId(saved.chatId);
      setChatPage(activePage);
      setChatContext(chatContext ?? context);
      setPastChats((items) => [
        { id: saved.chatId, page: activePage, title: nextMessages.find((message) => message.role === "user")?.content.slice(0, 90) ?? "Conversa sem título", updatedAt: Date.now(), kind: "assistant" as const },
        ...items.filter((item) => item.id !== saved.chatId),
      ].slice(0, 25));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar a pergunta.");
    } finally { setBusy(false); }
  };

  const requestHandoff = async () => {
    const token = getStoredSessionToken();
    if (!token || !guildId || !messages.some((message) => message.role === "assistant")) {
      setHandoff({ status: "failed", detail: "Converse com a ajuda do Wumpus antes de pedir atendimento humano." });
      return;
    }
    setHandoff({ status: "requesting" });
    try {
      const result = await requestHumanSupport({
        data: {
          token,
          guildId,
          page: chatPage ?? page.label,
          messages: messages.slice(-12).map((message) => ({ role: message.role, content: message.content.slice(0, 1200) })),
        },
      });
      window.localStorage.setItem(`wumpus-human-support:${guildId}`, result.jobId);
      setHandoff({ status: "queued", jobId: result.jobId, guildId, detail: "Seu pedido foi enviado. Em breve uma pessoa da equipe entrará em contato por aqui." });
    } catch (cause) {
      setHandoff({
        status: "failed",
        detail: cause instanceof Error ? cause.message : "Não foi possível encaminhar a conversa.",
      });
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setChatId(undefined);
    setChatPage(undefined);
    setChatContext(undefined);
    setQuestion("");
    setError("");
    setHandoff({ status: "idle" });
    setShowHistory(false);
    if (guildId) window.localStorage.removeItem(`wumpus-human-support:${guildId}`);
  };

  const openPastChat = async (entry: PastChat) => {
    const token = getStoredSessionToken();
    if (!token || !guildId) return;
    setHistoryBusy(true);
    setError("");
    try {
      if (entry.kind === "assistant") {
        const chat = await loadAssistantChat({ data: { token, guildId, chatId: entry.id } });
        setChatId(chat.id);
        setChatPage(chat.page);
        setChatContext(chat.context);
        setMessages(chat.messages);
        setHandoff({ status: "idle" });
      } else {
        const result = await getHumanSupportStatus({ data: { token, guildId, jobId: entry.id } });
        setChatId(undefined);
        setChatPage(entry.page);
        setChatContext(undefined);
        setMessages(result.messages ?? []);
        setHandoff({
          status: result.status === "failed" ? "failed" : result.status === "closed" ? "closed" : result.status === "open" ? "open" : "queued",
          guildId,
          jobId: entry.id,
          detail: result.detail ?? (result.status === "closed" ? "Este atendimento foi encerrado." : result.status === "failed" ? "Não foi possível criar o tópico do atendimento." : "Em breve uma pessoa da equipe entrará em contato por aqui."),
          threadUrl: result.channelId ? `https://discord.com/channels/${result.channelGuildId ?? guildId}/${result.channelId}` : undefined,
          rating: result.rating,
        });
        window.localStorage.setItem(`wumpus-human-support:${guildId}`, entry.id);
      }
      setShowHistory(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir essa conversa.");
    } finally {
      setHistoryBusy(false);
    }
  };

  const submitRating = async (rating: number) => {
    const token = getStoredSessionToken();
    if (!token || !guildId || !handoff.jobId || handoff.status !== "closed" || handoff.rating) return;
    setBusy(true);
    setError("");
    try {
      await rateHumanSupport({ data: { token, guildId, chatId: handoff.jobId, rating } });
      setHandoff((current) => ({ ...current, rating }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar a avaliação.");
    } finally {
      setBusy(false);
    }
  };

  return <>
    {open ? <section aria-label="Ajuda do Wumpus" className="fixed bottom-[5.5rem] right-4 z-40 flex h-[min(70vh,36rem)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-[0_18px_60px_-18px_rgb(0_0_0/0.65)] sm:bottom-24 sm:right-6">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        {showHistory ? (
          <button type="button" onClick={() => setShowHistory(false)} aria-label="Voltar para a conversa" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronLeft className="size-4" /></button>
        ) : (
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="size-4" /></span>
        )}
        <div className="min-w-0 flex-1"><h2 className="m-0 text-sm font-semibold">{handoff.status === "open" || handoff.status === "closed" ? "Atendimento humano" : "Ajuda do Wumpus"}</h2><p className="m-0 truncate text-xs text-muted-foreground">{chatPage ?? page.label} · {guild?.name ?? "seu servidor"}</p></div>
        {!showHistory ? <>
          <button type="button" onClick={() => setShowHistory(true)} aria-label="Ver conversas anteriores" title="Conversas anteriores" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronLeft className="size-4" /></button>
          {(messages.length > 0 || handoff.status === "closed") ? <button type="button" onClick={startNewChat} aria-label="Iniciar nova conversa" title="Nova conversa" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><Plus className="size-4" /></button> : null}
        </> : null}
        <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Fechar ajuda"><X className="size-4" /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {showHistory ? <div className="space-y-2">
          <h3 className="mb-3 mt-0 text-sm font-semibold">Conversas anteriores</h3>
          {historyBusy ? <p className="text-sm text-muted-foreground">Carregando conversas…</p> : null}
          {!pastChats.length && !historyBusy ? <p className="text-sm text-muted-foreground">Suas conversas anteriores aparecerão aqui.</p> : null}
          {pastChats.map((entry) => <button key={`${entry.kind}:${entry.id}`} type="button" onClick={() => void openPastChat(entry)} className="w-full rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted">
            <span className="block truncate text-sm font-medium">{entry.title}</span>
            <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{entry.kind === "support" ? "Atendimento humano" : entry.page}</span>
              <span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(entry.updatedAt)}</span>
            </span>
          </button>)}
        </div> : !messages.length ? <div className="space-y-3">
          <p className="m-0 text-sm leading-6">Posso explicar esta tela e ajudar com as configurações de <strong>{page.label.toLocaleLowerCase("pt-BR")}</strong>. Já tenho o contexto do servidor e desta seção.</p>
          <div className="flex flex-wrap gap-2">{["O que devo configurar primeiro?", "Explique essas opções", "Como resolvo um problema aqui?"].map((suggestion) => <button key={suggestion} type="button" onClick={() => setQuestion(suggestion)} className="rounded-xl border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{suggestion}</button>)}</div>
        </div> : messages.map((message, index) => <div key={message.id ?? `${index}-${message.role}`} className={`max-w-[92%] rounded-2xl px-3 py-2.5 text-sm leading-6 ${message.role === "user" ? "ml-auto whitespace-pre-wrap rounded-br-md bg-primary text-primary-foreground" : message.role === "staff" ? "rounded-bl-md bg-secondary text-foreground" : "rounded-bl-md bg-muted text-foreground"}`}>
          {message.role === "staff" ? <p className="mb-1 mt-0 text-xs font-semibold text-primary">Equipe de atendimento</p> : null}
          {message.role === "assistant" || message.role === "staff" ? <MarkdownContent content={message.content} /> : message.content}
          {message.delivery === "queued" ? <span className="mt-1 block text-[11px] opacity-70">Enviando para a equipe…</span> : null}
          {message.delivery === "failed" ? <span className="mt-1 block text-[11px] text-destructive">Não foi possível enviar ao atendimento.</span> : null}
        </div>)}
        {busy ? <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Entendendo o contexto…</p> : null}
        {error ? <p role="alert" className="m-0 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        {!showHistory && messages.some((message) => message.role === "assistant") ? (
          <div className="space-y-2 border-t border-border pt-3">
            {handoff.status === "queued" || handoff.status === "requesting" ? (
              <p role="status" className="m-0 rounded-lg bg-muted px-3 py-2 text-sm">{handoff.detail ?? "Seu pedido está chegando à equipe."}</p>
            ) : null}
            {handoff.status === "open" && handoff.threadUrl ? (
              <>
                <p role="status" className="m-0 rounded-lg bg-muted px-3 py-2 text-sm">Em breve uma pessoa da equipe entrará em contato com você por aqui. As mensagens que você enviar neste chat serão encaminhadas ao tópico do fórum.</p>
                <a href={handoff.threadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-2">
                  Ver tópico no fórum <ExternalLink className="size-3.5" />
                </a>
              </>
            ) : null}
            {handoff.status === "closed" ? (
              <section className="space-y-3 rounded-xl border border-border bg-background px-3.5 py-3.5" aria-labelledby="support-rating-title">
                {handoff.rating ? (
                  <>
                    <div>
                      <h3 id="support-rating-title" className="m-0 text-sm font-semibold">Obrigado pelo feedback!</h3>
                      <p className="mb-0 mt-1 text-xs text-muted-foreground">Sua avaliação ajuda a equipe a melhorar o atendimento.</p>
                    </div>
                    <div className="flex items-center gap-2" aria-label={`Você avaliou o atendimento com ${handoff.rating} de 5 estrelas`}>
                      <span className="text-lg leading-none tracking-[0.12em] text-amber-500">{"★".repeat(handoff.rating)}<span className="text-muted-foreground/40">{"★".repeat(5 - handoff.rating)}</span></span>
                      <span className="text-xs font-medium text-foreground">{["", "Muito ruim", "Ruim", "Regular", "Bom", "Excelente"][handoff.rating]}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h3 id="support-rating-title" className="m-0 text-sm font-semibold">Como foi seu atendimento?</h3>
                      <p className="mb-0 mt-1 text-xs leading-5 text-muted-foreground">Sua opinião ajuda a equipe a oferecer um suporte melhor.</p>
                    </div>
                    <div className="flex justify-between gap-1" role="group" aria-label="Avalie seu atendimento de uma a cinco estrelas">
                      {[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" onClick={() => void submitRating(rating)} disabled={busy} aria-label={`${rating} estrelas — ${["", "Muito ruim", "Ruim", "Regular", "Bom", "Excelente"][rating]}`} className="group flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-lg border border-transparent px-1 py-2 text-muted-foreground transition-colors hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60">
                        <span aria-hidden="true" className="text-2xl leading-none text-amber-500 transition-transform group-hover:scale-110">★</span>
                        <span className="text-[10px] font-medium leading-none text-muted-foreground group-hover:text-foreground">{rating}</span>
                      </button>)}
                    </div>
                    <div className="flex justify-between px-1 text-[11px] text-muted-foreground">
                      <span>Muito ruim</span><span>Excelente</span>
                    </div>
                    {busy ? <p role="status" className="m-0 text-xs text-muted-foreground">Enviando sua avaliação…</p> : null}
                  </>
                )}
              </section>
            ) : null}
            {handoff.status === "idle" || handoff.status === "failed" || handoff.status === "requesting" ? (
              <>
                {handoff.status === "failed" && handoff.detail ? <p role="alert" className="m-0 text-xs text-destructive">{handoff.detail}</p> : null}
                <Button type="button" variant="outline" size="sm" onClick={() => void requestHandoff()} disabled={handoff.status === "requesting"} className="w-full">
                  {handoff.status === "requesting" ? <LoaderCircle className="size-4 animate-spin" /> : <Headset className="size-4" />}
                  {handoff.status === "failed" ? "Tentar encaminhar novamente" : "Não resolveu? Falar com humano"}
                </Button>
                <p className="m-0 text-xs text-muted-foreground">A conversa será compartilhada com a equipe no fórum de suporte.</p>
              </>
            ) : null}
            {handoff.status === "closed" ? <Button type="button" size="sm" variant="outline" onClick={startNewChat} className="w-full">Iniciar nova conversa</Button> : null}
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      {!showHistory ? <form onSubmit={(event) => void send(event)} className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-input bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
          <textarea ref={inputRef} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={2} maxLength={2000} aria-label={handoff.status === "open" ? "Mensagem para o atendimento humano" : "Sua pergunta"} placeholder={handoff.status === "open" ? "Escreva para a equipe de atendimento…" : "Descreva o que você quer fazer…"} disabled={handoff.status === "queued" || handoff.status === "closed" || handoff.status === "requesting"} className="max-h-28 min-h-10 min-w-0 flex-1 resize-y bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60" />
          <Button type="submit" size="icon" aria-label={handoff.status === "open" ? "Enviar mensagem ao atendimento" : "Enviar pergunta"} disabled={!question.trim() || busy || handoff.status === "queued" || handoff.status === "closed" || handoff.status === "requesting"}><Send className="size-4" /></Button>
        </div>
        <p className="mb-0 mt-2 text-[11px] text-muted-foreground">{handoff.status === "open" ? "Sua mensagem será enviada à equipe pelo tópico do fórum." : "A IA orienta usando a seção e as configurações atuais. Ela não altera nada."}</p>
      </form> : null}
    </section> : null}
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Fechar ajuda do Wumpus" : "Pedir ajuda à IA"} title="Pedir ajuda à IA" className="fixed bottom-4 right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_8px_28px_-10px_rgb(0_0_0/0.65)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:bottom-6 sm:right-6">
      {open ? <X className="size-4" /> : <MessageCircle className="size-4" />}<span>{open ? "Fechar" : "Ajuda com IA"}</span>
    </button>
  </>;
}
