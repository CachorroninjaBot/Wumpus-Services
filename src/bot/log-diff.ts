import type { AuditLogChange } from "discord.js";
import type { LogField } from "./panels.ts";

const LABELS: Record<string, string> = {
  name: "Nome", topic: "Descrição", nsfw: "NSFW", rate_limit_per_user: "Slowmode",
  permission_overwrites: "Permissões", allow: "Permissões permitidas", deny: "Permissões negadas",
  permissions: "Permissões", color: "Cor", hoist: "Separado na lista", mentionable: "Mencionável",
  bitrate: "Bitrate", user_limit: "Limite de usuários", parent_id: "Categoria", position: "Posição",
  type: "Tipo", afk_channel_id: "Canal AFK", afk_timeout: "Tempo AFK",
  verification_level: "Verificação", default_message_notifications: "Notificações",
  explicit_content_filter: "Filtro de conteúdo", system_channel_id: "Canal do sistema",
  reason: "Motivo", communication_disabled_until: "Timeout até",
};

function printable(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "nenhum";
  if (typeof value === "string") return value || "vazio";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

/** Turn Discord audit-log changes into compact, bounded before/after fields. */
export function renderAuditDiff(changes: readonly AuditLogChange[], maxChars = 900): LogField[] {
  const lines = changes.map((change) => {
    const label = LABELS[change.key] ?? change.key.replaceAll("_", " ");
    return `**${label}**\n${printable(change.old)} → ${printable(change.new)}`;
  });
  const result: LogField[] = [];
  let remaining = Math.max(0, maxChars);
  for (const line of lines) {
    if (remaining <= 0) break;
    const value = line.length <= remaining ? line : `${line.slice(0, Math.max(0, remaining - 1))}…`;
    result.push({ name: "Antes → depois", value });
    remaining -= value.length;
  }
  return result;
}

export function summarizeAuditDiff(changes: readonly AuditLogChange[], maxChars = 900): string {
  return renderAuditDiff(changes, maxChars).map((field) => field.value).join("\n");
}
