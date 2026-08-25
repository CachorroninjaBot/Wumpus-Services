"use client";

import { useState } from "react";
import type { WumpusChannel } from "../../../lib/wumpus-api";
import { publishMemberPanel } from "../actions";
import { WumpusIcon } from "./wumpus-icon";

type Props = {
  guildId: string;
  module: "tickets" | "forms";
  config: Record<string, unknown>;
  channels: WumpusChannel[];
};

function text(config: Record<string, unknown>, key: string, fallback: string) {
  return typeof config[key] === "string" ? config[key] as string : fallback;
}

export function PanelPublisher({ guildId, module, config, channels }: Props) {
  const [format, setFormat] = useState<"components_v2" | "embed">(() => text(config, "panelFormat", "components_v2") === "embed" ? "embed" : "components_v2");
  const [title, setTitle] = useState(() => text(config, "panelTitle", module === "tickets" ? "Central de atendimento" : "Candidaturas"));
  const [description, setDescription] = useState(() => text(config, "panelDescription", module === "tickets" ? "Abra um atendimento privado e fale com a equipe." : "Envie sua candidatura pelo formulário seguro."));
  const [accentColor, setAccentColor] = useState(() => text(config, "panelAccentColor", "#8175FF"));

  return <section className="panel-studio">
    <div className="panel-studio-heading">
      <div><p className="eyebrow">ESTÚDIO DE PUBLICAÇÃO</p><h3>Veja antes de enviar ao Discord</h3><p>Edite esta publicação sem alterar as regras salvas do módulo.</p></div>
      <span className="studio-status"><i /> Prévia ao vivo</span>
    </div>
    <div className="panel-studio-grid">
      <form action={publishMemberPanel} className="publisher-form">
        <input type="hidden" name="guildId" value={guildId} />
        <input type="hidden" name="panelModule" value={module} />
        <input type="hidden" name="format" value={format} />
        <div className="format-picker"><span>Formato da mensagem</span><div>
          <button type="button" className={format === "components_v2" ? "selected" : ""} onClick={() => setFormat("components_v2")}><strong>Components V2</strong><small>Moderno e interativo</small></button>
          <button type="button" className={format === "embed" ? "selected" : ""} onClick={() => setFormat("embed")}><strong>Embed</strong><small>Compatibilidade clássica</small></button>
        </div></div>
        <label><span>Título</span><input name="title" value={title} minLength={3} maxLength={100} onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>Descrição</span><textarea name="description" value={description} minLength={10} maxLength={800} rows={4} onChange={(event) => setDescription(event.target.value)} /><small>{description.length}/800</small></label>
        <label className="publisher-color"><span>Cor de destaque</span><div><input name="accentColor" type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} /><b>{accentColor.toUpperCase()}</b></div></label>
        <label><span>Publicar em</span><select name="channelId" defaultValue="" required><option value="" disabled>Escolha um canal do Discord</option>{channels.filter((channel) => channel.type === 0 || channel.type === 5).map((channel) => <option key={channel.channelId} value={channel.channelId}>#{channel.name}</option>)}</select></label>
        {channels.some((channel) => channel.type === 0 || channel.type === 5) ? <button className="publish-button" type="submit">Publicar esta versão <WumpusIcon name="chevron" /></button> : <p className="publisher-warning">Os canais de texto ainda não foram sincronizados. Aguarde alguns segundos e atualize.</p>}
      </form>
      <div className="discord-preview-wrap">
        <div className="discord-window-bar"><i /><i /><i /><span>Prévia no Discord</span></div>
        <div className={`discord-preview ${format}`} style={{ borderColor: accentColor }}>
          <div className="discord-author"><span>W</span><div><strong>Wumpus</strong><small>APP</small></div></div>
          <article>
            {format === "components_v2" ? <div className="component-accent" style={{ background: accentColor }} /> : null}
            <h4>{title || "Título do painel"}</h4>
            <p>{description || "A descrição do painel aparecerá aqui."}</p>
            <button type="button" style={{ background: accentColor }}>{module === "tickets" ? "Abrir atendimento" : "Enviar candidatura"}</button>
          </article>
          <small className="discord-footnote">Somente você vê esta prévia.</small>
        </div>
      </div>
    </div>
  </section>;
}
