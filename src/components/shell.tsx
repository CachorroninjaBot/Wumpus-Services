import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Moon, Sun, Shield, LogOut, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BrandMark, GuildBadge } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { brand, groupLabels, navItems, type ModuleGroupId, type NavId } from "@/lib/wumpus/brand";
import { isPlatformOwner } from "@/lib/wumpus/owner";
import { useWumpus } from "@/lib/wumpus/store";
import { cn } from "@/lib/utils";

const iconByNav: Record<NavId, string> = {
  overview: "Visão",
  tickets: "Fila",
  forms: "Forms",
  staff: "Equipe",
  moderation: "Mod",
  protect: "Shield",
  knowledge: "Base",
  stats: "Números",
  logs: "Logs",
  settings: "Servidor",
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

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const active = useActiveNav();
  const groups: Array<ModuleGroupId | "home"> = ["home", "attend", "protect", "team", "intel"];
  return (
    <nav className="flex flex-col gap-4 pb-8">
      {groups.map((g) => {
        const items = navItems.filter((n) => n.group === g);
        if (!items.length) return null;
        return (
          <section key={g}>
            {g !== "home" ? (
              <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {groupLabels[g]}
              </p>
            ) : null}
            <div className="flex flex-col gap-0.5">
              {items.map((item) => (
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={onNavigate}
                  className={cn(
                    "flex min-h-11 items-center rounded-xl px-3 text-sm transition-colors duration-150",
                    active === item.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              ))}
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
  const activeId = useWumpus((s) => s.activeGuildId);
  const setActive = useWumpus((s) => s.setActiveGuild);
  const theme = useWumpus((s) => s.theme);
  const setTheme = useWumpus((s) => s.setTheme);
  const user = useWumpus((s) => s.sessionUser);
  const guild = guilds.find((g) => g.id === activeId) ?? guilds[0];
  const [open, setOpen] = useState(false);
  const active = useActiveNav();
  // O link de Admin so aparece para o dono da plataforma. Antes ficava visivel
  // para todos, e a tela so pedia uma senha que estava escrita no codigo.
  const isOwner = isPlatformOwner(user.id);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const title = useMemo(() => navItems.find((n) => n.id === active)?.label ?? "Painel", [active]);

  if (!hydrated) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background text-muted-foreground">
        Carregando o Wumpus…
      </div>
    );
  }

  // Visitante sem sessao nao ve painel nenhum. Antes caia no workspace de
  // demonstracao, entao qualquer pessoa abria /app e encontrava todos os
  // servidores com todos os planos liberados.
  if (!user.signedIn) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
        <Card className="w-full max-w-md space-y-4 p-6">
          <BrandMark />
          <div>
            <h1 className="m-0 text-xl font-semibold">Entre para continuar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              O painel mostra os servidores onde o Wumpus está instalado e que você administra, com o plano que você
              assinou.
            </p>
          </div>
          <Link
            to="/entrar"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Entrar com Discord
          </Link>
          <Link to="/" className="block text-center text-sm text-muted-foreground">
            Ver os planos
          </Link>
        </Card>
      </div>
    );
  }

  // Sem servidor liberado nao ha painel para mostrar. Antes caia aqui com a
  // lista cheia de servidores onde o bot nem estava; agora a tela explica o que
  // falta em vez de exibir uma configuracao que nao valeria nada.
  if (!guilds.length) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
        <Card className="w-full max-w-md space-y-4 p-6">
          <BrandMark />
          <div>
            <h1 className="m-0 text-xl font-semibold">Nenhum servidor disponível</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              O painel mostra apenas servidores onde o Wumpus está instalado e que você administra — e dentro do
              limite do seu plano.
            </p>
          </div>
          <a
            href={brand.invite}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Adicionar o Wumpus a um servidor
          </a>
          <Link to="/" className="block text-center text-sm text-muted-foreground">
            Ver os planos
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <aside className="hidden w-[72px] shrink-0 flex-col items-center gap-3 border-r border-border py-4 lg:flex">
        <Link to="/" aria-label="Wumpus" className="grid place-items-center">
          <BrandMark size={40} />
        </Link>
        <span className="h-px w-8 bg-border" />
        {guilds.map((g) => (
          <button key={g.id} type="button" title={g.name} onClick={() => setActive(g.id)} className="grid place-items-center">
            <GuildBadge tag={g.tag} iconUrl={g.iconUrl} active={g.id === activeId} />
          </button>
        ))}
        <a
          href={brand.invite}
          target="_blank"
          rel="noreferrer"
          className="mt-auto grid size-11 place-items-center rounded-[14px] border border-dashed border-border text-muted-foreground hover:text-foreground"
          title="Adicionar a outro servidor"
        >
          <Plus className="size-4" />
        </a>
      </aside>

      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card/40 lg:flex">
        <header className="flex items-center gap-3 border-b border-border px-4 py-4">
          <GuildBadge tag={guild?.tag ?? "W"} iconUrl={guild?.iconUrl} size={38} />
          <div className="min-w-0">
            <p className="m-0 truncate text-sm font-semibold">{guild?.name}</p>
            <p className="m-0 truncate text-xs text-muted-foreground">
              {guild?.online} online · plano {guild?.plan}
            </p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-2 pt-3">
          <NavList />
        </div>
        {isOwner ? (
          <div className="border-t border-border p-2">
            <Link
              to="/admin"
              className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Shield className="size-4" /> Admin
            </Link>
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-border px-3 sm:px-5">
          <Sheet open={open} onOpenChange={setOpen}>
            <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
              <Menu className="size-5" />
            </Button>
            <SheetContent side="left" className="flex flex-col gap-4 overflow-y-auto">
              <div className="mt-6 flex items-center gap-2">
                <BrandMark size={32} />
                <strong>Wumpus</strong>
              </div>
              <div className="flex gap-2">
                {guilds.map((g) => (
                  <button key={g.id} type="button" onClick={() => setActive(g.id)}>
                    <GuildBadge tag={g.tag} iconUrl={g.iconUrl} size={40} active={g.id === activeId} />
                  </button>
                ))}
              </div>
              <NavList onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-sm font-semibold">{title}</p>
            <p className="m-0 hidden truncate text-xs text-muted-foreground sm:block">
              {navItems.find((n) => n.id === active)?.hint}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Alternar tema" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">{user.globalName}</span>
          <Link to="/" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Sair">
            <LogOut className="size-4" />
          </Link>
        </header>
        <main className="flex-1 overflow-x-hidden p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

export { iconByNav };
