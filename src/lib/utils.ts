import { twMerge } from "tailwind-merge";

const relativeTimeFormatter = new Intl.RelativeTimeFormat("pt-BR", {
  numeric: "always",
  style: "short",
});

export function cn(...inputs: Array<string | false | null | undefined>) {
  return twMerge(inputs.filter(Boolean).join(" "));
}

export function formatRelative(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return relativeTimeFormatter.format(-Math.floor(diff / 60_000), "minute");
  if (diff < 86_400_000) return relativeTimeFormatter.format(-Math.floor(diff / 3_600_000), "hour");
  if (diff < 7 * 86_400_000)
    return relativeTimeFormatter.format(-Math.floor(diff / 86_400_000), "day");
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function uid(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function hoursAgo(hours: number, from = Date.now()): number {
  return from - hours * 3_600_000;
}

export function minutesAgo(minutes: number, from = Date.now()): number {
  return from - minutes * 60_000;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "W";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}
