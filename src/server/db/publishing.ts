import { getPool } from "./index.js";

/**
 * Fila de publicacao de paineis.
 *
 * O dashboard NUNCA fala direto com o Discord: ele enfileira um payload e o
 * bot consome. Assim a dashboard responde na hora, o bot pode estar reiniciando
 * e o envio tem retentativa com erro registrado.
 */

export type PanelFormat = "components_v2" | "embed";

export type PublicationRow = {
  id: number;
  guildId: string;
  channelId: string;
  module: string;
  format: PanelFormat;
  payload: Record<string, unknown>;
  createdBy: string;
};

export async function queuePublication(input: {
  guildId: string;
  channelId: string;
  module: string;
  format: PanelFormat;
  payload: Record<string, unknown>;
  createdBy: string;
}): Promise<{ id: number }> {
  const result = await getPool().query<{ id: number }>(
    `insert into publications (guild_id, channel_id, module, format, payload, created_by)
     values ($1, $2, $3, $4, $5::jsonb, $6)
     returning id`,
    [input.guildId, input.channelId, input.module, input.format, JSON.stringify(input.payload), input.createdBy]
  );
  return result.rows[0];
}

export async function listRecentPublications(guildId: string, limit = 10) {
  const result = await getPool().query(
    `select id, channel_id as "channelId", module, format, status, message_id as "messageId",
            error, created_at as "createdAt", processed_at as "processedAt"
     from publications where guild_id = $1 order by created_at desc limit $2`,
    [guildId, limit]
  );
  return result.rows;
}

/**
 * Consome a fila dentro de uma transacao com FOR UPDATE SKIP LOCKED.
 *
 * A transacao fica aberta durante o envio de proposito: e o que garante que
 * dois workers (ou um restart no meio) nunca enviem o mesmo painel duas vezes.
 */
export async function processPendingPublications(
  handler: (row: PublicationRow) => Promise<string>,
  limit = 5
): Promise<number> {
  const client = await getPool().connect();
  let processed = 0;

  try {
    await client.query("begin");
    const pending = await client.query<PublicationRow>(
      `select id, guild_id as "guildId", channel_id as "channelId", module, format, payload, created_by as "createdBy"
       from publications
       where status = 'pending'
       order by created_at
       limit $1
       for update skip locked`,
      [limit]
    );

    for (const row of pending.rows) {
      try {
        const messageId = await handler(row);
        await client.query(
          `update publications set status = 'published', message_id = $2, error = null, processed_at = now() where id = $1`,
          [row.id, messageId]
        );
        processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await client.query(
          `update publications set status = 'failed', error = $2, processed_at = now() where id = $1`,
          [row.id, message.slice(0, 500)]
        );
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return processed;
}

/* ------------------------------------------------------------------ *
 * Canais e cargos sincronizados pelo bot
 * ------------------------------------------------------------------ */

export type GuildChannel = { id: string; name: string; type: number; parentId: string | null; position: number };
export type GuildRole = { id: string; name: string; color: number; position: number; managed: boolean };

export async function saveGuildSnapshot(input: {
  guildId: string;
  channels: GuildChannel[];
  roles: GuildRole[];
}): Promise<void> {
  await getPool().query(
    `insert into guild_snapshots (guild_id, channels, roles, updated_at)
     values ($1, $2::jsonb, $3::jsonb, now())
     on conflict (guild_id) do update
       set channels = excluded.channels,
           roles = excluded.roles,
           updated_at = now()`,
    [input.guildId, JSON.stringify(input.channels), JSON.stringify(input.roles)]
  );
}

export async function listGuildAssets(
  guildId: string
): Promise<{ channels: GuildChannel[]; roles: GuildRole[]; syncedAt: string | null }> {
  const result = await getPool().query<{ channels: GuildChannel[]; roles: GuildRole[]; updatedAt: Date }>(
    `select channels, roles, updated_at as "updatedAt" from guild_snapshots where guild_id = $1`,
    [guildId]
  );
  const row = result.rows[0];
  if (!row) return { channels: [], roles: [], syncedAt: null };
  return { channels: row.channels ?? [], roles: row.roles ?? [], syncedAt: row.updatedAt.toISOString() };
}

export async function deactivateGuild(guildId: string): Promise<void> {
  await getPool().query(`update guilds set is_active = false where guild_id = $1`, [guildId]);
}
