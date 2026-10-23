import { Link, useRouterState } from "@tanstack/react-router";
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
import { useEffect, useMemo, useState } from "react";
import { BrandMark, GuildBadge } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/search-select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { brand, groupLabels, navItems, type ModuleGroupId, type NavId } from "@/lib/wumpus/brand";
import { SESSION_TOKEN_KEY } from "@/lib/wumpus/session-token";
import { useWumpus } from "@/lib/wumpus/store";
import { cn } from "@/lib/utils";
import { ModuleAssistant } from "@/components/module-assistant";

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

function GuildPicker({ onChange }: { onChange?: () => void }) {
  const guilds = useWumpus((s) => s.guilds);
  const activeId = useWumpus((s) => s.activeGuildId);
  const setActive = useWumpus((s) => s.setActiveGuild);
  const guild = guilds.find((item) => item.id === activeId) ?? guilds[0];

  return (
    <SearchSelect id="guild-picker" value={guild?.id ?? ""} eyebrow="Servidor Discord" placeholder="Selecione um servidor" onChange={(id) => { setActive(id); onChange?.(); }}
      className="min-h-[58px] rounded-2xl px-3" options={guilds.map((item) => ({ id: item.id, label: item.name, description: `Plano ${item.plan}`, icon: <GuildBadge tag={item.tag ?? "W"} iconUrl={item.iconUrl} size={34} /> }))} />
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const active = useActiveNav();
  const groups: Array<ModuleGroupId | "home"> = ["home", "attend", "protect", "team", "intel"];
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-6 pb-6">
      {groups.map((group) => {
        const items = navItems.filter((item) => item.group === group);
        if (!items.length) return null;
        return (
          <section key={group}>
            {group !== "home" ? (
              <p className="mb-2 px-3 text-[11px] font-semibold text-muted-foreground">{groupLabels[group]}</p>
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
                      "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                      active === item.id
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
  const active = useActiveNav();
  const nextTheme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
  const isOwner = user.isAdmin;

  useEffect(() => { hydrate(); }, [hydrate]);

  const title = useMemo(() => navItems.find((item) => item.id === active)?.label ?? "Painel", [active]);
  const hint = useMemo(() => navItems.find((item) => item.id === active)?.hint, [active]);

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
        <section className="w-full max-w-md rounded-2xl bg-card p-7 shadow-border">
          <BrandMark size={46} />
          <h1 className="mb-2 mt-6 text-2xl font-semibold">Vamos preparar seu servidor</h1>
          <p className="mb-6 mt-0 text-sm leading-6 text-muted-foreground">
            {isOwner
              ? "Seu acesso de dono da plataforma está ativo. Adicione o Wumpus a um servidor que você administra para começar."
              : "Instale o Wumpus em um servidor que você administra e conecte seu plano para começar a configurar."}
          </p>
          <a href={brand.invite} target="_blank" rel="noreferrer" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
            Adicionar o Wumpus ao Discord
          </a>
          {!isOwner ? <Link to="/" className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground">Ver planos e recursos</Link> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell flex min-h-dvh bg-background text-foreground">
      <aside className="app-sidebar hidden w-[17rem] shrink-0 flex-col border-r border-border bg-card lg:flex">
        <Link to="/" aria-label="Wumpus, início" className="flex h-[4.5rem] items-center gap-3 border-b border-border px-5">
          <BrandMark size={34} />
          <span className="text-[17px] font-bold tracking-[-0.03em]">Wumpus</span>
        </Link>
        <div className="px-3 pb-4 pt-4"><GuildPicker /></div>
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
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{user.globalName.slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-sm font-semibold">{user.globalName}</p>
              <p className="m-0 truncate text-xs text-muted-foreground">{user.username}</p>
            </div>
            <a href="/" aria-label="Sair" title="Sair" onClick={(event) => { event.preventDefault(); localStorage.removeItem(SESSION_TOKEN_KEY); window.location.assign("/"); }} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
              <LogOut className="size-4" />
            </a>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-bar sticky top-0 z-20 flex min-h-[4.5rem] items-center gap-3 border-b border-border px-4 sm:px-7">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <Button variant="outline" size="icon-sm" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Abrir navegação">
              <Menu className="size-4" />
            </Button>
            <SheetContent side="left" className="app-surface flex flex-col gap-0 overflow-y-auto border-0 bg-card p-0">
              <div className="flex h-[4.5rem] items-center gap-3 border-b border-border px-5">
                <BrandMark size={34} /><strong className="text-[17px]">Wumpus</strong>
              </div>
              <div className="px-3 py-4"><GuildPicker onChange={() => setMenuOpen(false)} /></div>
              <div className="px-3"><NavList onNavigate={() => setMenuOpen(false)} /></div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <h1 className="m-0 truncate text-lg font-semibold tracking-[-0.02em]">{title}</h1>
            {hint ? <p className="m-0 hidden truncate text-xs text-muted-foreground sm:block">{hint}</p> : null}
          </div>
          {runtimeSyncStatus !== "idle" ? (
            <span className={cn("hidden items-center gap-2 text-xs sm:flex", runtimeSyncStatus === "failed" ? "text-destructive" : "text-muted-foreground")} role="status">
              <span className={cn("size-2 rounded-full", runtimeSyncStatus === "failed" ? "bg-destructive" : runtimeSyncStatus === "syncing" ? "animate-pulse bg-warn" : "bg-ok")} />
              {runtimeSyncStatus === "syncing" ? "Salvando configuração" : runtimeSyncStatus === "failed" ? "Falha ao sincronizar" : "Configuração atualizada"}
            </span>
          ) : null}
          <Button variant="ghost" size="icon-sm" aria-label={`Tema atual ${theme}; mudar para ${nextTheme}`} title={`Tema ${theme}`} onClick={() => setTheme(nextTheme)}>
            {theme === "dark" ? <Moon className="size-4" /> : theme === "light" ? <Sun className="size-4" /> : <Monitor className="size-4" />}
          </Button>
          <a href={brand.invite} target="_blank" rel="noreferrer" className="hidden min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted sm:inline-flex">
            <Plus className="size-4" /> Adicionar a outro servidor
          </a>
        </header>
        {runtimeSyncError ? <p role="alert" className="mx-4 mb-0 mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive sm:mx-7">{runtimeSyncError}</p> : null}
        <main className="app-page w-full flex-1 px-4 py-6 sm:px-7 sm:py-8">
          {children}
        </main>
      </div>
      <ModuleAssistant />
    </div>
  );
}

export { iconByNav };
