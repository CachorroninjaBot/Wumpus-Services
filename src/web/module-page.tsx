import { useEffect, useState } from "react";
import { moduleGroups, modules, type ModuleId } from "../core/brand";
import { ApiError, getAssets, getModule, navigate, saveGuildModule, type ExceptionMode, type GuildAssets, type ModuleDetail } from "./api";
import { ModuleFieldsForm } from "./module-fields";
import { PanelPublisher } from "./panel-publisher";
import { GuildAvatar, Icon, Notice, Panel, Spinner, StateChip } from "./ui";

function isModuleId(value: string): value is ModuleId {
  return modules.some((entry) => entry.id === value);
}

export function ModulePage({ guildId, module: rawModule }: { guildId: string; module: string }) {
  const [detail, setDetail] = useState<ModuleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isModuleId(rawModule)) return;
    let alive = true;
    setDetail(null);
    setError(null);
    getModule(guildId, rawModule)
      .then((data) => {
        if (alive) setDetail(data);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 403) setError("Sua conta não tem permissão para administrar esse servidor.");
        else if (err instanceof ApiError && err.status === 404) setError("Este recurso não está disponível.");
        else setError("Não foi possível carregar este módulo agora.");
      });
    return () => {
      alive = false;
    };
  }, [guildId, rawModule]);

  if (!isModuleId(rawModule)) {
    return <Notice tone="error">Esse recurso não existe no Wumpus.</Notice>;
  }

  const descriptor = modules.find((entry) => entry.id === rawModule)!;
  const groupArea = descriptor.group;

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!detail) return <Spinner label="Carregando o recurso…" />;

  return (
    <ModuleEditor
      key={`${guildId}-${rawModule}-${detail.resolved.exceptionMode}-${detail.resolved.enabled}`}
      guildId={guildId}
      module={rawModule}
      detail={detail}
      descriptor={descriptor}
      groupArea={groupArea}
    />
  );
}

