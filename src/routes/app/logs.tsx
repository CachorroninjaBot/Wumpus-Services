import { PageHeader } from "@/components/page-header";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { DiscordMultiSelect, DiscordSelect } from "@/components/discord-select";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getGuildAudit } from "@/lib/wumpus/runtime-store";
import { getStoredSessionToken } from "@/lib/wumpus/session-token";
import { useModule, useWumpus } from "@/lib/wumpus/store";
import { formatTime } from "@/lib/utils";

export const Route = createFileRoute("/app/logs")({ component: LogsPage });

type EventRow = Awaited<ReturnType<typeof getGuildAudit>>[number];
const categories = [
  ["logModeration", "Moderação"], ["logMembers", "Membros"], ["logMessages", "Mensagens"],
  ["logVoice", "Voz"], ["logRoles", "Cargos"], ["logChannels", "Canais"],
  ["logBans", "Banimentos"], ["logAutoMod", "AutoMod"],
] as const;
const extendedCategories = [
  ["logThreadEvents", "Threads"], ["logStageEvents", "Stages"], ["logScheduledEvents", "Eventos agendados"],
] as const;

function LogsPage() {
  const gid = useWumpus((s) => s.activeGuildId);
  const lcfg = useModule("logs");
  const updateConfig = useWumpus((s) => s.updateConfig);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [ignoredDraft, setIgnoredDraft] = useState({ ignoredUserIds: "" });
  const [retentionDraft, setRetentionDraft] = useState(String(lcfg.config.retentionDays ?? 180));

  useEffect(() => {
    setIgnoredDraft({
      ignoredUserIds: Array.isArray(lcfg.config.ignoredUserIds) ? (lcfg.config.ignoredUserIds as string[]).join(", ") : "",
    });
    setRetentionDraft(String(lcfg.config.retentionDays ?? 180));
  }, [gid, lcfg.config]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const rows = await getGuildAudit({ data: { token: getStoredSessionToken(), guildId: gid, limit: 300 } });
        if (active) { setEvents(rows); setError(null); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível ler a auditoria do bot.");
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [gid]);

  const cats = useMemo(() => ["all", ...Array.from(new Set(events.map((event) => event.category)))], [events]);
  const filtered = events.filter((event) => {
    if (cat !== "all" && event.category !== cat) return false;
    const query = q.toLowerCase();
    return !query || `${event.summary} ${event.eventType} ${event.actorId ?? ""} ${event.targetId ?? ""}`.toLowerCase().includes(query);
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <PageHeader title="Auditoria" description="Eventos e ações registradas pelo bot." />
        <p className="mb-0 mt-1 text-sm text-muted-foreground">Eventos persistidos pelo bot. Atualiza a cada 30 segundos.</p>
      </div>
      <Card className="p-0">
        <h2 className="sr-only">Configurações de auditoria</h2>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map(([field, label]) => (
            <div key={field} className="flex items-center justify-between gap-2">
              <Label>{label}</Label>
              <Switch checked={Boolean(lcfg.config[field])} onCheckedChange={(value) => updateConfig("logs", { [field]: value })} />
            </div>
          ))}
          {extendedCategories.map(([field, label]) => (
            <div key={field} className="flex items-center justify-between gap-2">
              <Label>{label}</Label>
              <Switch checked={Boolean(lcfg.config[field])} onCheckedChange={(value) => updateConfig("logs", { [field]: value })} />
            </div>
          ))}
          <div className="flex items-center justify-between gap-2">
            <Label>Ignorar mensagens de bots</Label>
            <Switch checked={Boolean(lcfg.config.ignoreBotMessages)} onCheckedChange={(value) => updateConfig("logs", { ignoreBotMessages: value })} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label>Formato compacto</Label>
            <Switch checked={Boolean(lcfg.config.compactMode)} onCheckedChange={(value) => updateConfig("logs", { compactMode: value })} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label>Mencionar equipe em eventos críticos</Label>
            <Switch checked={Boolean(lcfg.config.mentionOnCritical)} onCheckedChange={(value) => updateConfig("logs", { mentionOnCritical: value })} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label>Incluir horário nos logs</Label>
            <Switch checked={Boolean(lcfg.config.includeTimestamp)} onCheckedChange={(value) => updateConfig("logs", { includeTimestamp: value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="logs-retention">Retenção da auditoria (dias)</Label>
            <Input id="logs-retention" type="number" min={7} max={3650} value={retentionDraft}
              onChange={(event) => setRetentionDraft(event.target.value)}
              onBlur={() => updateConfig("logs", { retentionDays: Math.max(7, Math.min(3650, Number(retentionDraft) || 7)) })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="logs-channel">Canal de logs</Label>
            <DiscordSelect id="logs-channel" kind="text" value={String(lcfg.config.channelId ?? "")} onChange={(channelId) => updateConfig("logs", { channelId })} placeholder="Selecione um canal" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="logs-mention-role">Cargo mencionado em alertas</Label>
            <DiscordSelect id="logs-mention-role" kind="role" value={String(lcfg.config.mentionRoleId ?? "")} onChange={(mentionRoleId) => updateConfig("logs", { mentionRoleId })} placeholder="Sem menção de cargo" />
          </div>
        </div>
      </Card>
      <details className="rounded-2xl bg-card text-card-foreground shadow-border">
        <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-2xl px-5 py-3 text-sm font-semibold hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          <span>Histórico de auditoria</span>
          <span className="text-xs font-normal text-muted-foreground">
            {error ? "Falha ao carregar · abrir detalhes" : `${events.length} eventos · abrir histórico`}
          </span>
        </summary>
        <div className="space-y-3 border-t border-border p-4">
          {error ? <p role="alert" className="m-0 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            {cats.map((category) => (
              <button key={category} type="button" onClick={() => setCat(category)}
                className={`min-h-9 rounded-full px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${cat === category ? "bg-secondary" : "text-muted-foreground hover:bg-muted"}`}>
                {category === "all" ? "tudo" : category}
              </button>
            ))}
          </div>
          <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar evento, usuário ou alvo" />
          <div>
            {filtered.length ? (
              <ul className="m-0 divide-y divide-border p-0">
                {filtered.map((event) => (
                  <li key={event.id} className="flex flex-col gap-1 px-1 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                    <time className="w-36 shrink-0 font-mono-num text-xs text-muted-foreground" dateTime={new Date(event.at).toISOString()}>{formatTime(event.at)}</time>
                    <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{event.category}</span>
                    <span className="min-w-0 flex-1 text-sm">
                      {event.actorId ? <><a className="text-primary" href={`https://discord.com/users/${event.actorId}`} target="_blank" rel="noreferrer">Autor</a> · </> : null}
                      {event.summary}
                      {event.targetId ? <> · alvo <code>{event.targetId}</code></> : null}
                      {event.channelId ? <> · <a className="text-primary" href={`https://discord.com/channels/${gid}/${event.channelId}`} target="_blank" rel="noreferrer">canal</a></> : null}
                    </span>
                    <span className={`text-xs ${event.severity === "critical" ? "text-destructive" : event.severity === "warning" ? "text-warn" : "text-muted-foreground"}`}>{event.severity}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="m-0 p-6 text-center text-sm text-muted-foreground">{error ? "A auditoria não foi carregada." : "Nenhum evento corresponde ao filtro."}</p>}
          </div>
        </div>
      </details>
      <Card className="space-y-3">
        <h2 className="m-0 text-base font-semibold">Ignorar eventos</h2>
        <p className="m-0 text-sm text-muted-foreground">Escolha cargos e canais que devem ficar fora da auditoria. Para ignorar uma pessoa, informe o ID do usuário.</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div><Label htmlFor="ignoredUserIds">Usuários ignorados (IDs)</Label><Input id="ignoredUserIds" value={ignoredDraft.ignoredUserIds} onChange={(event) => setIgnoredDraft((current) => ({ ...current, ignoredUserIds: event.target.value }))} onBlur={() => updateConfig("logs", { ignoredUserIds: ignoredDraft.ignoredUserIds.split(",").map((id) => id.trim()).filter(Boolean) })} /></div>
          <div><Label>Cargos ignorados</Label><DiscordMultiSelect value={Array.isArray(lcfg.config.ignoredRoleIds) ? lcfg.config.ignoredRoleIds as string[] : []} onChange={(ignoredRoleIds) => updateConfig("logs", { ignoredRoleIds })} /></div>
          <div><Label>Canais ignorados</Label><DiscordMultiSelect kind="text" value={Array.isArray(lcfg.config.ignoredChannelIds) ? lcfg.config.ignoredChannelIds as string[] : []} onChange={(ignoredChannelIds) => updateConfig("logs", { ignoredChannelIds })} /></div>
        </div>
      </Card>
    </div>
  );
}
