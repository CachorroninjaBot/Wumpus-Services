import { defaultWumpusModuleConfig, wumpusModuleSchema } from "@huborder/core";
import { createDatabase } from "@huborder/database";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getWumpusSession } from "../../../../lib/auth";
import { getWumpusGroup, getWumpusOverview, listInstalledWumpusGuilds, listWumpusChannels } from "../../../../lib/wumpus-api";
import { descriptorFor, moduleLabel } from "../../../../lib/wumpus-modules";
import { saveModuleConfiguration, saveServerException } from "../../actions";
import { ModuleConfigFields } from "../../_components/module-config-fields";
import { PanelPublisher } from "../../_components/panel-publisher";
import { OperationsBuilder } from "../../_components/operations-builder";
import { moduleIcon, WumpusIcon } from "../../_components/wumpus-icon";
import { WumpusFrame } from "../../_components/wumpus-frame";

type Props = { params: Promise<{ guildId: string; module: string }>; searchParams: Promise<{ saved?: string; error?: string }> };

async function builderData(guildId: string, module: string) {
  if (module !== "tickets" && module !== "forms") return { departments: [], forms: [] };
  const url = process.env.DATABASE_URL;
  if (!url) return { departments: [], forms: [] };
  const database = createDatabase(url);
  try {
    const [departments, forms] = await Promise.all([database.listWumpusTicketDepartments(guildId), database.listWumpusForms(guildId)]);
    return { departments, forms };
  } finally { await database.close(); }
}

