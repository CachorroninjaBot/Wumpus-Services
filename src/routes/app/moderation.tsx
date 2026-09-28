import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MemberAvatar } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { effectiveStrikes, nextModerationAction } from "@/lib/wumpus/engine";
import { useGuildMembers, useModule, useWumpus } from "@/lib/wumpus/store";
import type { ModAction } from "@/lib/wumpus/types";
import { formatRelative } from "@/lib/utils";

export const Route = createFileRoute("/app/moderation")({ component: ModerationPage });

const actions: Array<{ id: ModAction; label: string }> = [
  { id: "warn", label: "Advertir" },
  { id: "timeout", label: "Silenciar" },
  { id: "kick", label: "Expulsar" },
  { id: "ban", label: "Banir" },
  { id: "pardon", label: "Perdoar" },
];

function ModerationPage() {
  const gid = useWumpus((s) => s.activeGuildId);
  const members = useGuildMembers();
  const allCases = useWumpus((s) => s.cases);
  const cases = allCases.filter((c) => c.guildId === gid);
  const mcfg = useModule("moderation");
  const punish = useWumpus((s) => s.punish);
  const user = useWumpus((s) => s.sessionUser);
  const updateConfig = useWumpus((s) => s.updateConfig);
  const setEnabled = useWumpus((s) => s.setModuleEnabled);

  const [q, setQ] = useState("");
  const [targetId, setTargetId] = useState(members.find((m) => m.strikes > 0)?.id ?? members[0]?.id ?? "");
  const [action, setAction] = useState<ModAction>("warn");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return members.filter((m) => !s || m.displayName.toLowerCase().includes(s) || m.username.includes(s));
  }, [members, q]);
  const target = members.find((m) => m.id === targetId);
  const liveStrikes = target
    ? effectiveStrikes(target.strikes, cases, target.id, Number(mcfg.config.strikeExpiryDays ?? 0))
    : 0;
  const preview = target ? nextModerationAction(liveStrikes, mcfg.config) : null;

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <h1 className="m-0 text-xl font-semibold tracking-tight">Moderação</h1>
        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-40 flex-1">
              <Label>Buscar membro</Label>
              <Input className="mt-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="nome" />
            </div>
            <div className="flex items-center gap-2">
              <Label>Módulo ligado</Label>
              <Switch checked={mcfg.enabled} onCheckedChange={(v) => setEnabled("moderation", v)} />
            </div>
          </div>
          <ul className="mt-4 m-0 max-h-64 space-y-1 overflow-y-auto p-0">
            {filtered.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setTargetId(m.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left ${targetId === m.id ? "bg-muted" : "hover:bg-muted/50"}`}
                >
                  <MemberAvatar name={m.displayName} hue={m.hue} size={32} />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{m.displayName}</span>
                    <span className="text-xs text-muted-foreground">@{m.username}</span>
                  </span>
                  {m.banned ? <Badge tone="danger">ban</Badge> : null}
                  {m.timedOutUntil && m.timedOutUntil > Date.now() ? <Badge tone="warn">timeout</Badge> : null}
                  <Badge>{m.strikes} strikes</Badge>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {target ? (
          <Card>
            <h2 className="mt-0 text-base font-semibold">Ação em {target.displayName}</h2>
            <p className="text-sm text-muted-foreground">
              {liveStrikes} advertências na janela. Próximo passo se advertir: {preview?.action} — {preview?.note}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAction(a.id)}
                  className={`h-9 rounded-full px-3 text-sm ${action === a.id ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <Label>Motivo</Label>
                <Input className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div>
                <Label>Evidência</Label>
                <Textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} />
              </div>
              <Button
                onClick={() => {
                  const r = punish({
                    targetId: target.id,
                    actorId: user.id,
                    action,
                    reason,
                    evidence,
                    durationMinutes: action === "timeout" ? Number(mcfg.config.defaultTimeoutMinutes ?? 60) : undefined,
                  });
                  setNote(r.ok ? r.note : r.error);
                  if (r.ok) {
                    setReason("");
                    setEvidence("");
                  }
                }}
              >
                Aplicar
              </Button>
              {note ? <p className="m-0 text-sm text-muted-foreground">{note}</p> : null}
            </div>
          </Card>
        ) : null}

        <Card>
          <h2 className="mt-0 mb-3 text-base font-semibold">Histórico</h2>
          <ul className="m-0 space-y-2 p-0">
            {cases.slice(0, 12).map((c) => {
              const t = members.find((m) => m.id === c.targetId);
              return (
                <li key={c.id} className="flex justify-between gap-3 text-sm">
                  <span>
                    <span className="font-medium">{c.action}</span> · {t?.displayName} — {c.reason}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{formatRelative(c.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card className="h-fit space-y-4">
        <h2 className="mt-0 text-base font-semibold">Regras</h2>
        <Field label="Timeout padrão (min)">
          <Input
            type="number"
            defaultValue={Number(mcfg.config.defaultTimeoutMinutes ?? 60)}
            onBlur={(e) => updateConfig("moderation", { defaultTimeoutMinutes: Number(e.target.value) || 1 })}
          />
        </Field>
        <Field label="Advertências até timeout">
          <Input
            type="number"
            defaultValue={Number(mcfg.config.escalateAfterStrikes ?? 3)}
            onBlur={(e) => updateConfig("moderation", { escalateAfterStrikes: Number(e.target.value) || 1 })}
          />
        </Field>
        <Field label="Advertências até ban">
          <Input
            type="number"
            defaultValue={Number(mcfg.config.maxStrikesBeforeBan ?? 5)}
            onBlur={(e) => updateConfig("moderation", { maxStrikesBeforeBan: Number(e.target.value) || 1 })}
          />
        </Field>
        <Field label="Advertências expiram em (dias, 0 = nunca)">
          <Input
            type="number"
            defaultValue={Number(mcfg.config.strikeExpiryDays ?? 30)}
            onBlur={(e) => updateConfig("moderation", { strikeExpiryDays: Number(e.target.value) || 0 })}
          />
        </Field>
        <div className="flex items-center justify-between">
          <Label>Exigir evidência</Label>
          <Switch
            checked={Boolean(mcfg.config.requireEvidence)}
            onCheckedChange={(v) => updateConfig("moderation", { requireEvidence: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label>Permitir perdão</Label>
          <Switch
            checked={Boolean(mcfg.config.pardonsEnabled)}
            onCheckedChange={(v) => updateConfig("moderation", { pardonsEnabled: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label>Avisar em privado</Label>
          <Switch
            checked={Boolean(mcfg.config.dmOnPunish)}
            onCheckedChange={(v) => updateConfig("moderation", { dmOnPunish: v })}
          />
        </div>
      </Card>
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
