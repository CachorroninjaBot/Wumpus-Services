import { useRouterState } from "@tanstack/react-router";
import { LoaderCircle, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { askWumpusAssistant } from "@/lib/wumpus/assistant";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import { navItems } from "@/lib/wumpus/brand";
import type { ModuleKey } from "@/lib/wumpus/defaults";
import { useWumpus } from "@/lib/wumpus/store";

type ChatMessage = { role: "user" | "assistant"; content: string };
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
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const context = useMemo(() => {
    const relevant = Object.fromEntries((moduleContext[page.id] ?? []).flatMap((key) => modules?.[key] ? [[key, redact(modules[key])]] : []));
    return `Seção: ${page.label}. ${page.hint}\nConfiguração ativa (JSON): ${JSON.stringify(relevant).slice(0, 5600) || "Ainda sem configuração publicada."}`;
  }, [modules, page]);

  useEffect(() => { setMessages([]); setError(""); }, [pathname, guildId]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [messages, busy]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    const token = getStoredSessionToken();
    if (!text || busy) return;
    if (!token || !guildId) { setError("Entre com Discord e selecione um servidor para pedir ajuda."); return; }
    setQuestion(""); setError(""); setMessages((items) => [...items, { role: "user", content: text }]); setBusy(true);
    try {
      const conversation = messages.slice(-8).map((message) => `${message.role === "user" ? "Pessoa" : "Wumpus"}: ${message.content}`).join("\n");
      const contextualHistory = conversation ? `\n\nConversa de ajuda anterior:\n${conversation}` : "";
      const answer = await askWumpusAssistant({ data: { token, guildId, page: page.label, question: text, context: `${context}${contextualHistory}`.slice(0, 7000) } });
      setMessages((items) => [...items, { role: "assistant", content: answer.ok ? answer.text : answer.error }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar a pergunta.");
    } finally { setBusy(false); }
  };

  return <>
    {open ? <section aria-label="Ajuda do Wumpus" className="fixed bottom-[5.5rem] right-4 z-40 flex h-[min(70vh,36rem)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-[0_18px_60px_-18px_rgb(0_0_0/0.65)] sm:bottom-24 sm:right-6">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="size-4" /></span>
        <div className="min-w-0 flex-1"><h2 className="m-0 text-sm font-semibold">Ajuda do Wumpus</h2><p className="m-0 truncate text-xs text-muted-foreground">{page.label} · {guild?.name ?? "seu servidor"}</p></div>
        <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Fechar ajuda"><X className="size-4" /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {!messages.length ? <div className="space-y-3">
          <p className="m-0 text-sm leading-6">Posso explicar esta tela e ajudar com as configurações de <strong>{page.label.toLocaleLowerCase("pt-BR")}</strong>. Já tenho o contexto do servidor e desta seção.</p>
          <div className="flex flex-wrap gap-2">{["O que devo configurar primeiro?", "Explique essas opções", "Como resolvo um problema aqui?"].map((suggestion) => <button key={suggestion} type="button" onClick={() => setQuestion(suggestion)} className="rounded-xl border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{suggestion}</button>)}</div>
        </div> : messages.map((message, index) => <div key={`${index}-${message.role}`} className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2.5 text-sm leading-6 ${message.role === "user" ? "ml-auto rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground"}`}>{message.content}</div>)}
        {busy ? <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Entendendo o contexto…</p> : null}
        {error ? <p role="alert" className="m-0 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        <div ref={endRef} />
      </div>
      <form onSubmit={(event) => void send(event)} className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-input bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
          <textarea ref={inputRef} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={2} maxLength={2000} aria-label="Sua pergunta" placeholder="Descreva o que você quer fazer…" className="max-h-28 min-h-10 min-w-0 flex-1 resize-y bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground" />
          <Button type="submit" size="icon" aria-label="Enviar pergunta" disabled={!question.trim() || busy}><Send className="size-4" /></Button>
        </div>
        <p className="mb-0 mt-2 text-[11px] text-muted-foreground">A IA orienta usando a seção e as configurações atuais. Ela não altera nada.</p>
      </form>
    </section> : null}
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Fechar ajuda do Wumpus" : "Pedir ajuda à IA"} title="Pedir ajuda à IA" className="fixed bottom-4 right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_8px_28px_-10px_rgb(0_0_0/0.65)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:bottom-6 sm:right-6">
      {open ? <X className="size-4" /> : <MessageCircle className="size-4" />}<span>{open ? "Fechar" : "Ajuda com IA"}</span>
    </button>
  </>;
}
