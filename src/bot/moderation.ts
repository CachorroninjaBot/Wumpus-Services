/**
 * Moderacao com strikes.
 *
 * O `/mod` do bot antigo aplicava a punicao e esquecia: sem strike, sem
 * escalonamento e sem registro — reincidencia era invisivel e a equipe
 * decidia no escuro.
 *
 * Aqui cada punicao vira uma ocorrencia persistida. Os strikes ativos contam
 * dentro da janela de expiracao e escalam sozinhos:
 *   - `escalateAfterStrikes` advertências viram timeout
 *   - `maxStrikesBeforeBan`  qualquer acao vira ban
 * A escalada e decidida no servidor, nunca pelo usuario que chamou o comando.
 */
import type { Guild } from "discord.js";
import { bool, isEnabled, moduleConfig, num } from "./config.ts";
import { auditAndLog } from "./logs.ts";
import type { Logger } from "./logger.ts";
import { mutate, nextId, read } from "./store.ts";

export type ModAction = "warn" | "timeout" | "kick" | "ban";

export type ModerationOccurrence = {
  id: number;
  guildId: string;
  targetId: string;
  staffId: string;
  requestedAction: ModAction;
  appliedAction: ModAction | null;
  reason: string;
  evidence: string[];
  strikeNumber: number;
  timeoutMinutes: number | null;
  status: "pending" | "applied" | "failed" | "pardoned";
  error: string | null;
  createdAt: string;
  appliedAt: string | null;
};

const ACTIONS: readonly ModAction[] = ["warn", "timeout", "kick", "ban"];

export function isModAction(value: string): value is ModAction {
  return (ACTIONS as readonly string[]).includes(value);
}

/** Rotulo humano, usado na DM e no log. */
const LABEL: Record<ModAction, string> = {
  warn: "advertido",
  timeout: "silenciado",
  kick: "expulso",
  ban: "banido"
};

const ACCENT: Record<ModAction, string> = {
  warn: "#7c5cff",
  timeout: "#f5a524",
  kick: "#f5a524",
  ban: "#ff5c6c"
};

/** Strikes ainda validos: aplicados ou em processamento dentro da janela. */
export async function countActiveStrikes(guildId: string, targetId: string, expiryDays: number): Promise<number> {
  const cutoff = Date.now() - expiryDays * 24 * 60 * 60 * 1000;

  const rows = await read<ModerationOccurrence>("moderation");
  return rows.filter((row) => {
    if (row.guildId !== guildId || row.targetId !== targetId) return false;
    if (row.status !== "applied" && row.status !== "pending") return false;
    const at = Date.parse(row.createdAt);
    return !Number.isFinite(at) || at >= cutoff;
  }).length;
}

/**
 * Registra a ocorrencia, decide a escalada e aplica a punicao.
 *
 * A ordem importa: grava primeiro (status `pending`) e aplica depois. Se o
 * Discord falhar, a ocorrencia fica como `failed` com o motivo — o strike nao
 * se perde e a equipe consegue ver que a acao nao pegou.
 */
