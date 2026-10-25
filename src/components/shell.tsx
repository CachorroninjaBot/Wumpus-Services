import { Link, useRouterState } from "@tanstack/react-router";
import { createClientOnlyFn } from "@tanstack/react-start";
import {
  BookOpen,
  ChartNoAxesColumn,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Plus,
  Settings,
  Shield,
  ShieldAlert,
  Sun,
  Ticket,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandMark, GuildBadge } from "@/components/brand";
import { GuildSelectionPanel } from "@/components/guild-selection-panel";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/search-select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { brand, groupLabels, navItems, type ModuleGroupId, type NavId } from "@/lib/wumpus/brand";
import { SESSION_TOKEN_KEY } from "@/lib/wumpus/session-token";
import { getOwnerGuildDiagnostics, logoutDashboardSession, type OwnerGuildDiagnostics } from "@/lib/wumpus/session";
import { isDiscordActivityContext } from "@/lib/discord/activity-session.client";
import { useWumpus } from "@/lib/wumpus/store";
import { cn } from "@/lib/utils";
import { ModuleAssistant } from "@/components/module-assistant";

const isActivityClient = createClientOnlyFn(isDiscordActivityContext);

const iconByNav: Record<NavId, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  tickets: Ticket,
  forms: ClipboardCheck,
  staff: Users,
  moderation: ShieldAlert,
  protect: Shield,
  knowledge: BookOpen,
  stats: ChartNoAxesColumn,
  logs: FileText,
  settings: Settings,
};

function useActiveNav(): NavId {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/app/tickets")) return "tickets";
  if (pathname.startsWith("/app/forms")) return "forms";
  if (pathname.startsWith("/app/staff")) return "staff";
  if (pathname.startsWith("/app/moderation")) return "moderation";
  if (pathname.startsWith("/app/protect")) return "protect";
  if (pathname.startsWith("/app/knowledge")) return "knowledge";
  if (pathname.startsWith("/app/stats")) return "stats";
  if (pathname.startsWith("/app/logs")) return "logs";
  if (pathname.startsWith("/app/settings")) return "settings";
  return "overview";
}

function GuildPicker({ onChange, compact = false, id }: { onChange?: () => void; compact?: boolean; id?: string }) {
  const guilds = useWumpus((s) => s.guilds);
  const activeId = useWumpus((s) => s.activeGuildId);
  const setActive = useWumpus((s) => s.setActiveGuild);
  const guild = guilds.find((item) => item.id === activeId) ?? guilds[0];

  return (
    <SearchSelect id={id ?? "guild-picker"} value={guild?.id ?? ""} eyebrow={compact ? "Servidor ativo" : "Servidor Discord"} placeholder="Selecione um servidor" onChange={(nextId) => { setActive(nextId); onChange?.(); }}
      className={compact ? "min-h-11 rounded-xl px-2.5" : "min-h-[58px] rounded-2xl px-3"} options={guilds.map((item) => ({ id: item.id, label: item.name, description: compact ? undefined : `Plano ${item.plan}`, icon: <GuildBadge tag={item.tag ?? "W"} iconUrl={item.iconUrl} size={compact ? 26 : 34} /> }))} />
  );
}