function ModuleEditor({
  guildId,
  module,
  detail,
  descriptor,
  groupArea
}: {
  guildId: string;
  module: ModuleId;
  detail: ModuleDetail;
  descriptor: (typeof modules)[number];
  groupArea: string;
}) {
  const [mode, setMode] = useState<ExceptionMode>(detail.resolved.exceptionMode);
  const [enabled, setEnabled] = useState(detail.resolved.enabled);
  const [config, setConfig] = useState<Record<string, unknown>>(detail.resolved.config);
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(detail.resolved.config, null, 2));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<GuildAssets | null>(null);

  // Canais e cargos vem do que o bot sincronizou. Sem isso, os campos de
  // canal e cargo voltam a aceitar ID digitado — a tela nunca fica inutil.
  useEffect(() => {
    let alive = true;
    getAssets(guildId)
      .then((data) => {
        if (alive) setAssets(data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [guildId]);

  const hasGroup = detail.group !== null;
  const editable = hasGroup ? mode === "override" : true;

  function update(key: string, value: unknown) {
    setConfig((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      await saveGuildModule(guildId, module, hasGroup ? { mode, enabled, config } : { enabled, config });
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 403
          ? "Sua conta não tem permissão para alterar este servidor."
          : "Não foi possível salvar agora. Revise os campos e tente novamente."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-title">
          <span className={`module-title-icon group-${groupArea}`}>
            <Icon name={descriptor.icon} size={22} />
          </span>
          <div>
            <p className="kicker">
              {(moduleGroups.find((entry) => entry.id === descriptor.group)?.label ?? descriptor.group).toUpperCase()}
            </p>
            <h1>{descriptor.label}</h1>
            <p>{descriptor.description}</p>
          </div>
        </div>
        <div className="page-actions">
          <StateChip module={{ ...detail.resolved, exceptionMode: mode, enabled }} />
        </div>
      </header>

      {hasGroup ? (
        <section className="banner">
          <span className="banner-bar" style={{ background: detail.group!.color }} />
          <div>
            <small>OPERAÇÃO COMPARTILHADA</small>
            <strong>{detail.group!.name}</strong>
            <p>Você pode seguir o grupo ou personalizar apenas este recurso neste servidor.</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(`/wumpus/groups/${detail.group!.id}`)}>
            Abrir grupo <Icon name="chevron" size={15} />
          </button>
        </section>
      ) : (
        <section className="banner banner-muted">
          <span className="banner-bar banner-bar-muted" />
          <div>
            <small>SEM GRUPO</small>
            <strong>Configuração individual</strong>
            <p>Este servidor não pertence a um grupo, então estas escolhas valem só para ele.</p>
          </div>
        </section>
      )}

      {saved ? <Notice tone="ok">Alterações salvas. O Wumpus já está sincronizando esta configuração.</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <form onSubmit={submit}>
        <Panel
          title={hasGroup ? "Como este recurso funciona aqui" : "Escolha como este recurso funciona"}
          subtitle="Os dados são validados antes de chegar ao Discord."
        >
          {hasGroup ? (
            <fieldset className="mode-picker">
              <legend>Configuração usada neste servidor</legend>
              <div>
                {(
                  [
                    { value: "inherit", icon: "layers", title: "Seguir o grupo", help: "Recebe as próximas mudanças automaticamente." },
                    { value: "override", icon: "settings", title: "Personalizar aqui", help: "Usa valores próprios somente neste servidor." },
                    { value: "disabled", icon: "close", title: "Pausar aqui", help: "O grupo continua ativo nos outros servidores." }
                  ] as const
                ).map((option) => (
                  <label key={option.value} className={mode === option.value ? "is-selected" : ""}>
                    <input
                      type="radio"
                      name="mode"
                      value={option.value}
                      checked={mode === option.value}
                      onChange={() => {
                        setMode(option.value);
                        setSaved(false);
                      }}
                    />
                    <span className="mode-icon">
                      <Icon name={option.icon === "settings" ? "key" : option.icon} size={16} />
                    </span>
                    <strong>{option.title}</strong>
                    <small>{option.help}</small>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {hasGroup && mode === "override" ? (
            <label className="field field-toggle">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => {
                  setEnabled(event.target.checked);
                  setSaved(false);
                }}
              />
              <span className="switch">
                <i />
              </span>
              <span className="field-text">
                <strong>Manter este recurso ativo neste servidor</strong>
                <small>Só é usado quando “Personalizar aqui” está selecionado.</small>
              </span>
            </label>
          ) : null}

          {!hasGroup ? (
            <label className="field field-toggle">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => {
                  setEnabled(event.target.checked);
                  setSaved(false);
                }}
              />
              <span className="switch">
                <i />
              </span>
              <span className="field-text">
                <strong>Usar {descriptor.label}</strong>
                <small>Ao pausar, suas escolhas ficam guardadas para quando você reativar.</small>
              </span>
            </label>
          ) : null}

          <div className={editable ? "config-body" : "config-body is-locked"}>
            {!editable ? (
              <p className="locked-hint">
                <Icon name="layers" size={15} />
                {mode === "disabled"
                  ? "Este recurso está pausado neste servidor. Mude para “Personalizar aqui” para editar os campos."
                  : "Estes valores vêm do grupo. Mude para “Personalizar aqui” para editar neste servidor."}
              </p>
            ) : null}
            <ModuleFieldsForm
              module={module}
              config={config}
              disabled={!editable}
              assets={assets}
              scope="server"
              onChange={update}
            />
          </div>

          <div className="advanced">
            <button type="button" className="link-button" onClick={() => setShowJson(!showJson)}>
              <Icon name={showJson ? "close" : "chevron"} size={14} />
              {showJson ? "Ocultar ajustes avançados (JSON)" : "Ajustes avançados (JSON)"}
            </button>
            {showJson ? (
              <div className="json-editor">
                <textarea
                  rows={10}
                  value={jsonText}
                  spellCheck={false}
                  disabled={!editable}
                  onChange={(event) => setJsonText(event.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!editable}
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
                      setConfig(parsed);
                      setError(null);
                      setSaved(false);
                    } catch {
                      setError("O JSON não é válido. Corrija antes de aplicar.");
                    }
                  }}
                >
                  Aplicar JSON
                </button>
              </div>
            ) : null}
          </div>

          <div className="form-actions">
            <div>
              <strong>Salvar neste servidor</strong>
              <small>
                {hasGroup
                  ? "Grava apenas a exceção deste servidor; o grupo não muda."
                  : "Grava a configuração individual deste servidor."}
              </small>
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Salvando…" : "Salvar alterações"}
              {busy ? null : <Icon name="check" size={15} />}
            </button>
          </div>
        </Panel>
      </form>

      {module === "tickets" || module === "forms" ? (
        <PanelPublisher guildId={guildId} module={module} config={config} />
      ) : null}
    </div>
  );
}
