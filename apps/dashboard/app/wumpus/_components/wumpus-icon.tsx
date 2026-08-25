import type { WumpusModule } from "@huborder/core";
import type { ReactNode, SVGProps } from "react";

export type WumpusIconName =
  | "activity" | "automation" | "back" | "book" | "bot" | "channels" | "check"
  | "chevron" | "close" | "forms" | "grid" | "group" | "help" | "home"
  | "integration" | "logs" | "members" | "moderation" | "ocr" | "roles"
  | "search" | "security" | "settings" | "sparkles" | "staff" | "statistics"
  | "tickets";

type Props = SVGProps<SVGSVGElement> & { name: WumpusIconName };

export function WumpusIcon({ name, ...props }: Props) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {paths[name]}
  </svg>;
}

const paths: Record<WumpusIconName, ReactNode> = {
  activity: <><path d="M3 12h4l2.2-6 4 12 2.1-6H21" /></>,
  automation: <><path d="M4 7h11" /><path d="m12 4 3 3-3 3" /><path d="M20 17H9" /><path d="m12 14-3 3 3 3" /></>,
  back: <><path d="m15 18-6-6 6-6" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z" /></>,
  bot: <><rect x="4" y="7" width="16" height="12" rx="3" /><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8" /></>,
  channels: <><path d="M6 3 4 21M15 3l-2 18M2 9h18M1 15h18" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  chevron: <><path d="m9 18 6-6-6-6" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  forms: <><path d="M6 3h12a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  group: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2M14.5 15a4 4 0 0 1 6 3.5V20" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-1 .6-1.4 1.1-1.4 2.4M12 17h.01" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  integration: <><path d="M8 12h8M12 8v8" /><path d="M7 3h3v4H7a5 5 0 0 0 0 10h3v4H7A9 9 0 0 1 7 3ZM17 3h-3v4h3a5 5 0 0 1 0 10h-3v4h3a9 9 0 0 0 0-18Z" /></>,
  logs: <><path d="M5 4h14M5 9h14M5 14h9M5 19h6" /></>,
  members: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 4.5a3 3 0 0 1 0 7M18 15a5 5 0 0 1 3 4.5" /></>,
  moderation: <><path d="M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
  ocr: <><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" /><circle cx="12" cy="12" r="3" /></>,
  roles: <><circle cx="8" cy="8" r="3" /><path d="M2.5 20v-2a5.5 5.5 0 0 1 11 0v2M16 9h5M18.5 6.5v5" /><path d="m16 17 2 2 4-5" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  security: <><path d="M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6z" /><path d="M9.5 12h5M12 9.5v5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  sparkles: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2zM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8zM19 13l.7 1.8 1.8.7-1.8.7L19 18l-.7-1.8-1.8-.7 1.8-.7z" /></>,
  staff: <><circle cx="8" cy="7" r="3" /><path d="M2 20v-2a6 6 0 0 1 10.5-4M18 12l1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2-1.5-1.5 2-.3z" /></>,
  statistics: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  tickets: <><path d="M4 5h16v5a2.5 2.5 0 0 0 0 5v4H4v-4a2.5 2.5 0 0 0 0-5z" /><path d="M12 7v2M12 12v1M12 16v1" /></>
};

export function moduleIcon(module: WumpusModule): WumpusIconName {
  const icons: Record<WumpusModule, WumpusIconName> = {
    servers: "bot", statistics: "statistics", moderation: "moderation", automod: "security",
    ocr: "ocr", staff: "staff", roles: "roles", security: "security", reports: "tickets",
    tickets: "tickets", forms: "forms", automations: "automation", integrations: "integration",
    knowledge: "book", logs: "logs"
  };
  return icons[module];
}
