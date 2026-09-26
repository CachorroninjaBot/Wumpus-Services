import { getPool } from "./index.js";

/**
 * Controle de quem pode entrar na dashboard.
 *
 * Regra: sem estar nesta lista, o usuario nao acessa NADA. Nao basta ter
 * "login com Discord" — o Discord autentica quem a pessoa diz ser, mas nao
 * decide quem tem direito de entrar. Essa decisao e do dono do produto.
 *
 * Duas travas, em momentos diferentes:
 *  1. No login (callback do OAuth): quem nao esta na lista nem recebe sessao.
 *  2. Em CADA requisicao (currentSession): se for removido depois, perde o
 *     acesso na hora. Sem isto, alguem removido continuaria entrando ate a
 *     sessao expirar — ate 14 dias.
 */

export type DashboardRole = "owner" | "admin" | "member";

export type DashboardMember = {
  userId: string;
  role: DashboardRole;
  note: string | null;
  addedBy: string | null;
  createdAt: string;
  lastSeenAt: string | null;
};

/**
 * Dono do produto, definido por variavel de ambiente.
 *
 * Isto resolve um problema real: se a lista comecasse vazia, ninguem poderia
 * entrar para autorizar o primeiro membro. O dono por ambiente e a semente —
 * e nunca pode ser removido pela interface, para nao trancar o produto fora.
 */
export function ownerIdFromEnv(): string | null {
  const value = process.env.WUMPUS_OWNER_ID?.trim();
  return value ? value : null;
}

export async function ensureOwnerSeeded(): Promise<void> {
  const ownerId = ownerIdFromEnv();
  if (!ownerId) return;

  await getPool().query(
    `insert into dashboard_members (user_id, role, note, added_by)
     values ($1, 'owner', 'Dono definido por WUMPUS_OWNER_ID', 'system')
     on conflict (user_id) do update set role = 'owner'`,
    [ownerId]
  );
}

export async function getMember(userId: string): Promise<DashboardMember | null> {
  const result = await getPool().query<{
    userId: string;
    role: DashboardRole;
    note: string | null;
    addedBy: string | null;
    createdAt: Date;
    lastSeenAt: Date | null;
  }>(
    `select user_id as "userId", role, note, added_by as "addedBy",
            created_at as "createdAt", last_seen_at as "lastSeenAt"
     from dashboard_members where user_id = $1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null
  };
}

/**
 * A pergunta que o produto inteiro depende: esta pessoa pode entrar?
 *
 * O dono por ambiente sempre pode, mesmo que alguem o remova da tabela por
 * engano. E a garantia de que o produto nunca fica sem administrador.
 */
export async function isAllowed(userId: string): Promise<boolean> {
  if (ownerIdFromEnv() === userId) return true;
  const member = await getMember(userId).catch(() => null);
  return member !== null;
}

export async function isAdmin(userId: string): Promise<boolean> {
  if (ownerIdFromEnv() === userId) return true;
  const member = await getMember(userId).catch(() => null);
  return member?.role === "owner" || member?.role === "admin";
}

export async function listMembers(): Promise<DashboardMember[]> {
  const result = await getPool().query<{
    userId: string;
    role: DashboardRole;
    note: string | null;
    addedBy: string | null;
    createdAt: Date;
    lastSeenAt: Date | null;
  }>(
    `select user_id as "userId", role, note, added_by as "addedBy",
            created_at as "createdAt", last_seen_at as "lastSeenAt"
     from dashboard_members order by role, created_at`
  );
  return result.rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null
  }));
}

export async function addMember(input: {
  userId: string;
  role: DashboardRole;
  note?: string | null;
  addedBy: string;
}): Promise<void> {
  await getPool().query(
    `insert into dashboard_members (user_id, role, note, added_by)
     values ($1, $2, $3, $4)
     on conflict (user_id) do update
       set role = excluded.role,
           note = excluded.note,
           added_by = excluded.added_by`,
    [input.userId, input.role, input.note ?? null, input.addedBy]
  );
}

/**
 * Remove o acesso. Sessoes do usuario sao apagadas junto: sem isto, ele
 * continuaria navegando com a sessao antiga ate ela expirar.
 */
export async function removeMember(userId: string): Promise<boolean> {
  if (ownerIdFromEnv() === userId) return false;

  const result = await getPool().query(`delete from dashboard_members where user_id = $1`, [userId]);
  if (result.rowCount === 0) return false;

  await getPool().query(`delete from sessions where user_id = $1`, [userId]);
  return true;
}

export async function touchMember(userId: string): Promise<void> {
  await getPool()
    .query(`update dashboard_members set last_seen_at = now() where user_id = $1`, [userId])
    .catch(() => undefined);
}
