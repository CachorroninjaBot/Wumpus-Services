import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { renderTemplate, asString } from "@/lib/wumpus/engine";
import { plans as fallbackPlans, type PlanId } from "@/lib/wumpus/brand";
import { planById, serverLimit } from "@/lib/wumpus/catalog";
import { useBilling } from "@/lib/wumpus/use-billing";
import { useActiveGuild, useGuildMembers, useModule, useWumpus } from "@/lib/wumpus/store";
import { DiscordMultiSelect, DiscordSelect } from "@/components/discord-select";
import { ServerGroups } from "@/components/server-groups";

export const Route = createFileRoute("/app/settings")({ component: SettingsPage });

function SettingsPage() {
  const guild = useActiveGuild();
  const gid = useWumpus((s) => s.activeGuildId);
  const servers = useModule("servers");
  const rolesMod = useModule("roles");
  const logsMod = useModule("logs");
  const updateConfig = useWumpus((s) => s.updateConfig);
  const setEnabled = useWumpus((s) => s.setModuleEnabled);
  const members = useGuildMembers();
  const setPlan = useWumpus((s) => s.setPlan);
  const sessionUser = useWumpus((s) => s.sessionUser);
  // Trocar de plano pela interface e poder de dono (ferramenta de suporte).
  // Cliente so muda de plano pagando: o botao vira link de checkout.
  const isOwner = sessionUser.isAdmin;
  const sample = members[0];
  const preview = renderTemplate(asString(servers.config.joinMessage), {
    user: sample?.displayName ?? "membro",
  });
  const billing = useBilling();
  const catalog = billing.data?.plans?.length ? billing.data.plans : fallbackPlans;
  const current = catalog.find((p) => p.id === guild.plan) ?? planById(guild.plan);
  const cap = serverLimit(guild.plan);

  return (
    <div key={gid} className="mx-auto flex max-w-5xl flex-col gap-5">
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-tight">Configurações do servidor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
            {guild.name} · {guild.memberCount.toLocaleString("pt-BR")} membros · {guild.region}
        </p>
      </div>
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="m-0 text-base font-semibold">Licença WumPlus</h2>
          <Badge tone="primary">{current.name}</Badge>
        </div>
        <p className="m-0 text-sm text-muted-foreground">
          A cobrança é da {billing.data?.storeName ?? "Hub Express"} na ShardPay. Este servidor está em {current.price}.{" "}
          {cap === null ? "Servidores ilimitados." : `Até ${cap} servidores.`}
          {billing.loading ? " Lendo a loja…" : billing.data?.error ? ` ${billing.data.error}` : ""}
        </p>
        <div className="grid gap-2">
          {catalog.map((plan) => (
            <div key={plan.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-medium">{plan.name}</p>
                <p className="m-0 text-xs text-muted-foreground">{plan.price}</p>
              </div>
              {guild.plan === plan.id ? <Badge tone="ok">deste servidor</Badge> : null}
              {isOwner ? (
                <Button size="sm" variant="outline" onClick={() => setPlan(plan.id as PlanId)}>
                  Aplicar
                </Button>
              ) : null}
              <a href={plan.checkoutUrl} target="_blank" rel="noreferrer" className="text-sm text-primary">
                Assinar
              </a>
            </div>
          ))}
        </div>
        {!isOwner ? (
          <p className="m-0 text-xs text-muted-foreground">
            O plano deste servidor acompanha a sua assinatura na ShardPay. Para mudar, assine outro plano — a
            liberação é automática.
          </p>
        ) : null}
        <div>
          <p className="m-0 text-sm font-medium">Assinaturas na loja</p>
          {billing.data?.subscriptions.length ? (
            <ul className="mt-2 m-0 space-y-1 p-0 text-sm">
              {billing.data.subscriptions.map((sub) => (
                <li key={sub.id}>
                  {sub.productName} · {sub.status}
                  {sub.discordUsername ? ` · ${sub.discordUsername}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 mb-0 text-sm text-muted-foreground">
              Nenhuma assinatura ativa agora. Quem paga aparece aqui e o plano do servidor segue o produto.
            </p>
          )}
        </div>
      </Card>
      <ServerGroups />
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="m-0 font-medium">Modo manutenção</p>
            <p className="m-0 text-sm text-muted-foreground">O bot responde só com a mensagem abaixo.</p>
          </div>
          <Switch
            checked={Boolean(servers.config.maintenanceMode)}
            onCheckedChange={(v) => updateConfig("servers", { maintenanceMode: v })}
          />
        </div>
        {Boolean(servers.config.maintenanceMode) ? (
          <Textarea
            defaultValue={asString(servers.config.maintenanceMessage)}
            onBlur={(e) => updateConfig("servers", { maintenanceMessage: e.target.value })}
          />
        ) : null}
      </Card>
      <Card className="space-y-4">
        <div><h2 className="m-0 text-base font-semibold">Cargos padrão</h2><p className="m-0 mt-1 text-sm text-muted-foreground">Escolha cargos disponíveis neste servidor; eles serão resolvidos pelo nome nos grupos sincronizados.</p></div>
        <div><Label>Cargos atribuídos a novos membros</Label><DiscordMultiSelect value={Array.isArray(rolesMod.config.defaultRoleIds) ? rolesMod.config.defaultRoleIds as string[] : []} onChange={(defaultRoleIds) => updateConfig("roles", { defaultRoleIds })} placeholder="Adicionar cargo padrão…" /></div>
      </Card>
      <Card className="space-y-4">
        <h2 className="mt-0 text-base font-semibold">Boas-vindas e despedidas</h2>
        <p className="-mt-3 mb-0 text-sm text-muted-foreground">Escolha os canais e personalize o que o Wumpus envia quando alguém entra ou sai.</p>
        <div>
          <Label>Canal de boas-vindas</Label>
          <DiscordSelect kind="text" value={asString(servers.config.announceJoinChannelId)} onChange={(announceJoinChannelId) => updateConfig("servers", { announceJoinChannelId })} placeholder="Selecione um canal" />
        </div>
        <div>
          <Label>Mensagem de boas-vindas · use {"{user}"}</Label>
          <Textarea
            className="mt-1"
            defaultValue={asString(servers.config.joinMessage)}
            onBlur={(e) => updateConfig("servers", { joinMessage: e.target.value })}
          />
        </div>
        <div><Label>Canal de despedida</Label><DiscordSelect kind="text" value={asString(servers.config.announceLeaveChannelId)} onChange={(announceLeaveChannelId) => updateConfig("servers", { announceLeaveChannelId })} placeholder="Desativar mensagem de despedida" /></div>
        <div><Label>Mensagem de despedida · use {"{user}"}</Label><Textarea className="mt-1" defaultValue={asString(servers.config.leaveMessage)} onBlur={(e) => updateConfig("servers", { leaveMessage: e.target.value })} /></div>
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm"><span className="font-medium">Prévia da mensagem</span><p className="m-0 mt-1">{preview}</p></div>
      </Card>
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="m-0 font-medium">Registros do servidor</h2>
            <p className="m-0 text-sm text-muted-foreground">Entradas, cargos e bans no canal escolhido.</p>
          </div>
          <Switch checked={logsMod.enabled} onCheckedChange={(v) => setEnabled("logs", v)} />
        </div>
        <div><Label htmlFor="server-log-channel">Canal de registros</Label><DiscordSelect id="server-log-channel" kind="text" value={asString(logsMod.config.channelId)} onChange={(channelId) => updateConfig("logs", { channelId })} placeholder="Selecione um canal" /></div>
      </Card>
    </div>
  );
}