export async function recordOccurrence(input: {
  guild: Guild;
  targetId: string;
  staffId: string;
  action: ModAction;
  reason: string;
  evidence?: string[];
  log: Logger;
}): Promise<{ occurrenceId: number; applied: boolean; strikes: number; action: ModAction }> {
  const { guild, targetId, staffId, action, reason, evidence, log } = input;

  const config = await moduleConfig(guild.id, "moderation");
  if (!isEnabled(config)) {
    throw new Error("O modulo de moderacao esta desligado neste servidor.");
  }
  const expiryDays = Math.max(1, Math.min(Math.trunc(num(config, "strikeExpiryDays", 30)), 365));

  if (bool(config, "requireEvidence", false) && !(evidence ?? []).length) {
    throw new Error("Este servidor exige evidencia para aplicar uma punicao.");
  }

  const current = await countActiveStrikes(guild.id, targetId, expiryDays);
  const strikeNumber = current + 1;

  const escalateAfter = Math.max(1, Math.trunc(num(config, "escalateAfterStrikes", 3)));
  const maxStrikes = Math.max(1, Math.trunc(num(config, "maxStrikesBeforeBan", 5)));

  let finalAction: ModAction = action;
  if (strikeNumber >= maxStrikes && action !== "ban") finalAction = "ban";
  else if (strikeNumber >= escalateAfter && action === "warn") finalAction = "timeout";

  const timeoutMinutes = finalAction === "timeout"
    ? Math.max(1, Math.trunc(num(config, "defaultTimeoutMinutes", 60)))
    : null;

  const occurrenceId = await nextId("moderation");
  const createdAt = new Date().toISOString();

  const occurrence: ModerationOccurrence = {
    id: occurrenceId,
    guildId: guild.id,
    targetId,
    staffId,
    requestedAction: action,
    appliedAction: null,
    reason: reason.slice(0, 1000),
    evidence: (evidence ?? []).slice(0, 10),
    strikeNumber,
    timeoutMinutes,
    status: "pending",
    error: null,
    createdAt,
    appliedAt: null
  };

  await mutate<ModerationOccurrence>("moderation", (rows) => {
    rows.push(occurrence);
    return rows;
  });

  let applied = false;
  let error: string | null = null;

  try {
    const member = await guild.members.fetch(targetId).catch(() => null);

    if (finalAction === "timeout") {
      if (!member) throw new Error("Membro nao esta no servidor.");
      await member.timeout((timeoutMinutes ?? 60) * 60_000, reason);
      applied = true;
    } else if (finalAction === "kick") {
      if (!member) throw new Error("Membro nao esta no servidor.");
      await member.kick(reason);
      applied = true;
    } else if (finalAction === "ban") {
      const deleteSeconds = Math.max(0, Math.trunc(num(config, "banDeleteDays", 1))) * 86_400;
      await guild.members.ban(targetId, { reason, deleteMessageSeconds: deleteSeconds });
      applied = true;
    } else {
      // Advertencia nao altera o membro: o registro e a propria punicao.
      applied = true;
    }
  } catch (err) {
    error = String(err).slice(0, 500);
    log.error("falha ao aplicar punicao", { guildId: guild.id, occurrenceId, action: finalAction, error });
  }

  await mutate<ModerationOccurrence>("moderation", (rows) => {
    const row = rows.find((entry) => entry.id === occurrenceId);
    if (row) {
      row.status = applied ? "applied" : "failed";
      row.appliedAction = applied ? finalAction : null;
      row.error = error;
      row.appliedAt = applied ? new Date().toISOString() : null;
    }
    return rows;
  });

  // DM ao membro — so quando a acao realmente pegou e o servidor permite.
  if (applied && bool(config, "dmOnPunish", true)) {
    try {
      const user = await guild.client.users.fetch(targetId);
      const extra = strikeNumber >= maxStrikes
        ? "\n⚠️ Voce atingiu o maximo de strikes e foi banido."
        : "";
      await user.send(
        `Voce foi **${LABEL[finalAction]}** em **${guild.name}**.\n` +
        `Motivo: ${reason}\n` +
        `Strike #${strikeNumber}/${maxStrikes}${extra}`
      );
    } catch {
      // DM fechada e o caso comum; nao e erro.
    }
  }

  await auditAndLog(
    guild,
    {
      module: "moderation",
      category: "moderation",
      eventType: `moderation_${finalAction}`,
      actorId: staffId,
      targetId,
      severity: finalAction === "ban" ? "critical" : "warning",
      title: `${LABEL[finalAction].toUpperCase()} · strike ${strikeNumber}/${maxStrikes}`,
      description: `<@${targetId}> recebeu **${finalAction}** de <@${staffId}>.`,
      accentColor: ACCENT[finalAction],
      fields: [
        { name: "Motivo", value: reason.slice(0, 1024) },
        { name: "Strike", value: `${strikeNumber}/${maxStrikes}` },
        { name: "Resultado", value: applied ? "aplicado" : `falhou — ${error ?? "erro desconhecido"}` },
        ...(finalAction !== action
          ? [{ name: "Escalado de", value: action }]
          : []),
        ...((evidence ?? []).length ? [{ name: "Evidencia", value: evidence!.join("\n").slice(0, 1024) }] : [])
      ],
      data: { occurrenceId, requested: action, applied: finalAction, strikes: strikeNumber }
    },
    log
  );

  return { occurrenceId, applied, strikes: strikeNumber, action: finalAction };
}

/** Perdoa uma ocorrencia — o strike sai da contagem ativa. */
export async function pardonOccurrence(
  guild: Guild,
  occurrenceId: number,
  staffId: string,
  log: Logger
): Promise<boolean> {
  const config = await moduleConfig(guild.id, "moderation");
  if (!bool(config, "pardonsEnabled", true)) return false;

  let found = false;

  await mutate<ModerationOccurrence>("moderation", (rows) => {
    const row = rows.find(
      (entry) =>
        entry.id === occurrenceId &&
        entry.guildId === guild.id &&
        (entry.status === "applied" || entry.status === "pending")
    );
    if (row) {
      row.status = "pardoned";
      found = true;
    }
    return rows;
  });

  if (found) {
    await auditAndLog(
      guild,
      {
        module: "moderation",
        category: "moderation",
        eventType: "moderation_pardon",
        actorId: staffId,
        severity: "info",
        title: "PUNICAO PERDOADA",
        description: `Ocorrencia **#${occurrenceId}** foi perdoada por <@${staffId}>.`,
        accentColor: "#3ecf8e",
        fields: [{ name: "Ocorrencia", value: `#${occurrenceId}` }]
      },
      log
    );
  }

  return found;
}
