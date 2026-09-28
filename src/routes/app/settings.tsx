import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { renderTemplate, asString } from "@/lib/wumpus/engine";
import { plans as fallbackPlans, type PlanId } from "@/lib/wumpus/brand";
import { planById, serverLimit } from "@/lib/wumpus/catalog";
import { useBilling } from "@/lib/wumpus/use-billing";
import { useActiveGuild, useGuildMembers, useModule, useWumpus } from "@/lib/wumpus/store";

export const Route = createFileRoute("/app/settings")({ component: SettingsPage });

function SettingsPage() {
  const guild = useActiveGuild();
  const gid = useWumpus((s) => s.activeGuildId);
  const servers = useModule("servers");
  const rolesMod = useModule("roles");
  const logsMod = useModule("logs");
  const updateConfig = useWumpus((s) => s.updateConfig);
  const setEnabled = useWumpus((s) => s.setModuleEnabled);
  const channelMap = useWumpus((s) => s.channels);
  const roleMap = useWumpus((s) => s.roles);
  const channels = channelMap[gid] ?? [];
  const roles = roleMap[gid] ?? [];
  const members = useGuildMembers();
  const posts = useWumpus((s) => s.posts).filter((p) => p.guildId === gid);
  const setPlan = useWumpus((s) => s.setPlan);
  const simulateJoin = useWumpus((s) => s.simulateJoin);
  const sample = members[0];
  const preview = renderTemplate(asString(servers.config.joinMessage), {
    user: sample?.displayName ?? "membro",
  });
  const [username, setUsername] = useState("nova");
  const [age, setAge] = useState(2);
  const [joinNote, setJoinNote] = useState<string | null>(null);
  const billing = useBilling();
  const catalog = billing.data?.plans?.length ? billing.data.plans : fallbackPlans;
  const current = catalog.find((p) => p.id === guild.plan) ?? planById(guild.plan);
  const cap = serverLimit(guild.plan);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="m-0 text-xl font-semibold tracking-tight">Servidor</h1>
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
              <Button size="sm" variant="outline" onClick={() => setPlan(plan.id as PlanId)}>
                Aplicar
              </Button>
              <a href={plan.checkoutUrl} target="_blank" rel="noreferrer" className="text-sm text-primary">
                Checkout
              </a>
            </div>
          ))}
        </div>
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
        <h2 className="mt-0 text-base font-semibold">Boas-vindas</h2>
        <div>
          <Label>Canal</Label>
          <NativeSelect
            className="mt-1"
            defaultValue={asString(servers.config.announceJoinChannelId)}
            onChange={(e) => updateConfig("servers", { announceJoinChannelId: e.target.value })}
          >
            {channels
              .filter((c) => c.type === "text")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
          </NativeSelect>
        </div>
        <div>
          <Label>Mensagem · use {"{user}"}</Label>
          <Textarea
            className="mt-1"
            defaultValue={asString(servers.config.joinMessage)}
            onBlur={(e) => updateConfig("servers", { joinMessage: e.target.value })}
          />
        </div>
        <div className="rounded-xl bg-muted px-3 py-2 text-sm">Preview: {preview}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Simular entrada</Label>
            <Input className="mt-1" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <Label>Idade da conta (horas)</Label>
            <Input className="mt-1" type="number" value={age} onChange={(e) => setAge(Number(e.target.value) || 0)} />
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => setJoinNote(simulateJoin({ username, accountAgeHours: age }))}
        >
          Fazer o membro entrar
        </Button>
        {joinNote ? <p className="m-0 text-sm">{joinNote}</p> : null}
        {posts.length > 0 ? (
          <ul className="m-0 space-y-2 p-0">
            {posts.slice(0, 4).map((p) => (
              <li key={p.id} className="rounded-xl bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">#{p.channelId.replace("ch_", "")} · </span>
                {p.content}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
      <Card className="space-y-3">
        <h2 className="mt-0 text-base font-semibold">Cargos na entrada</h2>
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => {
            const selected = ((rolesMod.config.defaultRoleIds as string[]) ?? []).includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  const cur = new Set((rolesMod.config.defaultRoleIds as string[]) ?? []);
                  if (cur.has(r.id)) cur.delete(r.id);
                  else cur.add(r.id);
                  updateConfig("roles", { defaultRoleIds: Array.from(cur) });
                }}
              >
                <Badge tone={selected ? "primary" : "default"}>{r.name}</Badge>
              </button>
            );
          })}
        </div>
      </Card>
      <Card className="flex items-center justify-between">
        <div>
          <p className="m-0 font-medium">Logs de servidor</p>
          <p className="m-0 text-sm text-muted-foreground">Entradas, cargos e bans.</p>
        </div>
        <Switch checked={logsMod.enabled} onCheckedChange={(v) => setEnabled("logs", v)} />
      </Card>
    </div>
  );
}
