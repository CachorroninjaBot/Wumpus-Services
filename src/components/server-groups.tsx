import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { SearchSelect } from "@/components/search-select";
import { useWumpus } from "@/lib/wumpus/store";
import type { ModuleKey } from "@/lib/wumpus/defaults";
import { getDiscordGuildResources, getServerGroups, saveServerGroups } from "@/lib/wumpus/runtime-store";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";

type ServerGroup = { id: string; name: string; guildIds: string[]; resourceMappings?: Record<string, Record<string, string>> };
type Resource = { id: string; name: string; type?: "text" | "category" };
type Reference = { kind: "channel" | "role"; id: string; label: string };
const STORAGE_KEY = "wumpus-server-groups-v1";
const channelField = /(?:channel|category)ids?$/i;
const roleField = /roleids?$/i;
const keyFor = (ref: Reference) => `${ref.kind}:${ref.id}`;

function readGroups(): ServerGroup[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); return Array.isArray(value) ? value as ServerGroup[] : []; } catch { return []; }
}

function collectReferences(configs: Record<string, { config: Record<string, unknown> }>, guildId: string, roles: ReturnType<typeof useWumpus.getState>["roles"], channels: ReturnType<typeof useWumpus.getState>["channels"]): Reference[] {
  const found = new Map<string, Reference>();
  const add = (kind: Reference["kind"], value: unknown) => {
    if (typeof value !== "string" || !value.trim()) return;
    const id = value.trim();
    const source = kind === "channel" ? channels[guildId] : roles[guildId];
    const named = source?.find((resource) => resource.id === id);
    found.set(`${kind}:${id}`, { kind, id, label: named?.name ?? id });
  };
  for (const module of Object.values(configs)) for (const [field, value] of Object.entries(module.config)) {
    const kind = roleField.test(field) ? "role" : channelField.test(field) ? "channel" : null;
    if (!kind) continue;
    if (Array.isArray(value)) value.forEach((item) => add(kind, item)); else add(kind, value);
  }
  return [...found.values()];
}

