import crypto from "node:crypto";
import { getPool } from "./index.js";

export type SessionUser = {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
};

export type SessionRecord = {
  sessionId: string;
  userId: string;
  expiresAt: Date;
  user: SessionUser;
  guilds: Array<{ id: string; name: string; iconUrl: string | null; owner: boolean }>;
};

const SESSION_DAYS = 14;

export async function upsertUser(input: {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  avatarUrl: string | null;
  locale?: string;
}): Promise<void> {
  await getPool().query(
    `insert into users (id, username, global_name, avatar, locale)
     values ($1, $2, $3, $4, $5)
     on conflict (id) do update
       set username = excluded.username,
           global_name = excluded.global_name,
           avatar = excluded.avatar,
           locale = excluded.locale,
           updated_at = now()`,
    [input.id, input.username, input.globalName, input.avatar, input.locale ?? null]
  );
}

export async function createSession(input: {
  userId: string;
  guilds: SessionRecord["guilds"];
  userAgent?: string | null;
}): Promise<{ sessionId: string; expiresAt: Date }> {
  const sessionId = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getPool().query(
    `insert into sessions (id, user_id, guilds, user_agent, expires_at)
     values ($1, $2, $3::jsonb, $4, $5)`,
    [sessionId, input.userId, JSON.stringify(input.guilds), input.userAgent ?? null, expiresAt]
  );
  return { sessionId, expiresAt };
}

export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  const result = await getPool().query<{
    sessionId: string;
    userId: string;
    expiresAt: Date;
    guilds: SessionRecord["guilds"];
    username: string;
    globalName: string | null;
    avatar: string | null;
  }>(
    `select s.id as "sessionId", s.user_id as "userId", s.expires_at as "expiresAt", s.guilds,
            u.username, u.global_name as "globalName", u.avatar
     from sessions s
     join users u on u.id = s.user_id
     where s.id = $1 and s.expires_at > now()`,
    [sessionId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    sessionId: row.sessionId,
    userId: row.userId,
    expiresAt: row.expiresAt,
    user: {
      id: row.userId,
      username: row.username,
      globalName: row.globalName,
      avatarUrl: row.avatar ? `https://cdn.discordapp.com/avatars/${row.userId}/${row.avatar}.png?size=128` : null
    },
    guilds: row.guilds ?? []
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await getPool().query(`delete from sessions where id = $1`, [sessionId]);
}

export async function purgeExpiredSessions(): Promise<void> {
  await getPool().query(`delete from sessions where expires_at <= now()`);
}
