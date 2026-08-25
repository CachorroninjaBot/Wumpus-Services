import { defaultWumpusModuleConfig, wumpusModuleSchema } from "@huborder/core";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getWumpusSession } from "../../../../../lib/auth";
import { getWumpusGroup, isInternalApiError } from "../../../../../lib/wumpus-api";
import { descriptorFor, moduleLabel } from "../../../../../lib/wumpus-modules";
import { saveGroupModuleConfiguration } from "../../../actions";
import { ModuleConfigFields } from "../../../_components/module-config-fields";
import { moduleIcon, WumpusIcon } from "../../../_components/wumpus-icon";

type Props = { params: Promise<{ groupId: string; module: string }>; searchParams: Promise<{ saved?: string; error?: string }> };

export default async function WumpusGroupModulePage({ params, searchParams }: Props) {
  const [{ groupId: rawGroupId, module: rawModule }, query] = await Promise.all([params, searchParams]);
  const groupId = Number(rawGroupId);
  const module = wumpusModuleSchema.safeParse(rawModule);
  const session = await getWumpusSession();
  if (!session || !module.success || !Number.isSafeInteger(groupId)) redirect("/wumpus");
  const details = await getWumpusGroup(groupId, session.user.id).catch((error: unknown) => {
    if (isInternalApiError(error, 404)) return null;
    throw error;
  });
  if (!details) redirect("/wumpus?error=group_not_found");
  const current = details.configs.find((config) => config.module === module.data);
  const config = current?.config ?? defaultWumpusModuleConfig(module.data);
  const descriptor = descriptorFor(module.data);

  return <main className="w2-group-page w2-group-config-page">
    <header className="w2-group-topbar"><Link href={`/wumpus/groups/${groupId}`}><WumpusIcon name="back" />{details.group.name}</Link><div><span className="w2-online-dot" />{details.servers.length} servidor(es) neste grupo</div></header>
    <div className="w2-group-content">
      {query.saved ? <p className="save-notice"><strong>Configuração do grupo atualizada.</strong> Os servidores já estão recebendo as mudanças.</p> : null}
      {query.error ? <p className="form-error"><strong>Não foi possível salvar.</strong> Revise os campos indicados e tente novamente.</p> : null}
      <header className="w2-module-header w2-group-module-title">
        <div className={`w2-module-title-icon ${descriptor.group.toLowerCase()}`}><WumpusIcon name={moduleIcon(module.data)} /></div>
        <div><nav><Link href="/wumpus">Grupos</Link><WumpusIcon name="chevron" /><Link href={`/wumpus/groups/${groupId}`}>{details.group.name}</Link></nav><h1>{moduleLabel(module.data)}</h1><p>{descriptor.description}</p></div>
        <span className={`w2-state ${current?.enabled === false ? "paused" : "active"}`}><i />{current?.enabled === false ? "Pausado" : "Ativo no grupo"}</span>
      </header>
      <section className="w2-impact-banner"><WumpusIcon name="group" /><div><strong>Esta alteração afeta {details.servers.length} servidor(es)</strong><p>Personalizações feitas diretamente em um servidor continuam preservadas.</p></div></section>

      <section className="w2-group-config-grid">
        <article className="w2-config-surface"><header className="w2-config-head"><div><p className="w2-kicker">REGRAS COMPARTILHADAS</p><h2>Uma configuração para o grupo</h2><p>Defina o comportamento comum. Canais e cargos são escolhidos em cada servidor.</p></div></header>
          <form action={saveGroupModuleConfiguration} className="config-form w2-config-form">
            <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="module" value={module.data} />
            <label className="module-master-toggle"><input type="checkbox" name="enabled" defaultChecked={current?.enabled !== false} /><span className="switch"><i /></span><span><strong>Usar {moduleLabel(module.data)} neste grupo</strong><small>Ao pausar, as escolhas ficam guardadas para uma futura reativação.</small></span><b>{current?.enabled === false ? "Pausado" : "Compartilhado"}</b></label>
            <ModuleConfigFields module={module.data} config={config} scope="group" />
            <div className="form-actions"><div><strong>Publicar no grupo</strong><small>As personalizações locais não serão apagadas.</small></div><button className="w2-primary" type="submit">Salvar para {details.servers.length} servidor(es)<WumpusIcon name="check" /></button></div>
          </form>
        </article>

        <aside className="w2-surface w2-local-bindings"><header className="w2-section-head"><div><h2>Canais e cargos de cada servidor</h2><p>Abra um servidor somente quando precisar apontar recursos locais.</p></div></header>
          {details.servers.length ? <div>{details.servers.map((server) => <Link href={`/wumpus/${server.guildId}/${module.data}`} key={server.guildId}>
            {server.iconUrl ? <Image src={server.iconUrl} alt="" width={36} height={36} unoptimized /> : <span>{server.name.slice(0, 1)}</span>}<div><strong>{server.name}</strong><small>{Object.hasOwn(server.exceptions, module.data) ? "Possui personalização" : "Seguindo o grupo"}</small></div><WumpusIcon name="chevron" />
          </Link>)}</div> : <div className="w2-empty-compact"><WumpusIcon name="group" /><strong>Nenhum servidor no grupo</strong><p>Adicione um servidor antes de vincular canais e cargos.</p></div>}
        </aside>
      </section>
    </div>
  </main>;
}
