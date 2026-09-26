import { useCallback, useEffect, useMemo, useState } from "react";
import { brand, moduleGroups, modules, modulesOf, type ModuleId } from "../core/brand";
import {
  ApiError,
  closeIncident,
  createArticle,
  createGroup,
  deleteArticle,
  getArticles,
  getIncidents,
  getMe,
  getOverview,
  logout,
  navigate,
  parseRoute,
  updateArticle,
  type Group,
  type GuildOverview,
  type Incident,
  type KnowledgeArticle,
  type Me,
  type Route,
  type SessionGuild
} from "./api";
import { GroupPage } from "./group-page";
import { ModulePage } from "./module-page";
import {
  BrandMark,
  EmptyState,
  GuildAvatar,
  Icon,
  Notice,
  Panel,
  Spinner,
  StateChip,
  eventLabel,
  formatNumber,
  formatRelative
} from "./ui";

/* ------------------------------------------------------------------ *
 * App
 * ------------------------------------------------------------------ */

export function App() {
  const [session, setSession] = useState<Me | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "anonymous" | "failed">("loading");
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));
  const [mode, setMode] = useState<"dark" | "light">(
    () => (localStorage.getItem("wumpus-mode") === "light" ? "light" : "dark")
  );

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    localStorage.setItem("wumpus-mode", mode);
  }, [mode]);

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const me = await getMe();
      setSession(me);
      setStatus("ready");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setStatus("anonymous");
        return;
      }
      setStatus("failed");
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const refreshGroups = useCallback(async () => {
    try {
      setSession(await getMe());
    } catch {
      /* mantem a lista atual se a atualizacao falhar */
    }
  }, []);

  if (status === "loading") {
    return (
      <div className="boot">
        <Spinner label="Carregando o Wumpus…" />
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="boot">
        <Notice tone="error">
          Não foi possível falar com o servidor. Recarregue a página em alguns instantes.
        </Notice>
      </div>
    );
  }

  if (status === "anonymous" || !session) {
    return (
      <LoginScreen
        mode={mode}
        onToggleMode={() => setMode(mode === "dark" ? "light" : "dark")}
      />
    );
  }

  const activeGuildId = route.name === "guild" || route.name === "module" ? route.guildId : null;
  const activeGuild = activeGuildId ? session.guilds.find((guild) => guild.id === activeGuildId) ?? null : null;

  return (
    <div className="app">
      <ServerRail
        guilds={session.guilds}
        activeGuildId={activeGuildId}
        onHome={() => navigate("/wumpus")}
      />
      <Sidebar
        guild={activeGuild}
        group={
          activeGuild
            ? session.guildGroups.find((entry) => entry.guildId === activeGuild.id) ?? null
            : null
        }
        activeModule={route.name === "module" ? route.module : null}
        route={route}
      />
      <main className="content">
        <TopBar
          session={session}
          mode={mode}
          onToggleMode={() => setMode(mode === "dark" ? "light" : "dark")}
          onLogout={async () => {
            await logout().catch(() => undefined);
            window.location.href = "/wumpus";
          }}
        />
        <Content
          route={route}
          session={session}
          onGroupsChanged={refreshGroups}
        />
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Login
 * ------------------------------------------------------------------ */

function LoginScreen({ mode, onToggleMode }: { mode: "dark" | "light"; onToggleMode: () => void }) {
  return (
    <main className="login">
      <div className="login-glow" />
      <button type="button" className="login-theme" onClick={onToggleMode} aria-label="Alternar tema">
        <Icon name={mode === "dark" ? "sun" : "moon"} size={16} />
      </button>
      <section className="login-card">
        <BrandMark size={46} />
        <p className="kicker">WUMPUS PARA DISCORD</p>
        <h1>Gerenciar uma comunidade pode ser simples.</h1>
        <p className="lede">{brand.description}</p>
        <a className="btn btn-primary btn-lg" href="/auth/discord">
          <Icon name="discord" />
          Entrar com Discord
          <Icon name="chevron" size={16} />
        </a>
        <ul className="login-points">
          <li>
            <Icon name="check" size={15} /> Você vê apenas os servidores que pode gerenciar
          </li>
          <li>
            <Icon name="check" size={15} /> Configure uma vez no grupo e aplique em vários servidores
          </li>
          <li>
            <Icon name="check" size={15} /> Exceções por servidor quando um módulo precisa ser diferente
          </li>
        </ul>
        <small>Sem comandos para decorar: a dashboard é o painel de controle.</small>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ *
 * Shell
 * ------------------------------------------------------------------ */

function ServerRail({
  guilds,
  activeGuildId,
  onHome
}: {
  guilds: SessionGuild[];
  activeGuildId: string | null;
  onHome: () => void;
}) {
  const installed = guilds.filter((guild) => guild.wumpusInstalled);

  return (
    <aside className="rail" aria-label="Servidores">
      <button type="button" className="rail-brand" onClick={onHome} aria-label="Início">
        <BrandMark />
      </button>
      <span className="rail-divider" />
      <div className="rail-scroll">
        {installed.map((guild) => (
          <button
            key={guild.id}
            type="button"
            className={`rail-item${guild.id === activeGuildId ? " is-active" : ""}`}
            onClick={() => navigate(`/wumpus/${guild.id}`)}
            title={guild.name}
          >
            <GuildAvatar name={guild.name} iconUrl={guild.iconUrl} size={44} />
          </button>
        ))}
      </div>
      <span className="rail-spacer" />
      <a
        className="rail-item rail-add"
        href="https://discord.com/oauth2/authorize?client_id=1187601667559002225&permissions=8&scope=bot%20applications.commands"
        target="_blank"
        rel="noreferrer"
        title="Adicionar o Wumpus a outro servidor"
      >
        <Icon name="plus" />
      </a>
    </aside>
  );
}

function Sidebar({
  guild,
  group,
  activeModule,
  route
}: {
  guild: SessionGuild | null;
  group: { name: string; color: string } | null;
  activeModule: string | null;
  route: Route;
}) {
  if (!guild) {
    return (
      <aside className="sidebar">
        <header className="sidebar-head">
          <span className="sidebar-avatar sidebar-avatar-muted">
            <Icon name="grid" />
          </span>
          <div>
            <strong>Wumpus</strong>
            <small>Escolha um servidor</small>
          </div>
        </header>
        <nav className="nav">
          <button type="button" className="nav-item is-active" onClick={() => navigate("/wumpus")}>
            <Icon name="home" /> Servidores e grupos
          </button>
        </nav>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <header className="sidebar-head">
        <GuildAvatar name={guild.name} iconUrl={guild.iconUrl} size={38} />
        <div>
          <strong>{guild.name}</strong>
          <small>
            {group ? (
              <>
                <span className="dot-group" style={{ background: group.color }} />
                {group.name}
              </>
            ) : (
              "Configuração própria"
            )}
          </small>
        </div>
      </header>

      <nav className="nav">
        <button
          type="button"
          className={`nav-item${route.name === "guild" ? " is-active" : ""}`}
          onClick={() => navigate(`/wumpus/${guild.id}`)}
        >
          <Icon name="home" /> Visão geral
        </button>
        {moduleGroups.map((entry) => (
          <section key={entry.id}>
            <h2>{entry.label}</h2>
            {modulesOf(entry.id).map((descriptor) => (
              <button
                key={descriptor.id}
                type="button"
                className={`nav-item${activeModule === descriptor.id ? " is-active" : ""}`}
                onClick={() => navigate(`/wumpus/${guild.id}/${descriptor.id}`)}
              >
                <Icon name={descriptor.icon} />
                <span>{descriptor.label}</span>
              </button>
            ))}
          </section>
        ))}
      </nav>

      <footer className="sidebar-foot">
        <button type="button" className="nav-item" onClick={() => navigate("/wumpus")}>
          <Icon name="layers" /> Grupos e servidores
        </button>
      </footer>
    </aside>
  );
}

function TopBar({
  session,
  mode,
  onToggleMode,
  onLogout
}: {
  session: Me;
  mode: "dark" | "light";
  onToggleMode: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="topbar">
      <button type="button" className="topbar-home" onClick={() => navigate("/wumpus")}>
        <Icon name="grid" size={15} /> Todas as comunidades
      </button>
      <div className="topbar-right">
        <button type="button" className="icon-button" onClick={onToggleMode} aria-label="Alternar tema">
          <Icon name={mode === "dark" ? "sun" : "moon"} size={16} />
        </button>
        <span className="topbar-user">
          {session.user.avatarUrl ? (
            <img src={session.user.avatarUrl} alt="" width={26} height={26} />
          ) : (
            <span className="topbar-user-fallback">{session.user.username.slice(0, 1).toUpperCase()}</span>
          )}
          {session.user.globalName ?? session.user.username}
        </span>
        <button type="button" className="icon-button" onClick={onLogout} aria-label="Sair">
          <Icon name="logout" size={16} />
        </button>
      </div>
    </header>
  );
}

function Content({
  route,
  session,
  onGroupsChanged
}: {
  route: Route;
  session: Me;
  onGroupsChanged: () => Promise<void>;
}) {
  if (route.name === "module") {
    return <ModulePage guildId={route.guildId} module={route.module} />;
  }
  if (route.name === "group") {
    return <GroupPage groupId={route.groupId} session={session} onGroupsChanged={onGroupsChanged} />;
  }
  if (route.name === "guild") {
    return <GuildOverviewPage guildId={route.guildId} />;
  }
  return <HomePage session={session} onGroupsChanged={onGroupsChanged} />;
}

/* ------------------------------------------------------------------ *
 * Inicio: servidores + grupos
 * ------------------------------------------------------------------ */

function HomePage({ session, onGroupsChanged }: { session: Me; onGroupsChanged: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const installed = session.guilds.filter((guild) => guild.wumpusInstalled);
  const pending = session.guilds.filter((guild) => !guild.wumpusInstalled);

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-title">
          <div>
            <p className="kicker">SELECIONE ONDE TRABALHAR</p>
            <h1>Suas comunidades</h1>
            <p>Abra um servidor para configurar os módulos ou agrupe vários para administrar tudo junto.</p>
          </div>
        </div>
      </header>

      <section className="stat-grid">
        <article className="stat">
          <span className="stat-icon tone-brand">
            <Icon name="server" />
          </span>
          <div>
            <small>Servidores com Wumpus</small>
            <strong>{installed.length}</strong>
            <em>prontos para configurar</em>
          </div>
        </article>
        <article className="stat">
          <span className="stat-icon tone-info">
            <Icon name="layers" />
          </span>
          <div>
            <small>Grupos</small>
            <strong>{session.groups.length}</strong>
            <em>configuração compartilhada</em>
          </div>
        </article>
        <article className="stat">
          <span className="stat-icon tone-warn">
            <Icon name="alert" />
          </span>
          <div>
            <small>Sem o Wumpus</small>
            <strong>{pending.length}</strong>
            <em>convide o bot para começar</em>
          </div>
        </article>
        <article className="stat">
          <span className="stat-icon tone-ok">
            <Icon name="key" />
          </span>
          <div>
            <small>Módulos disponíveis</small>
            <strong>{modules.length}</strong>
            <em>em {moduleGroups.length} áreas</em>
          </div>
        </article>
      </section>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <section className="page-section">
        <header className="section-head">
          <div>
            <h2>Servidores</h2>
            <p>Você tem permissão de gerenciamento nestas comunidades.</p>
          </div>
          <span>{installed.length} com o Wumpus</span>
        </header>
        {installed.length ? (
          <div className="server-grid">
            {installed.map((guild) => (
              <button
                key={guild.id}
                type="button"
                className="server-card"
                onClick={() => navigate(`/wumpus/${guild.id}`)}
              >
                <GuildAvatar name={guild.name} iconUrl={guild.iconUrl} size={52} />
                <div className="server-card-body">
                  <strong>{guild.name}</strong>
                  <p>
                    <span className="dot-online" />
                    Wumpus conectado
                  </p>
                  <small>{guild.owner ? "Você é o dono" : "Permissão de gerenciamento"}</small>
                </div>
                <Icon name="chevron" size={15} />
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="server"
            title="Nenhum servidor com o Wumpus ainda"
            description="Adicione o Wumpus a um servidor onde você tenha a permissão Gerenciar servidor."
          />
        )}
      </section>

      {pending.length ? (
        <section className="page-section">
          <header className="section-head">
            <div>
              <h2>Prontos para receber o Wumpus</h2>
              <p>Você gerencia estas comunidades, mas o bot ainda não está nelas.</p>
            </div>
            <span>{pending.length}</span>
          </header>
          <div className="server-grid">
            {pending.map((guild) => (
              <div className="server-card server-card-pending" key={guild.id}>
                <GuildAvatar name={guild.name} iconUrl={guild.iconUrl} size={52} />
                <div className="server-card-body">
                  <strong>{guild.name}</strong>
                  <p>Sem o Wumpus instalado</p>
                  <small>Convide o bot para configurar</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="page-section groups-layout">
        <div>
          <header className="section-head">
            <div>
              <h2>Grupos de servidores</h2>
              <p>Compartilhe a mesma configuração entre comunidades relacionadas.</p>
            </div>
            <span>
              {session.groups.length} {session.groups.length === 1 ? "grupo" : "grupos"}
            </span>
          </header>
          {session.groups.length ? (
            <div className="group-list">
              {session.groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className="group-row"
                  onClick={() => navigate(`/wumpus/groups/${group.id}`)}
                >
                  <span className="group-bar" style={{ background: group.color }} />
                  <div>
                    <strong>{group.name}</strong>
                    <p>{group.description || "Sem descrição adicionada"}</p>
                  </div>
                  <em>
                    {group.serverCount} {group.serverCount === 1 ? "servidor" : "servidores"}
                  </em>
                  <Icon name="chevron" size={15} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="layers"
              title="Você ainda não criou grupos"
              description="Use o formulário ao lado para começar."
            />
          )}
        </div>

        <CreateGroupCard
          onCreated={async () => {
            await onGroupsChanged();
          }}
          onError={setError}
        />
      </section>
    </div>
  );
}

function CreateGroupCard({
  onCreated,
  onError
}: {
  onCreated: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#7c5cff");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError(null);
    setCreated(null);
    try {
      const result = await createGroup({ name, description, color });
      setCreated(result.group.name);
      setName("");
      setDescription("");
      await onCreated();
    } catch (error) {
      if (error instanceof ApiError && error.code === "group_name_unavailable") {
        onError("Você já possui um grupo com esse nome.");
      } else if (error instanceof ApiError && error.code === "invalid_name") {
        onError("O nome do grupo precisa ter entre 2 e 60 caracteres.");
      } else {
        onError("Não foi possível criar o grupo agora. Tente novamente.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="create-group">
      <span className="create-group-icon">
        <Icon name="layers" />
      </span>
      <h2>Novo grupo</h2>
      <p>Agrupe servidores do mesmo projeto, negócio ou comunidade.</p>
      {created ? <Notice tone="ok">Grupo “{created}” criado.</Notice> : null}
      <form onSubmit={submit}>
        <label>
          <span>Nome do grupo</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Rede Hub Express"
            minLength={2}
            maxLength={60}
            required
          />
        </label>
        <label>
          <span>
            Descrição <small>opcional</small>
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Para que este grupo será usado?"
            maxLength={280}
            rows={3}
          />
        </label>
        <label className="color-field">
          <span>Cor de identificação</span>
          <div>
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
            <small>Ajuda a reconhecer o grupo rapidamente.</small>
          </div>
        </label>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? "Criando…" : "Criar grupo"}
          {busy ? null : <Icon name="chevron" size={15} />}
        </button>
      </form>
    </aside>
  );
}

/* ------------------------------------------------------------------ *
 * Visao geral do servidor
 * ------------------------------------------------------------------ */

function GuildOverviewPage({ guildId }: { guildId: string }) {
  const [overview, setOverview] = useState<GuildOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setOverview(null);
    setError(null);
    getOverview(guildId)
      .then((data) => {
        if (alive) setOverview(data);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 403) setError("Sua conta não tem permissão para administrar esse servidor.");
        else if (err instanceof ApiError && err.status === 404) setError("Esse servidor não está mais disponível para esta conta.");
        else setError("Não foi possível carregar este servidor agora.");
      });
    return () => {
      alive = false;
    };
  }, [guildId]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!overview) return <Spinner label="Carregando o servidor…" />;

  const byModule = useMemo(
    () => new Map(overview.modules.map((entry) => [entry.module, entry])),
    [overview]
  );

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-title">
          <GuildAvatar name={overview.guild.name} iconUrl={overview.guild.iconUrl} size={56} />
          <div>
            <p className="kicker">PAINEL DO SERVIDOR</p>
            <h1>{overview.guild.name}</h1>
            <p>
              {formatNumber(overview.guild.memberCount)} membros · Wumpus conectado · sincronizado{" "}
              {formatRelative(overview.guild.lastSyncedAt)}
            </p>
          </div>
        </div>
        <div className="page-actions">
          <span className="pill pill-ok">
            <i /> Sincronizado
          </span>
        </div>
      </header>

      {overview.group ? (
        <section className="banner">
          <span className="banner-bar" style={{ background: overview.group.color }} />
          <div>
            <small>OPERAÇÃO COMPARTILHADA</small>
            <strong>{overview.group.name}</strong>
            <p>
              {overview.counts.customModules
                ? `${overview.counts.customModules} módulo(s) com exceção neste servidor.`
                : "Todos os módulos seguem a configuração do grupo."}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate(`/wumpus/groups/${overview.group!.id}`)}
          >
            Abrir grupo <Icon name="chevron" size={15} />
          </button>
        </section>
      ) : (
        <section className="banner banner-muted">
          <span className="banner-bar banner-bar-muted" />
          <div>
            <small>SEM GRUPO</small>
            <strong>Configuração individual</strong>
            <p>Crie um grupo para configurar vários servidores de uma vez e manter tudo igual automaticamente.</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => navigate("/wumpus")}>
            <Icon name="layers" size={15} /> Ver grupos
          </button>
        </section>
      )}

      <section className="stat-grid">
        <article className="stat">
          <span className="stat-icon tone-brand">
            <Icon name="grid" />
          </span>
          <div>
            <small>Módulos ativos</small>
            <strong>
              {overview.counts.activeModules}
              <em className="stat-of"> de {overview.modules.length}</em>
            </strong>
            <em>disponíveis neste servidor</em>
          </div>
        </article>
        <article className="stat">
          <span className={`stat-icon ${overview.counts.openIncidents ? "tone-danger" : "tone-ok"}`}>
            <Icon name="shield" />
          </span>
          <div>
            <small>Incidentes abertos</small>
            <strong>{overview.counts.openIncidents}</strong>
            <em>{overview.counts.openIncidents ? "requer atenção" : "nada pendente"}</em>
          </div>
        </article>
        <article className="stat">
          <span className="stat-icon tone-info">
            <Icon name="ticket" />
          </span>
          <div>
            <small>Atendimentos ativos</small>
            <strong>{overview.counts.openTickets}</strong>
            <em>abertos ou em andamento</em>
          </div>
        </article>
        <article className="stat">
          <span className="stat-icon tone-warn">
            <Icon name="book" />
          </span>
          <div>
            <small>Artigos aprovados</small>
            <strong>{overview.counts.knowledgeArticles}</strong>
            <em>prontos para respostas</em>
          </div>
        </article>
      </section>

      <div className="columns">
        <Panel
          title="Recursos do Wumpus"
          subtitle="Configure no grupo ou personalize apenas neste servidor."
          action={<span className="panel-count">{overview.counts.activeModules} ativos</span>}
        >
          {moduleGroups.map((group) => (
            <div className="module-block" key={group.id}>
              <h3>{group.label}</h3>
              <div className="module-list">
                {modulesOf(group.id).map((descriptor) => {
                  const state = byModule.get(descriptor.id);
                  return (
                    <button
                      key={descriptor.id}
                      type="button"
                      className="module-row"
                      onClick={() => navigate(`/wumpus/${guildId}/${descriptor.id}`)}
                    >
                      <span className={`module-icon group-${group.id}`}>
                        <Icon name={descriptor.icon} />
                      </span>
                      <div>
                        <strong>{descriptor.label}</strong>
                        <small>{descriptor.description}</small>
                      </div>
                      {state ? <StateChip module={state} /> : null}
                      <Icon name="chevron" size={15} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Panel>

        <aside className="side-col">
          <KnowledgePanel guildId={guildId} />

          <SecurityIncidents guildId={guildId} />

          <Panel title="Atividade recente" subtitle="Alterações e ações importantes.">
            {overview.events.length ? (
              <ol className="activity">
                {overview.events.map((event) => (
                  <li key={event.id}>
                    <span className={event.severity === "critical" ? "activity-icon tone-danger" : "activity-icon"}>
                      <Icon name="bolt" size={15} />
                    </span>
                    <div>
                      <strong>{eventLabel(event.eventType)}</strong>
                      <small>{formatRelative(event.occurredAt)}</small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon="check" title="Nenhuma alteração recente" description="As próximas mudanças aparecerão aqui." />
            )}
          </Panel>

          <section className="panel panel-accent">
            <span className="spark">
              <Icon name="spark" size={16} />
            </span>
            <h2>Assistente de configuração</h2>
            <p>
              Descreva o que você quer e receba um rascunho pronto para revisar antes de aplicar no Discord.
            </p>
            <button type="button" className="btn btn-primary btn-block" disabled title="Chega junto com o bot">
              Em breve
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Incidentes de seguranca
 * ------------------------------------------------------------------ */

const incidentTypeLabels: Record<string, string> = {
  raid: "Raid — entradas em massa",
  nuke: "Ações destrutivas em sequência",
  automod: "Filtro automático",
  permission_risk: "Permissão de risco"
};

const severityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica"
};

/** Resumo legivel do `details`, que varia conforme o tipo de incidente. */
function incidentSummary(incident: Incident): string {
  const details = incident.details ?? {};

  if (incident.incidentType === "raid") {
    const joins = Number(details.joins ?? 0);
    const window = Number(details.windowSeconds ?? 0);
    const contained = Number(details.contained ?? 0);
    return `${joins} contas entraram em ${window}s · ${contained} contida(s)`;
  }

  if (incident.incidentType === "nuke") {
    const actions = Number(details.actions ?? 0);
    const window = Number(details.windowSeconds ?? 0);
    const last = typeof details.lastAction === "string" ? details.lastAction : "ação destrutiva";
    return `${actions} ações em ${window}s · última: ${last}`;
  }

  return "Registrado pelo Wumpus";
}

function SecurityIncidents({ guildId }: { guildId: string }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await getIncidents(guildId, 10);
      setIncidents(data.incidents);
    } catch {
      /* Painel secundario: se falhar, o resto da tela continua util. */
    } finally {
      setLoaded(true);
    }
  }, [guildId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const open = incidents.filter((incident) => incident.status === "open");

  async function close(id: number, status: "contained" | "dismissed") {
    setBusy(id);
    try {
      await closeIncident(guildId, id, status);
      await reload();
    } catch {
      /* mantem a lista atual se a atualizacao falhar */
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel
      title="Incidentes de segurança"
      subtitle={open.length ? "Detectados pelo anti-raid e anti-nuke." : "Nada pendente."}
      action={open.length ? <span className="panel-count">{open.length} aberto(s)</span> : undefined}
    >
      {!loaded ? (
        <div className="panel-pad">
          <Spinner />
        </div>
      ) : incidents.length ? (
        <ol className="incidents">
          {incidents.map((incident) => (
            <li key={incident.id} className={incident.status === "open" ? "is-open" : ""}>
              <span className={`incident-dot sev-${incident.severity}`} />
              <div>
                <strong>{incidentTypeLabels[incident.incidentType] ?? "Incidente"}</strong>
                <small>{incidentSummary(incident)}</small>
                <em>
                  {formatRelative(incident.createdAt)} · {severityLabels[incident.severity] ?? incident.severity}
                  {incident.status === "open"
                    ? ""
                    : ` · ${incident.status === "dismissed" ? "falso positivo" : "tratado"}`}
                </em>
                {incident.status === "open" ? (
                  <div className="incident-actions">
                    <button type="button" disabled={busy === incident.id} onClick={() => close(incident.id, "contained")}>
                      Tratado
                    </button>
                    <button type="button" disabled={busy === incident.id} onClick={() => close(incident.id, "dismissed")}>
                      Falso positivo
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          icon="shield"
          title="Nenhum incidente registrado"
          description="O Wumpus não detectou raids nem ações destrutivas neste servidor."
        />
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Base de conhecimento
 * ------------------------------------------------------------------ */

const articleStatusLabels: Record<string, string> = {
  draft: "Rascunho",
  approved: "Aprovado",
  archived: "Arquivado"
};

/**
 * Gerenciamento dos artigos. O ponto de produto: so artigo APROVADO vira
 * resposta no Discord, entao aprovar e um gesto deliberado e visivel.
 */
function KnowledgePanel({ guildId }: { guildId: string }) {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const data = await getArticles(guildId);
      setArticles(data.articles);
    } catch {
      /* Painel secundario: se falhar, o resto da tela continua util. */
    } finally {
      setLoaded(true);
    }
  }, [guildId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save(status: KnowledgeArticle["status"]) {
    if (title.trim().length < 3 || body.trim().length < 10) {
      setError("Título (3+) e conteúdo (10+) são obrigatórios.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createArticle(guildId, {
        title: title.trim(),
        body: body.trim(),
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        status
      });
      setTitle("");
      setBody("");
      setTags("");
      setOpen(false);
      await reload();
    } catch {
      setError("Não consegui salvar o artigo.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(article: KnowledgeArticle, status: KnowledgeArticle["status"]) {
    setBusy(true);
    try {
      await updateArticle(guildId, article.id, { status });
      await reload();
    } catch {
      /* mantem a lista atual */
    } finally {
      setBusy(false);
    }
  }

  async function remove(article: KnowledgeArticle) {
    setBusy(true);
    try {
      await deleteArticle(guildId, article.id);
      await reload();
    } catch {
      /* mantem a lista atual */
    } finally {
      setBusy(false);
    }
  }

  const approved = articles.filter((article) => article.status === "approved").length;

  return (
    <Panel
      title="Base de conhecimento"
      subtitle={approved ? `${approved} artigo(s) respondendo no Discord.` : "Nenhum artigo aprovado ainda."}
      action={
        <button type="button" className="panel-action" onClick={() => setOpen((value) => !value)}>
          {open ? "Fechar" : "Novo"}
        </button>
      }
    >
      {open ? (
        <div className="article-form">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Título do artigo"
            maxLength={120}
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Resposta aprovada que o bot pode usar"
            rows={4}
          />
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="Tags separadas por vírgula"
          />
          {error ? <p className="form-error">{error}</p> : null}
          <div className="article-form-actions">
            <button type="button" disabled={busy} onClick={() => save("approved")}>
              Aprovar e publicar
            </button>
            <button type="button" disabled={busy} onClick={() => save("draft")}>
              Salvar rascunho
            </button>
          </div>
        </div>
      ) : null}

      {!loaded ? (
        <div className="panel-pad">
          <Spinner />
        </div>
      ) : articles.length ? (
        <ol className="articles">
          {articles.map((article) => (
            <li key={article.id}>
              <div>
                <strong>{article.title}</strong>
                <small>
                  {article.body.slice(0, 90)}
                  {article.body.length > 90 ? "…" : ""}
                </small>
                <em className={`art-${article.status}`}>
                  {articleStatusLabels[article.status] ?? article.status}
                  {article.tags.length ? ` · ${article.tags.join(", ")}` : ""}
                </em>
              </div>
              <div className="article-actions">
                {article.status !== "approved" ? (
                  <button type="button" disabled={busy} onClick={() => changeStatus(article, "approved")}>
                    Aprovar
                  </button>
                ) : (
                  <button type="button" disabled={busy} onClick={() => changeStatus(article, "archived")}>
                    Arquivar
                  </button>
                )}
                <button type="button" disabled={busy} onClick={() => remove(article)}>
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          icon="book"
          title="Nenhum artigo ainda"
          description="Artigos aprovados são a única fonte das respostas automáticas."
        />
      )}
    </Panel>
  );
}

export type { ModuleId };
