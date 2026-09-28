import { hoursAgo, minutesAgo, uid } from "@/lib/utils";
import { defaultsFor, type ModuleKey } from "./defaults";
import type {
  Article,
  AuditEvent,
  AutomodHit,
  Channel,
  DashboardMember,
  FormQuestion,
  FormSubmission,
  Guild,
  GuildModules,
  Incident,
  License,
  Member,
  ModCase,
  Role,
  SessionUser,
  Ticket,
} from "./types";

export const DEMO_GUILD = "g_aurora";
export const DEMO_RP = "g_nexus";

export const sessionUser: SessionUser = {
  id: "u_luna",
  username: "luna",
  globalName: "Luna",
  isAdmin: false,
};

export const roles: Record<string, Role[]> = {
  [DEMO_GUILD]: [
    { id: "role_owner", name: "Dona", color: "#f5d76e", position: 50, staff: true },
    { id: "role_staff", name: "Staff", color: "#7c5cff", position: 40, staff: true },
    { id: "role_suporte", name: "Suporte", color: "#5b8def", position: 30, staff: true },
    { id: "role_mod", name: "Moderação", color: "#ef5d6a", position: 20, staff: true },
    { id: "role_cliente", name: "Cliente", color: "#3ecf8e", position: 10 },
    { id: "role_membro", name: "Membro", color: "#9aa0ad", position: 1 },
  ],
  [DEMO_RP]: [
    { id: "role_owner", name: "Fundação", color: "#f5d76e", position: 50, staff: true },
    { id: "role_staff", name: "Staff", color: "#7c5cff", position: 40, staff: true },
    { id: "role_mod", name: "Fiscal", color: "#ef5d6a", position: 20, staff: true },
    { id: "role_membro", name: "Cidadão", color: "#9aa0ad", position: 1 },
  ],
};

export const channels: Record<string, Channel[]> = {
  [DEMO_GUILD]: [
    { id: "cat_info", name: "Informações", type: "category", parentId: null },
    { id: "ch_regras", name: "regras", type: "text", parentId: "cat_info" },
    { id: "ch_geral", name: "geral", type: "text", parentId: "cat_info" },
    { id: "cat_tickets", name: "Atendimento", type: "category", parentId: null },
    { id: "ch_atendimento", name: "abrir-ticket", type: "text", parentId: "cat_tickets" },
    { id: "ch_forms", name: "candidaturas", type: "text", parentId: "cat_tickets" },
    { id: "cat_staff", name: "Equipe", type: "category", parentId: null },
    { id: "ch_staff", name: "staff", type: "text", parentId: "cat_staff" },
    { id: "ch_mod", name: "mod-log", type: "text", parentId: "cat_staff" },
    { id: "ch_logs", name: "auditoria", type: "text", parentId: "cat_staff" },
    { id: "ch_transcripts", name: "transcrições", type: "text", parentId: "cat_staff" },
    { id: "ch_alerts", name: "alertas", type: "text", parentId: "cat_staff" },
  ],
  [DEMO_RP]: [
    { id: "ch_geral", name: "cidade", type: "text", parentId: null },
    { id: "ch_atendimento", name: "whitelist", type: "text", parentId: null },
    { id: "ch_mod", name: "staff-log", type: "text", parentId: null },
    { id: "ch_logs", name: "auditoria", type: "text", parentId: null },
    { id: "ch_alerts", name: "emergencia", type: "text", parentId: null },
  ],
};

export const guilds: Guild[] = [
  {
    id: DEMO_GUILD,
    name: "Aurora Store",
    tag: "AS",
    memberCount: 1842,
    online: 214,
    plan: "pro",
    preset: "shop",
    installed: true,
    region: "Brasil",
  },
  {
    id: DEMO_RP,
    name: "Nexus RP",
    tag: "NX",
    memberCount: 6204,
    online: 891,
    plan: "escala",
    preset: "rp",
    installed: true,
    region: "Brasil",
  },
];

