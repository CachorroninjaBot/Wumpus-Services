import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useModule, useWumpus } from "@/lib/wumpus/store";
import { formatTime } from "@/lib/utils";

export const Route = createFileRoute("/app/logs")({ component: LogsPage });

function LogsPage() {
  const gid = useWumpus((s) => s.activeGuildId);
  const allLogs = useWumpus((s) => s.logs);
  const logs = allLogs.filter((l) => l.guildId === gid);
  const lcfg = useModule("logs");
  const updateConfig = useWumpus((s) => s.updateConfig);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const cats = useMemo(() => ["all", ...Array.from(new Set(logs.map((l) => l.category)))], [logs]);
  const filtered = logs.filter((l) => {
    if (cat !== "all" && l.category !== cat) return false;
    if (q && !`${l.summary} ${l.actor}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1 className="m-0 text-xl font-semibold tracking-tight">Auditoria</h1>
      <div className="flex flex-wrap gap-2">
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`h-9 rounded-full px-3 text-sm ${cat === c ? "bg-secondary" : "text-muted-foreground hover:bg-muted"}`}
          >
            {c === "all" ? "tudo" : c}
          </button>
        ))}
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar" />
      <Card className="p-0">
        <ul className="m-0 divide-y divide-border p-0">
          {filtered.map((l) => (
            <li key={l.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
              <span className="w-36 shrink-0 font-mono-num text-xs text-muted-foreground">{formatTime(l.at)}</span>
              <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{l.category}</span>
              <span className="text-sm">
                <span className="text-muted-foreground">{l.actor} · </span>
                {l.summary}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label>Modo compacto</Label>
          <Switch
            checked={Boolean(lcfg.config.compactMode)}
            onCheckedChange={(v) => updateConfig("logs", { compactMode: v })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label>Registrar AutoMod</Label>
          <Switch
            checked={Boolean(lcfg.config.logAutoMod)}
            onCheckedChange={(v) => updateConfig("logs", { logAutoMod: v })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label>Registrar moderação</Label>
          <Switch
            checked={Boolean(lcfg.config.logModeration)}
            onCheckedChange={(v) => updateConfig("logs", { logModeration: v })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label>Ignorar bot</Label>
          <Switch
            checked={Boolean(lcfg.config.ignoreBotMessages)}
            onCheckedChange={(v) => updateConfig("logs", { ignoreBotMessages: v })}
          />
        </div>
      </Card>
      <Card className="space-y-3">
        <h2 className="m-0 text-base font-semibold">Ignorar eventos</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Usuários ignorados</Label>
            <Input
              defaultValue={Array.isArray(lcfg.config.ignoredUserIds) ? lcfg.config.ignoredUserIds.join(", ") : ""}
              onBlur={(e) =>
                updateConfig("logs", {
                  ignoredUserIds: e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean)
                })
              }
            />
          </div>
          <div>
            <Label>Cargos ignorados</Label>
            <Input
              defaultValue={Array.isArray(lcfg.config.ignoredRoleIds) ? lcfg.config.ignoredRoleIds.join(", ") : ""}
              onBlur={(e) =>
                updateConfig("logs", {
                  ignoredRoleIds: e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean)
                })
              }
            />
          </div>
          <div>
            <Label>Canais ignorados</Label>
            <Input
              defaultValue={Array.isArray(lcfg.config.ignoredChannelIds) ? lcfg.config.ignoredChannelIds.join(", ") : ""}
              onBlur={(e) =>
                updateConfig("logs", {
                  ignoredChannelIds: e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean)
                })
              }
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
