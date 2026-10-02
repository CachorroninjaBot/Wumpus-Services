import { create } from "zustand";
import { uid } from "@/lib/utils";
import { channelNameFor, effectiveStrikes, evaluateNuke, evaluateRaid, nextModerationAction, planAllows, renderTemplate, scanBurst, scanMessage, shouldAutoClose } from "./engine";
import { defaultsFor, presets, type ModuleKey, type PresetId } from "./defaults";
import { mergeModuleDefaults } from "./merge-modules";
import { publishGuildRuntime, requestPanelPublish } from "./runtime-store";
import { isPlatformOwner } from "./owner";
import type { PlanId } from "./catalog";
import { normalizePlan } from "./catalog";
import { cloneSeed, DEMO_GUILD } from "./seed";
import type {
  Article,
  AuditEvent,
  AutomodHit,
  Channel,
  ChannelPost,
  DashboardMember,
  FormQuestion,
  FormSubmission,
  Guild,
  GuildModules,
  Incident,
  License,
  Member,
  ModAction,
  ModCase,
  PublishJob,
  RecentMessage,
  Role,
  SessionUser,
  SubmissionStatus,
  Ticket,
  TicketPriority,
  TicketStatus,
} from "./types";

/**
 * Campo configurável do formulário.
 *
 * Este e o formato que o BOT le (`config.fields`). A dashboard precisa gravar
 * exatamente isto: antes gravava `config.questions`, e como `fields` passou a
 * existir no padrao, o bot ignorava o editor inteiro — a tela virava decoracao,
 * que e justamente o defeito que o painel tinha.
 */
export type FormFieldConfig = {
  id: string;
  label: string;
  type: "short" | "paragraph" | "select";
  required: boolean;
  options: string[];
  maxLength: number;
};

const KEY = "wumpus-demo-v2";

type PersistSlice = {
  activeGuildId: string;
  guilds: Guild[];
  members: Member[];
  tickets: Ticket[];
  formQuestions: Record<string, FormQuestion[]>;
  submissions: FormSubmission[];
  cases: ModCase[];
  automodHits: AutomodHit[];
  incidents: Incident[];
  articles: Article[];
  logs: AuditEvent[];
  modules: Record<string, GuildModules>;
  channels: Record<string, Channel[]>;
  roles: Record<string, Role[]>;
  dashboardMembers: DashboardMember[];
  licenses: License[];
  posts: ChannelPost[];
  publishQueue: PublishJob[];
  recentMessages: RecentMessage[];
  sessionUser: SessionUser;
  theme: "dark" | "light";
};

type Actions = {
  hydrated: boolean;
  hydrate: () => void;
  resetDemo: () => void;
  setTheme: (theme: "dark" | "light") => void;
  setActiveGuild: (id: string) => void;
  setAdmin: (on: boolean) => void;
  updateConfig: (module: ModuleKey, patch: Record<string, unknown>) => void;
  setModuleEnabled: (module: ModuleKey, enabled: boolean) => void;
  applyPreset: (preset: PresetId) => void;
  openTicket: (input: { openerId: string; department: string; subject: string; body: string }) => { ok: true; id: string } | { ok: false; error: string };
  claimTicket: (id: string, staffId: string) => { ok: true } | { ok: false; error: string };
  sweepInactive: () => { closed: number; error?: string };
  publishPanel: (kind: "tickets" | "forms") => void;
  processQueue: () => number;
  simulateJoin: (input: { username: string; accountAgeHours: number }) => string;
  simulateRaid: (joins: number) => string;
  simulateNuke: (actions: number) => string;
  setPlan: (plan: PlanId) => void;
  addTicketMessage: (id: string, authorId: string, content: string, kind: "user" | "staff" | "system") => void;
  closeTicket: (id: string, staffId: string, withFeedback?: { rating: number; comment: string }) => void;
  archiveTicket: (id: string) => void;
  reopenTicket: (id: string) => void;
  setTicketPriority: (id: string, priority: TicketPriority) => void;
  setTicketTags: (id: string, tags: string[]) => void;
  setQuestions: (questions: FormQuestion[]) => void;
  setFormFields: (fields: FormFieldConfig[]) => void;
  submitForm: (userId: string, answers: Record<string, string>) => { ok: true } | { ok: false; error: string };
  reviewForm: (id: string, status: Exclude<SubmissionStatus, "pending">, reason: string, reviewerId: string) => { ok: true } | { ok: false; error: string };
  setSubmissionAiNote: (id: string, note: string) => void;
  punish: (input: {
    targetId: string;
    actorId: string;
    action: ModAction;
    reason: string;
    evidence: string;
    durationMinutes?: number;
  }) => { ok: true; note: string } | { ok: false; error: string };
  testAutomod: (userId: string, text: string) => ReturnType<typeof scanMessage>;
  toggleLockdown: () => void;
  closeIncident: (id: string) => void;
  addArticle: (title: string, body: string, tags: string[]) => void;
  updateArticle: (id: string, patch: Partial<Article>) => void;
  deleteArticle: (id: string) => void;
  addDashboardMember: (username: string, role: DashboardMember["role"]) => void;
  removeDashboardMember: (id: string) => void;
};

