import type { LogField } from "./panels.ts";

export type LogEventInput = {
  title: string;
  description: string;
  actorId?: string;
  targetId?: string;
  channelId?: string;
  at?: number;
  changes?: string;
  mention?: string;
};

/** Build plain semantic content for a V2 log; output text is capped below Discord's total. */
export function renderLogEvent(event: LogEventInput): { title: string; description: string; fields: LogField[]; mention?: string } {
  const fields: LogField[] = [];
  if (event.actorId) fields.push({ name: "Autor", value: `<@${event.actorId}>` });
  if (event.targetId) fields.push({ name: "Alvo", value: `<@${event.targetId}>` });
  if (event.channelId) fields.push({ name: "Canal", value: `<#${event.channelId}>` });
  if (event.at) fields.push({ name: "Horário", value: `<t:${Math.floor(event.at / 1000)}:F>` });
  if (event.changes?.trim()) fields.push({ name: "Alterações", value: event.changes.slice(0, 900) });
  return {
    title: event.title.slice(0, 250),
    description: event.description.slice(0, 1800),
    fields,
    ...(event.mention ? { mention: event.mention } : {}),
  };
}
