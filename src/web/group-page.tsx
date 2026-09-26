import { useCallback, useEffect, useState } from "react";
import { modules, modulesOf, moduleGroups, type ModuleId } from "../core/brand";
import {
  ApiError,
  addServerToGroup,
  getGroup,
  navigate,
  removeServerFromGroup,
  saveGroupModule,
  type GroupDetails,
  type Me
} from "./api";
import { ModuleFieldsForm } from "./module-fields";
import { EmptyState, GuildAvatar, Icon, Notice, Panel, Spinner } from "./ui";

export function GroupPage({
  groupId,
  session,
  onGroupsChanged
}: {
  groupId: number;
  session: Me;
  onGroupsChanged: () => Promise<void>;
}) {
  const [details, setDetails] = useState<GroupDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openModule, setOpenModule] = useState<ModuleId | null>(null);
  const [busyServer, setBusyServer] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setDetails(await getGroup(groupId));
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("Esse grupo não está mais disponível para esta conta.");
        return;
      }
      setError("Não foi possível carregar este grupo agora.");
    }
  }, [groupId]);

  useEffect(() => {
    setDetails(null);
    void reload();
  }, [reload]);

  if (error) {
    return (
      <Notice tone="error">
        {error}{" "}
        <button type="button" className="link-button" onClick={() => navigate("/wumpus")}>
          Voltar
        </button>
      </Notice>
    );
  }
  if (!details) return <Spinner label="Carregando o grupo…" />;

  const inGroup = new Set(details.servers.map((server) => server.guildId));
  const available = session.guilds.filter((guild) => guild.wumpusInstalled && !inGroup.has(guild.id));
  const configByModule = new Map(details.configs.map((entry) => [entry.module, entry]));
  const activeModules = modules.filter((entry) => configByModule.get(entry.id)?.enabled !== false).length;

  async function add(guildId: string) {
    setBusyServer(guildId);
    try {
      await addServerToGroup(groupId, guildId);
      setNotice("Servidor adicionado ao grupo. Ele já está seguindo esta configuração.");
      await Promise.all([reload(), onGroupsChanged()]);
    } catch {
      setNotice(null);
      setError("Não foi possível adicionar esse servidor agora.");
    } finally {
      setBusyServer(null);
    }
  }

  async function remove(guildId: string) {
    setBusyServer(guildId);
    try {
      await removeServerFromGroup(groupId, guildId);
      setNotice("Servidor removido do grupo. Ele passou a ter configuração própria.");
      await Promise.all([reload(), onGroupsChanged()]);
    } catch {
      setNotice(null);
      setError("Não foi possível remover esse servidor agora.");
    } finally {
      setBusyServer(null);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-title">
          <span className="group-symbol" style={{ background: details.group.color }}>
            <Icon name="layers" size={22} />
          </span>
          <div>
            <p className="kicker">GRUPO DE SERVIDORES</p>
            <h1>{details.group.name}</h1>
            <p>{details.group.description || "Configurações compartilhadas para as comunidades deste grupo."}</p>
          </div>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate("/wumpus")}>
            <Icon name="back" size={15} /> Servidores e grupos
          </button>
        </div>
      </header>

      {notice ? <Notice tone="ok">{notice}</Notice> : null}

      <section className="stat-grid stat-grid-2">
        <article className="stat">
          <span className="stat-icon tone-brand">
            <Icon name="server" />
          </span>
          <div>
            <small>Servidores no grupo</small>
            <strong>{details.servers.length}</strong>
            <em>todos seguem esta configuração</em>
          </div>
        </article>
        <article className="stat">
          <span className="stat-icon tone-ok">
            <Icon name="grid" />
          </span>
          <div>
            <small>Módulos ativos no grupo</small>
            <strong>{activeModules}</strong>
            <em>de {modules.length} disponíveis</em>
          </div>
        </article>
      </section>

      <div className="columns">
        <Panel
          title="Configuração do grupo"
          subtitle="Estas regras chegam a todos os servidores do grupo."
          action={<span className="panel-count">{modules.length} recursos</span>}
        >
          {moduleGroups.map((group) => (
            <div className="module-block" key={group.id}>
              <h3>{group.label}</h3>
              <div className="module-list">
                {modulesOf(group.id).map((descriptor) => {
                  const saved = configByModule.get(descriptor.id);
                  const paused = saved?.enabled === false;
                  const isOpen = openModule === descriptor.id;
                  return (
                    <div className="group-module" key={descriptor.id}>
                      <button
                        type="button"
                        className="module-row"
                        onClick={() => setOpenModule(isOpen ? null : descriptor.id)}
                      >
                        <span className={`module-icon group-${group.id}`}>
                          <Icon name={descriptor.icon} />
                        </span>
                        <div>
                          <strong>{descriptor.label}</strong>
                          <small>{descriptor.description}</small>
                        </div>
                        <em className={`chip chip-${paused ? "disabled" : "active"}`}>
                          {paused ? "Pausado" : "Ativo"}
                        </em>
                        <Icon name="chevron" size={15} />
                      </button>
                      {isOpen ? (
                        <GroupModuleEditor
                          key={`${descriptor.id}-${paused}`}
                          groupId={groupId}
                          module={descriptor.id}
                          label={descriptor.label}
                          initialEnabled={!paused}
                          initialConfig={saved?.config ?? {}}
                          onSaved={async (message) => {
                            setNotice(message);
                            await reload();
                          }}
                          onError={setError}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </Panel>

        <aside className="side-col">
          <Panel title="Servidores do grupo" subtitle="Todos recebem as configurações ao lado.">
            {details.servers.length ? (
              <div className="group-servers">
                {details.servers.map((server) => (
                  <article key={server.guildId}>
                    <GuildAvatar name={server.name} iconUrl={server.iconUrl} size={38} />
                    <div>
                      <button type="button" className="link-button" onClick={() => navigate(`/wumpus/${server.guildId}`)}>
                        {server.name}
                      </button>
                      <small>
                        {server.exceptions
                          ? `${server.exceptions} ${server.exceptions === 1 ? "personalização" : "personalizações"}`
                          : "Seguindo todo o grupo"}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="icon-button icon-button-danger"
                      disabled={busyServer === server.guildId}
                      onClick={() => remove(server.guildId)}
                      aria-label={`Remover ${server.name}`}
                    >
                      <Icon name="close" size={15} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState icon="layers" title="Nenhum servidor adicionado" description="Escolha um servidor ao lado." />
            )}
          </Panel>

          <Panel title="Adicionar servidor" subtitle="Ele começará seguindo o grupo imediatamente.">
            {available.length ? (
              <div className="add-server-list">
                {available.map((guild) => (
                  <button
                    key={guild.id}
                    type="button"
                    disabled={busyServer === guild.id}
                    onClick={() => add(guild.id)}
                  >
                    <GuildAvatar name={guild.name} iconUrl={guild.iconUrl} size={34} />
                    <strong>{guild.name}</strong>
                    <small>{busyServer === guild.id ? "Adicionando…" : "Adicionar"}</small>
                    <Icon name="chevron" size={15} />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="check"
                title="Todos os servidores já estão agrupados"
                description="Nenhum servidor disponível para adicionar a este grupo."
              />
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function GroupModuleEditor({
  groupId,
  module,
  label,
  initialEnabled,
  initialConfig,
  onSaved,
  onError
}: {
  groupId: number;
  module: ModuleId;
  label: string;
  initialEnabled: boolean;
  initialConfig: Record<string, unknown>;
  onSaved: (message: string) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [config, setConfig] = useState(initialConfig);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError(null);
    try {
      const result = await saveGroupModule(groupId, module, { enabled, config });
      await onSaved(
        `${label} atualizado no grupo e aplicado a ${result.affectedServers} servidor(es).`
      );
    } catch {
      onError("Não foi possível salvar a configuração do grupo agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="group-module-editor" onSubmit={submit}>
      <p className="group-module-hint">
        <Icon name="alert" size={14} />
        Ao salvar, esta configuração passa a valer em todos os servidores do grupo que não tenham exceção.
      </p>
      <label className="field field-toggle">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        <span className="switch">
          <i />
        </span>
        <span className="field-text">
          <strong>Manter {label} ativo no grupo</strong>
          <small>Ao pausar, o recurso fica desligado em todos os servidores do grupo.</small>
        </span>
      </label>
      <ModuleFieldsForm
        module={module}
        config={config}
        disabled={false}
        scope="group"
        onChange={(key, value) => setConfig((current) => ({ ...current, [key]: value }))}
      />
      <div className="form-actions">
        <div>
          <strong>Salvar no grupo</strong>
          <small>Servidores com exceção continuam com a configuração própria.</small>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Salvando…" : "Salvar no grupo"}
          {busy ? null : <Icon name="check" size={15} />}
        </button>
      </div>
    </form>
  );
}
