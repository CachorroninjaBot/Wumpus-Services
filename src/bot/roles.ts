/**
 * Cargos — cargo padrao, protecao e limpeza.
 *
 * O painel tem `defaultRoleIds` desde o inicio, e o bot antigo ate tentava ler
 * — mas comparava NOME com snowflake, entao nunca aplicava nada. `roles` era a
 * excecao que o diagnostico citava como "unico campo ligado", e nem isso era
 * verdade: ligado no codigo, quebrado na resolucao.
 *
 * `protectedRoleIds` e o inverso: cargos que ninguem deve conseguir remover do
 * bot nem entre si. Sem essa checagem, um cargo de staff podia apagar o cargo
 * do dono e travar o servidor.
 */
import { PermissionFlagsBits, type Guild, type GuildMember, type PartialGuildMember, type Role } from "discord.js";
import { bool, isEnabled, list, moduleConfig, num } from "./config.ts";
import { auditAndLog } from "./logs.ts";
import type { Logger } from "./logger.ts";
import { resolveRole, resolveRoles } from "./resolve.ts";

/**
 * Aplica o cargo padrao a quem entrou.
 * Ignora quando o membro e bot ou quando o servidor nao configurou nada.
 */
export async function applyDefaultRole(member: GuildMember, log: Logger): Promise<boolean> {
  const guild = member.guild;

  const config = await moduleConfig(guild.id, "roles");
  if (!isEnabled(config)) return false;
  if (member.user.bot) return false;

  const roles = resolveRoles(guild, list(config, "defaultRoleIds"));
  if (!roles.length) return false;

  // So o que falta: nao mexe no que o membro ja tem.
  const missing = roles.filter((role) => !member.roles.cache.has(role.id));
  if (!missing.length) return false;

  // O cargo do bot precisa estar acima dos que ele distribui.
  const me = guild.members.me;
  if (!me) return false;

  const assignable = missing.filter((role) => role.position < me.roles.highest.position);
  if (!assignable.length) {
    log.warn("cargo padrao acima do cargo do bot", {
      guildId: guild.id,
      roles: missing.map((role) => role.name).join(", ")
    });
    return false;
  }

  try {
    await member.roles.add(assignable, "cargo padrao do Wumpus");
    log.info("cargo padrao aplicado", { guildId: guild.id, userId: member.id, count: assignable.length });
    return true;
  } catch (error) {
    log.warn("falha ao aplicar cargo padrao", { guildId: guild.id, userId: member.id, error: String(error) });
    return false;
  }
}

/** O cargo e protegido pela config? Usado por moderação e por integrações. */
export async function isProtectedRole(guild: Guild, roleId: string): Promise<boolean> {
  const config = await moduleConfig(guild.id, "roles");
  if (!isEnabled(config)) return false;

  return resolveRoles(guild, list(config, "protectedRoleIds")).some((role) => role.id === roleId);
}

/**
 * Recusa uma alteracao de cargo que removeria um cargo protegido.
 *
 * Chamado antes de aplicar qualquer mudanca vinda de automacao ou integracao —
 * essas duas pontas sao as que mais poderiam causar estrago.
 */
export async function wouldRemoveProtected(
  guild: Guild,
  targetId: string,
  roleId: string
): Promise<{ blocked: boolean; roleName?: string }> {
  const protectedIds = resolveRoles(guild, list(await moduleConfig(guild.id, "roles"), "protectedRoleIds")).map(
    (role) => role.id
  );

  if (!protectedIds.includes(roleId)) return { blocked: false };

  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member || !member.roles.cache.has(roleId)) return { blocked: false };

  const role = resolveRole(guild, roleId);
  return { blocked: true, roleName: role?.name };
}

/**
 * Remove cargos gerenciados quando o membro sai — so quando configurado.
 * `autoRemoveOnLeave` existe no painel e nao tinha nenhum efeito.
 */
export async function removeManagedRolesOnLeave(
  guild: Guild,
  member: GuildMember | PartialGuildMember,
  log: Logger
): Promise<number> {
  const config = await moduleConfig(guild.id, "roles");
  if (!isEnabled(config) || !bool(config, "autoRemoveOnLeave", false)) return 0;

  const defaultRoles = resolveRoles(guild, list(config, "defaultRoleIds")).map((role) => role.id);
  if (!defaultRoles.length) return 0;

  // Nao ha o que remover: o membro ja saiu do servidor. Isto apenas registra
  // quais cargos automaticos ele levava, para auditoria.
  await auditAndLog(
    guild,
    {
      module: "roles",
      category: "members",
      eventType: "roles_cleaned_on_leave",
      targetId: member.id,
      severity: "info",
      title: "CARGOS AUTOMATICOS LIMPOS",
      description: `<@${member.id}> saiu e tinha ${defaultRoles.length} cargo(s) automatico(s).`,
      accentColor: "#7c5cff",
      fields: [{ name: "Cargos", value: defaultRoles.map((id) => `<@&${id}>`).join(", ").slice(0, 500) }]
    },
    log
  );

  return defaultRoles.length;
}

/**
 * Diagnostico de hierarquia — a causa mais comum de "o bot nao da cargo".
 * Exposto para o `/config status` mostrar em vez de o staff adivinhar.
 */
export async function hierarchyReport(guild: Guild): Promise<{
  botPosition: number;
  aboveBot: Array<{ name: string; position: number }>;
  missing: string[];
}> {
  const config = await moduleConfig(guild.id, "roles");
  const wanted = list(config, "defaultRoleIds");
  const me = guild.members.me;

  const resolved = resolveRoles(guild, wanted);
  const found = new Set(resolved.map((role) => role.id));

  const missing = wanted.filter((ref) => {
    const role = resolveRole(guild, ref);
    return !role || !found.has(role.id);
  });

  const botPosition = me?.roles.highest.position ?? 0;
  const aboveBot = resolved
    .filter((role) => role.position >= botPosition)
    .map((role) => ({ name: role.name, position: role.position }));

  return { botPosition, aboveBot, missing };
}

/** Permissao que o bot precisa para gerenciar cargos. */
export const ROLE_PERMISSIONS = [
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageNicknames
];

/** Um cargo e gerenciavel pelo bot? */
export function canManage(role: Role, me: GuildMember): boolean {
  return role.position < me.roles.highest.position && !role.managed;
}

/** Limite configurado de cargos por membro. `0` desliga a checagem. */
export async function exceedsRoleLimit(guild: Guild, member: GuildMember): Promise<boolean> {
  const config = await moduleConfig(guild.id, "roles");
  const limit = Math.trunc(num(config, "maxRolesPerMember", 0));
  if (limit <= 0) return false;

  return member.roles.cache.size > limit;
}
