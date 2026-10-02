/**
 * Sessao de servidor — onde a decisao de acesso realmente acontece.
 *
 * Antes disto, o painel montava tudo no cliente: o `userId`, o plano e a lista
 * de servidores vinham do localStorage, entao editar o campo `id` para o do
 * dono bastava para entrar na area restrita.
 *
 * Agora:
 *   1. `startSession` troca o `code` do Discord e ASSINA a identidade. O
 *      `userId` dentro do token veio do Discord — o navegador nao escolhe.
 *   2. `resolveAccess` verifica a assinatura e recalcula os direitos a CADA
 *      chamada: presenca do bot e assinatura ativa sao relidas do servidor.
 *
 * Isso importa porque plano vence e bot sai de servidor. Se o direito fosse
 * gravado no token, um plano cancelado continuaria valendo ate o token expirar.
 */
import { createServerFn } from "@tanstack/react-start";
import { exchangeDiscordCodeDirect } from "@/lib/discord/oauth";
import { loadBotGuildIds } from "./bot-guilds";
import { resolveEntitlements, type Entitlements, type SubscriptionLite } from "./entitlements";
import { loadBilling } from "./shardpay";
import { sessionSecret, signSession, verifySession, type SessionGuild, type SessionPayload } from "./session-token";

export type SessionUserView = {
  id: string;
  username: string;
  globalName: string;
  avatar: string | null;
};

export type AccessResult =
  | { ok: true; session: SessionUserView; guilds: SessionGuild[]; entitlements: Entitlements }
  | { ok: false; error: string };

/** Entra com o `code` do Discord e devolve um token assinado. */
export const startSession = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true; token: string } | { ok: false; error: string }> => {
    const secret = sessionSecret();
    if (!secret) return { ok: false, error: "Segredo de sessão ausente no servidor." };

    const exchanged = await exchangeDiscordCodeDirect(data.code);
    if (!exchanged.ok) return { ok: false, error: exchanged.error };

    const payload: SessionPayload = {
      userId: exchanged.user.id,
      username: exchanged.user.username,
      globalName: exchanged.user.globalName,
      avatar: exchanged.user.avatar ?? null,
      guilds: exchanged.guilds.map((guild) => ({
        id: guild.id,
        name: guild.name,
        iconUrl: guild.iconUrl ?? null,
        owner: guild.owner,
      })),
    };

    return { ok: true, token: await signSession(payload, secret) };
  });

/**
 * Resolve o que esta pessoa pode ver AGORA.
 *
 * Nao confia em nada que o cliente mandou alem do token assinado. Sem token
 * valido devolve erro — nunca um acesso "vazio mas liberado".
 */
export const resolveAccess = createServerFn({ method: "POST" })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }): Promise<AccessResult> => {
    const secret = sessionSecret();
    if (!secret) return { ok: false, error: "Segredo de sessão ausente no servidor." };

    const payload = await verifySession(data.token, secret);
    if (!payload) return { ok: false, error: "Sessão inválida ou expirada. Entre de novo." };

    // Relido do servidor a cada chamada: bot que saiu e assinatura que venceu
    // deixam de valer sem depender de nada guardado no navegador.
    const [botGuildIds, billing] = await Promise.all([
      loadBotGuildIds().catch(() => [] as string[]),
      loadBilling().catch(() => null),
    ]);

    const subscriptions: SubscriptionLite[] = (billing?.subscriptions ?? []).map((sub) => ({
      status: sub.status,
      planId: sub.planId,
      discordUsername: sub.discordUsername,
    }));

    const entitlements = resolveEntitlements({
      discordUserId: payload.userId,
      discordUsername: payload.username,
      // Ser dono vem do Discord, dentro do token assinado.
      ownedGuildIds: payload.guilds.filter((guild) => guild.owner).map((guild) => guild.id),
      botGuildIds,
      subscriptions,
    });

    return {
      ok: true,
      session: {
        id: payload.userId,
        username: payload.username,
        globalName: payload.globalName,
        avatar: payload.avatar,
      },
      guilds: payload.guilds,
      entitlements,
    };
  });