function normalize(value: string) { return value.trim().replace(/^#|^@/, "").toLocaleLowerCase("pt-BR"); }

function mapConfig(config: Record<string, unknown>, refs: Reference[], target: Record<string, Resource[]>, mapping: Record<string, string>, guildName: string): { config: Record<string, unknown>; missing: string[] } {
  const next = { ...config };
  const missing: string[] = [];
  for (const [field, value] of Object.entries(next)) {
    const kind = roleField.test(field) ? "role" : channelField.test(field) ? "channel" : null;
    if (!kind) continue;
    const mapOne = (sourceId: unknown) => {
      if (typeof sourceId !== "string" || !sourceId) return sourceId;
      const ref = refs.find((item) => item.kind === kind && item.id === sourceId);
      if (!ref) return sourceId;
      const resources = target[kind === "channel" ? "channels" : "roles"] ?? [];
      const selectedId = mapping[keyFor(ref)];
      if (selectedId && resources.some((resource) => resource.id === selectedId)) return selectedId;
      const matches = resources.filter((resource) => normalize(resource.name) === normalize(ref.label));
      if (matches.length === 1) return matches[0]!.id;
      missing.push(`${kind === "channel" ? "Canal/categoria" : "Cargo"} “${ref.label}” em ${guildName}`);
      return sourceId;
    };
    next[field] = Array.isArray(value) ? value.map(mapOne) : mapOne(value);
  }
  return { config: next, missing };
}

export function ServerGroups() {
  const guilds = useWumpus((state) => state.guilds);
  const activeGuildId = useWumpus((state) => state.activeGuildId);
  const [groups, setGroups] = useState<ServerGroup[]>(() => typeof window === "undefined" ? [] : readGroups());
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [targets, setTargets] = useState<string[]>([activeGuildId]);
  const [status, setStatus] = useState("");
  const [resourcesByGuild, setResourcesByGuild] = useState<Record<string, { channels: Resource[]; roles: Resource[] }>>({});
  const activeGroup = groups.find((group) => group.id === selected);
  const resourceGuildIdsKey = activeGroup?.guildIds.filter((id) => id !== activeGuildId).join(",") ?? "";
  const availableGuilds = useMemo(() => guilds.filter((guild) => guild.id !== activeGuildId), [guilds, activeGuildId]);
  const state = useWumpus.getState();
  const refs = useMemo(() => {
    const modules = state.modules[activeGuildId] as Record<string, { config: Record<string, unknown> }> | undefined;
    return modules ? collectReferences(modules, activeGuildId, state.roles, state.channels) : [];
  }, [activeGuildId, state.modules, state.roles, state.channels]);

  useEffect(() => {
    const token = getStoredSessionToken();
    if (!token || !activeGuildId) return;
    let mounted = true;
    void getServerGroups({ data: { token, guildId: activeGuildId } }).then((value) => {
      if (mounted) { setGroups(value); localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
    }).catch((error) => { if (mounted) setStatus(error instanceof Error ? error.message : "Não foi possível carregar os grupos."); });
    return () => { mounted = false; };
  }, [activeGuildId]);

  useEffect(() => {
    const token = getStoredSessionToken();
    if (!token || !activeGroup) return;
    let mounted = true;
    const targetsToLoad = resourceGuildIdsKey.split(",").filter((id) => id && !resourcesByGuild[id]);
    if (!targetsToLoad.length) return;
    void Promise.all(targetsToLoad.map(async (guildId) => [guildId, await getDiscordGuildResources({ data: { token, guildId } })] as const))
      .then((entries) => { if (mounted) setResourcesByGuild((current) => ({ ...current, ...Object.fromEntries(entries) })); })
      .catch(() => { if (mounted) setStatus("Não foi possível carregar canais e cargos dos servidores. Verifique se o bot está conectado."); });
    return () => { mounted = false; };
  }, [activeGroup, resourceGuildIdsKey, activeGuildId, resourcesByGuild]);

  const save = (next: ServerGroup[]) => {
    setGroups(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    const token = getStoredSessionToken();
    if (token) void saveServerGroups({ data: { token, guildId: activeGuildId, groups: next } }).catch((error) => setStatus(error instanceof Error ? error.message : "Não foi possível salvar os grupos."));
  };
  const create = () => {
    const cleanName = name.trim();
    if (!cleanName || !targets.includes(activeGuildId)) return;
    const group = { id: `group-${Date.now().toString(36)}`, name: cleanName, guildIds: [...new Set(targets)], resourceMappings: {} };
    save([...groups, group]); setSelected(group.id); setName(""); setStatus(`Grupo “${cleanName}” criado.`);
  };
  const setMapping = (targetGuildId: string, ref: Reference, resourceId: string) => {
    if (!activeGroup) return;
    save(groups.map((group) => group.id === activeGroup.id ? {
      ...group,
      resourceMappings: { ...group.resourceMappings, [targetGuildId]: { ...group.resourceMappings?.[targetGuildId], [keyFor(ref)]: resourceId } },
    } : group));
  };
  const sync = () => {
    if (!activeGroup || !activeGroup.guildIds.includes(activeGuildId)) return;
    const sourceModules = useWumpus.getState().modules[activeGuildId] as Record<string, { config: Record<string, unknown>; enabled: boolean }> | undefined;
    if (!sourceModules) return;
    const problems: string[] = [];
    let synced = 0;
    for (const guildId of activeGroup.guildIds) {
      if (guildId === activeGuildId) continue;
      const targetGuild = guilds.find((guild) => guild.id === guildId);
      const targetResources = resourcesByGuild[guildId];
      if (!targetResources) { problems.push(`Recursos de ${targetGuild?.name ?? guildId} ainda não carregaram.`); continue; }
      const targetProblems: string[] = [];
      const mappedModules = Object.entries(sourceModules).map(([moduleName, module]) => {
        const result = mapConfig(module.config, refs, targetResources, activeGroup.resourceMappings?.[guildId] ?? {}, targetGuild?.name ?? guildId);
        targetProblems.push(...result.missing);
        return [moduleName, { ...module, config: result.config }] as const;
      });
      if (targetProblems.length) { problems.push(...targetProblems); continue; }
      const state = useWumpus.getState();
      state.setActiveGuild(guildId);
      for (const [moduleName, source] of mappedModules) {
        const module = moduleName as ModuleKey;
        state.updateConfig(module, source.config);
        state.setModuleEnabled(module, source.enabled);
      }
      synced++;
    }
    useWumpus.getState().setActiveGuild(activeGuildId);
    setStatus(problems.length ? `Sincronização parcial (${synced} servidor(es)). Resolva os recursos sem correspondência: ${[...new Set(problems)].slice(0, 5).join("; ")}${problems.length > 5 ? "…" : ""}` : `Configurações enviadas para ${synced} servidor(es).`);
  };

  return <section className="space-y-4 rounded-xl border border-border p-4">
    <div><h2 className="m-0 text-base font-semibold">Grupos de servidores</h2><p className="m-0 mt-1 text-sm text-muted-foreground">Compartilhe configurações e escolha os canais e cargos equivalentes em cada comunidade. O Wumpus nunca presume que nomes repetidos apontam para o mesmo recurso.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><Label>Grupo existente</Label><SearchSelect value={selected} onChange={(id) => { setSelected(id); setStatus(""); }} placeholder="Escolha um grupo" options={groups.map((group) => ({ id: group.id, label: group.name, description: `${group.guildIds.length} servidores` }))} /></div>
      <div><Label>Novo grupo</Label><div className="flex gap-2"><input value={name} onChange={(event) => setName(event.target.value)} className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-sm" placeholder="Ex.: Comunidades parceiras" /><Button onClick={create} disabled={!name.trim()}>Criar</Button></div></div>
    </div>
    {!activeGroup && availableGuilds.length ? <div className="flex flex-wrap gap-2">{availableGuilds.map((guild) => <label key={guild.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><input type="checkbox" checked={targets.includes(guild.id)} onChange={(event) => setTargets(event.target.checked ? [...new Set([...targets, guild.id])] : targets.filter((id) => id !== guild.id))} />{guild.name}</label>)}</div> : null}
    {activeGroup ? <>
      <p className="m-0 text-sm">Este servidor: {activeGroup.guildIds.includes(activeGuildId) ? "incluído" : "fora do grupo"}. Os mapeamentos abaixo são específicos por servidor e preservados no grupo.</p>
      <div className="flex flex-wrap gap-2">{availableGuilds.map((guild) => <label key={guild.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><input type="checkbox" checked={activeGroup.guildIds.includes(guild.id)} onChange={(event) => save(groups.map((group) => group.id === activeGroup.id ? { ...group, guildIds: event.target.checked ? [...new Set([...group.guildIds, guild.id])] : group.guildIds.filter((id) => id !== guild.id) } : group))} />{guild.name}</label>)}</div>
      {refs.length ? <div className="space-y-3 rounded-xl bg-muted/35 p-3"><div><h3 className="m-0 text-sm font-semibold">Correspondência de canais e cargos</h3><p className="m-0 mt-1 text-xs text-muted-foreground">Correspondências únicas por nome são automáticas. Quando houver nomes diferentes ou duplicados, selecione o recurso correto.</p></div>
        {activeGroup.guildIds.filter((id) => id !== activeGuildId).map((guildId) => {
          const guild = guilds.find((item) => item.id === guildId);
          const available = resourcesByGuild[guildId];
          return <div key={guildId} className="space-y-2 rounded-lg border border-border bg-card p-3"><p className="m-0 text-sm font-semibold">{guild?.name ?? guildId}</p>
            {refs.map((ref) => {
              const resources = available?.[ref.kind === "channel" ? "channels" : "roles"] ?? [];
              const matches = resources.filter((resource) => normalize(resource.name) === normalize(ref.label));
              const value = activeGroup.resourceMappings?.[guildId]?.[keyFor(ref)] ?? (matches.length === 1 ? matches[0]!.id : "");
              if (matches.length === 1 && !activeGroup.resourceMappings?.[guildId]?.[keyFor(ref)]) return null;
              return <div key={`${ref.kind}:${ref.id}`} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center"><span className="truncate text-xs text-muted-foreground">{ref.kind === "channel" ? "Canal/categoria" : "Cargo"}: {ref.label}</span><SearchSelect value={value} onChange={(id) => setMapping(guildId, ref, id)} placeholder={available ? "Escolher correspondência" : "Carregando recursos do bot…"} options={resources.map((resource) => ({ id: resource.id, label: resource.name, description: resource.type === "category" ? "Categoria" : resource.type === "text" ? "Canal de texto" : undefined }))} /></div>;
            })}
            {!available ? <p className="m-0 text-xs text-muted-foreground">O bot precisa estar conectado para listar os recursos deste servidor.</p> : null}
          </div>;
        })}
      </div> : null}
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={sync} disabled={!activeGroup.guildIds.includes(activeGuildId) || activeGroup.guildIds.length < 2}>Sincronizar configurações deste servidor</Button><Button variant="ghost" onClick={() => { save(groups.filter((group) => group.id !== activeGroup.id)); setSelected(""); setStatus("Grupo removido."); }}>Remover grupo</Button></div>
    </> : <p className="m-0 text-sm text-muted-foreground">Crie um grupo para compartilhar configurações. Cada servidor mantém seus próprios canais e cargos do Discord.</p>}
    {status ? <p role="status" className="m-0 text-sm text-muted-foreground">{status}</p> : null}
  </section>;
}
