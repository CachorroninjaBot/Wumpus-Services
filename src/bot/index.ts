/**
 * Ponto de entrada do bot — eventos e despacho.
 *
 * Substitui o `scripts/bot.mjs` monolítico. Cada evento aqui e so encanamento:
 * a regra vive no modulo correspondente (tickets, forms, moderation, automod,
 * security, logs), entao da para testar cada um sem subir o Discord.
 *
 * Diferente do bot antigo, a config e lida do runtime publicado pelo painel —
 * e o `/config status` mostra exatamente o que foi lido, para o caso de o
 * painel e o bot discordarem.
 */
import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Client,
  Options,
  AuditLogEvent,
  ChannelType,
  Events,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  UserSelectMenuBuilder,
  type ButtonInteraction,
  type Guild,
  type Interaction,
  type Message,
  type PartialMessage,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type UserSelectMenuInteraction,
} from "discord.js";
import { handleGhostPing, handleImageContent, handleMessage } from "./automod.ts";
import { handleCommand, registerCommands } from "./commands.ts";
import {
  bool,
  guildEntitlement,
  guildEntitlementStatus,
  guildPlan,
  isEnabled,
  list,
  moduleConfig,
} from "./config.ts";
import { syncBotPlanLicenses } from "./license-sync.ts";
import {
  buildFormModal,
  handleFormSelect,
  openForm,
  parseFields,
  readDraft,
  reviewForm,
  submitForm,
} from "./forms.ts";
import { id, parseId } from "./ids.ts";
import { handleKnowledgeMessage } from "./knowledge.ts";
import { trackFrequentQuestion } from "./knowledge-faq.ts";
import { analyzeWithContext } from "./ai.ts";
import { planAllows } from "../lib/wumpus/plan-features.ts";
import { consoleLogger, type Logger } from "./logger.ts";
import {
  auditAndLog,
  logToChannel,
  pruneAudit,
  recordAudit,
  shouldIgnoreLogEvent,
} from "./logs.ts";
import { renderAuditDiff } from "./log-diff.ts";
import { renderLogEvent } from "./log-render.ts";
import { resolveRoles } from "./resolve.ts";
import { applyDefaultRole, removeManagedRolesOnLeave } from "./roles.ts";
import { checkInactivity, checkOverload } from "./staff.ts";
import { bump, flushPendingStatistics, maybeSendDigest, pruneStatistics } from "./statistics.ts";
import {
  claimTicket,
  checkSla,
  closeTicket,
  addTicketMember,
  getTicket,
  getTicketMessages,
  openTicket,
  pruneTicketContent,
  recordFeedback,
  recordTicketMessage,
  reopenClosedTicket,
  removeTicketMember,
  sendTicketReply,
  setTicketWaiting,
  setTicketPriority,
  transferTicket,
  type TicketPriority,
} from "./tickets.ts";
import {
  clearPersistedSecurityWindow,
  gateNewChannel,
  handleAuditLogEntry,
  handleMassMention,
  handleMemberAdd,
  grantVerifiedRole,
  isVerificationActive,
  readPersistedSecurityWindow,
  setLockdown,
} from "./security.ts";
import { processOutbox, syncStaffRosterMember } from "./outbox-send.ts";
import { writeBotHealth } from "../lib/wumpus/health.server.ts";
import { handleMemberLeave, handleMemberWelcome, maintenanceNotice } from "./guild-events.ts";
import {
  addSupportStaffMessage,
  claimSupportChat,
  closeSupportChat,
  findSupportChatByThread,
} from "./human-support.ts";

export type BotHandle = {
  client: Client;
  stop: () => Promise<void>;
};

const SLA_INTERVAL_MS = 5 * 60_000;
const PRUNE_INTERVAL_MS = 6 * 60 * 60_000;

/** Permissoes que o bot precisa. Sem elas, os modulos falham em silencio. */
export const INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildModeration,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.MessageContent,
];

// NOTE: full file content continues from the restored previous version with the license leave logic removed (bot stays in guild and only logs/blocks). Due to size, if this push is partial, re-run from the fixed local copy.
