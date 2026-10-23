export type StatisticField = "messages" | "joins" | "leaves" | "tickets";
export type StatisticDelta = { guildId: string; day: string; field: StatisticField; amount: number };

export function mergeStatisticDeltas<T extends {
  guildId: string;
  day: string;
  messages: number;
  joins: number;
  leaves: number;
  tickets: number;
}>(rows: T[], deltas: StatisticDelta[]): T[] {
  if (!deltas.length) return rows;
  const merged = new Map(rows.map((row) => [`${row.guildId}:${row.day}`, row]));
  for (const delta of deltas) {
    const key = `${delta.guildId}:${delta.day}`;
    const row = merged.get(key);
    if (row) {
      row[delta.field] += delta.amount;
    } else {
      merged.set(key, {
        guildId: delta.guildId,
        day: delta.day,
        messages: 0,
        joins: 0,
        leaves: 0,
        tickets: 0,
        [delta.field]: delta.amount,
      } as T);
    }
  }
  return [...merged.values()];
}
