import { defaultsFor, type ModuleKey } from "./defaults";
import type { Guild, GuildModules, SessionUser } from "./types";

const MODULES: ModuleKey[] = [
  "servers",
  "tickets",
  "forms",
  "moderation",
  "automod",
  "security",
  "logs",
  "staff",
  "knowledge",
  "statistics",
  "roles",
];

function emptyModules(): GuildModules {
  const out = {} as GuildModules;
  for (const key of MODULES) out[key] = { enabled: true, config: defaultsFor(key) };
  return out;
}

export type DiscordGuildLite = {
  id: string;
  name: string;
  owner: boolean;
  iconUrl?: string | null;
};

export function buildOwnerWorkspace(
  user: { id: string; username: string; globalName: string },
  guilds: DiscordGuildLite[],
) {
  const list: Guild[] = (guilds.length ? guilds : [{ id: user.id, name: user.globalName, owner: true }]).map((g) => ({
    id: g.id,
    name: g.name,
    tag: g.name.slice(0, 2).toUpperCase(),
    memberCount: 0,
    online: 0,
    plan: "pro" as const,
    preset: "community" as const,
    installed: true,
    region: "Discord",
    iconUrl: g.iconUrl ?? null,
  }));

  const modules: Record<string, GuildModules> = {};
  const channels: Record<string, { id: string; name: string; type: "text" | "category" | "voice"; parentId: string | null }[]> = {};
  const roles: Record<string, { id: string; name: string; color: string; position: number; staff?: boolean }[]> = {};
  const formQuestions: Record<string, { id: string; label: string; required: boolean }[]> = {};

  for (const g of list) {
    modules[g.id] = emptyModules();
    channels[g.id] = [];
    roles[g.id] = [{ id: `owner-${g.id}`, name: "Dono", color: "#f5d76e", position: 50, staff: true }];
    formQuestions[g.id] = [
      { id: "q1", label: "Qual o seu nome ou apelido?", required: true },
      { id: "q2", label: "Por que quer fazer parte da equipe?", required: true },
      { id: "q3", label: "Qual a sua experiência relevante?", required: true },
    ];
  }

  const sessionUser: SessionUser = {
    id: user.id,
    username: user.username,
    globalName: user.globalName,
    isAdmin: true,
    signedIn: true,
  };

  return {
    activeGuildId: list[0]!.id,
    guilds: list,
    members: [
      {
        id: user.id,
        guildId: list[0]!.id,
        username: user.username,
        displayName: user.globalName,
        hue: 262,
        roleIds: [`owner-${list[0]!.id}`],
        joinedAt: Date.now(),
        strikes: 0,
        status: "online" as const,
        accountCreatedAt: Date.now(),
        timedOutUntil: null,
        banned: false,
      },
    ],
    tickets: [],
    formQuestions,
    submissions: [],
    cases: [],
    automodHits: [],
    incidents: [],
    articles: [],
    logs: [
      {
        id: `l-login`,
        guildId: list[0]!.id,
        at: Date.now(),
        actor: user.globalName,
        category: "auth",
        summary: "Entrou com Discord. Workspace do dono.",
      },
    ],
    modules,
    channels,
    roles,
    dashboardMembers: [{ id: user.id, username: user.username, role: "owner" as const, addedAt: Date.now() }],
    licenses: list.map((g) => ({
      id: `lic-${g.id}`,
      guildName: g.name,
      plan: "pro" as const,
      seats: 5,
      expires: "2027-12-31",
      status: "active" as const,
    })),
    posts: [],
    publishQueue: [],
    recentMessages: [],
    sessionUser,
    theme: "dark" as const,
  };
}