function modulesFor(preset: "shop" | "rp"): GuildModules {
  const list: ModuleKey[] = [
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
  const out = {} as GuildModules;
  for (const key of list) {
    out[key] = { enabled: true, config: defaultsFor(key) };
  }
  if (preset === "shop") {
    out.automod.config = {
      ...out.automod.config,
      blockLinks: true,
      allowedDomains: ["aurora.store", "mercadopago.com", "stripe.com"],
      slaWarningMinutes: 30,
    };
    out.tickets.config = {
      ...out.tickets.config,
      slaWarningMinutes: 30,
      departments: ["Compras", "Suporte", "Reembolso"],
    };
    out.security.config = {
      ...out.security.config,
      raidMode: "strict",
      raidJoinThreshold: 8,
      minAccountAgeHours: 48,
    };
  } else {
    out.automod.config = { ...out.automod.config, action: "warn", capsThresholdPercent: 100, mentionLimit: 12 };
    out.tickets.config = {
      ...out.tickets.config,
      panelTitle: "Whitelist e denúncias",
      departments: ["Denúncia", "Whitelist", "Staff"],
      slaWarningMinutes: 45,
    };
    out.security.config = { ...out.security.config, raidMode: "strict", quarantineNewMembers: true };
  }
  return out;
}

export const modules: Record<string, GuildModules> = {
  [DEMO_GUILD]: modulesFor("shop"),
  [DEMO_RP]: modulesFor("rp"),
};

export const members: Member[] = [
  m(DEMO_GUILD, "u_luna", "luna", "Luna", 262, ["role_owner", "role_staff"], 400, "online", 0),
  m(DEMO_GUILD, "u_theo", "theo", "Theo", 210, ["role_staff", "role_suporte"], 280, "online", 0),
  m(DEMO_GUILD, "u_maya", "maya", "Maya", 330, ["role_staff"], 210, "idle", 0),
  m(DEMO_GUILD, "u_rico", "rico", "Rico", 12, ["role_mod"], 180, "dnd", 0),
  m(DEMO_GUILD, "u_bia", "bia", "Bia", 140, ["role_cliente", "role_membro"], 90, "online", 0),
  m(DEMO_GUILD, "u_davi", "davi", "Davi", 28, ["role_membro"], 40, "online", 2),
  m(DEMO_GUILD, "u_nanda", "nanda", "Nanda", 300, ["role_cliente", "role_membro"], 70, "offline", 0),
  m(DEMO_GUILD, "u_kai", "kai", "Kai", 18, ["role_membro"], 12, "online", 4),
  m(DEMO_RP, "u_luna", "luna", "Luna", 262, ["role_owner", "role_staff"], 800, "online", 0),
  m(DEMO_RP, "u_gael", "gael", "Gael", 190, ["role_staff"], 120, "online", 0),
  m(DEMO_RP, "u_iris", "iris", "Íris", 40, ["role_membro"], 20, "idle", 1),
];

function m(
  guildId: string,
  id: string,
  username: string,
  displayName: string,
  hue: number,
  roleIds: string[],
  joinedDaysAgo: number,
  status: Member["status"],
  strikes: number,
): Member {
  return {
    id,
    guildId,
    username,
    displayName,
    hue,
    roleIds,
    joinedAt: hoursAgo(joinedDaysAgo * 24),
    strikes,
    status,
    accountCreatedAt: hoursAgo((joinedDaysAgo + 200) * 24),
    timedOutUntil: null,
    banned: false,
  };
}

export const tickets: Ticket[] = [
  {
    id: "t_101",
    guildId: DEMO_GUILD,
    number: 184,
    openerId: "u_bia",
    claimedBy: null,
    department: "Compras",
    subject: "Pagamento aprovado, produto não liberado",
    status: "open",
    priority: "urgent",
    tags: ["produto", "liberação"],
    channelName: "atendimento-bia",
    createdAt: minutesAgo(95),
    firstResponseAt: null,
    closedAt: null,
    transcript: null,
    feedback: null,
    messages: [
      msg("u_bia", "user", "Paguei o pack Aurora Pro há 2 horas e o cargo não caiu. Comprovante no e-mail.", minutesAgo(95)),
      msg("system", "system", "Ticket aberto no departamento Compras. SLA 30 min.", minutesAgo(95)),
    ],
  },
  {
    id: "t_102",
    guildId: DEMO_GUILD,
    number: 185,
    openerId: "u_nanda",
    claimedBy: "u_theo",
    department: "Suporte",
    subject: "Não consigo acessar o painel do produto",
    status: "claimed",
    priority: "high",
    tags: ["acesso"],
    channelName: "atendimento-nanda",
    createdAt: minutesAgo(40),
    firstResponseAt: minutesAgo(28),
    closedAt: null,
    transcript: null,
    feedback: null,
    messages: [
      msg("u_nanda", "user", "O login da área de membros volta erro 403.", minutesAgo(40)),
      msg("system", "system", "Theo assumiu o atendimento.", minutesAgo(28)),
      msg("u_theo", "staff", "Vi aqui — o e-mail da compra está diferente do Discord. Me confirma o e-mail usado no checkout?", minutesAgo(28)),
      msg("u_nanda", "user", "Usei nanda.loja@gmail.com", minutesAgo(18)),
    ],
  },
  {
    id: "t_103",
    guildId: DEMO_GUILD,
    number: 176,
    openerId: "u_davi",
    claimedBy: "u_maya",
    department: "Reembolso",
    subject: "Quero reembolso da chave errada",
    status: "closed",
    priority: "normal",
    tags: ["reembolso"],
    channelName: "atendimento-davi",
    createdAt: hoursAgo(30),
    firstResponseAt: hoursAgo(29.4),
    closedAt: hoursAgo(26),
    transcript:
      "Davi: Comprei a chave e veio de outro jogo.\nMaya: Vou reemitir. Pedido #A-2041.\nDavi: Recebi, obrigado.",
    feedback: { rating: 5, comment: "Rápido e sem enrolação." },
    messages: [
      msg("u_davi", "user", "Comprei a chave e veio de outro jogo.", hoursAgo(30)),
      msg("u_maya", "staff", "Vou reemitir. Pedido #A-2041.", hoursAgo(29.4)),
      msg("u_davi", "user", "Recebi, obrigado.", hoursAgo(27)),
      msg("system", "system", "Atendimento encerrado por Maya. Transcrição enviada.", hoursAgo(26)),
    ],
  },
  {
    id: "t_104",
    guildId: DEMO_GUILD,
    number: 162,
    openerId: "u_kai",
    claimedBy: "u_rico",
    department: "Suporte",
    subject: "Cargo de cliente sumiu",
    status: "archived",
    priority: "low",
    tags: ["cargo"],
    channelName: "atendimento-kai",
    createdAt: hoursAgo(90),
    firstResponseAt: hoursAgo(88),
    closedAt: hoursAgo(80),
    transcript: "Kai: Perdi o cargo.\nRico: Reapliquei o cargo Cliente.",
    feedback: { rating: 3, comment: "Resolveu, demorou um pouco." },
    messages: [
      msg("u_kai", "user", "Perdi o cargo de cliente depois de sair e voltar.", hoursAgo(90)),
      msg("u_rico", "staff", "Reapliquei o cargo Cliente.", hoursAgo(88)),
      msg("system", "system", "Arquivado automaticamente após 7 dias.", hoursAgo(10)),
    ],
  },
  {
    id: "t_201",
    guildId: DEMO_RP,
    number: 44,
    openerId: "u_iris",
    claimedBy: null,
    department: "Whitelist",
    subject: "Pedido de whitelist",
    status: "open",
    priority: "normal",
    tags: ["wl"],
    channelName: "atendimento-iris",
    createdAt: minutesAgo(50),
    firstResponseAt: null,
    closedAt: null,
    transcript: null,
    feedback: null,
    messages: [
      msg("u_iris", "user", "Quero entrar na cidade. Já li as regras.", minutesAgo(50)),
      msg("system", "system", "Ticket aberto no departamento Whitelist.", minutesAgo(50)),
    ],
  },
];

function msg(authorId: string, kind: Ticket["messages"][number]["kind"], content: string, at: number) {
  return { id: uid("m"), authorId, kind, content, at };
}

export const formQuestions: Record<string, FormQuestion[]> = {
  [DEMO_GUILD]: [
    { id: "q1", label: "Qual o seu nome ou apelido?", required: true },
    { id: "q2", label: "Por que quer fazer parte da equipe?", required: true },
    { id: "q3", label: "Qual a sua experiência relevante?", required: true },
  ],
  [DEMO_RP]: [
    { id: "q1", label: "Idade e fuso horário", required: true },
    { id: "q2", label: "História do personagem (curta)", required: true },
    { id: "q3", label: "Já jogou em outra cidade? Qual?", required: false },
  ],
};

export const submissions: FormSubmission[] = [
  {
    id: "s_1",
    guildId: DEMO_GUILD,
    userId: "u_bia",
    answers: {
      q1: "Bia",
      q2: "Já atendo a loja como cliente há 8 meses e quero ajudar no suporte.",
      q3: "Dois anos de Discord staff em servidor de 3k.",
    },
    status: "pending",
    createdAt: hoursAgo(6),
    reviewedAt: null,
    reviewerId: null,
    reason: "",
    aiNote: null,
  },
  {
    id: "s_2",
    guildId: DEMO_GUILD,
    userId: "u_davi",
    answers: {
      q1: "Davi",
      q2: "Quero o cargo de staff.",
      q3: "Nenhuma.",
    },
    status: "pending",
    createdAt: hoursAgo(20),
    reviewedAt: null,
    reviewerId: null,
    reason: "",
    aiNote: "Pouca substância nas respostas. Sem evidência de experiência. Sugerir rejeitar com pedido para tentar de novo em 30 dias.",
  },
  {
    id: "s_3",
    guildId: DEMO_GUILD,
    userId: "u_nanda",
    answers: {
      q1: "Nanda",
      q2: "Posso cobrir o plantão da madrugada e já vendi no Mercado Livre.",
      q3: "Atendimento em e-commerce, 4 anos.",
    },
    status: "approved",
    createdAt: hoursAgo(80),
    reviewedAt: hoursAgo(70),
    reviewerId: "u_luna",
    reason: "Perfil forte para compras. Cargo Suporte aplicado.",
    aiNote: null,
  },
  {
    id: "s_4",
    guildId: DEMO_RP,
    userId: "u_iris",
    answers: {
      q1: "19, GMT-3",
      q2: "Médica civil, formada na Cruz Vermelha da cidade.",
      q3: "Sim, Harmony RP por 6 meses.",
    },
    status: "pending",
    createdAt: hoursAgo(3),
    reviewedAt: null,
    reviewerId: null,
    reason: "",
    aiNote: null,
  },
];

export const cases: ModCase[] = [
  {
    id: "c_1",
    guildId: DEMO_GUILD,
    targetId: "u_kai",
    actorId: "u_rico",
    action: "warn",
    reason: "Divulgação de loja concorrente no #geral.",
    evidence: "Print da mensagem com link.",
    createdAt: hoursAgo(8),
  },
  {
    id: "c_2",
    guildId: DEMO_GUILD,
    targetId: "u_kai",
    actorId: "u_rico",
    action: "warn",
    reason: "Reincidência: convite de servidor.",
    evidence: "discord.gg/xxxx",
    createdAt: hoursAgo(5),
  },
  {
    id: "c_3",
    guildId: DEMO_GUILD,
    targetId: "u_davi",
    actorId: "u_maya",
    action: "timeout",
    reason: "Flood de menções após aviso.",
    evidence: "6 mensagens em 20s",
    createdAt: hoursAgo(14),
    durationMinutes: 60,
  },
];

export const automodHits: AutomodHit[] = [
  {
    id: "h_1",
    guildId: DEMO_GUILD,
    userId: "u_kai",
    content: "entra no meu server discord.gg/nitrofree",
    rule: "convite",
    action: "delete",
    at: hoursAgo(5),
  },
  {
    id: "h_2",
    guildId: DEMO_GUILD,
    userId: "u_davi",
    content: "FREE NITRO GEN!!!!",
    rule: "termo bloqueado",
    action: "delete",
    at: hoursAgo(14),
  },
];

export const incidents: Incident[] = [
  {
    id: "i_1",
    guildId: DEMO_GUILD,
    kind: "raid",
    title: "Pico de entradas",
    detail: "9 contas com menos de 2 dias em 40 segundos. Quarentena aplicada em 4.",
    status: "contained",
    at: hoursAgo(36),
  },
  {
    id: "i_2",
    guildId: DEMO_RP,
    kind: "nuke",
    title: "Tentativa de apagar canais",
    detail: "Cargo mal configurado em um bot de música. Revertido, cargo removido.",
    status: "closed",
    at: hoursAgo(120),
  },
];

export const articles: Article[] = [
  {
    id: "a_1",
    guildId: DEMO_GUILD,
    title: "Como recebo o produto depois do pagamento?",
    body: "O cargo Cliente é aplicado automaticamente em até 5 minutos. Se não cair, abra um ticket em Compras com o e-mail da nota.",
    tags: ["compras", "produto"],
    approved: true,
    updatedAt: hoursAgo(40),
  },
  {
    id: "a_2",
    guildId: DEMO_GUILD,
    title: "Política de reembolso",
    body: "Reembolso integral em até 7 dias se a chave não foi resgatada. Depois disso, avaliamos caso a caso no departamento Reembolso.",
    tags: ["reembolso"],
    approved: true,
    updatedAt: hoursAgo(200),
  },
  {
    id: "a_3",
    guildId: DEMO_GUILD,
    title: "Horário da equipe",
    body: "Plantão das 10h às 22h (Brasília), segunda a sábado. Fora disso o ticket fica na fila e o SLA pausa.",
    tags: ["equipe"],
    approved: true,
    updatedAt: hoursAgo(10),
  },
  {
    id: "a_4",
    guildId: DEMO_RP,
    title: "Como fazer whitelist",
    body: "Abra um ticket em Whitelist, envie idade, história curta e disponibilidade. Resposta em até 24h.",
    tags: ["whitelist"],
    approved: true,
    updatedAt: hoursAgo(12),
  },
];

export const logs: AuditEvent[] = [
  { id: uid("l"), guildId: DEMO_GUILD, at: minutesAgo(5), actor: "Wumpus", category: "automod", summary: "Mensagem apagada em #geral (convite)." },
  { id: uid("l"), guildId: DEMO_GUILD, at: minutesAgo(28), actor: "Theo", category: "tickets", summary: "Assumiu o ticket #185." },
  { id: uid("l"), guildId: DEMO_GUILD, at: minutesAgo(95), actor: "Bia", category: "tickets", summary: "Abriu ticket #184 em Compras." },
  { id: uid("l"), guildId: DEMO_GUILD, at: hoursAgo(5), actor: "Rico", category: "moderation", summary: "Advertência em Kai — convite." },
  { id: uid("l"), guildId: DEMO_GUILD, at: hoursAgo(6), actor: "Bia", category: "forms", summary: "Enviou candidatura à equipe." },
  { id: uid("l"), guildId: DEMO_GUILD, at: hoursAgo(14), actor: "Maya", category: "moderation", summary: "Timeout de 60 min em Davi." },
  { id: uid("l"), guildId: DEMO_GUILD, at: hoursAgo(26), actor: "Maya", category: "tickets", summary: "Encerrou #176 e publicou transcrição." },
  { id: uid("l"), guildId: DEMO_GUILD, at: hoursAgo(36), actor: "Wumpus", category: "security", summary: "Incidente de raid contido." },
  { id: uid("l"), guildId: DEMO_GUILD, at: hoursAgo(70), actor: "Luna", category: "forms", summary: "Aprovou candidatura de Nanda." },
];

export const dashboardMembers: DashboardMember[] = [
  { id: "u_luna", username: "luna", role: "owner", addedAt: hoursAgo(900) },
  { id: "u_theo", username: "theo", role: "admin", addedAt: hoursAgo(400) },
  { id: "u_maya", username: "maya", role: "viewer", addedAt: hoursAgo(200) },
];

export const licenses: License[] = [
  { id: "lic_1", guildName: "Aurora Store", plan: "pro", seats: 5, expires: "2026-12-01", status: "active" },
  { id: "lic_2", guildName: "Nexus RP", plan: "escala", seats: 8, expires: "2027-03-12", status: "active" },
];

export function cloneSeed() {
  return {
    guilds: structuredClone(guilds),
    members: structuredClone(members),
    tickets: structuredClone(tickets),
    formQuestions: structuredClone(formQuestions),
    submissions: structuredClone(submissions),
    cases: structuredClone(cases),
    automodHits: structuredClone(automodHits),
    incidents: structuredClone(incidents),
    articles: structuredClone(articles),
    logs: structuredClone(logs),
    modules: structuredClone(modules),
    channels: structuredClone(channels),
    roles: structuredClone(roles),
    dashboardMembers: structuredClone(dashboardMembers),
    licenses: structuredClone(licenses),
    sessionUser: { ...sessionUser },
  };
}
