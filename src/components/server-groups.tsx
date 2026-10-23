import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { SearchSelect } from "@/components/search-select";
import { useWumpus } from "@/lib/wumpus/store";
import { getServerGroups, saveServerGroups } from "@/lib/wumpus/runtime-store";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";

type ServerGroup = { id: string; name: string; guildIds: string[] };
const STORAGE_KEY = "wumpus-server-groups-v1";

function readGroups(): ServerGroup[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); return Array.isArray(value) ? value as ServerGroup[] : []; } catch { return []; }
}

function localReferences(config: Record<string, unknown>, guildId: string, roles: ReturnType<typeof useWumpus.getState>["roles"], channels: ReturnType<typeof useWumpus.getState>["channels"]): Record<string, unknown> {
  const out = { ...config };
  const channelKeys = ["panelChannelId", "categoryId", "transcriptChannelId", "logChannelId", "reviewChannelId", "channelId", "announceJoinChannelId", "announceLeaveChannelId", "alertChannelId", "verificationChannelId", "answerChannelId", "digestChannelId", "shiftLogChannelId", "notifyChannelId"];
  const roleKeys = ["staffRoleIds", "alertStaffRoleIds", "reviewerRoleIds", "defaultRoleIds", "protectedRoleIds", "trustedRoleIds", "whitelistRoleIds", "ignoredRoleIds"];
  const channelListKeys = ["ignoredChannelIds", "ignoreChannelIds"];
  for (const key of channelKeys) {
    const ref = out[key];
    if (typeof ref !== "string" || !ref) continue;
    out[key] = channels[guildId]?.find((item) => item.id === ref)?.name ?? ref;
  }
  for (const key of roleKeys) {
    const refs = out[key];
    if (!Array.isArray(refs)) continue;
    out[key] = refs.map((ref) => typeof ref === "string" ? roles[guildId]?.find((item) => item.id === ref)?.name ?? ref : ref);
  }
  for (const key of channelListKeys) {
    const refs = out[key];
    if (!Array.isArray(refs)) continue;
    out[key] = refs.map((ref) => typeof ref === "string" ? channels[guildId]?.find((item) => item.id === ref)?.name ?? ref : ref);
  }
  for (const key of ["escalationRoleId", "verifiedRoleId", "mentionRoleId", "verificationRoleId", "appealRoleId", "notifyRoleId"]) {
    const ref = out[key];
    if (typeof ref === "string" && ref) out[key] = roles[guildId]?.find((item) => item.id === ref)?.name ?? ref;
  }
  return out;
}

