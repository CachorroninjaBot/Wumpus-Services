import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  getAssets,
  getPublications,
  publishPanel,
  type GuildAssets,
  type Publication
} from "./api";
import { Icon, Notice } from "./ui";

type Format = "components_v2" | "embed";

function text(config: Record<string, unknown>, key: string, fallback: string): string {
  return typeof config[key] === "string" ? (config[key] as string) : fallback;
}

const defaults = {
  tickets: {
    title: "Central de atendimento",
    description: "Abra um atendimento privado e fale com a equipe.",
    button: "Abrir atendimento"
  },
  forms: {
    title: "Candidaturas",
    description: "Envie sua candidatura pelo formulário seguro.",
    button: "Enviar candidatura"
  }
} as const;

export function PanelPublisher({
  guildId,
  module,
  config
}: {
  guildId: string;
  module: "tickets" | "forms";
  config: Record<string, unknown>;
}) {
  const fallback = defaults[module];
  const [format, setFormat] = useState<Format>(() => (text(config, "panelFormat", "components_v2") === "embed" ? "embed" : "components_v2"));
  const [title, setTitle] = useState(() => text(config, "panelTitle", fallback.title));
  const [description, setDescription] = useState(() => text(config, "panelDescription", fallback.description));
  const [accentColor, setAccentColor] = useState(() => text(config, "panelAccentColor", "#7c5cff"));
  const [channelId, setChannelId] = useState("");
  const [assets, setAssets] = useState<GuildAssets | null>(null);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const reload = useCallback(async () => {
    const [assetData, publicationData] = await Promise.all([
      getAssets(guildId).catch(() => ({ channels: [], roles: [], syncedAt: null }) as GuildAssets),
      getPublications(guildId).catch(() => ({ publications: [] as Publication[] }))
    ]);
    setAssets(assetData);
    setPublications(publicationData.publications);
  }, [guildId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const textChannels = (assets?.channels ?? []).filter((channel) => channel.type === 0 || channel.type === 5);
  const synced = Boolean(assets?.syncedAt);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await publishPanel(guildId, {
        module,
        channelId,
        format,
        title,
        description,
        accentColor
      });
      setNotice({
        tone: "ok",
        text: "Painel enviado para a fila. O bot publica no Discord em poucos segundos."
      });
      await reload();
    } catch (error) {
      if (error instanceof ApiError && error.code === "unknown_channel") {
        setNotice({ tone: "error", text: "Esse canal não foi sincronizado pelo bot. Atualize a página e escolha outro." });
      } else if (error instanceof ApiError && (error.code === "invalid_title" || error.code === "invalid_description")) {
        setNotice({ tone: "error", text: "Revise o título (3 a 100 caracteres) e a descrição (10 a 800 caracteres)." });
      } else {
        setNotice({ tone: "error", text: "Não foi possível publicar agora. Tente novamente." });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="studio">
      <header className="studio-head">
        <div>
          <p className="kicker">ESTÚDIO DE PUBLICAÇÃO</p>
          <h3>Veja antes de enviar ao Discord</h3>
          <p>Esta publicação não altera as regras salvas do módulo.</p>
        </div>
        <span className="studio-status">
          <i /> Prévia ao vivo
        </span>
      </header>

      {!synced ? (
        <Notice tone="info">
          Os canais deste servidor ainda não foram sincronizados. Eles aparecem aqui assim que o bot conectar
          com o token configurado.
        </Notice>
      ) : null}

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <div className="studio-grid">
        <form className="studio-form" onSubmit={submit}>
          <div className="format-picker">
            <span>Formato da mensagem</span>
            <div>
              <button
                type="button"
                className={format === "components_v2" ? "selected" : ""}
                onClick={() => setFormat("components_v2")}
              >
                <strong>Components V2</strong>
                <small>Moderno e interativo</small>
              </button>
              <button
                type="button"
                className={format === "embed" ? "selected" : ""}
                onClick={() => setFormat("embed")}
              >
                <strong>Embed</strong>
                <small>Compatibilidade clássica</small>
              </button>
            </div>
          </div>

          <label className="field">
            <span>Título</span>
            <input value={title} minLength={3} maxLength={100} onChange={(event) => setTitle(event.target.value)} />
          </label>

          <label className="field">
            <span>Descrição</span>
            <textarea
              rows={4}
              value={description}
              minLength={10}
              maxLength={800}
              onChange={(event) => setDescription(event.target.value)}
            />
            <small>{description.length}/800</small>
          </label>

          <label className="field">
            <span>Cor de destaque</span>
            <div className="color-field">
              <input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} />
              <b>{accentColor.toUpperCase()}</b>
            </div>
          </label>

          <label className="field">
            <span>Publicar em</span>
            <select
              value={channelId}
              required
              onChange={(event) => setChannelId(event.target.value)}
              disabled={!textChannels.length}
            >
              <option value="" disabled>
                {textChannels.length ? "Escolha um canal do Discord" : "Nenhum canal sincronizado"}
              </option>
              {textChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  #{channel.name}
                </option>
              ))}
            </select>
          </label>

          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !channelId}>
            {busy ? "Enviando…" : "Publicar esta versão"}
            {busy ? null : <Icon name="send" size={15} />}
          </button>
        </form>

        <div className="preview-wrap">
          <div className="preview-bar">
            <i />
            <i />
            <i />
            <span>Prévia no Discord</span>
          </div>
          <div className={`preview preview-${format}`}>
            <div className="preview-author">
              <span>W</span>
              <div>
                <strong>Wumpus</strong>
                <small>APP</small>
              </div>
            </div>
            <article style={format === "embed" ? { borderLeftColor: accentColor } : undefined}>
              {format === "components_v2" ? <div className="preview-accent" style={{ background: accentColor }} /> : null}
              <h4>{title || "Título do painel"}</h4>
              <p>{description || "A descrição do painel aparece aqui."}</p>
              <button type="button" style={{ background: accentColor }}>
                {fallback.button}
              </button>
            </article>
            <small className="preview-foot">Somente você vê esta prévia.</small>
          </div>
        </div>
      </div>

      {publications.length ? (
        <div className="publication-list">
          <h4>Envios recentes</h4>
          <ul>
            {publications.slice(0, 5).map((entry) => (
              <li key={entry.id}>
                <span className={`chip chip-${entry.status === "published" ? "active" : entry.status === "failed" ? "disabled" : "inherit"}`}>
                  {entry.status === "published" ? "Publicado" : entry.status === "failed" ? "Falhou" : "Na fila"}
                </span>
                <span className="publication-format">{entry.format === "embed" ? "Embed" : "Components V2"}</span>
                <span className="publication-channel">#{entry.channelId}</span>
                {entry.error ? <em className="publication-error">{entry.error}</em> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
