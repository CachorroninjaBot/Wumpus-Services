import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Eye,
  LockKeyhole,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { presets, type PresetId } from "@/lib/wumpus/defaults";
import { getGuildProtectionReadiness, getGuildSecurityIncidents } from "@/lib/wumpus/runtime-store";
import { cn, formatRelative } from "@/lib/utils";

export type SecurityEvent = Awaited<ReturnType<typeof getGuildSecurityIncidents>>[number];

const configFieldLabels: Record<string, string> = {
  blockInvites: "Bloqueio de convites",
  blockLinks: "Bloqueio de links",
  allowedDomains: "Domínios permitidos",
  blockedTerms: "Termos bloqueados",
  action: "Ação do AutoMod",
  capsThresholdPercent: "Limite de letras maiúsculas",
  mentionLimit: "Limite de menções",
  raidMode: "Modo anti-raid",
  raidJoinThreshold: "Limite de entradas",
  minAccountAgeHours: "Idade mínima da conta",
  quarantineNewMembers: "Isolamento de contas novas",
  slaWarningMinutes: "Aviso de prazo do atendimento",
  departments: "Departamentos de atendimento",
};

export function SectionHeading({
  title,
  description,
  enabled,
  onEnabledChange,
  disabled = false,
  statusLabel,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  disabled?: boolean;
  statusLabel?: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="m-0 text-xl font-semibold">{title}</h2>
        <p className="m-0 mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <label
        className={`flex min-h-10 items-center gap-3 rounded-lg border border-border bg-card px-3 text-sm ${disabled ? "opacity-60" : ""}`}
      >
        <span>{statusLabel ?? (enabled ? "Ligado" : "Pausado")}</span>
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          disabled={disabled}
          aria-label={`${enabled ? "Pausar" : "Ativar"} ${title}`}
        />
      </label>
    </header>
  );
}

export function SectionTitle({ title }: { title: string }) {
  return <h3 className="m-0 text-base font-semibold">{title}</h3>;
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex min-h-12 items-center justify-between gap-4 py-2 ${disabled ? "opacity-55" : ""}`}
    >
      <div className="min-w-0">
        <p className="m-0 text-sm font-medium">{label}</p>
        {description ? (
          <p className="m-0 mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
    </div>
  );
}

export function Field({
  id,
  label,
  children,
  hint,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="m-0 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
  disabled = false,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <Field id={id} label={label} hint={hint}>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))
        }
      />
    </Field>
  );
}

export function ListField({
  id,
  label,
  hint,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  placeholder?: string;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function addItems(items: string[]) {
    const next = [...value];
    const seen = new Set(value.map((item) => item.trim().toLocaleLowerCase()));
    for (const item of items) {
      const trimmed = item.trim();
      const normalized = trimmed.toLocaleLowerCase();
      if (trimmed && !seen.has(normalized)) {
        next.push(trimmed);
        seen.add(normalized);
      }
    }
    if (next.length !== value.length) onChange(next);
  }

  function commitDraft() {
    if (!draft.trim()) return;
    addItems([draft]);
    setDraft("");
  }

  function removeItem(itemToRemove: string) {
    const index = value.indexOf(itemToRemove);
    if (index < 0) return;
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <Field id={id} label={label} hint={hint}>
      <div
        role="group"
        aria-label={label}
        className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card px-2 py-1.5 transition-[box-shadow,border-color] duration-150 focus-within:ring-2 focus-within:ring-ring has-[:disabled]:opacity-50"
      >
        {value.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="inline-flex min-h-7 max-w-full items-center gap-1 rounded-md bg-secondary px-2 text-xs font-medium text-secondary-foreground"
          >
            <span className="truncate">{item}</span>
            <button
              type="button"
              aria-label={`Remover "${item}" de ${label}`}
              title={`Remover ${item}`}
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => removeItem(item)}
              className="grid size-4 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none"
            >
              <span aria-hidden="true">×</span>
            </button>
          </span>
        ))}
        <Input
          id={id}
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="h-8 min-w-28 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            } else if (event.key === "Backspace" && !draft && value.length) {
              removeItem(value[value.length - 1]!);
            }
          }}
        />
      </div>
    </Field>
  );
}

export function ModuleStatusRow({
  label,
  detail,
  enabled,
  onChange,
  icon: Icon,
}: {
  label: string;
  detail: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  icon: typeof Shield;
}) {
  return (
    <div className="flex min-h-[4.4rem] items-center gap-3 py-3">
      <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-medium">{label}</p>
        <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <Badge tone={enabled ? "ok" : "default"}>{enabled ? "Ligado" : "Pausado"}</Badge>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        aria-label={`${enabled ? "Pausar" : "Ativar"} ${label}`}
      />
    </div>
  );
}

export function ReadinessRow({
  label,
  detail,
  status,
  tone,
  onClick,
}: {
  label: string;
  detail: string;
  status: string;
  tone: "ok" | "warn";
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-medium">{label}</p>
        <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <Badge tone={tone}>{status}</Badge>
      {onClick ? <ChevronRight className="size-4 text-muted-foreground" /> : null}
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[4.4rem] w-full items-center gap-3 py-3 text-left"
    >
      {content}
    </button>
  ) : (
    <div className="flex min-h-[4.4rem] items-center gap-3 py-3">{content}</div>
  );
}

export function BotConnectionStatus({
  readiness,
  error,
}: {
  readiness: Awaited<ReturnType<typeof getGuildProtectionReadiness>> | null;
  error: string | null;
}) {
  const status = readiness?.status ?? "unknown";
  const label =
    status === "online"
      ? "Conectado ao servidor"
      : status === "offline"
        ? "Sem conexão recente"
        : status === "not_installed"
          ? "Bot não está neste servidor"
          : "Estado indisponível";
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-1 size-2.5 rounded-full ${status === "online" ? "bg-ok" : status === "offline" || status === "not_installed" ? "bg-destructive" : "bg-warn"}`}
      />
      <div>
        <p className="m-0 text-sm font-medium">{label}</p>
        <p className="m-0 mt-1 text-xs text-muted-foreground">
          {readiness?.lastSeenAt
            ? `Último sinal ${formatRelative(readiness.lastSeenAt)}${readiness.pingMs == null ? "" : ` · ${readiness.pingMs} ms`}`
            : (error ?? "Aguardando o primeiro sinal do bot.")}
        </p>
      </div>
    </div>
  );
}

