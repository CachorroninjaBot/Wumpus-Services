import Image from "next/image";
import Link from "next/link";
import { getWumpusSession } from "../../lib/auth";
import { getWumpusGroup, listInstalledWumpusGuilds, listWumpusGroups } from "../../lib/wumpus-api";
import { WumpusIcon } from "./_components/wumpus-icon";
import { createGroup } from "./actions";

type Props = { searchParams: Promise<{ error?: string }> };

function errorMessage(error: string | undefined) {
  if (!error) return null;
  if (error === "access_denied") return "Sua conta não tem permissão para administrar esse servidor.";
  if (error === "group_name_unavailable") return "Você já possui um grupo com esse nome.";
  if (error === "group_not_found") return "Esse grupo não está mais disponível para esta conta. Escolha outro grupo ou crie um novo.";
  return "Não foi possível concluir esta ação. Revise os dados e tente novamente.";
}

export default async function WumpusHome({ searchParams }: Props) {
  const [session, installed, query] = await Promise.all([getWumpusSession(), listInstalledWumpusGuilds().catch(() => []), searchParams]);
  const error = errorMessage(query.error);
  if (!session) return <main className="w2-login"><section>
    <span className="w2-login-brand">W</span><p className="w2-kicker">WUMPUS PARA DISCORD</p>
    <h1>Gerenciar uma comunidade pode ser simples.</h1>
    <p>Entre com o Discord e configure proteção, atendimento, equipe e automações em um só lugar.</p>
    {error && <p className="form-error">{error}</p>}
    <Link className="w2-primary" href="/auth/discord"><WumpusIcon name="bot" />Continuar com Discord<WumpusIcon name="chevron" /></Link>
    <small>Você verá apenas os servidores que pode gerenciar.</small>
  </section></main>;

  const groups = await listWumpusGroups(session.user.id);
  const details = await Promise.all(groups.map((group) => getWumpusGroup(group.id, session.user.id).catch(() => null)));
  const groupByGuild = new Map(details.flatMap((group) => group?.servers.map((server) => [server.guildId, group.group]) ?? []));
  const managed = installed.filter((server) => session.guilds.some((guild) => guild.id === server.guildId));

  return <main className="w2-home">
    <header className="w2-homebar"><Link href="/wumpus" className="w2-home-brand"><span>W</span><div><strong>Wumpus</strong><small>Dashboard</small></div></Link><nav><a href="#servidores">Servidores</a><a href="#grupos">Grupos</a></nav><div className="w2-account"><span>{session.user.globalName ?? session.user.username}</span><form action="/auth/logout" method="post"><button>Sair</button></form></div></header>
    <div className="w2-home-content">
      <section className="w2-home-intro"><div><p className="w2-kicker">SELECIONE ONDE TRABALHAR</p><h1>Suas comunidades</h1><p>Abra um servidor para configurar seus módulos ou agrupe vários servidores para administrar tudo junto.</p></div><div><strong>{managed.length}</strong><span>servidores com Wumpus</span></div></section>
      {error && <p className="form-error">{error}</p>}

      <section id="servidores" className="w2-home-section">
        <header className="w2-section-head"><div><h2>Servidores</h2><p>Você possui permissão de gerenciamento nestas comunidades.</p></div><span>{managed.length} disponíveis</span></header>
        <div className="w2-server-grid">{managed.length ? managed.map((guild) => { const group = groupByGuild.get(guild.guildId); return <Link href={`/wumpus/${guild.guildId}`} className="w2-server-card" key={guild.guildId}>
          {guild.iconUrl ? <Image src={guild.iconUrl} alt="" width={56} height={56} unoptimized /> : <span className="w2-server-fallback">{guild.name.slice(0, 1).toUpperCase()}</span>}
          <div><strong>{guild.name}</strong><p><span className="w2-online-dot" />Wumpus conectado</p><small>{guild.memberCount?.toLocaleString("pt-BR") ?? "—"} membros</small></div>
          {group ? <em><WumpusIcon name="group" />{group.name}</em> : <em className="solo">Configuração própria</em>}
          <WumpusIcon name="chevron" />
        </Link>; }) : <div className="w2-empty"><WumpusIcon name="bot" /><h2>Nenhum servidor encontrado</h2><p>Adicione o Wumpus a um servidor onde você tenha a permissão Gerenciar servidor.</p></div>}</div>
      </section>

      <section id="grupos" className="w2-groups-layout">
        <div className="w2-home-section"><header className="w2-section-head"><div><h2>Grupos de servidores</h2><p>Compartilhe as mesmas configurações entre comunidades relacionadas.</p></div><span>{groups.length} grupos</span></header>
          <div className="w2-group-list">{groups.length ? groups.map((group) => <Link href={`/wumpus/groups/${group.id}`} key={group.id}>
            <span className="w2-group-color" style={{ background: group.color }} /><div><strong>{group.name}</strong><p>{group.description || "Sem descrição adicionada"}</p></div><em>{group.serverCount} {group.serverCount === 1 ? "servidor" : "servidores"}</em><WumpusIcon name="chevron" />
          </Link>) : <div className="w2-empty-compact"><WumpusIcon name="group" /><strong>Você ainda não criou grupos</strong><p>Use o formulário ao lado para começar.</p></div>}</div>
        </div>
        <aside className="w2-create-group"><div className="w2-create-icon"><WumpusIcon name="group" /></div><h2>Novo grupo</h2><p>Agrupe servidores do mesmo projeto, negócio ou comunidade.</p><form action={createGroup}>
          <label><span>Nome do grupo</span><input name="name" placeholder="Ex.: Rede Hub Express" minLength={2} maxLength={60} required /></label>
          <label><span>Descrição <small>opcional</small></span><textarea name="description" placeholder="Para que este grupo será usado?" maxLength={280} rows={3} /></label>
          <label className="w2-color-input"><span>Cor de identificação</span><div><input type="color" name="color" defaultValue="#5865F2" /><small>Ajuda a reconhecer o grupo rapidamente.</small></div></label>
          <button className="w2-primary" type="submit">Criar grupo<WumpusIcon name="chevron" /></button>
        </form></aside>
      </section>
    </div>
  </main>;
}