export type WumpusStore = PersistSlice & Actions;

function pick(s: PersistSlice): PersistSlice {
  return {
    activeGuildId: s.activeGuildId,
    guilds: s.guilds,
    members: s.members,
    tickets: s.tickets,
    formQuestions: s.formQuestions,
    submissions: s.submissions,
    cases: s.cases,
    automodHits: s.automodHits,
    incidents: s.incidents,
    articles: s.articles,
    logs: s.logs,
    modules: s.modules,
    channels: s.channels,
    roles: s.roles,
    dashboardMembers: s.dashboardMembers,
    licenses: s.licenses,
    posts: s.posts,
    publishQueue: s.publishQueue,
    recentMessages: s.recentMessages,
    sessionUser: s.sessionUser,
    theme: s.theme,
  };
}

function seedSlice(): PersistSlice {
  const s = cloneSeed();
  return { ...s, activeGuildId: DEMO_GUILD, theme: "dark", posts: [], publishQueue: [], recentMessages: [] };
}

function persist(slice: PersistSlice) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(slice));
  } catch {
    /* quota */
  }
}

export const useWumpus = create<WumpusStore>((set, get) => {
  /** Ultimo objeto de módulos publicado — evita republicar sem mudança real. */
  let publishedModules: unknown = null;

  /**
   * Publica a config do servidor ativo para o bot ler.
   *
   * O bot é outro processo: sem esta publicação ele nunca vê o que o painel
   * salva, e todo campo vira decoração. Falha de rede aqui não pode quebrar a
   * interface — o painel segue funcionando e tenta de novo na próxima mudança.
   */
  const publishModules = (state: WumpusStore) => {
    if (state.modules === publishedModules) return;
    publishedModules = state.modules;

    const guildId = state.activeGuildId;
    const modules = state.modules[guildId];
    if (!guildId || !modules) return;

    const payload: Record<string, Record<string, unknown>> = {};
    for (const [key, value] of Object.entries(modules)) {
      if (!value) continue;
      // `enabled` vai junto: desligar um módulo no painel tem de pará-lo no bot.
      payload[key] = { ...(value.config ?? {}), enabled: value.enabled !== false };
    }

    void publishGuildRuntime({
      data: {
        guildId,
        name: state.guilds.find((g) => g.id === guildId)?.name,
        modules: payload,
        // A base de conhecimento vai junto: o bot busca nela para responder.
        articles: state.articles
          .filter((article) => article.guildId === guildId)
          .map((article) => ({
            id: article.id,
            title: article.title,
            body: article.body,
            tags: article.tags,
            approved: article.approved,
          })),
      },
    }).catch(() => undefined);
  };

  const write = (partial: Partial<PersistSlice> | ((s: WumpusStore) => Partial<PersistSlice>)) => {
    set(partial);
    const state = get();
    persist(pick(state));
    publishModules(state);
  };

  const audit = (category: string, summary: string, actor?: string) => {
    const state = get();
    const event: AuditEvent = {
      id: uid("l"),
      guildId: state.activeGuildId,
      at: Date.now(),
      actor: actor ?? state.sessionUser.globalName,
      category,
      summary,
    };
    write({ logs: [event, ...state.logs].slice(0, 200) });
  };

  const cfg = (module: ModuleKey) => {
    const state = get();
    const g = state.modules[state.activeGuildId];
    return g?.[module] ?? { enabled: true, config: defaultsFor(module) };
  };

  return {
    ...seedSlice(),
    hydrated: false,

    hydrate: () => {
      if (typeof window === "undefined") {
        set({ hydrated: true });
        return;
      }
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<PersistSlice>;
          if (parsed && parsed.modules && parsed.tickets && parsed.guilds) {
            const base = seedSlice();
            const guilds = (parsed.guilds ?? base.guilds).map((g) => ({ ...g, plan: normalizePlan(g.plan) }));
            const licenses = (parsed.licenses ?? base.licenses).map((l) => ({ ...l, plan: normalizePlan(l.plan) }));

            // Sessao salva antes desta correcao traz `isAdmin: true` para todo
            // mundo. Revalidar aqui e o que impede um login antigo de continuar
            // entrando na area restrita — sem isso a correcao so valeria para
            // quem entrasse de novo.
            const stored = parsed.sessionUser ?? base.sessionUser;
            const sessionUser = {
              ...stored,
              isAdmin: isPlatformOwner(stored.id),
            };

            // Os defaults entram POR BAIXO do que esta salvo. Sem isto, chave
            // de padrao adicionada depois nunca chega a um workspace existente
            // — foi o que aconteceu com `fields` no formulario.
            const modules = mergeModuleDefaults({ ...base.modules, ...(parsed.modules ?? {}) });

            set({
              ...base,
              ...parsed,
              guilds,
              licenses,
              modules,
              sessionUser,
              posts: parsed.posts ?? [],
              publishQueue: parsed.publishQueue ?? [],
              recentMessages: parsed.recentMessages ?? [],
              hydrated: true,
            });
            document.documentElement.dataset.theme = parsed.theme ?? "dark";
            // Config ja salva no navegador tambem precisa chegar ao bot, mesmo
            // sem o usuario editar nada nesta sessao.
            publishModules(get());
            return;
          }
        }
      } catch {
        /* ignore */
      }
      document.documentElement.dataset.theme = "dark";
      set({ hydrated: true });
      publishModules(get());
    },

    resetDemo: () => {
      const next = seedSlice();
      write({ ...next });
      set({ hydrated: true });
      document.documentElement.dataset.theme = "dark";
      audit("admin", "Demonstração restaurada ao estado inicial.", "Admin");
    },

    setTheme: (theme) => {
      document.documentElement.dataset.theme = theme;
      write({ theme });
    },

    setActiveGuild: (id) => write({ activeGuildId: id }),

    // `isAdmin` nao pode ser ligado por qualquer um: so o dono da plataforma.
    // Sem esta trava, bastava chamar setAdmin(true) (ou editar o estado salvo)
    // para abrir a area restrita.
    setAdmin: (on) => {
      const current = get().sessionUser;
      if (on && !isPlatformOwner(current.id)) return;
      write({ sessionUser: { ...current, isAdmin: on && isPlatformOwner(current.id) } });
    },

    updateConfig: (module, patch) => {
      const state = get();
      const current = cfg(module);
      const nextModules = {
        ...state.modules,
        [state.activeGuildId]: {
          ...state.modules[state.activeGuildId],
          [module]: { ...current, config: { ...current.config, ...patch } },
        },
      };
      write({ modules: nextModules });
      audit(module, `Configuração de ${module} atualizada.`);
    },

    setModuleEnabled: (module, enabled) => {
      const state = get();
      const current = cfg(module);
      write({
        modules: {
          ...state.modules,
          [state.activeGuildId]: {
            ...state.modules[state.activeGuildId],
            [module]: { ...current, enabled },
          },
        },
      });
      audit(module, enabled ? `Módulo ${module} ligado.` : `Módulo ${module} pausado.`);
    },

    applyPreset: (preset) => {
      const state = get();
      const gid = state.activeGuildId;
      const current = state.modules[gid];
      const patch = presets[preset].patch;
      const next = { ...current };
      for (const key of Object.keys(patch) as ModuleKey[]) {
        const p = patch[key];
        if (!p) continue;
        next[key] = { ...next[key], config: { ...next[key].config, ...p } };
      }
      write({
        modules: { ...state.modules, [gid]: next },
        guilds: state.guilds.map((g) => (g.id === gid ? { ...g, preset } : g)),
      });
      audit("protect", `Preset “${presets[preset].label}” aplicado.`);
    },

    openTicket: ({ openerId, department, subject, body }) => {
      const state = get();
      const tcfg = cfg("tickets");
      if (!tcfg.enabled) return { ok: false, error: "O atendimento está pausado neste servidor." };
      const maxOpen = Number(tcfg.config.maxOpenPerUser ?? 1);
      const openCount = state.tickets.filter(
        (t) => t.guildId === state.activeGuildId && t.openerId === openerId && (t.status === "open" || t.status === "claimed"),
      ).length;
      if (openCount >= maxOpen) {
        return { ok: false, error: `Limite de ${maxOpen} atendimento(s) aberto(s) por pessoa.` };
      }
      const opener = state.members.find((m) => m.id === openerId && m.guildId === state.activeGuildId);
      const name = opener?.username ?? "membro";
      const pattern = String(tcfg.config.namingPattern ?? "atendimento-{user}");
      const numbers = state.tickets.filter((t) => t.guildId === state.activeGuildId).map((t) => t.number);
      const number = (numbers.length ? Math.max(...numbers) : 100) + 1;
      const welcome = String(tcfg.config.welcomeMessage ?? "");
      const plan = state.guilds.find((g) => g.id === state.activeGuildId)?.plan ?? "pro";
      const departments = Array.isArray(tcfg.config.departments)
        ? tcfg.config.departments.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        : [];
      const dept = planAllows(plan, "multiDepartment") ? department : (departments[0] ?? department);
      const ticket: Ticket = {
        id: uid("t"),
        guildId: state.activeGuildId,
        number,
        openerId,
        claimedBy: null,
        department: dept,
        subject,
        status: "open",
        priority: "normal",
        tags: [],
        channelName: channelNameFor(pattern, name),
        createdAt: Date.now(),
        firstResponseAt: null,
        closedAt: null,
        transcript: null,
        feedback: null,
        messages: [
          {
            id: uid("m"),
            authorId: openerId,
            content: body,
            at: Date.now(),
            kind: "user",
          },
          {
            id: uid("m"),
            authorId: "system",
            content: welcome || `Atendimento #${number} aberto em ${dept}.`,
            at: Date.now() + 1,
            kind: "system",
          },
        ],
      };
      write({ tickets: [ticket, ...state.tickets] });
      audit("tickets", `Abriu ticket #${number} em ${dept}.`, opener?.displayName ?? "Membro");
      return { ok: true, id: ticket.id };
    },

    claimTicket: (id, staffId) => {
      const state = get();
      const ticket = state.tickets.find((t) => t.id === id);
      if (!ticket) return { ok: false, error: "Ticket não encontrado." };
      const staff = state.members.find((m) => m.id === staffId);
      const max = Number(cfg("staff").config.maxConcurrentTickets ?? 5);
      const load = state.tickets.filter(
        (t) => t.guildId === state.activeGuildId && t.claimedBy === staffId && (t.status === "open" || t.status === "claimed"),
      ).length;
      if (load >= max) return { ok: false, error: `${staff?.displayName ?? "Staff"} já está com ${max} atendimentos.` };
      write({
        tickets: state.tickets.map((t) =>
          t.id === id
            ? {
                ...t,
                status: "claimed" as TicketStatus,
                claimedBy: staffId,
                firstResponseAt: t.firstResponseAt ?? Date.now(),
                messages: [
                  ...t.messages,
                  {
                    id: uid("m"),
                    authorId: "system",
                    content: `${staff?.displayName ?? "Staff"} assumiu o atendimento.`,
                    at: Date.now(),
                    kind: "system" as const,
                  },
                ],
              }
            : t,
        ),
      });
      audit("tickets", `Assumiu o ticket #${ticket.number}.`, staff?.displayName);
      return { ok: true };
    },

    addTicketMessage: (id, authorId, content, kind) => {
      const state = get();
      write({
        tickets: state.tickets.map((t) => {
          if (t.id !== id) return t;
          const firstResponseAt =
            t.firstResponseAt ?? (kind === "staff" ? Date.now() : t.firstResponseAt);
          return {
            ...t,
            firstResponseAt,
            messages: [...t.messages, { id: uid("m"), authorId, content, at: Date.now(), kind }],
          };
        }),
      });
    },

    closeTicket: (id, staffId, withFeedback) => {
      const state = get();
      const ticket = state.tickets.find((t) => t.id === id);
      if (!ticket) return;
      const staff = state.members.find((m) => m.id === staffId);
      const transcript = ticket.messages
        .map((m) => {
          const who =
            m.kind === "system"
              ? "Sistema"
              : state.members.find((x) => x.id === m.authorId)?.displayName ?? m.authorId;
          return `${who}: ${m.content}`;
        })
        .join("\n");
      const channelId = String(cfg("tickets").config.transcriptChannelId ?? "ch_transcripts");
      const plan = state.guilds.find((g) => g.id === state.activeGuildId)?.plan ?? "pro";
      const withTranscript = planAllows(plan, "transcripts");
      const post: ChannelPost | null = withTranscript
        ? {
            id: uid("p"),
            guildId: state.activeGuildId,
            channelId,
            author: "Wumpus",
            content: `Transcrição #${ticket.number} — ${ticket.subject}\n${transcript}`,
            at: Date.now(),
          }
        : null;
      write({
        posts: post ? [post, ...state.posts].slice(0, 60) : state.posts,
        tickets: state.tickets.map((t) =>
          t.id === id
            ? {
                ...t,
                status: "closed" as TicketStatus,
                closedAt: Date.now(),
                transcript,
                feedback: withFeedback ?? t.feedback,
                messages: [
                  ...t.messages,
                  {
                    id: uid("m"),
                    authorId: "system",
                    content: withTranscript
                      ? `Encerrado por ${staff?.displayName ?? "staff"}. Transcrição enviada para o canal configurado.`
                      : `Encerrado por ${staff?.displayName ?? "staff"}. Transcrição automática é do plano Pro.`,
                    at: Date.now(),
                    kind: "system" as const,
                  },
                ],
              }
            : t,
        ),
      });
      audit("tickets", `Encerrou #${ticket.number} e publicou transcrição.`, staff?.displayName);
    },

    archiveTicket: (id) => {
      const state = get();
      write({
        tickets: state.tickets.map((t) => (t.id === id ? { ...t, status: "archived" as TicketStatus } : t)),
      });
      audit("tickets", "Ticket arquivado.");
    },

    reopenTicket: (id) => {
      const tcfg = cfg("tickets");
      if (!tcfg.config.reopenEnabled) return;
      const state = get();
      write({
        tickets: state.tickets.map((t) =>
          t.id === id
            ? {
                ...t,
                status: "open" as TicketStatus,
                closedAt: null,
                messages: [
                  ...t.messages,
                  { id: uid("m"), authorId: "system", content: "Atendimento reaberto.", at: Date.now(), kind: "system" as const },
                ],
              }
            : t,
        ),
      });
      audit("tickets", "Ticket reaberto.");
    },

    setTicketPriority: (id, priority) => {
      if (!cfg("tickets").config.priorityEnabled) return;
      write({ tickets: get().tickets.map((t) => (t.id === id ? { ...t, priority } : t)) });
    },

    setTicketTags: (id, tags) => {
      write({ tickets: get().tickets.map((t) => (t.id === id ? { ...t, tags } : t)) });
    },

    setQuestions: (questions) => {
      const state = get();
      write({ formQuestions: { ...state.formQuestions, [state.activeGuildId]: questions } });
      write({
        modules: {
          ...get().modules,
          [state.activeGuildId]: {
            ...get().modules[state.activeGuildId],
            forms: {
              ...cfg("forms"),
              config: { ...cfg("forms").config, questions: questions.map((q) => q.label) },
            },
          },
        },
      });
      audit("forms", "Perguntas do formulário atualizadas.");
    },

    // Grava `config.fields` — o MESMO caminho que o bot le.
    //
    // Este metodo existe porque o editor da dashboard gravava so
    // `config.questions`: enquanto `fields` nao existia, o bot caia no
    // fallback e a tela funcionava por acidente. Assim que `fields` entrou no
    // padrao, o editor passou a nao ter efeito nenhum.
    setFormFields: (fields) => {
      const state = get();
      const forms = cfg("forms");

      write({
        modules: {
          ...state.modules,
          [state.activeGuildId]: {
            ...state.modules[state.activeGuildId],
            forms: { ...forms, config: { ...forms.config, fields } },
          },
        },
        // `formQuestions` segue em sincronia para a previa e a simulacao, que
        // trabalham com a lista simples de rotulos.
        formQuestions: {
          ...state.formQuestions,
          [state.activeGuildId]: fields.map((field) => ({
            id: field.id,
            label: field.label,
            required: field.required,
          })),
        },
      });

      audit("forms", "Formulário atualizado.");
    },

    submitForm: (userId, answers) => {
      const state = get();
      const fcfg = cfg("forms");
      if (!fcfg.enabled) return { ok: false, error: "As candidaturas estão pausadas." };
      const plan = state.guilds.find((g) => g.id === state.activeGuildId)?.plan ?? "pro";
      if (!planAllows(plan, "forms")) {
        return { ok: false, error: "O plano Comunidade não inclui candidaturas." };
      }
      const cooldownH = Number(fcfg.config.cooldownHours ?? 24);
      const recent = state.submissions.find(
        (s) =>
          s.guildId === state.activeGuildId &&
          s.userId === userId &&
          Date.now() - s.createdAt < cooldownH * 3_600_000,
      );
      if (recent) return { ok: false, error: `Aguarde ${cooldownH}h entre envios.` };
      const max = Number(fcfg.config.maxSubmissionsPerUser ?? 3);
      const count = state.submissions.filter((s) => s.guildId === state.activeGuildId && s.userId === userId).length;
      if (count >= max) return { ok: false, error: "Limite de envios atingido." };
      const member = state.members.find((m) => m.id === userId && m.guildId === state.activeGuildId);
      const minDays = Number(fcfg.config.minAccountAgeDays ?? 0);
      if (member && minDays > 0) {
        const age = (Date.now() - member.accountCreatedAt) / 86_400_000;
        if (age < minDays) return { ok: false, error: `Conta precisa ter ${minDays} dia(s).` };
      }
      const sub: FormSubmission = {
        id: uid("s"),
        guildId: state.activeGuildId,
        userId,
        answers,
        status: "pending",
        createdAt: Date.now(),
        reviewedAt: null,
        reviewerId: null,
        reason: "",
        aiNote: null,
      };
      write({ submissions: [sub, ...state.submissions] });
      audit("forms", "Nova candidatura recebida.", member?.displayName);
      return { ok: true };
    },

    reviewForm: (id, status, reason, reviewerId) => {
      const fcfg = cfg("forms");
      if (status === "rejected" && fcfg.config.requireReasonOnReject && !reason.trim()) {
        return { ok: false, error: "Informe o motivo da recusa." };
      }
      const state = get();
      write({
        submissions: state.submissions.map((s) =>
          s.id === id
            ? { ...s, status, reason, reviewerId, reviewedAt: Date.now() }
            : s,
        ),
      });
      audit("forms", status === "approved" ? "Candidatura aprovada." : `Candidatura recusada: ${reason}`);
      return { ok: true };
    },

    setSubmissionAiNote: (id, note) => {
      write({ submissions: get().submissions.map((s) => (s.id === id ? { ...s, aiNote: note } : s)) });
    },

    punish: ({ targetId, actorId, action, reason, evidence, durationMinutes }) => {
      const state = get();
      const mcfg = cfg("moderation");
      if (!mcfg.enabled) return { ok: false, error: "Moderação pausada." };
      if (mcfg.config.requireEvidence && !evidence.trim()) {
        return { ok: false, error: "Evidência obrigatória neste servidor." };
      }
      if (mcfg.config.requireReason !== false && !reason.trim() && cfg("staff").config.requireReason) {
        return { ok: false, error: "Motivo obrigatório." };
      }
      const target = state.members.find((m) => m.id === targetId && m.guildId === state.activeGuildId);
      if (!target) return { ok: false, error: "Membro não encontrado." };
      if (action === "pardon" && !mcfg.config.pardonsEnabled) {
        return { ok: false, error: "Perdão está desligado." };
      }

      let strikes = effectiveStrikes(
        target.strikes,
        state.cases.filter((c) => c.guildId === state.activeGuildId),
        target.id,
        Number(mcfg.config.strikeExpiryDays ?? 0),
      );
      let timedOutUntil = target.timedOutUntil;
      let banned = target.banned;
      let note = "";

      if (action === "warn") {
        const next = nextModerationAction(strikes, mcfg.config);
        strikes += 1;
        note = `Advertência ${strikes}. ${next.note}`;
      } else if (action === "timeout") {
        const mins = durationMinutes ?? Number(mcfg.config.defaultTimeoutMinutes ?? 60);
        timedOutUntil = Date.now() + mins * 60_000;
        strikes += 1;
        note = `Timeout de ${mins} min.`;
      } else if (action === "kick") {
        note = "Membro expulso (na demo ele permanece na lista).";
      } else if (action === "ban") {
        banned = true;
        note = "Membro banido.";
      } else if (action === "pardon") {
        strikes = Math.max(0, strikes - 1);
        timedOutUntil = null;
        banned = false;
        note = "Advertência perdoada.";
      }

      if (Boolean(mcfg.config.dmOnPunish) && action !== "pardon") {
        note = `${note} Aviso enviado no privado.`;
      }

      const cas: ModCase = {
        id: uid("c"),
        guildId: state.activeGuildId,
        targetId,
        actorId,
        action,
        reason,
        evidence,
        createdAt: Date.now(),
        durationMinutes,
      };

      write({
        cases: [cas, ...state.cases],
        members: state.members.map((m) =>
          m.id === targetId && m.guildId === state.activeGuildId
            ? { ...m, strikes, timedOutUntil, banned }
            : m,
        ),
      });
      audit("moderation", `${action} em ${target.displayName}: ${reason}`);
      return { ok: true, note };
    },

    testAutomod: (userId, text) => {
      const state = get();
      const acfg = cfg("automod");
      const author = state.members.find((m) => m.id === userId && m.guildId === state.activeGuildId) ?? {
        roleIds: [] as string[],
        username: "membro",
      };
      if (!acfg.enabled) return { ok: true, detail: "AutoMod pausado — mensagem passaria." };
      const verdict = scanMessage(acfg.config, text, author);
      const recent: RecentMessage[] = [
        ...state.recentMessages,
        { guildId: state.activeGuildId, userId, content: text, at: Date.now() },
      ].slice(-120);
      const burst = verdict.ok ? scanBurst(acfg.config, state.recentMessages.filter((m) => m.guildId === state.activeGuildId), userId, text) : null;
      const finalVerdict = burst ?? verdict;
      if (!finalVerdict.ok) {
        const hit: AutomodHit = {
          id: uid("h"),
          guildId: state.activeGuildId,
          userId,
          content: text,
          rule: finalVerdict.rule ?? "filtro",
          action: finalVerdict.action ?? "delete",
          at: Date.now(),
        };
        write({ recentMessages: recent, automodHits: [hit, ...state.automodHits].slice(0, 80) });
        audit("automod", `Filtrou mensagem (${finalVerdict.rule}).`);
        return finalVerdict;
      }
      write({ recentMessages: recent });
      return finalVerdict;
    },

    toggleLockdown: () => {
      const state = get();
      const current = cfg("security");
      const next = !Boolean(current.config.lockdown);
      write({
        modules: {
          ...state.modules,
          [state.activeGuildId]: {
            ...state.modules[state.activeGuildId],
            security: { ...current, config: { ...current.config, lockdown: next } },
          },
        },
      });
      if (next) {
        const inc: Incident = {
          id: uid("i"),
          guildId: state.activeGuildId,
          kind: "lockdown",
          title: "Lockdown manual",
          detail: String(current.config.lockdownMessage ?? "Servidor em proteção."),
          status: "open",
          at: Date.now(),
        };
        write({ incidents: [inc, ...get().incidents] });
      }
      audit("security", next ? "Lockdown ligado." : "Lockdown desligado.");
    },

    closeIncident: (id) => {
      write({
        incidents: get().incidents.map((i) => (i.id === id ? { ...i, status: "closed" } : i)),
      });
    },

    addArticle: (title, body, tags) => {
      const state = get();
      const article: Article = {
        id: uid("a"),
        guildId: state.activeGuildId,
        title,
        body,
        tags,
        approved: true,
        updatedAt: Date.now(),
      };
      write({ articles: [article, ...state.articles] });
      audit("knowledge", `Artigo “${title}” publicado.`);
    },

    updateArticle: (id, patch) => {
      write({
        articles: get().articles.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a)),
      });
    },

    deleteArticle: (id) => {
      write({ articles: get().articles.filter((a) => a.id !== id) });
      audit("knowledge", "Artigo removido.");
    },

    addDashboardMember: (username, role) => {
      const member: DashboardMember = {
        id: uid("dm"),
        username,
        role,
        addedAt: Date.now(),
      };
      write({ dashboardMembers: [...get().dashboardMembers, member] });
    },

    removeDashboardMember: (id) => {
      write({ dashboardMembers: get().dashboardMembers.filter((m) => m.id !== id) });
    },

    sweepInactive: () => {
      const state = get();
      const tcfg = cfg("tickets");
      const hours = Number(tcfg.config.autoCloseInactiveHours ?? 0);
      if (hours <= 0) return { closed: 0, error: "Autoencerramento está em 0h." };
      let closed = 0;
      const tickets = state.tickets.map((t) => {
        if (t.guildId !== state.activeGuildId || !shouldAutoClose(t, tcfg.config)) return t;
        closed += 1;
        const transcript = t.messages
          .map((m) => {
            const who = m.kind === "system" ? "Sistema" : state.members.find((x) => x.id === m.authorId)?.displayName ?? m.authorId;
            return `${who}: ${m.content}`;
          })
          .join("\n");
        return {
          ...t,
          status: "closed" as TicketStatus,
          closedAt: Date.now(),
          transcript,
          messages: [
            ...t.messages,
            {
              id: uid("m"),
              authorId: "system",
              content: `Encerrado por inatividade (${hours}h sem mensagem).`,
              at: Date.now(),
              kind: "system" as const,
            },
          ],
        };
      });
      if (closed === 0) return { closed: 0, error: "Nenhum atendimento ocioso." };
      write({ tickets });
      audit("tickets", `Autoencerramento fechou ${closed} atendimento(s).`);
      return { closed };
    },

    publishPanel: (kind) => {
      const state = get();
      const mod = cfg(kind);
      const title = String(mod.config.panelTitle ?? kind);
      const channelRef = String(
        kind === "tickets" ? mod.config.panelChannelId ?? "ch_atendimento" : mod.config.reviewChannelId ?? "ch_forms",
      );

      const job: PublishJob = {
        id: uid("j"),
        guildId: state.activeGuildId,
        kind,
        status: "queued",
        detail: title,
        at: Date.now(),
      };
      write({ publishQueue: [job, ...state.publishQueue].slice(0, 40) });
      audit("servers", `Painel de ${kind} enviado para publicação: ${title}.`);

      // O pedido real vai para a fila que o BOT le. Sem isto, "publicar" so
      // escrevia no estado local e nada chegava ao Discord.
      void requestPanelPublish({
        data: { guildId: state.activeGuildId, target: kind, channelRef },
      })
        .then((result) => {
          if (!result.ok) return;
          write({
            publishQueue: get().publishQueue.map((entry) =>
              entry.id === job.id ? { ...entry, status: "published" as const } : entry,
            ),
          });
        })
        .catch(() => undefined);
    },

    processQueue: () => {
      const state = get();
      const pending = state.publishQueue.filter((j) => j.guildId === state.activeGuildId && j.status === "queued");
      if (pending.length === 0) return 0;
      const posts: ChannelPost[] = pending.map((job) => {
        const mod = cfg(job.kind);
        const channelId = String(job.kind === "tickets" ? mod.config.panelChannelId ?? "ch_atendimento" : mod.config.reviewChannelId ?? "ch_forms");
        return {
          id: uid("p"),
          guildId: state.activeGuildId,
          channelId,
          author: "Wumpus",
          content: `Painel publicado · ${String(mod.config.panelTitle ?? job.detail)}\n${String(mod.config.panelDescription ?? "")}`,
          at: Date.now(),
        };
      });
      write({
        posts: [...posts, ...state.posts].slice(0, 60),
        publishQueue: state.publishQueue.map((j) =>
          j.guildId === state.activeGuildId && j.status === "queued" ? { ...j, status: "published" as const } : j,
        ),
      });
      audit("servers", `Fila processada: ${pending.length} painel(is).`);
      return pending.length;
    },

    simulateJoin: ({ username, accountAgeHours }) => {
      const state = get();
      const servers = cfg("servers");
      const security = cfg("security");
      const roles = cfg("roles");
      const name = username.trim().replace(/\s+/g, "").slice(0, 24) || "visitante";
      const minHours = Number(security.config.minAccountAgeHours ?? 0);
      const quarantine = Boolean(security.config.quarantineNewMembers) && accountAgeHours < minHours;
      const maintenance = Boolean(servers.config.maintenanceMode);
      const defaultRoles = Array.isArray(roles.config.defaultRoleIds)
        ? roles.config.defaultRoleIds.filter((x): x is string => typeof x === "string")
        : [];
      const member: Member = {
        id: uid("u"),
        guildId: state.activeGuildId,
        username: name.toLowerCase(),
        displayName: name,
        hue: Math.round(Math.random() * 360),
        roleIds: maintenance || quarantine ? [] : defaultRoles,
        joinedAt: Date.now(),
        strikes: 0,
        status: "online",
        accountCreatedAt: Date.now() - Math.max(0, accountAgeHours) * 3_600_000,
        timedOutUntil: null,
        banned: false,
      };
      const channelId = String(
        maintenance || quarantine
          ? security.config.alertChannelId ?? "ch_alerts"
          : servers.config.announceJoinChannelId ?? "ch_geral",
      );
      const content = maintenance
        ? String(servers.config.maintenanceMessage ?? "Manutenção.")
        : quarantine
          ? `${name} entrou com conta de ${accountAgeHours}h (mínimo ${minHours}h) e foi isolado, sem cargo.`
          : renderTemplate(String(servers.config.joinMessage ?? "Bem-vindo, {user}."), { user: name });
      const post: ChannelPost = {
        id: uid("p"),
        guildId: state.activeGuildId,
        channelId,
        author: "Wumpus",
        content,
        at: Date.now(),
      };
      const incidents = quarantine
        ? [
            {
              id: uid("i"),
              guildId: state.activeGuildId,
              kind: "raid" as const,
              title: "Conta nova isolada",
              detail: content,
              status: "open" as const,
              at: Date.now(),
            },
            ...state.incidents,
          ]
        : state.incidents;
      write({
        members: [...state.members, member],
        posts: [post, ...state.posts].slice(0, 60),
        incidents,
        guilds: state.guilds.map((g) =>
          g.id === state.activeGuildId ? { ...g, memberCount: g.memberCount + 1, online: g.online + 1 } : g,
        ),
      });
      audit("servers", content);
      return content;
    },

    simulateRaid: (joins) => {
      const state = get();
      const security = cfg("security");
      const decision = evaluateRaid(joins, security.config);
      if (!decision.triggered) {
        audit("security", decision.detail);
        return decision.detail;
      }
      const lockdown = decision.lockdown;
      const incident: Incident = {
        id: uid("i"),
        guildId: state.activeGuildId,
        kind: "raid",
        title: lockdown ? "Raid — lockdown" : "Raid — alerta",
        detail: decision.detail,
        status: lockdown ? "open" : "contained",
        at: Date.now(),
      };
      const channelId = String(security.config.alertChannelId ?? "ch_alerts");
      const post: ChannelPost = {
        id: uid("p"),
        guildId: state.activeGuildId,
        channelId,
        author: "Wumpus",
        content: lockdown ? String(security.config.lockdownMessage ?? decision.detail) : decision.detail,
        at: Date.now(),
      };
      write({
        incidents: [incident, ...state.incidents],
        posts: [post, ...state.posts].slice(0, 60),
        modules: lockdown
          ? {
              ...state.modules,
              [state.activeGuildId]: {
                ...state.modules[state.activeGuildId],
                security: { ...security, config: { ...security.config, lockdown: true } },
              },
            }
          : state.modules,
      });
      audit("security", decision.detail);
      return decision.detail;
    },

    simulateNuke: (actions) => {
      const state = get();
      const plan = state.guilds.find((g) => g.id === state.activeGuildId)?.plan ?? "pro";
      const security = cfg("security");
      const decision = evaluateNuke(actions, security.config, planAllows(plan, "antiNuke"));
      if (!decision.triggered) {
        audit("security", decision.detail);
        return decision.detail;
      }
      const incident: Incident = {
        id: uid("i"),
        guildId: state.activeGuildId,
        kind: "nuke",
        title: decision.lockdown ? "Nuke contido" : "Nuke só em alerta",
        detail: decision.detail,
        status: decision.lockdown ? "open" : "contained",
        at: Date.now(),
      };
      write({
        incidents: [incident, ...state.incidents],
        modules: decision.lockdown
          ? {
              ...state.modules,
              [state.activeGuildId]: {
                ...state.modules[state.activeGuildId],
                security: { ...security, config: { ...security.config, lockdown: true } },
              },
            }
          : state.modules,
      });
      audit("security", decision.detail);
      return decision.detail;
    },

    setPlan: (plan) => {
      const state = get();
      // Só o dono troca plano por aqui. O cliente muda de plano pagando na
      // ShardPay — sem esta trava, o botao da tela de servidor dava Escala de
      // graca a qualquer sessao.
      if (!isPlatformOwner(state.sessionUser.id)) return;
      write({
        guilds: state.guilds.map((g) => (g.id === state.activeGuildId ? { ...g, plan } : g)),
        licenses: state.licenses.map((l) => {
          const guild = state.guilds.find((g) => g.id === state.activeGuildId);
          return guild && l.guildName === guild.name ? { ...l, plan } : l;
        }),
      });
      audit("servers", `Plano do servidor alterado para ${plan}.`);
    },
  };
});

