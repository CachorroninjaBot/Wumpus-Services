/**
 * Publicacao idempotente de paineis.
 *
 * Repetir `/ticket` (ou publicar pelo dashboard) nao pode encher o canal de
 * copias: o bot guarda a mensagem que publicou e edita a mesma. A chave separa
 * os varios paineis de atendimento; painel unico antigo continua na chave
 * `tickets`, entao a mensagem ja publicada e reaproveitada.
 */
import type { Guild } from "discord.js";
import type { Sendable } from "./resolve.ts";
import type { Logger } from "./logger.ts";
import { readBotCollection, updateBotCollection } from "../lib/wumpus/runtime.server.ts";

export type PublishedPanel = {
  guildId: string;
  kind: "tickets" | "forms";
  /** Identidade do painel dentro do tipo (ex.: `tickets:loja`). Ausente = painel unico antigo. */
  key?: string;
  channelId: string;
  messageId: string;
  updatedAt: number;
};

export function panelMessageKey(kind: PublishedPanel["kind"], panelId?: string): string {
  // O painel legado usa a chave antiga para "adotar" a mensagem ja publicada.
  return panelId && panelId !== "default" ? `${kind}:${panelId}` : kind;
}

function rowKey(row: PublishedPanel): string {
  return row.key ?? row.kind;
}

export async function publishPanelIdempotent(
  guild: Guild,
  kind: PublishedPanel["kind"],
  panel: { flags?: unknown; components?: unknown },
  target: Sendable,
  log: Logger,
  key: string = kind,
): Promise<"publicado" | "atualizado"> {
  const rows = await readBotCollection<PublishedPanel>("panel-messages");
  const existing = rows.find((row) => row.guildId === guild.id && rowKey(row) === key);

  if (existing && existing.channelId === target.id && target.messages) {
    try {
      const message = await target.messages.fetch(existing.messageId);
      await message.edit({ flags: panel.flags, components: panel.components } as Record<string, unknown>);
      return "atualizado";
    } catch {
      log.warn("painel anterior não encontrado; publicando um novo", {
        guildId: guild.id,
        kind,
        key,
        messageId: existing.messageId,
      });
    }
  }

  const message = await target.send({ flags: panel.flags, components: panel.components } as Record<string, unknown>);
  await updateBotCollection<PublishedPanel>("panel-messages", (current) => [
    ...current.filter((row) => !(row.guildId === guild.id && rowKey(row) === key)),
    {
      guildId: guild.id,
      kind,
      key,
      channelId: message.channelId ?? target.id,
      messageId: message.id,
      updatedAt: Date.now(),
    },
  ]);
  return "publicado";
}