export function ServerGroups() {
  const guilds = useWumpus((state) => state.guilds);
  const activeGuildId = useWumpus((state) => state.activeGuildId);
  const [groups, setGroups] = useState<ServerGroup[]>(() => typeof window === "undefined" ? [] : readGroups());
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [targets, setTargets] = useState<string[]>([activeGuildId]);
  const [status, setStatus] = useState("");
  const activeGroup = groups.find((group) => group.id === selected);
  const availableGuilds = useMemo(() => guilds.filter((guild) => guild.id !== activeGuildId), [guilds, activeGuildId]);

  useEffect(() => {
    const token = getStoredSessionToken();
    if (!token || !activeGuildId) return;
    let mounted = true;
    void getServerGroups({ data: { token, guildId: activeGuildId } }).then((value) => {
      if (mounted) { setGroups(value); localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
    }).catch((error) => { if (mounted) setStatus(error instanceof Error ? error.message : "Não foi possível carregar os grupos."); });
    return () => { mounted = false; };
  }, [activeGuildId]);

  const save = (next: ServerGroup[]) => {
    setGroups(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    const token = getStoredSessionToken();
    if (token) void saveServerGroups({ data: { token, guildId: activeGuildId, groups: next } }).catch((error) => setStatus(error instanceof Error ? error.message : "Não foi possível salvar os grupos."));
  };
  const create = () => {
    const cleanName = name.trim();
    if (!cleanName || !targets.includes(activeGuildId)) return;
    const group = { id: `group-${Date.now().toString(36)}`, name: cleanName, guildIds: [...new Set(targets)] };
    save([...groups, group]); setSelected(group.id); setName(""); setStatus(`Grupo “${cleanName}” criado.`);
  };
  const sync = () => {
    if (!activeGroup || !activeGroup.guildIds.includes(activeGuildId)) return;
    const state = useWumpus.getState();
    const sourceModules = state.modules[activeGuildId];
    if (!sourceModules) return;
    const mapped = Object.fromEntries(Object.entries(sourceModules).map(([module, value]) => [module, {
      ...value,
      config: localReferences(value.config, activeGuildId, state.roles, state.channels),
    }]));
    for (const guildId of activeGroup.guildIds) {
      if (guildId === activeGuildId) continue;
      state.setActiveGuild(guildId);
      for (const [moduleName, source] of Object.entries(mapped)) {
        const module = moduleName as keyof typeof sourceModules;
        state.updateConfig(module, source.config);
        state.setModuleEnabled(module, source.enabled);
      }
    }
    state.setActiveGuild(activeGuildId);
    setStatus(`Configurações enviadas para ${activeGroup.guildIds.length - 1} servidor(es).`);
  };

  return <section className="space-y-4 rounded-xl border border-border p-4">
    <div><h2 className="m-0 text-base font-semibold">Grupos de servidores</h2><p className="m-0 mt-1 text-sm text-muted-foreground">Agrupe servidores administrados por você e sincronize a configuração atual. Cada servidor resolve os nomes de canais e cargos na própria estrutura.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><Label>Grupo existente</Label><SearchSelect value={selected} onChange={(id) => { setSelected(id); setStatus(""); }} placeholder="Escolha um grupo" options={groups.map((group) => ({ id: group.id, label: group.name, description: `${group.guildIds.length} servidores` }))} /></div>
      <div><Label>Novo grupo</Label><div className="flex gap-2"><input value={name} onChange={(event) => setName(event.target.value)} className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-sm" placeholder="Ex.: Comunidades parceiras" /><Button onClick={create} disabled={!name.trim()}>Criar</Button></div></div>
    </div>
    {!activeGroup && availableGuilds.length ? <div className="flex flex-wrap gap-2">{availableGuilds.map((guild) => <label key={guild.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><input type="checkbox" checked={targets.includes(guild.id)} onChange={(event) => setTargets(event.target.checked ? [...new Set([...targets, guild.id])] : targets.filter((id) => id !== guild.id))} />{guild.name}</label>)}</div> : null}
    {activeGroup ? <>
      <p className="m-0 text-sm">Este servidor: {activeGroup.guildIds.includes(activeGuildId) ? "incluído" : "fora do grupo"}. Use “Sincronizar” para enviar a configuração deste servidor aos demais membros do grupo.</p>
      <div className="flex flex-wrap gap-2">{availableGuilds.map((guild) => <label key={guild.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><input type="checkbox" checked={activeGroup.guildIds.includes(guild.id)} onChange={(event) => save(groups.map((group) => group.id === activeGroup.id ? { ...group, guildIds: event.target.checked ? [...new Set([...group.guildIds, guild.id])] : group.guildIds.filter((id) => id !== guild.id) } : group))} />{guild.name}</label>)}</div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={sync} disabled={!activeGroup.guildIds.includes(activeGuildId) || activeGroup.guildIds.length < 2}>Sincronizar configurações deste servidor</Button><Button variant="ghost" onClick={() => { save(groups.filter((group) => group.id !== activeGroup.id)); setSelected(""); setStatus("Grupo removido."); }}>Remover grupo</Button></div>
    </> : <p className="m-0 text-sm text-muted-foreground">Crie um grupo para compartilhar configurações. Cada servidor mantém seus próprios canais e cargos do Discord.</p>}
    {status ? <p role="status" className="m-0 text-sm text-muted-foreground">{status}</p> : null}
  </section>;
}