function DiscordAvatar({ user }: { user: { id: string; avatar?: string | null; globalName: string } }) {
  const [failed, setFailed] = useState(false);
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=96`
    : null;

  return avatarUrl && !failed ? (
    <img
      src={avatarUrl}
      alt=""
      width={36}
      height={36}
      onError={() => setFailed(true)}
      className="size-9 shrink-0 rounded-full object-cover"
    />
  ) : (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground" aria-hidden="true">
      {user.globalName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function ServerRail() {
  const guilds = useWumpus((state) => state.guilds);
  const activeGuildId = useWumpus((state) => state.activeGuildId);
  const setActiveGuild = useWumpus((state) => state.setActiveGuild);
  const userId = useWumpus((state) => state.sessionUser.id);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const orderKey = `wumpus-server-order-v1:${userId}`;

  useEffect(() => {
    let saved: string[] = [];
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(orderKey) ?? "[]");
      if (Array.isArray(parsed)) saved = parsed.filter((id): id is string => typeof id === "string");
    } catch (error) {
      console.error("Não foi possível carregar a ordem dos servidores.", error);
    }
    const availableIds = new Set(guilds.map((guild) => guild.id));
    const next = [...saved.filter((id) => availableIds.has(id)), ...guilds.map((guild) => guild.id).filter((id) => !saved.includes(id))];
    setOrderedIds(next);
  }, [guilds, orderKey]);

  const orderedGuilds = useMemo(() => {
    const byId = new Map(guilds.map((guild) => [guild.id, guild]));
    return orderedIds.map((id) => byId.get(id)).filter((guild) => guild !== undefined);
  }, [guilds, orderedIds]);

  const reorder = (sourceId: string, targetId: string) => {
    const sourceIndex = orderedIds.indexOf(sourceId);
    const targetIndex = orderedIds.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    const next = [...orderedIds];
    const [moved] = next.splice(sourceIndex, 1);
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    setOrderedIds(next);
    try {
      localStorage.setItem(orderKey, JSON.stringify(next));
    } catch (error) {
      console.error("Não foi possível salvar a ordem dos servidores.", error);
    }
  };

  return (
    <aside aria-label="Servidores" className="hidden w-[4.5rem] shrink-0 flex-col items-center gap-2 border-r border-border bg-muted/35 py-2 lg:flex lg:py-3">
      <Link to="/app" aria-label="Início do Wumpus" className="grid size-12 place-items-center rounded-2xl transition-colors hover:bg-background">
        <BrandMark size={38} />
      </Link>
      <span aria-hidden="true" className="h-px w-8 bg-border" />
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1.5 overflow-y-auto px-1.5">
        {orderedGuilds.map((guild, index) => {
          const active = guild.id === activeGuildId;
          const isDragging = draggingId === guild.id;
          const isDropTarget = dropTargetId === guild.id && draggingId && draggingId !== guild.id;
          return (
            <button
              key={guild.id}
              type="button"
              draggable
              aria-label={`${guild.name}${active ? ", servidor selecionado" : ""}. Arraste para reordenar; use Alt e as setas para mover.`}
              aria-pressed={active}
              aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
              title={guild.name}
              onClick={() => setActiveGuild(guild.id)}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", guild.id);
                event.dataTransfer.effectAllowed = "move";
                setDraggingId(guild.id);
              }}
              onDragEnd={() => { setDraggingId(null); setDropTargetId(null); }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (draggingId && draggingId !== guild.id) setDropTargetId(guild.id);
              }}
              onDragLeave={() => { if (dropTargetId === guild.id) setDropTargetId(null); }}
              onDrop={(event) => {
                event.preventDefault();
                reorder(event.dataTransfer.getData("text/plain"), guild.id);
                setDraggingId(null);
                setDropTargetId(null);
              }}
              onKeyDown={(event) => {
                if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
                event.preventDefault();
                const target = orderedGuilds[index + (event.key === "ArrowUp" ? -1 : 1)];
                if (target) reorder(guild.id, target.id);
              }}
              className={cn(
                "server-rail-item group relative grid size-11 shrink-0 place-items-center rounded-[16px] cursor-grab transition-all duration-150 hover:rounded-[12px] hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:cursor-grabbing lg:size-12 lg:rounded-[18px]",
                active && "rounded-[12px] bg-background shadow-border lg:rounded-[14px]",
                isDragging && "opacity-40 scale-95",
                isDropTarget && "ring-2 ring-primary/60 ring-offset-1 ring-offset-background",
              )}
            >
              <span aria-hidden="true" className={cn("absolute -left-1.5 w-1 rounded-r-full bg-primary transition-all", active ? "h-7 lg:h-8" : "h-2 opacity-0")} />
              <GuildBadge tag={guild.tag ?? guild.name.slice(0, 2)} iconUrl={guild.iconUrl} size={34} />
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center rounded-[inherit] bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="text-[10px] text-white">⋮⋮</span>
              </span>
            </button>
          );
        })}
      </div>
      <a href={brand.invite} target="_blank" rel="noreferrer" aria-label="Adicionar o Wumpus a outro servidor" title="Adicionar servidor" className="grid size-11 shrink-0 place-items-center rounded-full border border-border text-primary transition-colors hover:bg-background">
        <Plus className="size-5" />
      </a>
    </aside>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const active = useActiveNav();
  const groups: Array<ModuleGroupId | "home"> = ["home", "attend", "protect", "team", "intel"];
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-5 pb-4">
      {groups.map((group) => {
        const items = navItems.filter((item) => item.group === group);
        if (!items.length) return null;
        return (
          <section key={group}>
            {group !== "home" ? (
              <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-wide text-muted-foreground">{groupLabels[group]}</p>
            ) : null}
            <div className="flex flex-col gap-1">
              {items.map((item) => {
                const Icon = iconByNav[item.id];
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={onNavigate}
                    aria-current={active === item.id ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-[background,color,transform] duration-150",
                      active === item.id
                        ? "bg-secondary text-foreground shadow-sm"
                        : "text-muted-foreground hover:translate-x-0.5 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-[17px] shrink-0" strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const hydrate = useWumpus((s) => s.hydrate);
  const hydrated = useWumpus((s) => s.hydrated);
  const guilds = useWumpus((s) => s.guilds);
  const theme = useWumpus((s) => s.theme);
  const setTheme = useWumpus((s) => s.setTheme);
  const runtimeSyncStatus = useWumpus((s) => s.runtimeSyncStatus);
  const runtimeSyncError = useWumpus((s) => s.runtimeSyncError);
  const user = useWumpus((s) => s.sessionUser);
  const [menuOpen, setMenuOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<OwnerGuildDiagnostics | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const active = useActiveNav();
  const nextTheme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
  const isOwner = user.isAdmin;

  useEffect(() => { hydrate(); }, [hydrate]);

  const title = useMemo(() => navItems.find((item) => item.id === active)?.label ?? "Painel", [active]);
  const hint = useMemo(() => navItems.find((item) => item.id === active)?.hint, [active]);

  const inspectGuildConnection = useCallback(async () => {
    setDiagnosticsLoading(true);
    setDiagnosticsError(null);
    try {
      setDiagnostics(await getOwnerGuildDiagnostics({ data: {} }));
    } catch (cause) {
      console.error("Não foi possível carregar o diagnóstico da conexão do Wumpus.", cause);
      setDiagnosticsError(cause instanceof Error ? cause.message : "Não foi possível consultar o diagnóstico.");
    } finally {
      setDiagnosticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hydrated && isOwner && guilds.length === 0) void inspectGuildConnection();
  }, [guilds.length, hydrated, inspectGuildConnection, isOwner]);

  if (!hydrated) {
    return <div className="grid min-h-dvh place-items-center bg-background text-muted-foreground">Carregando o Wumpus…</div>;
  }

  if (!user.signedIn) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
        <section className="w-full max-w-md rounded-2xl bg-card p-7 shadow-border">
          <BrandMark size={46} />
          <h1 className="mb-2 mt-6 text-2xl font-semibold">Entre para continuar</h1>
          <p className="mb-6 mt-0 text-sm leading-6 text-muted-foreground">
            Configure o atendimento do seu servidor e acompanhe a equipe em um só lugar.
          </p>
          <Link to="/entrar" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
            Entrar com Discord
          </Link>
          <Link to="/" className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground">Conhecer o Wumpus</Link>
        </section>
      </div>
    );
  }

  if (!guilds.length) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
        <section className="w-full max-w-lg rounded-2xl bg-card p-7 shadow-border">
          <BrandMark size={46} />
          <h1 className="mb-2 mt-6 text-2xl font-semibold">Vamos preparar seu servidor</h1>
          <p className="mb-6 mt-0 text-sm leading-6 text-muted-foreground">
            {isOwner
              ? "Seu acesso de dono da plataforma está ativo. O Wumpus precisa estar online em um servidor que sua conta administra e enviar um heartbeat recente (até 90 segundos). Se ele já está online, confira se o bot e o painel usam o mesmo PostgreSQL (DATABASE_URL); depois atualize a conexão com o Discord."
              : "O Wumpus detecta os servidores que você possui e onde o bot está instalado. Escolha abaixo quais quer gerenciar; a quantidade permitida depende do seu plano."}
          </p>
          <a href={brand.invite} target="_blank" rel="noreferrer" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
            Adicionar o Wumpus ao Discord
          </a>
          <a href="/entrar?reconectar=1" className="mt-4 block text-center text-sm font-medium text-primary hover:underline">Atualizar conexão com o Discord</a>
          {!isOwner ? (
            <div className="mt-6">
              <GuildSelectionPanel />
            </div>
          ) : null}
          {isOwner ? (
            <section aria-labelledby="connection-diagnostics-title" className="mt-6 rounded-xl border border-border bg-muted/35 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="connection-diagnostics-title" className="m-0 text-sm font-semibold">Diagnóstico da conexão</h2>
                <Button variant="outline" size="sm" disabled={diagnosticsLoading} onClick={() => void inspectGuildConnection()}>
                  {diagnosticsLoading ? "Verificando…" : diagnostics ? "Verificar novamente" : "Verificar conexão"}
                </Button>
              </div>
              {diagnosticsLoading && !diagnostics ? <p role="status" className="mb-0 mt-3 text-sm text-muted-foreground">Consultando sessão Discord e heartbeat do bot…</p> : null}
              {diagnosticsError ? <p role="alert" className="mb-0 mt-3 text-sm text-destructive">{diagnosticsError}</p> : null}
              {diagnostics ? (
                <>
                  <dl className="mb-0 mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Servidores administráveis</dt>
                    <dd className="m-0 text-right font-medium">{diagnostics.manageableGuildCount}</dd>
                    <dt className="text-muted-foreground">Heartbeat do bot</dt>
                    <dd className="m-0 text-right font-medium">
                      {diagnostics.healthState === "available" ? "Encontrado e válido" : diagnostics.healthState === "missing" ? "Não encontrado" : diagnostics.healthState === "invalid" ? "Inválido" : "Sem permissão de leitura"}
                    </dd>
                    <dt className="text-muted-foreground">Fonte do heartbeat</dt>
                    <dd className="m-0 text-right font-medium">{diagnostics.healthPathSource === "database" ? "PostgreSQL via DATABASE_URL" : diagnostics.healthPathSource === "configured" ? "WUMPUS_HEALTH_PATH" : "Arquivo padrão"}</dd>
                    <dt className="text-muted-foreground">Estado do bot</dt>
                    <dd className="m-0 text-right font-medium">{diagnostics.healthStatus === "online" ? "Online" : diagnostics.healthStatus === "offline" ? "Offline" : "Sem registro"}</dd>
                    <dt className="text-muted-foreground">Último heartbeat</dt>
                    <dd className="m-0 text-right font-medium">{diagnostics.healthAgeSeconds === null ? "Indisponível" : `há ${diagnostics.healthAgeSeconds}s`}</dd>
                    <dt className="text-muted-foreground">Servidores do bot</dt>
                    <dd className="m-0 text-right font-medium">{diagnostics.healthGuildCount}</dd>
                    <dt className="text-muted-foreground">Servidores em comum</dt>
                    <dd className="m-0 text-right font-medium">{diagnostics.matchingGuildCount}</dd>
                  </dl>
                  <p className="mb-0 mt-4 break-all rounded-lg bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                    Armazenamento consultado: {diagnostics.healthPath}
                  </p>
                  <p className="mb-0 mt-2 text-xs text-muted-foreground">Identificador: <code>{diagnostics.issue}</code></p>
                  {diagnostics.errorCode ? <p className="mb-0 mt-2 text-xs text-destructive">Código técnico: {diagnostics.errorCode}</p> : null}
                  <p className="mb-0 mt-3 text-sm leading-6">{diagnostics.recommendation}</p>
                  <p className="mb-0 mt-2 text-xs text-muted-foreground">Consulta registrada nos logs do servidor em {new Date(diagnostics.checkedAt).toLocaleTimeString("pt-BR")}.</p>
                </>
              ) : null}
            </section>
          ) : null}
          {!isOwner ? <Link to="/" className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground">Ver planos e recursos</Link> : null}
        </section>
      </div>
    );
  }

  return (
    <div
      className="app-shell flex min-h-dvh bg-background text-foreground"
      onContextMenu={(event) => event.preventDefault()}
    >
      <a href="#main-content" className="skip-link">Pular para o conteúdo</a>
      <ServerRail />
      <aside className="app-sidebar hidden w-[17rem] shrink-0 flex-col border-r border-border bg-card lg:flex">
        <Link to="/" aria-label="Wumpus, início" className="flex h-[4.5rem] items-center gap-3 border-b border-border px-5">
          <BrandMark size={34} />
          <span className="text-[17px] font-bold tracking-[-0.03em]">Wumpus</span>
        </Link>
        <div className="px-3 pb-4 pt-4"><GuildPicker id="guild-picker-sidebar" /></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3">
          <NavList />
        </div>
        <div className="border-t border-border p-3">
          {isOwner ? (
            <Link to="/admin" className="mb-2 flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              <Shield className="size-[17px]" /> Administração Wumpus
            </Link>
          ) : null}
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <DiscordAvatar key={user.id} user={user} />
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-sm font-semibold">{user.globalName}</p>
              <p className="m-0 truncate text-xs text-muted-foreground">{user.username}</p>
            </div>
            <a href="/" aria-label="Sair" title="Sair" onClick={(event) => {
              event.preventDefault();
              void logoutDashboardSession({ data: {} }).catch(() => undefined).finally(() => {
                localStorage.removeItem(SESSION_TOKEN_KEY);
                localStorage.removeItem("wumpus-demo-v2");
                window.location.assign(isActivityClient()
                  ? `${window.location.pathname}${window.location.search}`
                  : "/");
              });
            }} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
              <LogOut className="size-4" />
            </a>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-bar sticky top-0 z-20 flex min-h-[4.5rem] flex-wrap items-center gap-3 border-b border-border px-4 sm:px-7">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Abrir navegação">
              <Menu className="size-4" />
            </Button>
            <SheetContent side="left" className="app-surface flex flex-col gap-0 overflow-y-auto border-0 bg-card p-0">
              <div className="flex h-[4.5rem] items-center gap-3 border-b border-border px-5">
                <BrandMark size={34} /><strong className="text-[17px]">Wumpus</strong>
              </div>
              <div className="px-3 py-4"><GuildPicker id="guild-picker-menu" onChange={() => setMenuOpen(false)} /></div>
              <div className="px-3"><NavList onNavigate={() => setMenuOpen(false)} /></div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <h1 className="m-0 truncate text-lg font-semibold tracking-[-0.02em]">{title}</h1>
            {hint ? <p className="m-0 hidden truncate text-xs text-muted-foreground sm:block">{hint}</p> : null}
          </div>
          {runtimeSyncStatus !== "idle" ? (
            <span key={runtimeSyncStatus} className={cn("sync-status hidden items-center gap-2 text-xs sm:flex", runtimeSyncStatus === "failed" ? "text-destructive" : "text-muted-foreground")} role="status">
              <span className={cn("size-2 rounded-full", runtimeSyncStatus === "failed" ? "bg-destructive" : runtimeSyncStatus === "syncing" ? "animate-pulse bg-warn" : "bg-ok")} />
              {runtimeSyncStatus === "syncing" ? "Salvando configuração" : runtimeSyncStatus === "failed" ? "Falha ao sincronizar" : "Configuração atualizada"}
            </span>
          ) : null}
          <Button variant="ghost" size="icon" className="lg:size-9" aria-label={`Tema atual ${theme}; mudar para ${nextTheme}`} title={`Tema ${theme}`} onClick={() => setTheme(nextTheme)}>
            {theme === "dark" ? <Moon className="size-4" /> : theme === "light" ? <Sun className="size-4" /> : <Monitor className="size-4" />}
          </Button>
          <a href={brand.invite} target="_blank" rel="noreferrer" className="hidden min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted sm:inline-flex">
            <Plus className="size-4" /> Adicionar a outro servidor
          </a>
          <div className="order-last w-full pb-3 lg:hidden">
            <GuildPicker id="guild-picker-mobile-header" compact />
          </div>
        </header>
        {runtimeSyncError ? <p role="alert" className="mx-4 mb-0 mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive sm:mx-7">{runtimeSyncError}</p> : null}
        <main id="main-content" tabIndex={-1} className="app-page w-full flex-1 px-4 py-6 outline-none sm:px-7 sm:py-8">
          {children}
        </main>
      </div>
      <ModuleAssistant />
    </div>
  );
}

export { iconByNav };
