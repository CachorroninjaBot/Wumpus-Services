import { createDatabase } from "@huborder/database";
import { redirect } from "next/navigation";
import { getAdminSession } from "../../lib/admin-auth";
import { logoutAdmin, publishHubOrderMessage, reviewOccurrence, saveHubOrderPanel, saveLicense } from "./actions";

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  return createDatabase(url);
}

function dateLabel(value: Date | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(value) : "Sem vencimento";
}

function evidenceUrls(items: Array<Record<string, unknown>>) {
  return items.map((item) => typeof item.url === "string" ? item.url : null).filter((url): url is string => Boolean(url));
}

const actionName = { warn: "Advertência", timeout: "Castigo", kick: "Expulsão", ban: "Banimento" } as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const db = database();
  const guildId = process.env.HUBORDER_SUPPORT_GUILD_ID ?? "";
  const [stats, licenses, occurrences, services, panel, query] = await Promise.all([
    db.getWumpusAdminStats(), db.listWumpusLicenses(), db.listWumpusOccurrences({ limit: 100 }), db.listServices(), guildId ? db.getHubOrderPanelConfig(guildId) : null, searchParams
  ]).finally(() => db.close());
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand"><span>H</span><div><strong>HubOrder</strong><small>PRIVATE OPS</small></div></div>
        <nav><a href="#overview" className="active">Visão geral</a><a href="#huborder">HubOrderBot</a><a href="#licenses">Clientes Wumpus</a><a href="#occurrences">Ocorrências</a><a href="#services">Serviços</a></nav>
        <form action={logoutAdmin}><button type="submit">Sair da central</button></form>
      </aside>
      <section className="admin-content">
        <header className="admin-header" id="overview"><div><p className="eyebrow">OPERAÇÃO HUBORDER</p><h1>Bom trabalho, {session.username}.</h1><p>Decisões sensíveis e acessos comerciais ficam concentrados aqui.</p></div><span className="admin-live"><i /> operação ativa</span></header>
        {query.saved ? <div className="admin-alert success">Acesso Wumpus salvo com sucesso.</div> : null}
        {query.reviewed ? <div className="admin-alert success">Ocorrência revisada; o bot executará a decisão aprovada.</div> : null}
        {query.error ? <div className="admin-alert danger">Não foi possível concluir essa ação. Revise os dados e tente novamente.</div> : null}
        <section className="admin-metrics" aria-label="Resumo"><article><span>Licenças ativas</span><strong>{stats.activeLicenses}</strong><small>{stats.licenses} cadastros totais</small></article><article><span>Servidores instalados</span><strong>{stats.installedServers}</strong><small>capacidade contratada: {stats.licensedServers}</small></article><article><span>Contas Discord</span><strong>{stats.registeredDiscordAccounts}</strong><small>com sessão registrada</small></article><article className={stats.pendingOccurrences ? "attention" : ""}><span>Aguardando decisão</span><strong>{stats.pendingOccurrences}</strong><small>expulsões ou banimentos</small></article></section>

        <section className="admin-section" id="huborder"><div className="admin-section-heading"><div><p className="eyebrow">HUBORDERBOT · PUBLICAÇÃO</p><h2>Atendimento e mensagens</h2><p>Configure com linguagem normal, visualize as escolhas e envie pelo próprio bot.</p></div></div><div className="admin-split"><form action={saveHubOrderPanel} className="admin-form"><h3>Painel de encomendas</h3><label><span>Canal que receberá o painel</span><input name="channelId" inputMode="numeric" pattern="[0-9]{15,22}" placeholder="ID do canal" required /></label><div className="admin-form-row"><label><span>Formato</span><select name="format" defaultValue={panel?.format ?? "components_v2"}><option value="components_v2">Components V2</option><option value="embed">Embed clássico</option></select></label><label><span>Cor de destaque</span><input name="accentColor" type="color" defaultValue={panel?.accentColor ?? "#8175FF"} /></label></div><label><span>Título</span><input name="title" defaultValue={panel?.title} required /></label><label><span>Explicação para o cliente</span><textarea name="description" defaultValue={panel?.description} required /></label><label><span>Texto final</span><input name="footer" defaultValue={panel?.footer} required /></label><label><span>Prefixo dos canais</span><input name="ticketPrefix" defaultValue={panel?.ticketPrefix ?? "pedido"} pattern="[A-Za-z0-9-]{2,20}" required /></label><label className="admin-check"><input type="checkbox" name="allowMultipleOpenTickets" defaultChecked={panel?.allowMultipleOpenTickets} /><span>Permitir mais de um atendimento aberto por cliente</span></label><label className="admin-check"><input type="checkbox" name="feedbackEnabled" defaultChecked={panel?.feedbackEnabled ?? true} /><span>Pedir avaliação ao encerrar</span></label><button type="submit">Salvar e publicar painel <span>→</span></button></form><form action={publishHubOrderMessage} className="admin-form"><h3>Editor de mensagem</h3><label><span>Canal de destino</span><input name="channelId" inputMode="numeric" pattern="[0-9]{15,22}" placeholder="ID do canal" required /></label><div className="admin-form-row"><label><span>Formato</span><select name="format" defaultValue="components_v2"><option value="components_v2">Components V2</option><option value="embed">Embed clássico</option></select></label><label><span>Cor</span><input name="color" type="color" defaultValue="#8175FF" /></label></div><label><span>Título</span><input name="title" placeholder="Atualização importante" maxLength={100} required /></label><label><span>Mensagem</span><textarea name="description" placeholder="Escreva a mensagem exatamente como o público deve receber." maxLength={4000} required /></label><label><span>Rodapé</span><input name="footer" defaultValue="HubOrder" maxLength={200} /></label><button type="submit">Enviar pelo bot <span>→</span></button></form></div></section>

        <section className="admin-section" id="licenses"><div className="admin-section-heading"><div><p className="eyebrow">WUMPUS · CLIENTES</p><h2>Acessos e planos</h2><p>Use o ID do Discord para vincular o contrato à pessoa correta.</p></div></div>
          <div className="admin-split"><form action={saveLicense} className="admin-form"><h3>Adicionar ou atualizar acesso</h3><label><span>ID do usuário no Discord</span><input name="discordUserId" inputMode="numeric" pattern="[0-9]{15,22}" placeholder="123456789012345678" required /><small>Abra o Discord no modo desenvolvedor e use “Copiar ID do usuário”.</small></label><div className="admin-form-row"><label><span>Plano</span><select name="plan" defaultValue="standard"><option value="starter">Starter</option><option value="standard">Standard</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option></select></label><label><span>Status</span><select name="status" defaultValue="active"><option value="active">Ativo</option><option value="suspended">Suspenso</option><option value="expired">Encerrado</option></select></label></div><div className="admin-form-row"><label><span>Limite de servidores</span><input name="maxServers" type="number" min="1" max="1000" defaultValue="1" required /></label><label><span>Vencimento</span><input name="expiresAt" type="date" /></label></div><label><span>Observações internas</span><textarea name="notes" maxLength={1000} placeholder="Contrato, responsável ou contexto importante" /></label><button type="submit">Salvar acesso <span>→</span></button></form>
            <div className="admin-table-wrap"><table><thead><tr><th>Discord</th><th>Plano</th><th>Status</th><th>Servidores</th><th>Vencimento</th></tr></thead><tbody>{licenses.length ? licenses.map((license) => <tr key={license.id}><td><strong>{license.discordUserId}</strong><small>{license.notes || "Sem observações"}</small></td><td>{license.plan}</td><td><span className={"status-pill " + license.status}>{license.status}</span></td><td>{license.maxServers}</td><td>{dateLabel(license.expiresAt)}</td></tr>) : <tr><td colSpan={5} className="empty-cell">Nenhum cliente cadastrado ainda.</td></tr>}</tbody></table></div>
          </div>
        </section>

        <section className="admin-section" id="occurrences"><div className="admin-section-heading"><div><p className="eyebrow">MODERAÇÃO · REVISÃO HUMANA</p><h2>Ocorrências</h2><p>Expulsões e banimentos nunca são executados antes da sua decisão.</p></div></div><div className="occurrence-list">{occurrences.length ? occurrences.map((item) => <article key={item.id} className="occurrence-card"><header><div><span>#{item.id}</span><strong>Nível {item.strikeNumber} · {item.strikeNumber >= 4 ? "Banimento" : actionName[item.requestedAction]}</strong></div><span className={"status-pill " + item.status}>{item.status}</span></header><p>{item.reason}</p><dl><div><dt>Membro</dt><dd>{item.targetId}</dd></div><div><dt>Staff</dt><dd>{item.staffId}</dd></div><div><dt>Registrada</dt><dd>{dateLabel(item.createdAt)}</dd></div><div><dt>Evidências</dt><dd>{item.evidence.length}</dd></div></dl>{evidenceUrls(item.evidence).length ? <div className="evidence-links">{evidenceUrls(item.evidence).map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer">Abrir evidência {index + 1}</a>)}</div> : null}{item.status === "pending" ? <form action={reviewOccurrence}><input type="hidden" name="id" value={item.id} /><label><span>Nota da decisão</span><input name="note" maxLength={500} placeholder="Opcional, mas recomendado" /></label><div><button name="decision" value="rejected" className="secondary" type="submit">Rejeitar</button><button name="decision" value="approved" type="submit">Aprovar {item.strikeNumber >= 4 ? "banimento" : "expulsão"}</button></div></form> : <small>{item.reviewNote || item.error || "Decisão processada."}</small>}</article>) : <div className="admin-empty">Nenhuma ocorrência registrada.</div>}</div></section>

        <section className="admin-section" id="services"><div className="admin-section-heading"><div><p className="eyebrow">INFRAESTRUTURA</p><h2>Serviços conectados</h2></div></div><div className="service-strip">{services.map((service) => <article key={service.service}><i className={service.status} /><div><strong>{service.service}</strong><small>{service.status} · {dateLabel(service.lastHeartbeatAt)}</small></div></article>)}</div></section>
      </section>
    </main>
  );
}
