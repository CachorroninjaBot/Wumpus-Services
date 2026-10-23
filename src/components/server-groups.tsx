import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { GuildBadge } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { SearchSelect } from "@/components/search-select";
import { Dialog, DialogContent, DialogDesc, DialogTitle } from "@/components/ui/dialog";
import { useWumpus } from "@/lib/wumpus/store";
import { cn } from "@/lib/utils";
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
  const [createOpen, setCreateOpen] = useState(false);
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
  const moveGroup = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= groups.length) return;
    const next = [...groups];
    [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
    save(next);
    setStatus("Ordem dos grupos atualizada.");
  };
  const moveGuild = (group: ServerGroup, index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= group.guildIds.length) return;
    const guildIds = [...group.guildIds];
    [guildIds[index], guildIds[nextIndex]] = [guildIds[nextIndex]!, guildIds[index]!];
    save(groups.map((item) => item.id === group.id ? { ...item, guildIds } : item));
    setStatus("Ordem dos servidores no grupo atualizada.");
  };
  const create = () => {
    const cleanName = name.trim();
    if (!cleanName || !targets.includes(activeGuildId)) return;
    const group = { id: `group-${Date.now().toString(36)}`, name: cleanName, guildIds: [...new Set(targets)], resourceMappings: {} };
    save([...groups, group]); setSelected(group.id); setName(""); setStatus(`Grupo “${cleanName}” criado.`);
    setCreateOpen(false);
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

  return <section className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="m-0 text-base font-semibold">Grupos de configuração</h2><p className="m-0 mt-1 max-w-2xl text-sm text-muted-foreground">Organize servidores e sincronize os módulos escolhidos. Canais e cargos equivalentes continuam configurados por servidor.</p></div>
      <Button onClick={() => { setTargets(activeGuildId ? [activeGuildId] : []); setName(""); setCreateOpen(true); }} disabled={!activeGuildId}>
        <Plus aria-hidden="true" className="size-4" /> Criar grupo
      </Button>
    </div>
    {groups.length ? (
      <div aria-label="Grupos salvos" className="grid gap-2 sm:grid-cols-2">
        {groups.map((group, index) => (
          <div key={group.id} className={cn(
            "flex min-h-14 items-center gap-2 rounded-xl border px-2",
            selected === group.id ? "border-primary/60 bg-secondary/70" : "border-border bg-card",
          )}>
            <button type="button" aria-pressed={selected === group.id} onClick={() => { setSelected(group.id); setStatus(""); }}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/60">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-sm font-semibold">{group.name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{group.name}</span><span className="block text-xs text-muted-foreground">{group.guildIds.length} {group.guildIds.length === 1 ? "servidor" : "servidores"}</span></span>
            </button>
            <div className="flex shrink-0">
              <button type="button" aria-label={`Mover grupo ${group.name} para cima`} title="Mover para cima" disabled={index === 0} onClick={() => moveGroup(index, -1)} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35"><ArrowUp className="size-4" /></button>
              <button type="button" aria-label={`Mover grupo ${group.name} para baixo`} title="Mover para baixo" disabled={index === groups.length - 1} onClick={() => moveGroup(index, 1)} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35"><ArrowDown className="size-4" /></button>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="rounded-xl border border-dashed border-border px-4 py-5">
        <p className="m-0 text-sm font-medium">Nenhum grupo criado</p>
        <p className="m-0 mt-1 text-sm text-muted-foreground">Crie um grupo para organizar servidores e compartilhar configurações entre eles.</p>
      </div>
    )}
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogTitle>Criar grupo de configuração</DialogTitle>
        <DialogDesc>Escolha um nome e os servidores que vão compartilhar as configurações deste grupo.</DialogDesc>
        <div className="mt-5 space-y-4">
          <div>
            <Label htmlFor="server-group-name">Nome do grupo</Label>
            <input id="server-group-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm" placeholder="Ex.: Comunidades parceiras" />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Servidores no grupo</legend>
            {guilds.map((guild) => {
              const isActive = guild.id === activeGuildId;
              return (
                <label key={guild.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 hover:bg-muted/50">
                  <input type="checkbox" checked={targets.includes(guild.id)} disabled={isActive} onChange={(event) => setTargets(event.target.checked ? [...new Set([...targets, guild.id])] : targets.filter((id) => id !== guild.id))} />
                  <GuildBadge tag={guild.tag ?? "W"} iconUrl={guild.iconUrl} size={30} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{guild.name}</span>
                  {isActive ? <span className="text-xs text-muted-foreground">Servidor atual</span> : null}
                </label>
              );
            })}
          </fieldset>
          <p className="m-0 text-xs leading-5 text-muted-foreground">A ordem dos servidores pode ser ajustada depois. A sincronização adapta canais e cargos para cada comunidade.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={create} disabled={!name.trim() || !targets.includes(activeGuildId)}>Criar grupo</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {activeGroup ? <>
      <div className="rounded-xl border border-border p-3">
        <h3 className="m-0 text-sm font-semibold">Servidores do grupo</h3>
        <p className="m-0 mt-1 text-xs text-muted-foreground">Use as setas para definir a ordem. O servidor atual é a origem da sincronização.</p>
        <div className="mt-3 space-y-2">
          {activeGroup.guildIds.map((guildId, index) => {
            const guild = guilds.find((item) => item.id === guildId);
            return <div key={guildId} className="flex min-h-11 items-center gap-2 rounded-lg bg-muted/40 px-2">
              {guild ? <GuildBadge tag={guild.tag ?? "W"} iconUrl={guild.iconUrl} size={28} /> : null}
              <span className="min-w-0 flex-1 truncate text-sm">{guild?.name ?? guildId}{guildId === activeGuildId ? <span className="ml-2 text-xs text-muted-foreground">origem</span> : null}</span>
              <button type="button" aria-label={`Mover ${guild?.name ?? "servidor"} para cima`} disabled={index === 0} onClick={() => moveGuild(activeGroup, index, -1)} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-background disabled:opacity-35"><ArrowUp className="size-4" /></button>
              <button type="button" aria-label={`Mover ${guild?.name ?? "servidor"} para baixo`} disabled={index === activeGroup.guildIds.length - 1} onClick={() => moveGuild(activeGroup, index, 1)} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-background disabled:opacity-35"><ArrowDown className="size-4" /></button>
              {guildId !== activeGuildId ? <button type="button" onClick={() => save(groups.map((group) => group.id === activeGroup.id ? { ...group, guildIds: group.guildIds.filter((id) => id !== guildId) } : group))} className="rounded-lg px-2 py-1 text-xs text-destructive hover:bg-destructive/10">Remover</button> : null}
            </div>;
          })}
        </div>
        {availableGuilds.some((guild) => !activeGroup.guildIds.includes(guild.id)) ? <div className="mt-3 flex flex-wrap gap-2">
          {availableGuilds.filter((guild) => !activeGroup.guildIds.includes(guild.id)).map((guild) => <Button key={guild.id} size="sm" variant="outline" onClick={() => save(groups.map((group) => group.id === activeGroup.id ? { ...group, guildIds: [...group.guildIds, guild.id] } : group))}><Plus className="size-3.5" />{guild.name}</Button>)}
        </div> : null}
      </div>
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
    </> : null}
    {status ? <p role="status" className="m-0 text-sm text-muted-foreground">{status}</p> : null}
  </section>;
}
