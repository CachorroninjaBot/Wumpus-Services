/**
 * Horário de atendimento.
 *
 * Dois modos: "warn" continua abrindo o ticket fora do horário e só avisa a
 * pessoa (e o painel mostra o horário no rodapé); "block" recusa a abertura
 * fora do horário com a mensagem configurada. O fuso é configurável porque o
 * bot roda em UTC no deploy.
 */
export type BusinessHours = {
  enabled: boolean;
  start: number;
  end: number;
  /** Dias do Discord/JS: 0 = domingo … 6 = sábado. */
  days: number[];
  mode: "warn" | "block";
  /** Deslocamento em horas somado ao UTC: -3 = Brasília. */
  utcOffset: number;
  closedMessage: string;
};

const DAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function readNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function businessHoursFrom(config: Record<string, unknown>): BusinessHours {
  const rawDays = Array.isArray(config.businessHoursDays)
    ? config.businessHoursDays
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];
  const closedMessage = typeof config.businessHoursClosedMessage === "string"
    ? config.businessHoursClosedMessage.trim().slice(0, 500)
    : "";
  return {
    enabled: config.businessHoursEnabled === true,
    start: readNumber(config.businessHoursStart, 9, 0, 23),
    end: readNumber(config.businessHoursEnd, 18, 0, 24),
    days: rawDays.length ? [...new Set(rawDays)].sort() : [1, 2, 3, 4, 5],
    mode: config.businessHoursMode === "block" ? "block" : "warn",
    utcOffset: readNumber(config.businessHoursUtcOffset, 0, -12, 14),
    closedMessage,
  };
}

export function isWithinBusinessHours(
  config: Record<string, unknown>,
  now: Date = new Date(),
): boolean {
  const hours = businessHoursFrom(config);
  if (!hours.enabled) return true;
  // O bot roda em UTC: desloca o instante para o fuso configurado antes de
  // decidir dia da semana e hora.
  const local = new Date(now.getTime() + hours.utcOffset * 3_600_000);
  if (!hours.days.includes(local.getUTCDay())) return false;

  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const start = hours.start * 60;
  const end = hours.end * 60;
  if (end === start) return true;
  if (end < start) return minutes >= start || minutes < end;
  return minutes >= start && minutes < end;
}

/** Fora do horário o painel deve recusar a abertura em vez de só avisar? */
export function businessHoursBlocks(config: Record<string, unknown>): boolean {
  return businessHoursFrom(config).mode === "block";
}

export function businessHoursLabel(config: Record<string, unknown>): string {
  const hours = businessHoursFrom(config);
  const days = hours.days.map((day) => DAY_LABELS[day]).join(", ");
  const end = hours.end === 24 ? "24h" : `${hours.end}h`;
  const offset = hours.utcOffset === 0 ? "UTC" : `UTC${hours.utcOffset > 0 ? "+" : ""}${hours.utcOffset}`;
  return `${days} das ${hours.start}h às ${end} (${offset})`;
}

export function businessHoursNotice(config: Record<string, unknown>): string {
  const hours = businessHoursFrom(config);
  const schedule = businessHoursLabel(config);
  return hours.closedMessage
    ? `${hours.closedMessage}\nHorário de atendimento: ${schedule}.`
    : `Fora do horário de atendimento (${schedule}). Seu ticket foi aberto e a equipe responde no próximo horário.`;
}

/** Resposta quando a abertura é recusada fora do horário. */
export function businessHoursClosedReply(config: Record<string, unknown>): string {
  const hours = businessHoursFrom(config);
  const schedule = businessHoursLabel(config);
  return hours.closedMessage
    ? `${hours.closedMessage}\nAtendemos ${schedule}. Volte nesse horário para abrir o atendimento.`
    : `O atendimento está fechado agora. Atendemos ${schedule}. Volte nesse horário para abrir o atendimento.`;
}
