import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MemberAvatar } from "@/components/brand";
import { DiscordPanel } from "@/components/discord-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDesc, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { analyzeWithGrok } from "@/lib/wumpus/analyze";
import { asList, asString, planAllows, searchArticles, shouldAutoClose, ticketSla, type SlaState } from "@/lib/wumpus/engine";
import { useActiveGuild, useGuildMembers, useModule, useWumpus } from "@/lib/wumpus/store";
import { getPublishStatus, type PublishStatus } from "@/lib/wumpus/runtime-store";
import type { Ticket, TicketPriority, TicketStatus } from "@/lib/wumpus/types";
import { cn, formatRelative, formatTime } from "@/lib/utils";

export const Route = createFileRoute("/app/tickets")({ component: TicketsPage });

const slaTone: Record<SlaState, "ok" | "warn" | "danger"> = {
  ok: "ok",
  warning: "warn",
  breach: "danger",
};

function TicketsPage() {
  const gid = useWumpus((s) => s.activeGuildId);
  const guild = useActiveGuild();
  const user = useWumpus((s) => s.sessionUser);
  const allTickets = useWumpus((s) => s.tickets);
  const tickets = allTickets.filter((t) => t.guildId === gid);
  const members = useGuildMembers();
  const tcfg = useModule("tickets");
  const updateConfig = useWumpus((s) => s.updateConfig);
  const setEnabled = useWumpus((s) => s.setModuleEnabled);
  const claim = useWumpus((s) => s.claimTicket);
  const close = useWumpus((s) => s.closeTicket);
  const archive = useWumpus((s) => s.archiveTicket);
  const reopen = useWumpus((s) => s.reopenTicket);
  const addMsg = useWumpus((s) => s.addTicketMessage);
  const setPri = useWumpus((s) => s.setTicketPriority);
  const setTags = useWumpus((s) => s.setTicketTags);
  const openTicket = useWumpus((s) => s.openTicket);
  const sweep = useWumpus((s) => s.sweepInactive);
  const publishPanel = useWumpus((s) => s.publishPanel);
  const articles = useWumpus((s) => s.articles);
  const kcfg = useModule("knowledge");
  const aiAllowed = planAllows(guild.plan, "ai") && Boolean(tcfg.config.aiSupportEnabled);
  const departments = (planAllows(guild.plan, "multiDepartment") ? asList(tcfg.config.departments) : asList(tcfg.config.departments).slice(0, 1));

  const [filter, setFilter] = useState<"active" | TicketStatus>("active");
  const [selectedId, setSelectedId] = useState<string | null>(tickets[0]?.id ?? null);
  const [reply, setReply] = useState("");
  const [settings, setSettings] = useState(false);
  const [compose, setCompose] = useState(false);
  const [ai, setAi] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pubBusy, setPubBusy] = useState(false);

  const list = useMemo(() => {
    return tickets
      .filter((t) => (filter === "active" ? t.status === "open" || t.status === "claimed" : t.status === filter))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [tickets, filter]);

  const ticket = tickets.find((t) => t.id === selectedId) ?? list[0] ?? null;
  const memberById = (id: string) => members.find((m) => m.id === id);

  async function runAi(t: Ticket) {
    setAiBusy(true);
    setAi(null);
    const transcript = t.messages.map((m) => `${m.kind}: ${m.content}`).join("\n");
    const related = kcfg.enabled
      ? searchArticles(`${t.subject}\n${transcript}`, articles.filter((a) => a.guildId === gid), Boolean(kcfg.config.requireApprovedArticles)).slice(0, 3)
      : [];
    const knowledge = related.map((a) => `${a.title}: ${a.body}`).join("\n");
    const res = await analyzeWithGrok({
      data: {
        kind: "ticket",
        title: `#${t.number} ${t.subject} (${t.department})`,
        body: transcript,
        extra: `SLA ${String(tcfg.config.slaWarningMinutes)} min. Prioridade ${t.priority}.${knowledge ? `\nBase do servidor:\n${knowledge}` : ""}`,
      },
    });
    setAiBusy(false);
    setAi(res.ok ? res.text : res.error);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto m-0 text-xl font-semibold tracking-tight">Atendimento</h1>
        <Button variant="outline" size="sm" onClick={() => setSettings(true)}>
          Painel e SLA
        </Button>
        <Button size="sm" variant="outline" onClick={() => {
          const r = sweep();
          setNotice(r.closed > 0 ? `${r.closed} atendimento(s) encerrado(s) por inatividade.` : r.error ?? "Nada ocioso.");
        }}>
          Fechar ociosos
        </Button>
        <Button size="sm" onClick={() => setCompose(true)}>
          Abrir ticket
        </Button>
      </div>

      {!tcfg.enabled ? (
        <p className="m-0 rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn">Atendimento pausado neste servidor.</p>
      ) : null}
      {notice ? <p className="m-0 rounded-xl bg-muted px-3 py-2 text-sm">{notice}</p> : null}
      {!planAllows(guild.plan, "ai") ? (
        <p className="m-0 text-sm text-muted-foreground">Plano Essencial não inclui IA. O Pro libera a análise para a equipe.</p>
      ) : null}
      {!planAllows(guild.plan, "transcripts") ? (
        <p className="m-0 text-sm text-muted-foreground">Transcrição no encerramento entra no Pro.</p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {(["active", "closed", "archived"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "h-9 rounded-full px-3 text-sm",
              filter === f ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {f === "active" ? "Abertos" : f === "closed" ? "Encerrados" : "Arquivo"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <Card className="max-h-[70vh] overflow-y-auto p-2">
          {list.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhum atendimento nesta vista.</p>
          ) : (
            list.map((t) => {
              const sla = ticketSla(t, tcfg.config);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(t.id);
                    setAi(null);
                  }}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left",
                    ticket?.id === t.id ? "bg-muted" : "hover:bg-muted/50",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    #{t.number}
                    <Badge tone={slaTone[sla]}>{t.priority}</Badge>
                    {shouldAutoClose(t, tcfg.config) ? <Badge tone="warn">ocioso</Badge> : null}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">{t.subject}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {t.department} · {formatRelative(t.createdAt)}
                  </span>
                </button>
              );
            })
          )}
        </Card>

        {ticket ? (
          <Card className="flex min-h-[70vh] flex-col p-0">
            <header className="border-b border-border px-4 py-3">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-xs text-muted-foreground">
                    #{ticket.number} · #{ticket.channelName}
                  </p>
                  <h2 className="mt-0.5 mb-0 text-lg font-semibold">{ticket.subject}</h2>
                </div>
                {tcfg.config.priorityEnabled ? (
                  <NativeSelect
                    className="h-9 w-auto"
                    value={ticket.priority}
                    onChange={(e) => setPri(ticket.id, e.target.value as TicketPriority)}
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
                {ticket.claimedBy ? <span>com {memberById(ticket.claimedBy)?.displayName}</span> : <span>sem dono</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {ticket.status === "open" || ticket.status === "claimed" ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => {
                      const r = claim(ticket.id, user.id);
                      setNotice(r.ok ? "Atendimento assumido." : r.error);
                    }}>
                      Assumir
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCloseOpen(true)}>
                      Encerrar
                    </Button>
                    {aiAllowed ? (
                      <Button size="sm" variant="ghost" disabled={aiBusy} onClick={() => void runAi(ticket)}>
                        {aiBusy ? "Analisando…" : "Analisar com IA"}
                      </Button>
                    ) : null}
                  </>
                ) : null}
                {ticket.status === "closed" ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => archive(ticket.id)}>
                      Arquivar
                    </Button>
                    {Boolean(tcfg.config.reopenEnabled) ? (
                      <Button size="sm" variant="outline" onClick={() => reopen(ticket.id)}>
                        Reabrir
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {ticket.messages.map((m) => {
                const who = m.kind === "system" ? null : memberById(m.authorId);
                return (
                  <div key={m.id} className="flex gap-2">
                    {who ? <MemberAvatar name={who.displayName} hue={who.hue} size={28} /> : <span className="size-7" />}
                    <div className="min-w-0">
                      <p className="m-0 text-[11px] text-muted-foreground">
                        {who?.displayName ?? "Sistema"} · {formatRelative(m.at)}
                      </p>
                      <p className="m-0 text-sm leading-relaxed">{m.content}</p>
                    </div>
                  </div>
                );
              })}
              {ai ? (
                <div className="rounded-xl bg-primary/10 px-3 py-2 text-sm whitespace-pre-wrap">{ai}</div>
              ) : null}
              {ticket.transcript && ticket.status !== "open" ? (
                <details className="rounded-xl bg-muted px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-medium">Transcrição</summary>
                  <pre className="mt-2 mb-0 overflow-x-auto whitespace-pre-wrap font-sans text-muted-foreground">
                    {ticket.transcript}
                  </pre>
                </details>
              ) : null}
              {ticket.feedback ? (
                <p className="m-0 text-sm">
                  Feedback: {ticket.feedback.rating}/5 — {ticket.feedback.comment}
                </p>
              ) : null}
            </div>

            {ticket.status === "open" || ticket.status === "claimed" ? (
              <form
                className="flex gap-2 border-t border-border p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!reply.trim()) return;
                  addMsg(ticket.id, user.id, reply.trim(), "staff");
                  setReply("");
                }}
              >
                <Input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Responder como staff…"
                />
                <Button type="submit">Enviar</Button>
              </form>
            ) : null}

            <div className="border-t border-border px-4 py-2">
              <Label>Tags</Label>
              <Input
                className="mt-1 h-9"
                defaultValue={ticket.tags.join(", ")}
                key={ticket.id}
                onBlur={(e) =>
                  setTags(
                    ticket.id,
                    e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  )
                }
              />
            </div>
          </Card>
        ) : (
          <Card className="grid min-h-64 place-items-center text-sm text-muted-foreground">
            Selecione um atendimento.
          </Card>
        )}
      </div>

      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogTitle>Painel e fluxo</DialogTitle>
          <DialogDesc>O que você muda aqui o bot usa na hora de abrir e fechar ticket.</DialogDesc>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Label>Atendimento ligado</Label>
              <Switch checked={tcfg.enabled} onCheckedChange={(v) => setEnabled("tickets", v)} />
            </div>
            <Field label="Título do painel">
              <Input
                defaultValue={asString(tcfg.config.panelTitle)}
                onBlur={(e) => updateConfig("tickets", { panelTitle: e.target.value })}
              />
            </Field>
            <Field label="Descrição">
              <Textarea
                defaultValue={asString(tcfg.config.panelDescription)}
                onBlur={(e) => updateConfig("tickets", { panelDescription: e.target.value })}
              />
            </Field>
            <Field label="Mensagem de boas-vindas">
              <Textarea
                defaultValue={asString(tcfg.config.welcomeMessage)}
                onBlur={(e) => updateConfig("tickets", { welcomeMessage: e.target.value })}
              />
            </Field>
            <Field label="Departamentos (vírgula)">
              <Input
                defaultValue={departments.join(", ")}
                onBlur={(e) =>
                  updateConfig("tickets", {
                    departments: e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>
            <Field label="Alerta de SLA (minutos)">
              <Input
                type="number"
                defaultValue={Number(tcfg.config.slaWarningMinutes ?? 60)}
                onBlur={(e) => updateConfig("tickets", { slaWarningMinutes: Number(e.target.value) || 0 })}
              />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <Label>Pedir feedback ao encerrar</Label>
              <Switch
                checked={Boolean(tcfg.config.feedbackEnabled)}
                onCheckedChange={(v) => updateConfig("tickets", { feedbackEnabled: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>IA de apoio à equipe</Label>
              <Switch
                checked={Boolean(tcfg.config.aiSupportEnabled)}
                onCheckedChange={(v) => updateConfig("tickets", { aiSupportEnabled: v })}
              />
            </div>
            <Field label="Inatividade até encerrar (horas, 0 desliga)">
              <Input
                type="number"
                defaultValue={Number(tcfg.config.autoCloseInactiveHours ?? 24)}
                onBlur={(e) => updateConfig("tickets", { autoCloseInactiveHours: Number(e.target.value) || 0 })}
              />
            </Field>
            <Button
              variant="outline"
              disabled={pubBusy}
              onClick={async () => {
                setPubBusy(true);
                publishPanel("tickets");

                // O bot processa a fila em ate 20s. Consulta algumas vezes
                // para mostrar o resultado REAL, em vez de "publicado" no
                // instante do clique — que era o defeito antigo.
                let last: PublishStatus | null = null;
                for (let attempt = 0; attempt < 10; attempt++) {
                  await new Promise((resolve) => setTimeout(resolve, 2000));
                  const rows = await getPublishStatus({ data: { guildId: gid } }).catch(() => []);
                  last = rows[rows.length - 1] ?? null;
                  if (last && last.status !== "queued") break;
                }

                setPubBusy(false);
                setNotice(
                  !last
                    ? "Pedido enviado. O bot publica em instantes."
                    : last.status === "done"
                      ? `Publicado no canal "${last.channelRef}".`
                      : `Não deu: ${last.detail ?? "motivo desconhecido"}`,
                );
              }}
            >
              {pubBusy ? "Publicando…" : "Publicar painel no Discord"}
            </Button>
            <DiscordPanel
              title={asString(tcfg.config.panelTitle)}
              description={asString(tcfg.config.panelDescription)}
              accent={asString(tcfg.config.panelAccentColor, "#7c5cff")}
              buttons={departments}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={compose} onOpenChange={setCompose}>
        <DialogContent>
          <DialogTitle>Simular abertura</DialogTitle>
          <DialogDesc>Como se o membro tivesse apertado o botão no Discord.</DialogDesc>
          <ComposeForm
            departments={departments}
            members={members}
            onCreate={(data) => {
              const res = openTicket(data);
              if (res.ok) {
                setSelectedId(res.id);
                setCompose(false);
              } else {
                alert(res.error);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogTitle>Encerrar atendimento</DialogTitle>
          <DialogDesc>A transcrição vai para o canal configurado. Opcional: registrar a nota do cliente.</DialogDesc>
          {tcfg.config.feedbackEnabled ? (
            <div className="mt-3 space-y-2">
              <Label>Nota</Label>
              <NativeSelect value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} / 5
                  </option>
                ))}
              </NativeSelect>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentário" />
            </div>
          ) : null}
          <Button
            className="mt-4 w-full"
            onClick={() => {
              if (!ticket) return;
              close(
                ticket.id,
                user.id,
                tcfg.config.feedbackEnabled ? { rating, comment } : undefined,
              );
              setCloseOpen(false);
            }}
          >
            Encerrar e gerar transcrição
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

function ComposeForm({
  departments,
  members,
  onCreate,
}: {
  departments: string[];
  members: ReturnType<typeof useGuildMembers>;
  onCreate: (d: { openerId: string; department: string; subject: string; body: string }) => void;
}) {
  const [openerId, setOpenerId] = useState(members.find((m) => !m.roleIds.includes("role_staff"))?.id ?? members[0]?.id);
  const [department, setDepartment] = useState(departments[0] ?? "Suporte");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!openerId || !subject.trim() || !body.trim()) return;
        onCreate({ openerId, department, subject: subject.trim(), body: body.trim() });
      }}
    >
      <Field label="Membro">
        <NativeSelect value={openerId} onChange={(e) => setOpenerId(e.target.value)}>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Departamento">
        <NativeSelect value={department} onChange={(e) => setDepartment(e.target.value)}>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Assunto">
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </Field>
      <Field label="Primeira mensagem">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} required />
      </Field>
      <Button type="submit" className="w-full">
        Abrir
      </Button>
    </form>
  );
}
