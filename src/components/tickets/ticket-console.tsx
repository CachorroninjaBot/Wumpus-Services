import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Clock,
  ExternalLink,
  Inbox,
  LoaderCircle,
  RefreshCw,
  Search,
  Send,
  StickyNote,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { getGuildTicketMessages, getGuildTickets, getTicketActionStatus, requestTicketAction } from "@/lib/wumpus/runtime-store";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import { useModule, useWumpus } from "@/lib/wumpus/store";
import { slaState } from "@/bot/tickets-sla";
import { cn, formatRelative, formatTime } from "@/lib/utils";
import type { TicketPriority } from "@/lib/wumpus/types";

type TicketRow = Awaited<ReturnType<typeof getGuildTickets>>[number];
type TicketMessage = Awaited<ReturnType<typeof getGuildTicketMessages>>["messages"][number];
type ActionName = "claim" | "reply" | "note" | "close" | "priority" | "transfer" | "waiting_user" | "waiting_staff" | "resume";

const statusLabel: Record<string, string> = {
  open: "Aberto",
  claimed: "Em atendimento",
  closed: "Encerrado",
};

const priorityLabel: Record<TicketPriority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

const priorityTone: Record<TicketPriority, "default" | "info" | "warn" | "danger"> = {
  low: "default",
  normal: "info",
  high: "warn",
  urgent: "danger",
};

function statusTone(status: string) {
  return status === "open" ? "ok" as const : status === "claimed" ? "info" as const : "default" as const;
}

/** Aguarda o bot processar o pedido da fila; sem isso a tela recarregaria antes do efeito. */
async function waitForTicketJob(token: string, guildId: string, jobId: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const result = await getTicketActionStatus({ data: { token, guildId, jobId } });
    if (result.status !== "queued") return result;
  }
  return { status: "queued" as const, detail: "O bot ainda não confirmou. Atualize em instantes." };
}

