import type { WumpusModule } from "@huborder/core";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { moduleDescriptors, moduleLabel } from "../../../lib/wumpus-modules";
import { moduleIcon, WumpusIcon } from "./wumpus-icon";

type Props = {
  guild: { guildId: string; name: string; iconUrl?: string | null; memberCount: number | null };
  active: WumpusModule | "overview";
  children: ReactNode;
};

const groups = [
  { name: "Gerenciar", source: "Operação" },
  { name: "Proteger", source: "Proteção" },
  { name: "Atender", source: "Atendimento" },
  { name: "Inteligência", source: "Inteligência" }
] as const;

export function WumpusFrame({ guild, active, children }: Props) {
  return <main className="w2-app">
    <aside className="w2-rail" aria-label="Atalhos do Wumpus">
      <Link href="/wumpus" className="w2-brand-mark" aria-label="Wumpus">W</Link>
      <span className="w2-rail-separator" />
      <Link href={`/wumpus/${guild.guildId}`} className="w2-rail-server active" aria-label={guild.name}>
        {guild.iconUrl ? <Image src={guild.iconUrl} alt="" width={44} height={44} unoptimized /> : <span>{guild.name.slice(0, 1).toUpperCase()}</span>}
      </Link>
      <Link href="/wumpus" className="w2-rail-button" aria-label="Ver todos os servidores"><WumpusIcon name="grid" /></Link>
      <Link href="/wumpus" className="w2-rail-button" aria-label="Gerenciar grupos"><WumpusIcon name="group" /></Link>
      <span className="w2-rail-spacer" />
      <span className="w2-rail-health" title="Wumpus conectado" />
    </aside>

    <aside className="w2-sidebar">
      <header className="w2-server-head">
        <div><small>Servidor atual</small><strong>{guild.name}</strong></div>
        <Link href="/wumpus" aria-label="Trocar servidor"><WumpusIcon name="chevron" /></Link>
      </header>
      <div className="w2-server-status"><span /><p><strong>Wumpus conectado</strong><small>{guild.memberCount?.toLocaleString("pt-BR") ?? "—"} membros sincronizados</small></p></div>
      <nav className="w2-nav" aria-label="Módulos do Wumpus">
        <Link href={`/wumpus/${guild.guildId}`} className={active === "overview" ? "active" : ""}>
          <WumpusIcon name="home" /><span>Visão geral</span>
        </Link>
        {groups.map((group) => <section key={group.name}>
          <h2>{group.name}</h2>
          {moduleDescriptors.filter((entry) => entry.group === group.source).map((entry) => <Link href={`/wumpus/${guild.guildId}/${entry.module}`} className={active === entry.module ? "active" : ""} key={entry.module}>
            <WumpusIcon name={moduleIcon(entry.module)} /><span>{moduleLabel(entry.module)}</span>
          </Link>)}
        </section>)}
      </nav>
      <footer className="w2-sidebar-footer">
        <Link href="/wumpus"><WumpusIcon name="group" /><span><strong>Servidores e grupos</strong><small>Trocar contexto</small></span></Link>
        <Link href="/wumpus" aria-label="Ajuda"><WumpusIcon name="help" /></Link>
      </footer>
    </aside>

    <section className="w2-content">
      <div className="w2-mobile-head"><Link href="/wumpus" className="w2-brand-mark">W</Link><strong>{guild.name}</strong><span>Role para ver os módulos</span></div>
      <div className="w2-page">{children}</div>
    </section>
  </main>;
}
