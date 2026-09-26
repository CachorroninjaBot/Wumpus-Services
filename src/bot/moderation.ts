import { Routes, type Client } from "discord.js";
import { getPool, recordAuditEvent, resolveModuleConfig } from "../server/db/index.js";
import { applyTimeout } from "./security.js";
import { buildLogPayload } from "./panels.js";

type Logger = {
  info: (message: string, extra?: Record<string, unknown>) => void;
  error: (message: string, extra?: Record<string, unknown>) => void;
};

type ModerationConfig = {
  logChannelId?: string;
  staffRoleIds?: string[];
  defaultTimeoutMinutes?: number;
  escalateAfterStrikes?: number;
  banDeleteDays?: number;
  dmOnPunish?: boolean;
  requireEvidence?: boolean;
  appealChannelId?: string;
  autoUnmuteAfterTimeout?: boolean;
  strikeExpiryDays?: number;
  publicLogging?: boolean;
  pardonsEnabled?: boolean;
  maxStrikesBeforeBan?: number;
};

/**
 * Registra uma ocorrência de moderação e aplica a punição.
 * Chamado por staff via comando ou interface.
 */
export async function recordOccurrence(input: {
  client: Client;
  guildId: string;
  targetId: string;
  staffId: string;
  action: "warn" | "timeout" | "kick" | "ban";
  reason: string;
  evidence?: string[];
  log: Logger;
}): Promise<{ occurrenceId: number; applied: boolean; strikes: number }> {
  const { client, guildId, targetId, staffId, action, reason, evidence, log } = input;
  const config = await resolveModuleConfig(guildId, "moderation");
  if (!config.enabled) throw new Error("Módulo de moderação pausado.");
  const cfg = config.config as ModerationConfig;

  // Conta strikes ativos (não expirados)
  const expiryDays = cfg.strikeExpiryDays ?? 30;
  const strikesResult = await getPool().query<{ cnt: number }>(
    `select count(*)::integer as cnt from moderation_occurrences
     where guild_id = $1 and target_id = $2 and status in ('applied', 'processing')
       and created_at > now() - interval '${expiryDays} days'`,
    [guildId, targetId]
  );
  const currentStrikes = strikesResult.rows[0]?.cnt ?? 0;
  const newStrike = currentStrikes + 1;

  // Insere a ocorrência
  const result = await getPool().query<{ id: number }>(
    `insert into moderation_occurrences
       (guild_id, target_id, staff_id, requested_action, reason, evidence, strike_number, status)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7, 'pending')
     returning id`,
    [guildId, targetId, staffId, action, reason, JSON.stringify(evidence ?? []), newStrike]
  );
  const occurrenceId = result.rows[0].id;

  // Verifica escalação
  const escalateAfter = cfg.escalateAfterStrikes ?? 3;
  const maxStrikes = cfg.maxStrikesBeforeBan ?? 5;
  let finalAction = action;
  if (newStrike >= maxStrikes && action !== "ban") {
    finalAction = "ban";
  } else if (newStrike >= escalateAfter && action === "warn") {
    finalAction = "timeout";
  }

  // Aplica a punição
  let applied = false;
  try {
    if (finalAction === "timeout") {
      const minutes = cfg.defaultTimeoutMinutes ?? 60;
      applied = await applyTimeout(client, guildId, targetId, minutes);
      await getPool().query(
        `update moderation_occurrences set applied_action = 'timeout', timeout_minutes = $3, status = 'applied', applied_at = now() where id = $1 and guild_id = $2`,
        [occurrenceId, guildId, minutes]
      );
    } else if (finalAction === "kick") {
      await client.rest.delete(Routes.guildMember(guildId, targetId), { reason });
      applied = true;
      await getPool().query(
        `update moderation_occurrences set applied_action = 'kick', status = 'applied', applied_at = now() where id = $1 and guild_id = $2`,
        [occurrenceId, guildId]
      );
    } else if (finalAction === "ban") {
      await client.rest.put(Routes.guildBan(guildId, targetId), { reason });
      applied = true;
      await getPool().query(
        `update moderation_occurrences set applied_action = 'ban', status = 'applied', applied_at = now() where id = $1 and guild_id = $2`,
        [occurrenceId, guildId]
      );
    } else {
      // warn
      applied = true;
      await getPool().query(
        `update moderation_occurrences set applied_action = 'warn', status = 'applied', applied_at = now() where id = $1 and guild_id = $2`,
        [occurrenceId, guildId]
      );
    }
  } catch (err) {
    await getPool().query(
      `update moderation_occurrences set status = 'failed', error = $3 where id = $1 and guild_id = $2`,
      [occurrenceId, guildId, String(err).slice(0, 500)]
    );
    log.error("falha ao aplicar punição", { occurrenceId, action: finalAction, error: String(err) });
  }

  // DM para o membro
  if (cfg.dmOnPunish !== false && applied) {
    try {
      const dm = await client.users.createDM(targetId);
      const actionLabel = finalAction === "warn" ? "advertido" : finalAction === "timeout" ? "silenciado" : finalAction === "kick" ? "expulso" : "banido";
      await client.rest.post(Routes.channelMessages(dm.id), {
        body: {
          content: `Você foi **${actionLabel}** em um servidor.\nMotivo: ${reason}\nStrike #${newStrike}${newStrike >= maxStrikes ? "\n⚠️ Você atingiu o máximo de strikes e foi banido." : ""}`
        }
      });
    } catch { /* DM fechada */ }
  }

  // Log no canal configurado
  const logChannelId = typeof cfg.logChannelId === "string" ? cfg.logChannelId : "";
  if (logChannelId) {
    const actionEmoji = finalAction === "warn" ? "⚠️" : finalAction === "timeout" ? "🔇" : finalAction === "kick" ? "👢" : "🔨";
    await client.rest.post(Routes.channelMessages(logChannelId), {
      body: buildLogPayload({
        title: `${actionEmoji} Moderação · ${finalAction.toUpperCase()}`,
        description: `<@${targetId}> recebeu **${finalAction}** de <@${staffId}>.`,
        accentColor: finalAction === "ban" ? "#ff5c6c" : finalAction === "kick" ? "#f5a524" : "#7c5cff",
        fields: [
          { name: "Motivo", value: reason.slice(0, 1024), inline: false },
          { name: "Strike", value: `${newStrike}/${maxStrikes}`, inline: true },
          { name: "Ação aplicada", value: applied ? finalAction : "falhou", inline: true },
          ...(evidence?.length ? [{ name: "Evidência", value: evidence.join("\n").slice(0, 1024), inline: false }] : [])
        ]
      })
    }).catch(() => undefined);
  }

  await recordAuditEvent({
    guildId,
    module: "moderation",
    eventType: `moderation_${finalAction}`,
    actorId: staffId,
    targetId,
    severity: finalAction === "ban" ? "critical" : "warning",
    data: { occurrenceId, action: finalAction, strikes: newStrike, applied, reason }
  }).catch(() => undefined);

  log.info("ocorrência registrada", { guildId, occurrenceId, target: targetId, action: finalAction, strikes: newStrike, applied });

  return { occurrenceId, applied, strikes: newStrike };
}

/**
 * Perdoa (remove) uma advertência.
 */
export async function pardonOccurrence(guildId: string, occurrenceId: number, staffId: string, client: Client): Promise<boolean> {
  const config = await resolveModuleConfig(guildId, "moderation");
  if (!config.enabled || (config.config as ModerationConfig).pardonsEnabled === false) return false;

  const result = await getPool().query(
    `update moderation_occurrences set status = 'rejected', reviewed_by = $3, review_note = 'Perdoado', reviewed_at = now()
     where id = $1 and guild_id = $2 and status in ('applied', 'pending') returning id`,
    [occurrenceId, guildId, staffId]
  );
  return (result.rowCount ?? 0) > 0;
}