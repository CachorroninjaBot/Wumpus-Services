import { createFileRoute } from "@tanstack/react-router";
import { DiscordSelect } from "@/components/discord-select";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { presets, type PresetId } from "@/lib/wumpus/defaults";
import { asList, asString } from "@/lib/wumpus/engine";
import { useActiveGuild, useGuildMembers, useModule, useWumpus } from "@/lib/wumpus/store";
import { formatRelative } from "@/lib/utils";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import { requestPanelPublish, requestSecurityLockdown, requestSecurityRestore } from "@/lib/wumpus/runtime-store";

export const Route = createFileRoute("/app/protect")({ component: ProtectPage });

function ProtectPage() {
  const guild = useActiveGuild();
  const gid = useWumpus((s) => s.activeGuildId);
  const automod = useModule("automod");
  const security = useModule("security");
  const updateConfig = useWumpus((s) => s.updateConfig);
  const applyPreset = useWumpus((s) => s.applyPreset);
  const testAutomod = useWumpus((s) => s.testAutomod);
  const closeIncident = useWumpus((s) => s.closeIncident);
  const simulateRaid = useWumpus((s) => s.simulateRaid);
  const simulateNuke = useWumpus((s) => s.simulateNuke);
  const members = useGuildMembers();
  const allHits = useWumpus((s) => s.automodHits);
  const allIncidents = useWumpus((s) => s.incidents);
  const hits = allHits.filter((h) => h.guildId === gid);
  const incidents = allIncidents.filter((i) => i.guildId === gid);

  const [text, setText] = useState("entra no meu server discord.gg/nitrofree");
  const [userId, setUserId] = useState(members.find((m) => !m.roleIds.includes("role_staff"))?.id ?? members[0]?.id ?? "");
  const [verdict, setVerdict] = useState<ReturnType<typeof testAutomod> | null>(null);
  const [joins, setJoins] = useState(14);
  const [nukes, setNukes] = useState(6);
  const [raidNote, setRaidNote] = useState<string | null>(null);
  const [securityActionNote, setSecurityActionNote] = useState<string | null>(null);
  const [verificationChannelId, setVerificationChannelId] = useState(asString(security.config.verificationChannelId));
  const [verifiedRoleId, setVerifiedRoleId] = useState(asString(security.config.verifiedRoleId));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h1 className="m-0 text-xl font-semibold tracking-tight">Proteção</h1>
      <div className="grid gap-3 md:grid-cols-3">
        {(Object.keys(presets) as PresetId[]).map((id) => {
          const p = presets[id];
          const active = guild.preset === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              className={`rounded-2xl bg-card p-4 text-left shadow-border ${active ? "ring-1 ring-primary" : ""}`}
            >
              <p className="m-0 text-sm font-semibold">{p.label}</p>
              <p className="mt-1 mb-0 text-sm text-muted-foreground">{p.blurb}</p>
              {active ? <Badge tone="primary" className="mt-2">ativo</Badge> : null}
            </button>
          );
        })}
      </div>

      <Tabs defaultValue="automod">
        <TabsList>
          <TabsTrigger value="automod">AutoMod</TabsTrigger>
          <TabsTrigger value="raid">Anti-raid</TabsTrigger>
        </TabsList>
        <TabsContent value="automod" className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <h2 className="mt-0 text-base font-semibold">Tester ao vivo</h2>
            <p className="text-sm text-muted-foreground">
              A mensagem passa pelo mesmo filtro do bot, com os cargos do autor.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <Label>Autor</Label>
                <NativeSelect className="mt-1" value={userId} onChange={(e) => setUserId(e.target.value)}>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
              <Button
                onClick={() => setVerdict(testAutomod(userId, text))}
              >
                Testar
              </Button>
              {verdict ? (
                <div
                  className={`rounded-xl px-3 py-2 text-sm ${verdict.ok ? "bg-ok/15 text-ok" : "bg-destructive/15 text-destructive"}`}
                >
                  {verdict.ok
                    ? verdict.detail || "Mensagem passa."
                    : `${verdict.action} · ${verdict.rule} — ${verdict.detail}`}
                </div>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              <Toggle
                label="Bloquear convites"
                checked={Boolean(automod.config.blockInvites)}
                onChange={(v) => updateConfig("automod", { blockInvites: v })}
              />
              <Toggle
                label="Bloquear links (exceto lista)"
                checked={Boolean(automod.config.blockLinks)}
                onChange={(v) => updateConfig("automod", { blockLinks: v })}
              />
              <Toggle
                label="Detectar ghost ping"
                checked={Boolean(automod.config.antiGhostPing)}
                onChange={(v) => updateConfig("automod", { antiGhostPing: v })}
              />
              <Field label="Ação">
                <NativeSelect
                  defaultValue={asString(automod.config.action, "delete")}
                  onChange={(e) => updateConfig("automod", { action: e.target.value })}
                >
                  <option value="delete">Apagar</option>
                  <option value="warn">Avisar</option>
                  <option value="timeout">Timeout</option>
                  <option value="review">Revisão</option>
                </NativeSelect>
              </Field>
              <Field label="Termos bloqueados">
                <Input
                  defaultValue={asList(automod.config.blockedTerms).join(", ")}
                  onBlur={(e) =>
                    updateConfig("automod", {
                      blockedTerms: e.target.value
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
              <Field label="Domínios permitidos">
                <Input
                  defaultValue={asList(automod.config.allowedDomains).join(", ")}
                  onBlur={(e) =>
                    updateConfig("automod", {
                      allowedDomains: e.target.value
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
              <Field label="Limite de menções">
                <Input
                  type="number"
                  defaultValue={Number(automod.config.mentionLimit ?? 8)}
                  onBlur={(e) => updateConfig("automod", { mentionLimit: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Caps (%)">
                <Input
                  type="number"
                  defaultValue={Number(automod.config.capsThresholdPercent ?? 80)}
                  onBlur={(e) => updateConfig("automod", { capsThresholdPercent: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Mensagens na janela">
                <Input
                  type="number"
                  defaultValue={Number(automod.config.messageLimit ?? 6)}
                  onBlur={(e) => updateConfig("automod", { messageLimit: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Janela (segundos)">
                <Input
                  type="number"
                  defaultValue={Number(automod.config.windowSeconds ?? 10)}
                  onBlur={(e) => updateConfig("automod", { windowSeconds: Number(e.target.value) || 1 })}
                />
              </Field>
              <p className="m-0 text-xs text-muted-foreground">
                Envie a mesma frase várias vezes no tester: flood e duplicata usam essa janela.
              </p>
            </div>
          </Card>
          <Card>
            <h2 className="mt-0 text-base font-semibold">Últimos hits</h2>
            <ul className="m-0 space-y-3 p-0">
              {hits.slice(0, 10).map((h) => (
                <li key={h.id} className="text-sm">
                  <span className="text-muted-foreground">{formatRelative(h.at)} · {h.rule}</span>
                  <p className="m-0 truncate">{h.content}</p>
                </li>
              ))}
              {hits.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum hit ainda.</p> : null}
            </ul>
          </Card>
        </TabsContent>
        <TabsContent value="raid" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-base font-semibold">Anti-raid</h2>
              {security.config.lockdown ? <Badge tone="danger">lockdown</Badge> : <Badge tone="ok">normal</Badge>}
            </div>
            <Field label="Modo">
              <NativeSelect
                defaultValue={asString(security.config.raidMode, "smart")}
                onChange={(e) => updateConfig("security", { raidMode: e.target.value })}
              >
                <option value="smart">Inteligente</option>
                <option value="strict">Estrito</option>
                <option value="passive">Passivo</option>
              </NativeSelect>
            </Field>
            <Field label="Resposta a uma raid">
              <NativeSelect value={asString(security.config.response, "lockdown_review")} onChange={(e) => updateConfig("security", { response: e.target.value })}>
                <option value="alert">Só alertar</option>
                <option value="lockdown_review">Lockdown e revisão</option>
                <option value="auto">Timeout automático</option>
              </NativeSelect>
            </Field>
            {asString(security.config.response) === "auto" ? (
              <Toggle label="Confirmo que o modo automático pode aplicar timeouts" checked={Boolean(security.config.autoResponseConfirmed)} onChange={(v) => updateConfig("security", { autoResponseConfirmed: v })} />
            ) : null}
            <Toggle label="Banir automaticamente autores de ações destrutivas em massa" checked={Boolean(security.config.autoBanRepeatOffenders)} onChange={(v) => updateConfig("security", { autoBanRepeatOffenders: v })} />
            {security.config.autoBanRepeatOffenders ? (
              <Toggle label="Confirmo banimentos automáticos após detecção anti-nuke" checked={Boolean(security.config.autoResponseConfirmed)} onChange={(v) => updateConfig("security", { autoResponseConfirmed: v })} />
            ) : null}
            <Field label="Entradas para raid">
              <Input
                type="number"
                defaultValue={Number(security.config.raidJoinThreshold ?? 12)}
                onBlur={(e) => updateConfig("security", { raidJoinThreshold: Number(e.target.value) || 3 })}
              />
            </Field>
            <Field label="Idade mínima da conta (h)">
              <Input
                type="number"
                defaultValue={Number(security.config.minAccountAgeHours ?? 24)}
                onBlur={(e) => updateConfig("security", { minAccountAgeHours: Number(e.target.value) || 0 })}
              />
            </Field>
            <Toggle
              label="Isolar contas novas"
              checked={Boolean(security.config.quarantineNewMembers)}
              onChange={(v) => updateConfig("security", { quarantineNewMembers: v })}
            />
            <h3 className="mb-0 mt-4 text-sm font-semibold">Verificação de membros</h3>
            <p className="m-0 text-xs text-muted-foreground">Restringe a visualização dos canais a @everyone e libera o cargo selecionado após o clique no painel. As permissões atuais são salvas para restauração.</p>
            <Field label="ID do canal de verificação">
              <DiscordSelect kind="text" value={verificationChannelId} onChange={(value) => { setVerificationChannelId(value); updateConfig("security", { verificationChannelId: value }); }} placeholder="Selecione um canal" />
            </Field>
            <Field label="ID do cargo verificado">
              <DiscordSelect kind="role" value={verifiedRoleId} onChange={(value) => { setVerifiedRoleId(value); updateConfig("security", { verifiedRoleId: value }); }} placeholder="Selecione um cargo" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={async () => {
                if (!gid || !verificationChannelId || !verifiedRoleId) { setSecurityActionNote("Informe o canal e o cargo verificado."); return; }
                try {
                  await updateConfig("security", { verificationChannelId, verifiedRoleId, verificationEnabled: true });
                  await requestPanelPublish({ data: { token: getStoredSessionToken(), guildId: gid, target: "security-verification", channelRef: verificationChannelId, verificationRoleId: verifiedRoleId } });
                  setSecurityActionNote("Configuração enviada ao bot. O status aparecerá nos logs se houver erro.");
                } catch (error) { setSecurityActionNote(String(error)); }
              }}>Ativar e publicar painel</Button>
              <Button variant="ghost" onClick={async () => {
                if (!gid) return;
                try { await requestSecurityRestore({ data: { token: getStoredSessionToken(), guildId: gid } }); setSecurityActionNote("Restauração enviada ao bot."); }
                catch (error) { setSecurityActionNote(String(error)); }
              }}>Restaurar permissões</Button>
            </div>
            {securityActionNote ? <p className="m-0 rounded-xl bg-muted px-3 py-2 text-sm">{securityActionNote}</p> : null}
            <h3 className="mb-0 mt-4 text-sm font-semibold">Detecção anti-nuke</h3>
            <Toggle label="Alertar sobre exclusão de cargos em massa" checked={security.config.alertOnMassRoleDelete !== false} onChange={(v) => updateConfig("security", { alertOnMassRoleDelete: v })} />
            <Toggle label="Alertar sobre criação de webhooks em massa" checked={security.config.alertOnMassWebhookCreate !== false} onChange={(v) => updateConfig("security", { alertOnMassWebhookCreate: v })} />
            <Toggle label="Alertar sobre criação de convites em massa" checked={security.config.alertOnMassInviteCreate !== false} onChange={(v) => updateConfig("security", { alertOnMassInviteCreate: v })} />
            <Toggle label="Alertar sobre @everyone repetido" checked={security.config.alertOnEveryoneMentions !== false} onChange={(v) => updateConfig("security", { alertOnEveryoneMentions: v })} />
            <Field label="Mensagem de lockdown">
              <Textarea
                defaultValue={asString(security.config.lockdownMessage)}
                onBlur={(e) => updateConfig("security", { lockdownMessage: e.target.value })}
              />
            </Field>
            <Button variant={security.config.lockdown ? "secondary" : "destructive"} onClick={async () => {
              if (!gid) return;
              try { await requestSecurityLockdown({ data: { token: getStoredSessionToken(), guildId: gid, enabled: !security.config.lockdown } }); await updateConfig("security", { lockdown: !security.config.lockdown }); setSecurityActionNote("Ação de lockdown enviada ao bot."); }
              catch (error) { setSecurityActionNote(String(error)); }
            }}>
              {security.config.lockdown ? "Encerrar lockdown" : "Ligar lockdown"}
            </Button>
            <Field label="Simular entradas agora">
              <Input type="number" value={joins} onChange={(e) => setJoins(Number(e.target.value) || 0)} />
            </Field>
            <Button variant="outline" onClick={() => setRaidNote(simulateRaid(joins))}>
              Rodar anti-raid
            </Button>
            <Field label="Simular ações destrutivas (nuke)">
              <Input type="number" value={nukes} onChange={(e) => setNukes(Number(e.target.value) || 0)} />
            </Field>
            <Button variant="outline" onClick={() => setRaidNote(simulateNuke(nukes))}>
              Rodar anti-nuke
            </Button>
            <p className="m-0 text-xs text-muted-foreground">Anti-nuke faz parte de todos os WumPlus, do Essencial ao Escala.</p>
            {raidNote ? <p className="m-0 rounded-xl bg-muted px-3 py-2 text-sm">{raidNote}</p> : null}
          </Card>
          <Card>
            <h2 className="mt-0 text-base font-semibold">Incidentes</h2>
            <ul className="m-0 space-y-3 p-0">
              {incidents.map((i) => (
                <li key={i.id} className="rounded-xl bg-muted px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{i.title}</span>
                    <Badge tone={i.status === "closed" ? "ok" : "warn"}>{i.status}</Badge>
                  </div>
                  <p className="m-0 text-sm text-muted-foreground">{i.detail}</p>
                  {i.status !== "closed" ? (
                    <Button size="sm" variant="ghost" className="mt-1" onClick={() => closeIncident(i.id)}>
                      Encerrar
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
