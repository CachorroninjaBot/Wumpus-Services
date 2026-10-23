import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, AlertTriangle, RefreshCw, Search, Shield, UserRound, Users, Wallet } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { forceGuildResync, getAdminOverview, grantAdminAccess, manageAdminUser, revokeAdminGrant } from "@/lib/wumpus/admin";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import { useWumpus } from "@/lib/wumpus/store";
import { formatRelative } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type AdminOverview = Awaited<ReturnType<typeof getAdminOverview>>;
type TabId = "overview" | "users" | "subscriptions" | "security";
type Member = AdminOverview["members"][number];

const tabs: { id: TabId; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Visão geral", icon: Activity },
  { id: "users", label: "Usuários", icon: Users },
  { id: "subscriptions", label: "Assinaturas", icon: Wallet },
  { id: "security", label: "Segurança", icon: Shield },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível carregar a administração.";
}

function dateTime(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const date = new Date(typeof value === "number" ? value : value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function duration(start: number, end: number): string {
  const minutes = Math.max(0, Math.floor((end - start) / 60_000));
  if (minutes < 1) return "menos de 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} h ${remaining} min` : `${hours} h`;
}

function AdminPage() {
  const hydrate = useWumpus((s) => s.hydrate);
  const hydrated = useWumpus((s) => s.hydrated);
  const user = useWumpus((s) => s.sessionUser);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [grantPlan, setGrantPlan] = useState<"essencial" | "pro" | "escala">("essencial");
  const [grantDays, setGrantDays] = useState("30");
  const [grantReason, setGrantReason] = useState("");

  useEffect(() => { hydrate(); }, [hydrate]);

  async function refresh() {
    setError(null);
    try {
      setOverview(await getAdminOverview({ data: { token: getStoredSessionToken() } }));
    } catch (cause) { setError(errorMessage(cause)); }
  }

  useEffect(() => {
    if (hydrated && user.signedIn && user.isAdmin) void refresh();
  }, [hydrated, user.isAdmin, user.signedIn]);

  const selectedMember = overview?.members.find((member) => member.id === selectedId) ?? null;
  useEffect(() => { setNotes(selectedMember?.notes ?? ""); }, [selectedMember?.id, selectedMember?.notes]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return overview?.members ?? [];
    return (overview?.members ?? []).filter((member) => member.username.toLowerCase().includes(query) || member.id.includes(query));
  }, [overview?.members, search]);

  async function manage(member: Member, action: "suspend" | "restore" | "revoke-sessions" | "save-notes") {
    const label = action === "suspend" ? "suspend" : action === "restore" ? "restaurar" : action === "revoke-sessions" ? "encerrar as sessões de" : "atualizar os dados de";
    if (action !== "save-notes" && !window.confirm(`Deseja ${label} ${member.username}?`)) return;
    setBusy(`${action}:${member.id}`);
    setNotice(null);
    try {
      await manageAdminUser({ data: {
        token: getStoredSessionToken(), userId: member.id, action,
        ...(action === "save-notes" ? { notes } : {}),
        ...(action === "suspend" ? { reason: "Acesso suspenso pelo administrador." } : {}),
      } });
      setNotice(action === "suspend" ? "Conta suspensa e sessões encerradas." : action === "restore" ? "Acesso restaurado." : action === "revoke-sessions" ? "Sessões encerradas." : "Nota salva.");
      await refresh();
    } catch (cause) { setNotice(errorMessage(cause)); }
    finally { setBusy(null); }
  }

  async function resync(guildId: string, guildName: string) {
    setBusy(guildId); setNotice(null);
    try {
      const result = await forceGuildResync({ data: { token: getStoredSessionToken(), guildId } });
      setNotice(`${result.queued.length} painel(is) enviados para republicação em ${guildName}.`);
      await refresh();
    } catch (cause) { setNotice(errorMessage(cause)); }
    finally { setBusy(null); }
  }

  async function grantAccess(member: Member) {
    setBusy(`grant:${member.id}`); setNotice(null);
    try {
      const result = await grantAdminAccess({ data: {
        token: getStoredSessionToken(), userId: member.id, username: member.username,
        planId: grantPlan, durationDays: Number(grantDays), reason: grantReason,
      } });
      setNotice(`Acesso ${grantPlan} concedido até ${dateTime(result.expiresAt)}.`);
      setGrantReason("");
      await refresh();
    } catch (cause) { setNotice(errorMessage(cause)); }
    finally { setBusy(null); }
  }

  async function revokeGrant(grantId: string) {
    if (!window.confirm("Revogar esta concessão manual agora?")) return;
    setBusy(`grant-revoke:${grantId}`); setNotice(null);
    try {
      await revokeAdminGrant({ data: { token: getStoredSessionToken(), grantId } });
      setNotice("Concessão manual revogada.");
      await refresh();
    } catch (cause) { setNotice(errorMessage(cause)); }
    finally { setBusy(null); }
  }

  if (!hydrated) return <div className="grid min-h-dvh place-items-center text-muted-foreground">Carregando…</div>;

  if (!user.signedIn || !user.isAdmin) return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-sm space-y-4"><BrandMark /><div><h1 className="m-0 text-xl font-semibold">Área restrita</h1><p className="mt-1 text-sm text-muted-foreground">Entre com a conta Discord autorizada para acessar a administração da plataforma.</p></div><Link to="/entrar" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">Entrar com Discord</Link><Link to="/" className="block text-center text-sm text-muted-foreground">Voltar ao site</Link></Card>
    </main>
  );

  const activeSessions = overview?.sessions.filter((session) => !session.endedAt && !session.revokedAt && Date.now() - session.lastSeenAt < 2 * 60_000).length ?? 0;
  const activeSubscriptions = overview?.subscriptions.filter((sub) => ["active", "trialing", "paid", "authorized", "succeeded"].includes(sub.status.toLowerCase())).length ?? 0;

  return <div className="min-h-dvh bg-background text-foreground">
    <header className="flex h-14 items-center gap-3 border-b border-border px-4"><BrandMark size={28} /><strong>Administração</strong><Badge tone="primary">somente dono</Badge><Link to="/app" className="ml-auto text-sm text-muted-foreground hover:text-foreground">Painel</Link><Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Site</Link></header>
    <main className="mx-auto grid max-w-6xl gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><h1 className="m-0 text-2xl font-semibold tracking-tight">Centro de administração</h1><p className="mb-0 mt-2 text-sm text-muted-foreground">Acessos, assinaturas e segurança da plataforma em um só lugar.</p></div><Button variant="outline" onClick={() => void refresh()} disabled={busy === "refresh"}><RefreshCw className="mr-2 size-4" />Atualizar dados</Button></div>
      {notice ? <Card role="status" className="p-3 text-sm">{notice}</Card> : null}
      {error ? <Card className="border-destructive/40 bg-destructive/5"><h2 className="m-0 text-lg font-semibold">Acesso administrativo indisponível</h2><p className="mb-0 mt-2 text-sm text-muted-foreground">{error}</p><p className="mb-0 mt-2 text-sm text-muted-foreground">A administração exige login pela conta proprietária e autenticação de dois fatores ativa no Discord.</p><Button className="mt-4" variant="outline" onClick={() => void refresh()}>Tentar novamente</Button></Card> : null}
      {!overview && !error ? <Card role="status" className="text-sm text-muted-foreground">Carregando dados administrativos…</Card> : null}
      {overview ? <>
        <nav aria-label="Seções administrativas" role="tablist" className="flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} id={`admin-tab-${id}`} type="button" aria-controls={`admin-panel-${id}`} aria-selected={tab === id} role="tab" onClick={() => setTab(id)} className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${tab === id ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Icon className="size-4" />{label}</button>)}
        </nav>

        {tab === "overview" ? <section id="admin-panel-overview" aria-labelledby="admin-tab-overview" role="tabpanel" className="grid gap-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={UserRound} label="Contas registradas" value={overview.members.length} detail={`${overview.members.filter((member) => member.suspended).length} suspensas`} />
            <Metric icon={Activity} label="Sessões recentes" value={activeSessions} detail="atividade nos últimos 2 minutos" />
            <Metric icon={Wallet} label="Assinaturas ativas" value={activeSubscriptions} detail={overview.billingAvailable ? "dados atuais da ShardPay" : "ShardPay indisponível"} />
            <Metric icon={Shield} label="Bot Discord" value={overview.health.status === "online" ? "Online" : "Offline"} detail={`${overview.health.guildCount} servidores · ${overview.health.pingMs ?? "—"} ms`} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><div className="flex items-start justify-between gap-3"><div><h2 className="m-0 text-base font-semibold">Acessos recentes</h2><p className="mb-0 mt-1 text-sm text-muted-foreground">Últimas contas que entraram na dashboard.</p></div><Button size="sm" variant="ghost" onClick={() => setTab("users")}>Ver usuários</Button></div>
              {overview.sessions.length ? <ul className="m-0 mt-4 divide-y divide-border p-0">{overview.sessions.slice(0, 6).map((session) => <li key={session.id} className="flex flex-wrap items-center gap-2 py-3 text-sm"><span className="min-w-0 flex-1 truncate font-medium">{session.username}</span><span className="text-muted-foreground">{formatRelative(session.startedAt)}</span><Badge tone={!session.endedAt && !session.revokedAt && Date.now() - session.lastSeenAt < 2 * 60_000 ? "ok" : "default"}>{!session.endedAt && !session.revokedAt && Date.now() - session.lastSeenAt < 2 * 60_000 ? "Ativa" : "Encerrada"}</Badge></li>)}</ul> : <Empty>Nenhum acesso registrado ainda.</Empty>}
            </Card>
            <Card><div><h2 className="m-0 text-base font-semibold">Atividade administrativa</h2><p className="mb-0 mt-1 text-sm text-muted-foreground">Ações feitas nesta área ficam registradas.</p></div>
              {overview.events.length ? <ul className="m-0 mt-4 divide-y divide-border p-0">{overview.events.slice(0, 6).map((event) => <li key={event.id} className="py-3"><p className="m-0 text-sm font-medium">{event.summary}</p><p className="mb-0 mt-1 text-xs text-muted-foreground">{event.action} · {formatRelative(event.at)} · alvo {event.targetId}</p></li>)}</ul> : <Empty>As ações administrativas aparecerão aqui.</Empty>}
            </Card>
          </div>
          <Card><div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><h2 className="m-0 text-base font-semibold">Servidores do bot</h2><p className="mb-0 mt-1 text-sm text-muted-foreground">Republique os painéis quando uma configuração não chegar ao Discord.</p></div><Badge tone={overview.health.status === "online" ? "ok" : "warn"}>{overview.health.status === "online" ? "Bot conectado" : "Bot sem heartbeat"}</Badge></div>
            {overview.guilds.length ? <ul className="m-0 mt-3 divide-y divide-border p-0">{overview.guilds.map((guild) => <li key={guild.id} className="flex flex-wrap items-center gap-3 py-3 text-sm"><span className="min-w-0 flex-1 font-medium">{guild.name}</span><span className="text-xs text-muted-foreground">{[guild.hasTicketsPanel && "Tickets", guild.hasFormsPanel && "Formulários"].filter(Boolean).join(" · ") || "sem painel"}</span><Button size="sm" variant="outline" disabled={busy === guild.id || (!guild.hasTicketsPanel && !guild.hasFormsPanel)} onClick={() => void resync(guild.id, guild.name)}>{busy === guild.id ? "Enviando…" : "Republicar painéis"}</Button></li>)}</ul> : <Empty>O bot não retornou servidores ativos.</Empty>}
          </Card>
        </section> : null}

        {tab === "users" ? <section id="admin-panel-users" aria-labelledby="admin-tab-users" role="tabpanel" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="min-w-0"><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><h2 className="m-0 text-base font-semibold">Contas Discord</h2><p className="mb-0 mt-1 text-sm text-muted-foreground">{overview.members.length} contas · primeira e última atividade registradas.</p></div><label className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><span className="sr-only">Buscar por nome ou ID</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou ID Discord" className="min-h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label></div>
            {filteredMembers.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="pb-2 font-medium">Usuário</th><th className="pb-2 font-medium">Acessos</th><th className="pb-2 font-medium">Última atividade</th><th className="pb-2 font-medium">Estado</th></tr></thead><tbody>{filteredMembers.map((member) => <tr key={member.id} onClick={() => setSelectedId(member.id)} className={`cursor-pointer border-t border-border ${selectedId === member.id ? "bg-muted/60" : "hover:bg-muted/30"}`}><td className="py-3"><span className="block font-medium">{member.username}</span><code className="text-xs text-muted-foreground">{member.id}</code></td><td className="py-3">{member.loginCount}</td><td className="py-3 text-muted-foreground">{formatRelative(member.lastSeenAt)}</td><td className="py-3"><Badge tone={member.suspended ? "warn" : "ok"}>{member.suspended ? "Suspensa" : "Liberada"}</Badge></td></tr>)}</tbody></table></div> : <Empty>Nenhuma conta corresponde à busca.</Empty>}
          </Card>
          <Card className="h-fit"><h2 className="m-0 text-base font-semibold">{selectedMember?.username ?? "Detalhes da conta"}</h2>{selectedMember ? <>
            <code className="mt-1 block text-xs text-muted-foreground">{selectedMember.id}</code>
            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-sm"><dt className="text-muted-foreground">Primeiro acesso</dt><dd className="m-0 text-right">{dateTime(selectedMember.firstSeenAt)}</dd><dt className="text-muted-foreground">Última atividade</dt><dd className="m-0 text-right">{dateTime(selectedMember.lastSeenAt)}</dd><dt className="text-muted-foreground">Total de logins</dt><dd className="m-0 text-right">{selectedMember.loginCount}</dd></dl>
            {selectedMember.suspensionReason ? <p className="mt-3 rounded-lg bg-warn/10 p-3 text-sm">{selectedMember.suspensionReason}</p> : null}
            <label className="mt-4 block text-sm font-medium">Nota interna<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={4} placeholder="Contexto para futuras ações administrativas" className="mt-2 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
            <Button className="mt-2 w-full" variant="outline" disabled={busy === `save-notes:${selectedMember.id}`} onClick={() => void manage(selectedMember, "save-notes")}>{busy === `save-notes:${selectedMember.id}` ? "Salvando…" : "Salvar nota"}</Button>
            <div className="mt-5 border-t border-border pt-4"><h3 className="m-0 text-sm font-semibold">Conceder acesso temporário</h3><p className="mb-0 mt-1 text-xs text-muted-foreground">Acesso manual sem cobrança; expira automaticamente.</p>
              <label className="mt-3 block text-xs font-medium">Plano<select value={grantPlan} onChange={(event) => setGrantPlan(event.target.value as typeof grantPlan)} className="mt-1 min-h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="essencial">Essencial</option><option value="pro">Pro</option><option value="escala">Escala</option></select></label>
              <label className="mt-3 block text-xs font-medium">Duração em dias<input type="number" min={1} max={3650} value={grantDays} onChange={(event) => setGrantDays(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" /></label>
              <label className="mt-3 block text-xs font-medium">Motivo obrigatório<input value={grantReason} onChange={(event) => setGrantReason(event.target.value)} maxLength={500} placeholder="Ex.: cortesia aprovada" className="mt-1 min-h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" /></label>
              <Button className="mt-3 w-full" disabled={Boolean(busy) || Number(grantDays) < 1 || Number(grantDays) > 3650 || grantReason.trim().length < 3} onClick={() => void grantAccess(selectedMember)}>{busy === `grant:${selectedMember.id}` ? "Concedendo…" : "Conceder plano"}</Button>
            </div>
            <div className="mt-4 grid gap-2"><Button variant={selectedMember.suspended ? "default" : "outline"} disabled={Boolean(busy)} onClick={() => void manage(selectedMember, selectedMember.suspended ? "restore" : "suspend")}>{selectedMember.suspended ? "Restaurar acesso" : "Suspender conta"}</Button><Button variant="outline" disabled={Boolean(busy)} onClick={() => void manage(selectedMember, "revoke-sessions")}>Encerrar todas as sessões</Button></div>
          </> : <p className="mb-0 mt-2 text-sm text-muted-foreground">Selecione uma conta para ver os acessos, adicionar uma nota ou gerenciar o acesso.</p>}</Card>
        </section> : null}

        {tab === "subscriptions" ? <section id="admin-panel-subscriptions" aria-labelledby="admin-tab-subscriptions" role="tabpanel" className="grid gap-4"><Card><div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><h2 className="m-0 text-base font-semibold">Assinaturas ShardPay</h2><p className="mb-0 mt-1 text-sm text-muted-foreground">Estado, plano, valor e período que o provedor informa.</p></div>{overview.billingStoreUrl ? <a href={overview.billingStoreUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline underline-offset-4">Abrir painel ShardPay</a> : null}</div>
            {!overview.billingAvailable ? <p role="status" className="mt-4 rounded-lg bg-warn/10 p-3 text-sm">{overview.billingError}</p> : null}
            {overview.subscriptions.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="pb-2 font-medium">Assinante</th><th className="pb-2 font-medium">Plano</th><th className="pb-2 font-medium">Estado</th><th className="pb-2 font-medium">Valor</th><th className="pb-2 font-medium">Início</th><th className="pb-2 font-medium">Fim / próxima cobrança</th><th className="pb-2 font-medium">Ação</th></tr></thead><tbody>{overview.subscriptions.map((sub) => <tr key={sub.id} className="border-t border-border"><td className="py-3"><span className="block font-medium">{sub.username}</span><code className="text-xs text-muted-foreground">{sub.discordUserId ?? "ID não vinculado"}</code></td><td className="py-3">{sub.productName}<span className="block text-xs text-muted-foreground">{sub.billingCycle || "ciclo não informado"}</span>{sub.manual && sub.reason ? <span className="block max-w-48 text-xs text-muted-foreground">{sub.reason}</span> : null}</td><td className="py-3"><Badge tone={["active", "trialing", "paid", "authorized", "succeeded"].includes(sub.status.toLowerCase()) ? "ok" : "warn"}>{sub.status}</Badge></td><td className="py-3">{sub.manual ? "cortesia" : (sub.priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td className="py-3">{dateTime(sub.startedAt)}</td><td className="py-3">{dateTime(sub.manual ? sub.periodEndsAt : (sub.periodEndsAt ?? sub.nextBillingDate))}</td><td className="py-3">{sub.manual && sub.status === "active" ? <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void revokeGrant(sub.id)}>{busy === `grant-revoke:${sub.id}` ? "Revogando…" : "Revogar"}</Button> : sub.manual ? "—" : <a href={overview.billingStoreUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary underline underline-offset-4">Gerenciar na ShardPay</a>}</td></tr>)}</tbody></table></div> : <Empty>Nenhuma assinatura ou concessão foi registrada.</Empty>}
            <p className="mb-0 mt-4 text-xs text-muted-foreground">Alterações de cobrança e cancelamentos devem ser feitos no painel do provedor para manter o estado financeiro sincronizado.</p>
          </Card></section> : null}

        {tab === "security" ? <section id="admin-panel-security" aria-labelledby="admin-tab-security" role="tabpanel" className="grid gap-4 lg:grid-cols-2">
          <Card><h2 className="m-0 text-base font-semibold">Configuração segura</h2><p className="mb-0 mt-1 text-sm text-muted-foreground">Apenas o estado de configuração aparece aqui. Segredos e tokens nunca são exibidos.</p><ul className="m-0 mt-4 space-y-3 p-0">{[
            ["Segredo de sessão (32+ caracteres)", overview.security.sessionSecretConfigured],
            ["Chave privada ShardPay", overview.security.shardPayKeyConfigured],
            ["Segredo OAuth Discord", overview.security.discordClientSecretConfigured],
            ["ID do dono da plataforma", overview.security.ownerIdConfigured],
          ].map(([label, configured]) => <li key={String(label)} className="flex items-center gap-3 border-t border-border pt-3 text-sm"><span className="min-w-0 flex-1">{label}</span><Badge tone={configured ? "ok" : "warn"}>{configured ? "Configurado" : "Ausente"}</Badge></li>)}</ul><div className="mt-4 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground"><AlertTriangle className="mr-2 inline size-4" />Mantenha tokens no gerenciador de segredos do ambiente e faça rotação imediata se algum for exposto.</div></Card>
          <Card><h2 className="m-0 text-base font-semibold">Sessões e logins</h2><p className="mb-0 mt-1 text-sm text-muted-foreground">Duração aproximada pela atividade da dashboard; sessões sem atividade recente são marcadas como encerradas.</p>{overview.sessions.length ? <ul className="m-0 mt-4 max-h-[520px] divide-y divide-border overflow-auto p-0">{overview.sessions.slice(0, 100).map((session) => { const recent = !session.endedAt && !session.revokedAt && Date.now() - session.lastSeenAt < 2 * 60_000; const end = session.endedAt ?? session.lastSeenAt; return <li key={session.id} className="py-3"><div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-medium">{session.username}</span><Badge tone={recent ? "ok" : session.revokedAt ? "warn" : "default"}>{recent ? "Ativa" : session.revokedAt ? "Revogada" : "Inativa"}</Badge></div><p className="mb-0 mt-1 text-xs text-muted-foreground">Entrou {dateTime(session.startedAt)} · atividade {formatRelative(session.lastSeenAt)} · {duration(session.startedAt, end)} estimados</p></li>; })}</ul> : <Empty>Nenhuma sessão registrada.</Empty>}</Card>
          <Card className="lg:col-span-2"><h2 className="m-0 text-base font-semibold">Registro de ações</h2>{overview.events.length ? <ul className="m-0 mt-3 divide-y divide-border p-0">{overview.events.slice(0, 100).map((event) => <li key={event.id} className="flex flex-wrap gap-x-3 gap-y-1 py-3 text-sm"><span className="min-w-0 flex-1">{event.summary}</span><code className="text-xs text-muted-foreground">{event.action} · por {event.actorId} · alvo {event.targetId}</code><time className="text-xs text-muted-foreground">{dateTime(event.at)}</time></li>)}</ul> : <Empty>Nenhuma ação administrativa registrada.</Empty>}</Card>
        </section> : null}
      </> : null}
    </main>
  </div>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string | number; detail: string }) {
  return <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4" /><span className="text-xs">{label}</span></div><p className="mb-0 mt-3 text-2xl font-semibold tabular-nums">{value}</p><p className="mb-0 mt-1 text-xs text-muted-foreground">{detail}</p></Card>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="mb-0 mt-4 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{children}</p>;
}