export function PermissionStatus({
  label,
  value,
  botStatus,
}: {
  label: string;
  value: boolean | null;
  botStatus: string;
}) {
  const missing = botStatus === "online" && value === false;
  const status =
    botStatus !== "online" || value === null
      ? "Aguardando"
      : value
        ? "Disponível"
        : "Falta permissão";
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 py-2">
      <span className="text-sm">{label}</span>
      <Badge tone={missing ? "danger" : value ? "ok" : "default"}>{status}</Badge>
    </div>
  );
}

export function PermissionCheckInline({
  label,
  value,
  botStatus,
}: {
  label: string;
  value: boolean | null;
  botStatus: string;
}) {
  const missing = botStatus === "online" && value === false;
  return (
    <p
      className={`m-0 flex items-center gap-2 text-sm ${missing ? "text-destructive" : "text-muted-foreground"}`}
    >
      <span
        className={`size-1.5 rounded-full ${missing ? "bg-destructive" : value ? "bg-ok" : "bg-muted-foreground/50"}`}
      />
      {label}:{" "}
      {botStatus !== "online" || value === null
        ? "a confirmar"
        : value
          ? "disponível"
          : "falta ao bot"}
    </p>
  );
}

export function CheckLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p
      className={`m-0 flex items-center gap-2 text-sm ${ok ? "text-ok" : "text-muted-foreground"}`}
    >
      <span
        className={`grid size-4 place-items-center rounded-full ${ok ? "bg-ok/15" : "bg-muted"}`}
      >
        {ok ? <Check className="size-3" /> : null}
      </span>
      {label}
    </p>
  );
}

export function PausedNotice({ name, onResume }: { name: string; onResume: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warn/10 px-3 py-2.5">
      <p className="m-0 text-sm">
        {name} está pausado. As regras abaixo não estão sendo aplicadas pelo bot.
      </p>
      <Button size="sm" variant="outline" onClick={onResume}>
        Ativar agora
      </Button>
    </div>
  );
}

