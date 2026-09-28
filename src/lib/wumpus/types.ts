import type { ModuleKey, PresetId } from "./defaults";
import type { PlanId } from "./brand";

export type Role = {
  id: string;
  name: string;
  color: string;
  position: number;
  staff?: boolean;
};

export type Channel = {
  id: string;
  name: string;
  type: "text" | "category" | "voice";
  parentId: string | null;
};

export type Guild = {
  id: string;
  name: string;
  tag: string;
  memberCount: number;
  online: number;
  plan: PlanId;
  preset: PresetId;
  installed: boolean;
  region: string;
};

export type MemberStatus = "online" | "idle" | "dnd" | "offline";

export type Member = {
  id: string;
  guildId: string;
  username: string;
  displayName: string;
  hue: number;
  roleIds: string[];
  joinedAt: number;
  strikes: number;
  status: MemberStatus;
  accountCreatedAt: number;
  timedOutUntil: number | null;
  banned: boolean;
};

export type TicketStatus = "open" | "claimed" | "closed" | "archived";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export type TicketMessage = {
  id: string;
  authorId: string;
  content: string;
  at: number;
  kind: "user" | "staff" | "system";
};

export type Ticket = {
  id: string;
  guildId: string;
  number: number;
  openerId: string;
  claimedBy: string | null;
  department: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  tags: string[];
  channelName: string;
  createdAt: number;
  firstResponseAt: number | null;
  closedAt: number | null;
  messages: TicketMessage[];
  feedback: { rating: number; comment: string } | null;
  transcript: string | null;
};

export type FormQuestion = { id: string; label: string; required: boolean };

export type SubmissionStatus = "pending" | "approved" | "rejected";

export type FormSubmission = {
  id: string;
  guildId: string;
  userId: string;
  answers: Record<string, string>;
  status: SubmissionStatus;
  createdAt: number;
  reviewedAt: number | null;
  reviewerId: string | null;
  reason: string;
  aiNote: string | null;
};

export type ModAction = "warn" | "timeout" | "kick" | "ban" | "pardon";

export type ModCase = {
  id: string;
  guildId: string;
  targetId: string;
  actorId: string;
  action: ModAction;
  reason: string;
  evidence: string;
  createdAt: number;
  durationMinutes?: number;
};

export type AutomodHit = {
  id: string;
  guildId: string;
  userId: string;
  content: string;
  rule: string;
  action: string;
  at: number;
};

export type Incident = {
  id: string;
  guildId: string;
  kind: "raid" | "nuke" | "massban" | "lockdown";
  title: string;
  detail: string;
  status: "open" | "contained" | "closed";
  at: number;
};

export type Article = {
  id: string;
  guildId: string;
  title: string;
  body: string;
  tags: string[];
  approved: boolean;
  updatedAt: number;
};

export type AuditEvent = {
  id: string;
  guildId: string;
  at: number;
  actor: string;
  category: string;
  summary: string;
};

export type DashboardMember = {
  id: string;
  username: string;
  role: "owner" | "admin" | "viewer";
  addedAt: number;
};

export type License = {
  id: string;
  guildName: string;
  plan: PlanId;
  seats: number;
  expires: string;
  status: "active" | "past_due" | "canceled";
};

export type ModuleState = {
  enabled: boolean;
  config: Record<string, unknown>;
};

export type GuildModules = Record<ModuleKey, ModuleState>;

export type SessionUser = {
  id: string;
  username: string;
  globalName: string;
  isAdmin: boolean;
};

export type ChannelPost = {
  id: string;
  guildId: string;
  channelId: string;
  author: string;
  content: string;
  at: number;
};

export type PublishJob = {
  id: string;
  guildId: string;
  kind: "tickets" | "forms";
  status: "queued" | "published";
  detail: string;
  at: number;
};

export type RecentMessage = {
  guildId: string;
  userId: string;
  content: string;
  at: number;
};

export type AutomodVerdict = {
  ok: boolean;
  rule?: string;
  action?: string;
  detail?: string;
};