export default async function WumpusModulePage({ params, searchParams }: Props) {
  const [{ guildId, module: rawModule }, query] = await Promise.all([params, searchParams]);
  const module = wumpusModuleSchema.safeParse(rawModule);
  if (!module.success) notFound();
  const [session, installed] = await Promise.all([getWumpusSession(), listInstalledWumpusGuilds()]);
  if (!session) redirect("/wumpus");
  if (!session.guilds.some((guild) => guild.id === guildId) || !installed.some((guild) => guild.guildId === guildId)) redirect("/wumpus?error=access_denied");

  const overview = await getWumpusOverview(guildId);
  const [groupDetails, channels, builders] = await Promise.all([
    overview.group ? getWumpusGroup(overview.group.id, session.user.id) : Promise.resolve(null),
    listWumpusChannels(guildId).catch(() => []),
    builderData(guildId, module.data)
  ]);
  const current = overview.configs.find((config) => config.module === module.data);
  const config = current?.config ?? defaultWumpusModuleConfig(module.data);
  const descriptor = descriptorFor(module.data);
  const rawException = groupDetails?.servers.find((server) => server.guildId === guildId)?.exceptions[module.data];
  const exception = rawException !== null && typeof rawException === "object" && !Array.isArray(rawException) ? rawException as Record<string, unknown> : {};
  const exceptionMode = exception.mode === "disabled" || exception.mode === "override" ? exception.mode : "inherit";
  const stateLabel = current?.enabled === false ? "Pausado" : overview.group ? (exceptionMode === "inherit" ? `Pelo grupo ${overview.group.name}` : "Personalizado neste servidor") : "Ativo";

  return <WumpusFrame guild={overview.guild} active={module.data}>
    <div className="w2-module-page">
      <header className="w2-module-header">
        <div className={`w2-module-title-icon ${descriptor.group.toLowerCase()}`}><WumpusIcon name={moduleIcon(module.data)} /></div>
        <div><nav><Link href={`/wumpus/${guildId}`}>Visão geral</Link><WumpusIcon name="chevron" /><span>{descriptor.group}</span></nav><h1>{moduleLabel(module.data)}</h1><p>{descriptor.description}</p></div>
        <span className={`w2-state ${current?.enabled === false ? "paused" : "active"}`}><i />{stateLabel}</span>
      </header>

      {query.saved ? <p className="save-notice"><strong>Alterações salvas.</strong> O Wumpus já está sincronizando esta configuração.</p> : null}
      {query.error ? <p className="form-error"><strong>Não foi possível salvar.</strong> Revise os campos indicados e tente novamente.</p> : null}

      {overview.group ? <section className="w2-inheritance-note"><span className="group-color" style={{ background: overview.group.color }} /><div><strong>Este servidor pertence a {overview.group.name}</strong><p>Você pode seguir o grupo ou personalizar apenas este recurso.</p></div><Link href={`/wumpus/groups/${overview.group.id}/${module.data}`}>Abrir configuração do grupo<WumpusIcon name="chevron" /></Link></section> : null}

      <article className="w2-config-surface">
        <header className="w2-config-head"><div><p className="w2-kicker">CONFIGURAÇÃO</p><h2>{overview.group ? "Como este recurso funciona aqui" : "Escolha como este recurso funciona"}</h2><p>Os campos usam canais, categorias e cargos importados diretamente do Discord.</p></div><span><WumpusIcon name="settings" />Alterações registradas</span></header>
        <form action={overview.group ? saveServerException : saveModuleConfiguration} className="config-form w2-config-form">
          {overview.group ? <>
            <input type="hidden" name="groupId" value={overview.group.id} /><input type="hidden" name="guildId" value={guildId} /><input type="hidden" name="module" value={module.data} />
            <fieldset className="inheritance-picker"><legend>Configuração usada neste servidor</legend><div>
              <label><input type="radio" name="mode" value="inherit" defaultChecked={exceptionMode === "inherit"} /><span><WumpusIcon name="group" /></span><strong>Seguir o grupo</strong><small>Recebe as próximas mudanças automaticamente.</small></label>
              <label><input type="radio" name="mode" value="override" defaultChecked={exceptionMode === "override"} /><span><WumpusIcon name="settings" /></span><strong>Personalizar aqui</strong><small>Usa valores próprios somente neste servidor.</small></label>
              <label><input type="radio" name="mode" value="disabled" defaultChecked={exceptionMode === "disabled"} /><span><WumpusIcon name="close" /></span><strong>Pausar aqui</strong><small>O grupo continua ativo nos outros servidores.</small></label>
            </div></fieldset>
            <label className="module-master-toggle"><input type="checkbox" name="enabled" defaultChecked={exception.enabled !== false} /><span className="switch"><i /></span><span><strong>Manter este recurso ativo</strong><small>Usado quando a personalização local estiver selecionada.</small></span></label>
            <ModuleConfigFields module={module.data} config={config} channels={channels} roles={overview.roles} scope="exception" />
          </> : <>
            <input type="hidden" name="guildId" value={guildId} /><input type="hidden" name="module" value={module.data} />
            <label className="module-master-toggle"><input type="checkbox" name="enabled" defaultChecked={current?.enabled !== false} /><span className="switch"><i /></span><span><strong>Usar {moduleLabel(module.data)}</strong><small>Ao pausar, suas escolhas ficam guardadas para quando você reativar.</small></span><b>{current?.enabled === false ? "Pausado" : "Funcionando"}</b></label>
            <ModuleConfigFields module={module.data} config={config} channels={channels} roles={overview.roles} scope="server" />
          </>}
          <div className="form-actions"><div><strong>Salvar neste servidor</strong><small>Os dados são validados antes de chegar ao Discord.</small></div><button className="w2-primary" type="submit">Salvar alterações<WumpusIcon name="check" /></button></div>
        </form>
        {(module.data === "tickets" || module.data === "forms") ? <PanelPublisher guildId={guildId} module={module.data} config={config} channels={channels} /> : null}
        {(module.data === "tickets" || module.data === "forms") ? <OperationsBuilder guildId={guildId} module={module.data} channels={channels} roles={overview.roles} departments={builders.departments} forms={builders.forms} /> : null}
      </article>
    </div>
  </WumpusFrame>;
}
