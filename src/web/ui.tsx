import type { ReactNode } from "react";
import type { ExceptionMode, ModuleSummary } from "./api";
import { brand } from "../core/brand";

/* ------------------------------------------------------------------ *
 * Icones: conjunto proprio, stroke 1.7, grade 24.
 * ------------------------------------------------------------------ */

const icons: Record<string, string[]> = {
  home: ["M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"],
  server: ["M3 5h18v5H3z", "M3 14h18v5H3z", "M7 7.5h.01", "M7 16.5h.01"],
  chart: ["M4 19V5", "M4 19h16", "M8 19v-5", "M12 19V9", "M16 19v-8"],
  users: ["M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M2 20c0-3 2.7-5 6-5s6 2 6 5", "M16 15c3 0 6 2 6 5"],
  key: ["M15 4a5 5 0 1 1-4.6 6.9L5 16.3V20H2v-3l5.4-5.4A5 5 0 0 1 15 4z", "M16 8h.01"],
  bolt: ["M13 3 4 14h6l-1 7 9-11h-6z"],
  plug: ["M9 3v6", "M15 3v6", "M6 9h12v3a6 6 0 0 1-12 0z", "M12 18v3"],
  ban: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M5.6 5.6l12.8 12.8"],
  cpu: ["M6 6h12v12H6z", "M10 3v3", "M14 3v3", "M10 18v3", "M14 18v3", "M3 10h3", "M3 14h3", "M18 10h3", "M18 14h3"],
  shield: ["M12 3l7 3v6c0 4.4-2.9 7.5-7 9-4.1-1.5-7-4.6-7-9V6z", "M9 12l2 2 4-4"],
  bell: ["M6 9a6 6 0 1 1 12 0v5l2 3H4l2-3z", "M10 20a2 2 0 0 0 4 0"],
  ticket: ["M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z", "M12 9v6"],
  clipboard: ["M9 4h6v3H9z", "M6 6h12v14H6z", "M9 11h6", "M9 15h4"],
  book: ["M5 5h9a3 3 0 0 1 3 3v11H8a3 3 0 0 1-3-3z", "M17 19h2V8a3 3 0 0 0-3-3"],
  image: ["M4 5h16v14H4z", "M8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z", "M20 15l-5-5-6 6"],
  grid: ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"],
  layers: ["M12 3 3 8l9 5 9-5z", "M3 13l9 5 9-5"],
  plus: ["M12 5v14", "M5 12h14"],
  chevron: ["m9 6 6 6-6 6"],
  back: ["M15 6l-6 6 6 6"],
  check: ["M5 13l4 4L19 7"],
  close: ["M6 6l12 12", "M18 6 6 18"],
  sun: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2v2", "M12 20v2", "M4 12H2", "M22 12h-2", "M5 5l1.5 1.5", "M17.5 17.5 19 19", "M19 5l-1.5 1.5", "M6.5 17.5 5 19"],
  moon: ["M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"],
  logout: ["M15 12H4", "m8 8-4 4 4 4", "M12 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"],
  spark: ["M12 3v3.5", "M12 17.5V21", "M3 12h3.5", "M17.5 12H21", "M6 6l2.2 2.2", "M15.8 15.8 18 18", "M18 6l-2.2 2.2", "M8.2 15.8 6 18"],
  send: ["M4 12l16-8-6 16-3.5-6.5z"],
  alert: ["M12 4l9 16H3z", "M12 10v4", "M12 17h.01"],
  refresh: ["M20 12a8 8 0 1 1-2.3-5.6", "M20 4v5h-5"],
  discord: ["M8.5 9.5h.01", "M15.5 9.5h.01", "M7 6.5C9 5.5 15 5.5 17 6.5c1.5 3 2 6 1.5 9.5-1.5 1.5-4 2-4 2l-.8-1.4c-1.6.3-3.8.3-5.4 0L7.5 18s-2.5-.5-4-2C3 12.5 3.5 9.5 5 6.5"]
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths = icons[name] ?? icons.grid;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Marca
 * ------------------------------------------------------------------ */

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-label={brand.name}>
      <svg viewBox="0 0 32 32" width={size * 0.62} height={size * 0.62} aria-hidden="true">
        <path
          d="M5 8.5 10 24l4.4-9.6h3.2L22 24l5-15.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Avatar de servidor (icone do Discord ou inicial)
 * ------------------------------------------------------------------ */

export function GuildAvatar({
  name,
  iconUrl,
  size = 44,
  accent
}: {
  name: string;
  iconUrl?: string | null;
  size?: number;
  accent?: string;
}) {
  if (iconUrl) {
    return (
      <img
        className="guild-avatar"
        src={iconUrl}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        loading="lazy"
      />
    );
  }
  return (
    <span
      className="guild-avatar guild-avatar-fallback"
      style={{ width: size, height: size, background: accent ?? undefined, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Chip de estado do modulo
 * ------------------------------------------------------------------ */

export function StateChip({ module }: { module: ModuleSummary }) {
  const { label, tone } = describeState(module);
  return (
    <em className={`chip chip-${tone}`}>
      {module.exceptionMode === "inherit" && module.source === "group" ? <Icon name="layers" size={12} /> : null}
      {label}
    </em>
  );
}

export function describeState(module: ModuleSummary): { label: string; tone: ExceptionMode | "active" } {
  if (!module.enabled) return { label: "Pausado", tone: "disabled" };
  if (module.exceptionMode === "override") return { label: "Personalizado", tone: "override" };
  if (module.source === "group") return { label: "Pelo grupo", tone: "inherit" };
  if (module.source === "server") return { label: "Configurado", tone: "override" };
  return { label: "Padrão", tone: "active" };
}

/* ------------------------------------------------------------------ *
 * Utilidades de apresentacao
 * ------------------------------------------------------------------ */

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR");
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `há ${days} d`;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso));
}

export const eventLabels: Record<string, string> = {
  module_config_updated: "Configuração do servidor atualizada",
  server_exception_updated: "Exceção do servidor alterada",
  group_config_updated: "Configuração do grupo aplicada",
  group_assigned: "Servidor entrou em um grupo",
  group_removed: "Servidor saiu do grupo",
  incident_created: "Incidente detectado",
  ticket_created: "Atendimento aberto",
  ticket_closed: "Atendimento encerrado",
  feedback_received: "Feedback recebido"
};

export function eventLabel(eventType: string): string {
  return eventLabels[eventType] ?? "Atividade registrada";
}

/* ------------------------------------------------------------------ *
 * Blocos de UI reutilizaveis
 * ------------------------------------------------------------------ */

export function Panel({
  title,
  subtitle,
  action,
  children,
  className
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className ? `panel ${className}` : "panel"}>
      {title ? (
        <header className="panel-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({
  icon = "grid",
  title,
  description,
  action
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "ok" | "error" | "info"; children: ReactNode }) {
  return <p className={`notice notice-${tone}`}>{children}</p>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="loading">
      <span className="spinner" />
      {label ? <span>{label}</span> : null}
    </div>
  );
}
