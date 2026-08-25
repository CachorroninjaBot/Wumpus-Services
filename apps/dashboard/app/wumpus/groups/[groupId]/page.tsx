import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getWumpusSession } from "../../../../lib/auth";
import { getWumpusGroup, isInternalApiError, listInstalledWumpusGuilds } from "../../../../lib/wumpus-api";
import { moduleDescriptors, moduleLabel } from "../../../../lib/wumpus-modules";
import { moduleIcon, WumpusIcon } from "../../_components/wumpus-icon";
import { assignServerToGroup, removeServerFromGroup } from "../../actions";

type Props = { params: Promise<{ groupId: string }>; searchParams: Promise<{ created?: string; server?: string }> };

export default async function WumpusGroupPage({ params, searchParams }: Props) {
  const [{ groupId: rawGroupId }, query] = await Promise.all([params, searchParams]);
  const groupId = Number(rawGroupId);
  const session = await getWumpusSession();
  if (!session || !Number.isSafeInteger(groupId)) redirect("/wumpus");
  const detailsRequest = getWumpusGroup(groupId, session.user.id).catch((error: unknown) => {
    if (isInternalApiError(error, 404)) return null;
    throw error;
  });
  const [details, installed] = await Promise.all([detailsRequest, listInstalledWumpusGuilds()]);
  if (!details) redirect("/wumpus?error=group_not_found");
  const managed = installed.filter((server) => session.guilds.some((guild) => guild.id === server.guildId));
  const groupedIds = new Set(details.servers.map((server) => server.guildId));
  const available = managed.filter((server) => !groupedIds.has(server.guildId));
  const configs = new Map(details.configs.map((config) => [config.module, config]));
  const activeModules = moduleDescriptors.filter((entry) => configs.get(entry.module)?.enabled !== false).length;

  return <main className="w2-group-page">
    <header className="w2-group-topbar"><Link href="/wumpus"><WumpusIcon name="back" />Servidores e grupos</Link><div><span className="w2-online-dot" />Configuração compartilhada</div></header>
    <div className="w2-group-content">
      {query.created && <p className="save-notice">Grupo criado. Adicione abaixo os servidores que devem compartilhar esta configuração.</p>}
      {query.server && <p className="save-notice">Servidor {query.server === "assigned" ? "adicionado ao grupo" : "removido do grupo"}.</p>}
      <section className="w2-group-hero">
        <span className="w2-group-symbol" style={{ background: details.group.color }}><WumpusIcon name="group" /></span>
        <div><p className="w2-kicker">GRUPO DE SERVIDORES</p><h1>{details.group.name}</h1><p>{details.group.description || "Configurações compartilhadas para as comunidades deste grupo."}</p></div>
        <div className="w2-group-hero-stats"><span><strong>{details.servers.length}</strong><small>servidores</small></span><span><strong>{activeModules}</strong><small>módulos ativos</small></span></div>
      </section>

      <section className="w2-group-grid">
        <div className="w2-surface w2-group-modules"><header className="w2-section-head"><div><h2>Configuração do grupo</h2><p>Estas regras chegam a todos os servidores abaixo.</p></div><span>{moduleDescriptors.length} recursos</span></header>
          <div>{moduleDescriptors.map((entry) => { const current = configs.get(entry.module); return <Link href={`/wumpus/groups/${groupId}/${entry.module}`} key={entry.module}>
            <span className={`w2-module-icon ${entry.group.toLowerCase()}`}><WumpusIcon name={moduleIcon(entry.module)} /></span>
            <div><strong>{moduleLabel(entry.module)}</strong><small>{entry.description}</small></div>
            <em className={current?.enabled === false ? "paused" : "active"}>{current?.enabled === false ? "Pausado" : "Ativo"}</em><WumpusIcon name="chevron" />
          </Link>; })}</div>
        </div>

        <aside className="w2-group-side">
          <section className="w2-surface"><header className="w2-section-head"><div><h2>Servidores do grupo</h2><p>Todos recebem as configurações ao lado.</p></div></header>
            <div className="w2-group-servers">{details.servers.length ? details.servers.map((server) => { const exceptionCount = Object.keys(server.exceptions).length; return <article key={server.guildId}>
              {server.iconUrl ? <Image src={server.iconUrl} alt="" width={38} height={38} unoptimized /> : <span>{server.name.slice(0, 1).toUpperCase()}</span>}
              <div><Link href={`/wumpus/${server.guildId}`}>{server.name}</Link><small>{exceptionCount ? `${exceptionCount} ${exceptionCount === 1 ? "personalização" : "personalizações"}` : "Seguindo todo o grupo"}</small></div>
              <form action={removeServerFromGroup}><input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="guildId" value={server.guildId} /><button type="submit" aria-label={`Remover ${server.name}`}><WumpusIcon name="close" /></button></form>
            </article>; }) : <div className="w2-empty-compact"><WumpusIcon name="group" /><strong>Nenhum servidor adicionado</strong><p>Escolha um servidor abaixo.</p></div>}</div>
          </section>

          <section className="w2-surface w2-add-server"><header className="w2-section-head"><div><h2>Adicionar servidor</h2><p>Ele começará seguindo o grupo imediatamente.</p></div></header>
            {available.length ? <div>{available.map((server) => <form action={assignServerToGroup} key={server.guildId}><input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="guildId" value={server.guildId} /><button type="submit">
              {server.iconUrl ? <Image src={server.iconUrl} alt="" width={34} height={34} unoptimized /> : <span>{server.name.slice(0, 1)}</span>}<strong>{server.name}</strong><small>Adicionar</small><WumpusIcon name="chevron" />
            </button></form>)}</div> : <p className="w2-muted">Todos os seus servidores disponíveis já pertencem a um grupo.</p>}
          </section>
        </aside>
      </section>
    </div>
  </main>;
}
