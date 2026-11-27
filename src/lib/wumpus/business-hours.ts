/**
 * Horário de atendimento.
 *
 * Quando ligado, o bot continua abrindo o ticket fora do horário — só avisa a
 * pessoa (e o painel mostra o horário no rodapé) para ela não achar que foi
 * ignorada. O fuso é o do servidor do bot (UTC no deploy).
 */
export type BusinessHours = {
  enabled: boolean;
  start: number;
  end: number;
  /** Dias do Discord/JS: 0 = domingo … 6 = sábado. */
  days: number[];
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
  return {
    enabled: config.businessHoursEnabled === true,
    start: readNumber(config.businessHoursStart, 9, 0, 23),
    end: readNumber(config.businessHoursEnd, 18, 0, 24),
    days: rawDays.length ? [...new Set(rawDays)].sort() : [1, 2, 3, 4, 5],
  };
}

export function isWithinBusinessHours(
  config: Record<string, unknown>,
  now: Date = new Date(),
): boolean {
  const hours = businessHoursFrom(config);
  if (!hours.enabled) return true;
  if (!hours.days.includes(now.getUTCDay())) return false;

  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const start = hours.start * 60;
  const end = hours.end * 60;
  if (end === start) return true;
  if (end < start) return minutes >= start || minutes < end;
  return minutes >= start && minutes < end;
}

export function businessHoursLabel(config: Record<string, unknown>): string {
  const hours = businessHoursFrom(config);
  const days = hours.days.map((day) => DAY_LABELS[day]).join(", ");
  const end = hours.end === 24 ? "24h" : `${hours.end}h`;
  return `${days} das ${hours.start}h às ${end}`;
}

export function businessHoursNotice(config: Record<string, unknown>): string {
  return `Fora do horário de atendimento (${businessHoursLabel(config)}). Seu ticket foi aberto e a equipe responde no próximo horário.`;
}
