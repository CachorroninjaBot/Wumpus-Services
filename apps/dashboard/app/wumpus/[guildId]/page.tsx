import Link from "next/link";
import { redirect } from "next/navigation";
import { getWumpusSession } from "../../../lib/auth";
import { getWumpusOverview, listInstalledWumpusGuilds } from "../../../lib/wumpus-api";
import { moduleDescriptors, moduleLabel } from "../../../lib/wumpus-modules";
import { moduleIcon, WumpusIcon } from "../_components/wumpus-icon";
import { WumpusFrame } from "../_components/wumpus-frame";

type Props = { params: Promise<{ guildId: string }> };

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function eventLabel(value: string) {
  const labels: Record<string, string> = {
    module_config_updated: "Configuração atualizada", module_enabled: "Módulo ativado",
    module_disabled: "Módulo pausado", incident_created: "Incidente detectado",
    automation_executed: "Automação executada", role_draft_created: "Rascunho de cargos criado"
  };
  return labels[value] ?? "Atividade registrada";
}

export default async function WumpusGuildOverview({ params }: Props) {
  const { guildId } = await params;
  const [session, installed] = await Promise.all([getWumpusSession(), listInstalledWumpusGuilds()]);
  if (!session) redirect("/wumpus");
  if (!session.guilds.some((guild) => guild.id === guildId) || !installed.some((guild) => guild.guildId === guildId)) redirect("/wumpus?error=access_denied");
  const overview = await getWumpusOverview(guildId);
  const configs = new Map(overview.configs.map((config) => [config.module, config]));
  const activeModules = moduleDescriptors.filter((entry) => configs.get(entry.module)?.enabled !== false).length;

  return <WumpusFrame guild={overview.guild} active="overview">
    <header className="w2-page-header">
      <div><p className="w2-kicker">PAINEL DO SERVIDOR</p><h1>{overview.guild.name}</h1><p>O essencial da sua comunidade, sem precisar decorar comandos ou IDs.</p></div>
      <div className="w2-sync"><span /><div><strong>Tudo sincronizado</strong><small>Discord e Wumpus conectados</small></div></div>
    </header>

    {overview.group ? <Link href={`/wumpus/groups/${overview.group.id}`} className="w2-context-banner">
      <span className="group-color" style={{ background: overview.group.color }} /><div><small>OPERAÇÃO COMPARTILHADA</small><strong>{overview.group.name}</strong><p>{overview.exceptionModules.length ? `${overview.exceptionModules.length} módulo(s) personalizado(s) neste servidor` : "Todos os módulos seguem a configuração do grupo"}</p></div><WumpusIcon name="chevron" />
    </Link> : null}

    <section className="w2-stat-grid" aria-label="Resumo do servidor">
      <article><span className="purple"><WumpusIcon name="grid" /></span><div><small>Módulos ativos</small><strong>{activeModules}<em> de {moduleDescriptors.length}</em></strong></div></article>
      <article><span className={overview.counts.openIncidents ? "red" : "green"}><WumpusIcon name="security" /></span><div><small>Incidentes abertos</small><strong>{overview.counts.openIncidents}</strong></div></article>
      <article><span className="blue"><WumpusIcon name="moderation" /></span><div><small>Casos aguardando equipe</small><strong>{overview.counts.openCases}</strong></div></article>
      <article><span className="amber"><WumpusIcon name="automation" /></span><div><small>Automações funcionando</small><strong>{overview.counts.activeAutomations}</strong></div></article>
    </section>

    <section className="w2-overview-grid">
      <div className="w2-surface w2-modules-panel">
        <header className="w2-section-head"><div><h2>Recursos do Wumpus</h2><p>Escolha o que você quer configurar.</p></div><span>{activeModules} ativos</span></header>
        {(["Operação", "Proteção", "Atendimento", "Inteligência"] as const).map((group) => <section className="w2-module-group" key={group}>
          <h3>{group === "Operação" ? "Gerenciar" : group === "Proteção" ? "Proteger" : group === "Atendimento" ? "Atender" : group}</h3>
          <div>{moduleDescriptors.filter((entry) => entry.group === group).map((entry) => { const config = configs.get(entry.module); const disabled = config?.enabled === false; return <Link href={`/wumpus/${guildId}/${entry.module}`} className="w2-module-row" key={entry.module}>
            <span className={`w2-module-icon ${entry.group.toLowerCase()}`}><WumpusIcon name={moduleIcon(entry.module)} /></span>
            <div><strong>{moduleLabel(entry.module)}</strong><small>{entry.description}</small></div>
            <em className={disabled ? "paused" : "active"}>{overview.group ? (overview.exceptionModules.includes(entry.module) ? "Personalizado" : "Pelo grupo") : disabled ? "Pausado" : "Ativo"}</em>
            <WumpusIcon name="chevron" />
          </Link>; })}</div>
        </section>)}
      </div>

      <aside className="w2-overview-side">
        <section className="w2-surface">
          <header className="w2-section-head"><div><h2>Atividade recente</h2><p>Alterações e ações importantes.</p></div><Link href={`/wumpus/${guildId}/logs`}>Ver tudo</Link></header>
          {overview.events.length ? <ol className="w2-activity-list">{overview.events.slice(0, 6).map((event) => <li key={event.id}><span><WumpusIcon name="activity" /></span><div><strong>{eventLabel(event.eventType)}</strong><small>{formatTime(event.occurredAt)}</small></div></li>)}</ol> : <div className="w2-empty-compact"><WumpusIcon name="check" /><strong>Nenhuma alteração recente</strong><p>As próximas mudanças aparecerão aqui.</p></div>}
        </section>
        <section className="w2-surface w2-health-card">
          <header className="w2-section-head"><div><h2>Saúde da comunidade</h2><p>Leitura rápida das proteções.</p></div></header>
          <div><span><WumpusIcon name="security" /></span><p><strong>{overview.incidents.length ? "Requer atenção" : "Proteções normais"}</strong><small>{overview.incidents.length ? `${overview.incidents.length} incidente(s) recente(s)` : "Nenhum incidente recente"}</small></p></div>
          <div><span><WumpusIcon name="roles" /></span><p><strong>{overview.roles.length} cargos sincronizados</strong><small>Disponíveis nos seletores do painel</small></p></div>
          <div><span><WumpusIcon name="book" /></span><p><strong>{overview.counts.knowledgeArticles} artigos aprovados</strong><small>Prontos para respostas assistidas</small></p></div>
        </section>
      </aside>
    </section>
  </WumpusFrame>;
}