export function SecurityEventList({
  events,
  onReview,
  onOpen,
  onLockdown,
  lockdown,
  compact = false,
}: {
  events: SecurityEvent[];
  onReview: (id: number) => void;
  onOpen: (event: SecurityEvent) => void;
  onLockdown: () => void;
  lockdown: boolean;
  compact?: boolean;
}) {
  if (!events.length)
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
        <ShieldCheck className="mx-auto size-6 text-ok" aria-hidden="true" />
        <p className="mb-0 mt-2 text-sm font-medium">Nenhum alerta nesta lista</p>
        <p className="m-0 mt-1 text-xs text-muted-foreground">
          Os eventos reais do AutoMod e da proteção aparecem aqui.
        </p>
      </div>
    );
  return (
    <ul className="m-0 divide-y divide-border rounded-xl border border-border bg-card p-0">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
          <span
            className={`mt-1.5 size-2 shrink-0 rounded-full ${event.severity === "critical" ? "bg-destructive" : event.severity === "warning" ? "bg-warn" : "bg-info"}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="m-0 text-sm font-semibold">{event.title}</p>
              <Badge
                tone={
                  event.severity === "critical"
                    ? "danger"
                    : event.severity === "warning"
                      ? "warn"
                      : "info"
                }
              >
                {severityLabel(event.severity)}
              </Badge>
              <Badge>{event.module === "automod" ? "AutoMod" : "Segurança"}</Badge>
              {event.acknowledged ? <Badge tone="ok">Revisado</Badge> : null}
            </div>
            <p className="m-0 mt-1 text-sm text-muted-foreground">{event.detail}</p>
            <p className="m-0 mt-1 text-xs text-muted-foreground">
              {formatRelative(event.at)}
              {event.targetId ? ` · usuário ${event.targetId}` : ""}
              {event.channelId ? ` · canal ${event.channelId}` : ""}
            </p>
            {!compact || !event.acknowledged ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onOpen(event)}>
                  Ver configuração
                  <ArrowRight className="size-3.5" />
                </Button>
                {!event.acknowledged ? (
                  <Button size="sm" variant="ghost" onClick={() => onReview(event.id)}>
                    Marcar como revisado
                  </Button>
                ) : null}
                {event.eventType.startsWith("security_") &&
                !lockdown &&
                event.severity === "critical" ? (
                  <Button size="sm" variant="destructive" onClick={onLockdown}>
                    Ativar lockdown
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {event.acknowledged ? "Visto" : "Pendente"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function getPresetChanges(
  preset: PresetId,
  automodConfig: Record<string, unknown>,
  securityConfig: Record<string, unknown>,
  ticketsConfig: Record<string, unknown>,
) {
  const configs: Record<string, Record<string, unknown>> = {
    automod: automodConfig,
    security: securityConfig,
    tickets: ticketsConfig,
  };
  return Object.entries(presets[preset].patch).flatMap(([module, patch]) =>
    Object.entries(patch ?? {}).flatMap(([key, value]) => {
      const current = configs[module]?.[key];
      if (JSON.stringify(current) === JSON.stringify(value)) return [];
      return [
        {
          key: `${module}.${key}`,
          module,
          label: configFieldLabels[key] ?? key,
          value: formatConfigValue(value),
        },
      ];
    }),
  );
}

export function formatConfigValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "ligado" : "desligado";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "lista limpa";
  if (typeof value === "number") return String(value);
  if (value === "smart") return "Inteligente";
  if (value === "strict") return "Estrito";
  if (value === "passive") return "Só avisar";
  if (value === "delete") return "Apagar";
  if (value === "warn") return "Avisar";
  return String(value);
}

export function severityLabel(severity: string) {
  return severity === "critical" ? "Crítico" : severity === "warning" ? "Aviso" : "Informativo";
}
export function actionLabel(action?: string) {
  return action === "timeout" || action === "mute"
    ? "apagar e aplicar timeout"
    : action === "warn"
      ? "avisar"
      : "apagar";
}
export function raidResponseDescription(response: string) {
  return response === "alert"
    ? "O bot avisa a equipe e não aplica restrições automaticamente."
    : response === "auto"
      ? "O bot aplica timeout a membros que entrarem durante a detecção; exige confirmação separada."
      : "Ao detectar uma raid, o bot ativa o lockdown e envia um alerta para revisão da equipe.";
}
export function channelLabel(channels: Array<{ id: string; name: string }>, id: string) {
  return channels.find((channel) => channel.id === id || channel.name === id)?.name
    ? `Painel em #${channels.find((channel) => channel.id === id || channel.name === id)?.name}`
    : "Canal não encontrado na lista sincronizada";
}