export function useGuildId() {
  return useWumpus((s) => s.activeGuildId);
}

/**
 * Servidor neutro para quando a sessao nao tem nenhum liberado.
 *
 * Existe porque lista vazia passou a ser um estado LEGITIMO: sem assinatura
 * ativa, ou com o bot em nenhum servidor que a pessoa administre. Antes o
 * codigo fazia `s.guilds[0]!` — uma assercao que mente, porque com a lista
 * vazia o valor e `undefined` e qualquer acesso a `guild.plan` estourava.
 */
const NO_GUILD: Guild = {
  id: "",
  name: "Nenhum servidor",
  tag: "--",
  memberCount: 0,
  online: 0,
  plan: "essencial",
  preset: "community",
  installed: false,
  region: "—",
  iconUrl: null,
};

export function useActiveGuild(): Guild {
  return useWumpus((s) => s.guilds.find((g) => g.id === s.activeGuildId) ?? s.guilds[0] ?? NO_GUILD);
}

export function useModule(module: ModuleKey) {
  const gid = useWumpus((s) => s.activeGuildId);
  const mods = useWumpus((s) => s.modules[gid]);
  return mods?.[module] ?? { enabled: true, config: defaultsFor(module) };
}

export function useGuildMembers() {
  const gid = useWumpus((s) => s.activeGuildId);
  const members = useWumpus((s) => s.members);
  return members.filter((m) => m.guildId === gid);
}