export function TicketConsole({ guildId, initialTicket }: { guildId: string; initialTicket?: number }) {
  const sessionUser = useWumpus((state) => state.sessionUser);
  const ticketsConfig = useModule("tickets");
  const slaMinutes = Number(ticketsConfig.config.slaWarningMinutes ?? 0);

  const [rows, setRows] = useState<TicketRow[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "info" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState<ActionName | null>(null);

  const [reply, setReply] = useState("");
  const [showClose, setShowClose] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [showTransfer, setShowTransfer] = useState(false);
  const [staffId, setStaffId] = useState("");

  const selectedIdRef = useRef<number | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const selected = rows.find((row) => row.number === selectedId) ?? null;
  const visibleRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return rows
      .filter((row) =>
        statusFilter === "all" ||
        (statusFilter === "active" ? row.status !== "closed" : row.status === statusFilter),
      )
      .filter((row) => !needle || `#${row.number} ${row.subject} ${row.department} ${row.openerName ?? ""}`.toLocaleLowerCase("pt-BR").includes(needle));
  }, [query, rows, statusFilter]);

  const loadMessages = useCallback(async (ticketId: number) => {
    const token = getStoredSessionToken();
    if (!token) return;
    setLoadingMessages(true);
    try {
      const result = await getGuildTicketMessages({ data: { token, guildId, ticketId, limit: 500 } });
      if (selectedIdRef.current === ticketId) setMessages(result.messages);
    } catch (error) {
      if (selectedIdRef.current === ticketId) {
        setMessages([]);
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível carregar a conversa." });
      }
    } finally {
      if (selectedIdRef.current === ticketId) setLoadingMessages(false);
    }
  }, [guildId]);

  const refresh = useCallback(async () => {
    const token = getStoredSessionToken();
    if (!token) {
      setLoadError("Entre com Discord para acompanhar os atendimentos.");
      setRows([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getGuildTickets({ data: { token, guildId, limit: 500 } });
      setRows(result);
      setSelectedId((current) => {
        if (current && result.some((row) => row.number === current)) return current;
        if (initialTicket && result.some((row) => row.number === initialTicket)) return initialTicket;
        const firstOpen = result.find((row) => row.status !== "closed") ?? result[0];
        return firstOpen?.number ?? null;
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível carregar os atendimentos.");
    } finally {
      setLoading(false);
    }
  }, [guildId, initialTicket]);

  useEffect(() => {
    setRows([]);
    setMessages([]);
    setSelectedId(null);
    setNotice(null);
    setLoadError(null);
    void refresh();
  }, [guildId, refresh]);

  useEffect(() => {
    if (selectedId === null) {
      setMessages([]);
      return;
    }
    setReply("");
    setShowClose(false);
    setCloseReason("");
    setShowTransfer(false);
    setStaffId("");
    void loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  async function runAction(action: ActionName, extra: { content?: string; reason?: string; targetStaffId?: string; priority?: TicketPriority } = {}): Promise<boolean> {
    if (!selected) return false;
    const token = getStoredSessionToken();
    if (!token) {
      setNotice({ tone: "error", text: "Entre com Discord para agir sobre o atendimento." });
      return false;
    }
    setPending(action);
    setNotice(null);
    try {
      const { jobId } = await requestTicketAction({
        data: {
          token,
          guildId,
          ticketId: selected.number,
          actorId: sessionUser.id,
          action,
          ...(extra.content ? { content: extra.content } : {}),
          ...(extra.reason ? { reason: extra.reason } : {}),
          ...(extra.targetStaffId ? { targetStaffId: extra.targetStaffId } : {}),
          ...(extra.priority ? { priority: extra.priority } : {}),
        },
      });
      const result = await waitForTicketJob(token, guildId, jobId);
      if (result.status === "done") {
        setNotice({ tone: "ok", text: result.detail ?? "Ação aplicada no Discord." });
      } else if (result.status === "failed") {
        setNotice({ tone: "error", text: result.detail ?? "O bot recusou a ação." });
      } else if (result.status === "missing") {
        setNotice({ tone: "error", text: "O pedido saiu da fila antes do bot processar. Tente de novo." });
      } else {
        setNotice({ tone: "info", text: result.detail ?? "Pedido enviado; o bot vai confirmar em instantes." });
      }
      await refresh();
      if (selectedIdRef.current === selected.number) await loadMessages(selected.number);
      return result.status === "done";
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível enviar a ação." });
      return false;
    } finally {
      setPending(null);
    }
  }

  function submitReply(kind: "reply" | "note") {
    const content = reply.trim();
    if (!content) return;
    void runAction(kind, { content }).then((ok) => {
      if (ok) setReply("");
    });
  }

  const sla = selected
    ? slaState({
        id: selected.number,
        status: selected.status,
        createdAt: new Date(selected.createdAt).toISOString(),
        firstResponseAt: selected.firstResponseAt ? new Date(selected.firstResponseAt).toISOString() : null,
      }, slaMinutes)
    : "ok";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-semibold tracking-tight">Central de atendimento</h2>
          <p className="m-0 mt-1 max-w-2xl text-sm text-muted-foreground">
            Acompanhe as conversas reais, responda, assuma e encerre sem sair do painel. O canal do Discord continua sendo a fonte da verdade.
          </p>
        </div>
        <Button variant="outline" disabled={loading} onClick={() => void refresh()}>
          <RefreshCw aria-hidden="true" className={cn("size-4", loading && "animate-spin")} />
          {loading ? "Atualizando…" : "Atualizar"}
        </Button>
      </div>

      {loadError ? <Notice tone="warning">{loadError}</Notice> : null}
      {notice ? (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "m-0 rounded-lg px-3 py-2 text-sm",
            notice.tone === "ok" && "bg-ok/10 text-ok",
            notice.tone === "info" && "bg-muted text-foreground",
            notice.tone === "error" && "bg-destructive/10 text-destructive",
          )}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,.82fr)_minmax(0,1.6fr)]">
        <Card className="space-y-3 p-0">
          <div className="space-y-2 border-b border-border p-3">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar atendimentos"
                className="pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por número, assunto ou pessoa"
              />
            </div>
            <NativeSelect aria-label="Filtrar por status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="active">Em andamento</option>
              <option value="open">Aguardando equipe</option>
              <option value="claimed">Em atendimento</option>
              <option value="closed">Encerrados</option>
              <option value="all">Todos</option>
            </NativeSelect>
          </div>

          {visibleRows.length === 0 ? (
            <EmptyState
              className="py-6"
              icon={<Inbox aria-hidden="true" className="size-7 text-muted-foreground" />}
              title={loading ? "Carregando…" : "Nenhum atendimento nesta vista"}
              description="Publique o painel no Discord ou ajuste o filtro para ver o histórico."
              variant="filtered"
            />
          ) : (
            <ul className="m-0 max-h-[34rem] divide-y divide-border overflow-y-auto p-0">
              {visibleRows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.number)}
                    aria-pressed={selectedId === row.number}
                    className={cn(
                      "flex w-full flex-col gap-1.5 px-3 py-3 text-left transition-colors",
                      selectedId === row.number ? "bg-primary/10" : "hover:bg-muted/50",
                    )}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="font-mono-num text-xs font-semibold text-muted-foreground">#{row.number}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.subject}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelative(row.createdAt)}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={statusTone(row.status)}>{statusLabel[row.status] ?? row.status}</Badge>
                      <Badge>{row.department}</Badge>
                      {row.priority !== "normal" ? <Badge tone={priorityTone[row.priority]}>{priorityLabel[row.priority]}</Badge> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected ? (
          <Card className="min-w-0 space-y-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono-num text-xs font-semibold text-muted-foreground">#{selected.number}</span>
                  <Badge tone={statusTone(selected.status)}>{statusLabel[selected.status] ?? selected.status}</Badge>
                  <Badge>{selected.department}</Badge>
                  <Badge tone={priorityTone[selected.priority]}>{priorityLabel[selected.priority]}</Badge>
                  {selected.status !== "closed" && sla !== "ok" ? (
                    <Badge tone="danger">{sla === "breach" ? "SLA crítico" : "SLA estourado"}</Badge>
                  ) : null}
                </div>
                <h3 className="m-0 mt-1 text-lg font-semibold tracking-tight">{selected.subject}</h3>
                <p className="m-0 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Solicitante:{" "}
                    <a className="text-primary hover:underline" href={`https://discord.com/users/${selected.openerId}`} target="_blank" rel="noreferrer">
                      {selected.openerName ?? selected.openerId}
                    </a>
                  </span>
                  <span>Aberto {formatTime(selected.createdAt)}</span>
                  {selected.claimedBy ? <span>Responsável: {selected.claimedBy}</span> : <span>Sem responsável</span>}
                  {selected.firstResponseAt ? <span>1ª resposta {formatRelative(selected.firstResponseAt)}</span> : null}
                </p>
              </div>
              <a
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-primary hover:underline"
                href={`https://discord.com/channels/${guildId}/${selected.channelId}`}
                target="_blank"
                rel="noreferrer"
              >
                Abrir no Discord <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            </header>

            {selected.status === "closed" ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span>Encerrado {selected.closedAt ? formatTime(selected.closedAt) : "—"}</span>
                {selected.closeReason ? <span>Motivo: {selected.closeReason}</span> : null}
                <span>{selected.feedback ? `Avaliação: ${selected.feedback.rating}/5` : "Sem avaliação"}</span>
                {selected.transcriptUrl ? (
                  <a className="text-primary hover:underline" href={selected.transcriptUrl} target="_blank" rel="noreferrer">Ver transcrição externa</a>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {!selected.claimedBy ? (
                    <Button size="sm" disabled={pending !== null} onClick={() => void runAction("claim")}>
                      {pending === "claim" ? <LoaderCircle className="size-4 animate-spin" /> : <UserCheck className="size-4" />}
                      Assumir
                    </Button>
                  ) : (
                    <Badge tone="ok" icon={<Check />}>Assumido</Badge>
                  )}
                  <Button size="sm" variant="outline" disabled={pending !== null} onClick={() => setShowTransfer((value) => !value)}>
                    <ArrowUpRight className="size-4" /> Transferir
                  </Button>
                  <Button size="sm" variant={selected.waitingOn === "user" ? "secondary" : "outline"} disabled={pending !== null} onClick={() => void runAction("waiting_user")}>
                    <Clock className="size-4" /> Aguardando usuário
                  </Button>
                  <Button size="sm" variant={selected.waitingOn === "staff" ? "secondary" : "outline"} disabled={pending !== null} onClick={() => void runAction("waiting_staff")}>
                    <Clock className="size-4" /> Aguardando equipe
                  </Button>
                  {selected.waitingOn ? (
                    <Button size="sm" variant="ghost" disabled={pending !== null} onClick={() => void runAction("resume")}>
                      Retomar
                    </Button>
                  ) : null}
                  <Button size="sm" variant="destructive" className="ml-auto" disabled={pending !== null} onClick={() => setShowClose((value) => !value)}>
                    Fechar atendimento
                  </Button>
                </div>

                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem]">
                  <div className="space-y-1">
                    <Label htmlFor="ticket-priority">Prioridade</Label>
                    <NativeSelect
                      id="ticket-priority"
                      value={selected.priority}
                      disabled={pending !== null}
                      onChange={(event) => void runAction("priority", { priority: event.target.value as TicketPriority })}
                    >
                      {(Object.keys(priorityLabel) as TicketPriority[]).map((priority) => (
                        <option key={priority} value={priority}>{priorityLabel[priority]}</option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="flex items-end text-xs text-muted-foreground">
                    {selected.waitingOn === "user" ? "Aguardando o solicitante responder." : selected.waitingOn === "staff" ? "Aguardando a equipe responder." : "Em atendimento normal."}
                  </div>
                </div>

                {showTransfer ? (
                  <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                    <Label htmlFor="ticket-transfer-id">ID de quem vai assumir</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id="ticket-transfer-id"
                        value={staffId}
                        onChange={(event) => setStaffId(event.target.value)}
                        placeholder="Ex.: 123456789012345678"
                        inputMode="numeric"
                      />
                      <Button
                        disabled={pending !== null || !/^\d{17,20}$/.test(staffId.trim())}
                        onClick={() => void runAction("transfer", { targetStaffId: staffId.trim() }).then((ok) => {
                          if (!ok) return;
                          setShowTransfer(false);
                          setStaffId("");
                        })}
                      >
                        {pending === "transfer" ? <LoaderCircle className="size-4 animate-spin" /> : "Transferir"}
                      </Button>
                    </div>
                    <p className="m-0 text-xs text-muted-foreground">O bot valida se a pessoa tem um cargo de atendimento antes de transferir.</p>
                  </div>
                ) : null}

                {showClose ? (
                  <div className="space-y-2 rounded-lg bg-destructive/5 p-3">
                    <Label htmlFor="ticket-close-reason">Motivo (opcional)</Label>
                    <Textarea
                      id="ticket-close-reason"
                      rows={2}
                      maxLength={500}
                      value={closeReason}
                      onChange={(event) => setCloseReason(event.target.value)}
                      placeholder="Ex.: dúvida resolvida, pedido entregue…"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="destructive"
                        disabled={pending !== null}
                        onClick={() => void runAction("close", closeReason.trim() ? { reason: closeReason.trim() } : {}).then((ok) => {
                          if (!ok) return;
                          setShowClose(false);
                          setCloseReason("");
                        })}
                      >
                        {pending === "close" ? <LoaderCircle className="size-4 animate-spin" /> : "Confirmar encerramento"}
                      </Button>
                      <Button variant="ghost" disabled={pending !== null} onClick={() => setShowClose(false)}>Cancelar</Button>
                    </div>
                    <p className="m-0 text-xs text-muted-foreground">O canal será apagado e a transcrição fica salva para a equipe.</p>
                  </div>
                ) : null}
              </div>
            )}

            <section aria-label="Conversa do atendimento" className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="m-0 text-sm font-semibold">Conversa</h4>
                <span className="text-xs text-muted-foreground">{loadingMessages ? "Carregando…" : `${messages.length} mensagem(ns)`}</span>
              </div>
              <div className="max-h-[26rem] space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3">
                {loadingMessages ? (
                  <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Buscando a conversa…</p>
                ) : messages.length === 0 ? (
                  <p className="m-0 text-sm text-muted-foreground">Nenhuma mensagem registrada ainda.</p>
                ) : (
                  messages.map((message) => {
                    const internal = message.kind === "internal";
                    const fromOpener = message.authorId === selected.openerId;
                    return (
                      <article
                        key={message.id}
                        className={cn(
                          "rounded-lg border px-3 py-2",
                          internal ? "border-warn/30 bg-warn/5" : fromOpener ? "border-border bg-card" : "border-primary/20 bg-primary/5",
                        )}
                      >
                        <header className="flex flex-wrap items-center gap-2 text-xs">
                          <strong className="text-sm text-foreground">{message.authorName}</strong>
                          {fromOpener ? <Badge tone="info">Solicitante</Badge> : null}
                          {internal ? <Badge tone="warn" icon={<StickyNote />}>Nota interna</Badge> : null}
                          <time className="ml-auto text-muted-foreground">{formatTime(message.at)}</time>
                        </header>
                        <p className="m-0 mt-1 whitespace-pre-wrap break-words text-sm">{message.content}</p>
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            {selected.status === "closed" ? (
              selected.transcript ? (
                <details className="rounded-xl border border-border p-3">
                  <summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Ver transcrição salva</summary>
                  <pre className="m-0 mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 text-xs">{selected.transcript}</pre>
                </details>
              ) : null
            ) : (
              <div className="space-y-2">
                <Label htmlFor="ticket-reply">Resposta da equipe</Label>
                <Textarea
                  id="ticket-reply"
                  rows={3}
                  maxLength={2000}
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      event.preventDefault();
                      submitReply("reply");
                    }
                  }}
                  placeholder="Escreva a resposta que será enviada no canal do atendimento…"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button disabled={pending !== null || !reply.trim()} onClick={() => submitReply("reply")}>
                    {pending === "reply" ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Responder
                  </Button>
                  <Button variant="outline" disabled={pending !== null || !reply.trim()} onClick={() => submitReply("note")}>
                    {pending === "note" ? <LoaderCircle className="size-4 animate-spin" /> : <StickyNote className="size-4" />}
                    Salvar nota interna
                  </Button>
                  <span className="ml-auto text-xs text-muted-foreground">{reply.length}/2000</span>
                </div>
                <p className="m-0 text-xs text-muted-foreground">Ctrl+Enter envia a resposta. Notas internas ficam no histórico, mas não aparecem para o solicitante.</p>
              </div>
            )}
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={<Inbox aria-hidden="true" className="size-8 text-muted-foreground" />}
              title="Selecione um atendimento"
              description="Escolha uma conversa na lista para ver o histórico e agir sem sair do painel."
            />
          </Card>
        )}
      </div>
    </div>
  );
}
