/**
 * Assistente de IA — analise e aconselhamento.
 *
 * O pedido era um assistente que ajudasse quem contratou o Wumpus a configurar
 * o produto e a enxergar o que esta acontecendo no servidor: log estranho,
 * membro com comportamento fora do padrao, imagem suspeita.
 *
 * REGRA QUE NAO SE NEGOCIA: o assistente NUNCA aplica nada sozinho. Ele
 * devolve sugestao, e quem decide e o dono. Automacao de configuracao por IA e
 * como um bot que mexe no servidor sem avisar — se a analise erra, o estrago ja
 * aconteceu. Por isso nao existe funcao de "aplicar" neste arquivo.
 *
 * A saida e estruturada (JSON) mas SEMPRE passa por `parseAnalysis`, porque
 * modelo de linguagem erra formato. Se vier torto, devolvemos um resultado
 * vazio e marcado como indisponivel — nunca um `undefined` que estoura no meio
 * de um handler.
 */
import { groqChat, qualityModel } from "./ai.ts";
import type { Logger } from "./logger.ts";

export type Severity = "info" | "attention" | "urgent";

export type Finding = {
  title: string;
  detail: string;
  severity: Severity;
  /** O que fazer a respeito. Vazio quando nao ha acao obvia. */
  suggestion: string;
};

export type Analysis = {
  summary: string;
  findings: Finding[];
  /** 0 a 100. Quanto maior, mais o assistente recomenda olhar agora. */
  risk: number;
  /** `unavailable` quando nao houve resposta utilizavel da IA. */
  source: "ai" | "unavailable";
};

const EMPTY: Analysis = {
  summary: "Nao foi possivel analisar agora.",
  findings: [],
  risk: 0,
  source: "unavailable",
};

/** Modelo com visao, para ler imagem. */
export function visionModel(): string {
  return process.env.WUMPUS_GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
}

/** Prende o risco em 0..100, tolerando valor ausente ou absurdo. */
export function clampRisk(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Aceita variacoes que o modelo costuma inventar ("alto", "critico", "ALERTA"). */
export function normalizeSeverity(value: unknown): Severity {
  const text = String(value ?? "").trim().toLowerCase();
  if (["urgent", "urgente", "critico", "crítico", "critical", "high", "alto", "grave"].includes(text)) {
    return "urgent";
  }
  if (["attention", "atencao", "atenção", "warn", "warning", "medio", "médio", "medium"].includes(text)) {
    return "attention";
  }
  return "info";
}

/** Extrai o primeiro objeto JSON de um texto que pode vir com cercas de codigo. */
function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Converte a resposta crua em `Analysis`.
 *
 * Nunca lanca: qualquer formato inesperado vira o resultado vazio. Um assistente
 * que quebra o handler quando o modelo responde diferente e pior que um
 * assistente que admite nao ter conseguido.
 */
export function parseAnalysis(raw: string | null): Analysis {
  if (!raw) return EMPTY;

  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== "object") return EMPTY;

  const row = parsed as Record<string, unknown>;
  const findingsRaw = Array.isArray(row.findings) ? row.findings : [];

  const findings: Finding[] = findingsRaw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .slice(0, 5)
    .map((item) => ({
      title: String(item.title ?? "Observacao").slice(0, 120),
      detail: String(item.detail ?? "").slice(0, 600),
      severity: normalizeSeverity(item.severity),
      suggestion: String(item.suggestion ?? "").slice(0, 400)
    }));

  const summary = typeof row.summary === "string" && row.summary.trim()
    ? row.summary.trim().slice(0, 600)
    : EMPTY.summary;

  return {
    summary,
    findings,
    risk: clampRisk(row.risk),
    source: "ai"
  };
}

/** Formato compacto de um evento de auditoria, para caber no prompt. */
export type AuditLite = {
  at: number;
  actor: string;
  category: string;
  summary: string;
};

/**
 * Transforma eventos em texto curto.
 *
 * O prompt tem teto de tamanho: mandar 500 eventos crus estoura o contexto e
 * custa caro. Aqui limitamos e cortamos cada linha — o assistente precisa do
 * PADRAO, nao do texto integral de cada evento.
 */
export function buildLogDigest(events: AuditLite[], limit = 60): string {
  if (!events.length) return "Nenhum evento registrado na janela.";

  return events
    .slice(0, limit)
    .map((event) => {
      const when = Number.isFinite(event.at) ? new Date(event.at).toISOString().slice(5, 16).replace("T", " ") : "?";
      return `${when} [${event.category}] ${event.actor}: ${event.summary.slice(0, 160)}`;
    })
    .join("\n");
}

/** Contexto de um membro, para analise de comportamento. */
export function buildMemberDigest(input: {
  username: string;
  accountAgeDays: number;
  joinedDaysAgo: number;
  /** `null` quando nao medimos mensagens por membro — nao inventamos zero. */
  messages: number | null;
  strikes: number;
  timedOut: boolean;
  tickets: number;
}): string {
  return [
    `membro: ${input.username}`,
    `idade da conta: ${input.accountAgeDays} dia(s)`,
    `entrou no servidor ha: ${input.joinedDaysAgo} dia(s)`,
    `mensagens na janela: ${input.messages === null ? "nao medido" : input.messages}`,
    `advertencias acumuladas: ${input.strikes}`,
    `em castigo agora: ${input.timedOut ? "sim" : "nao"}`,
    `atendimentos abertos: ${input.tickets}`
  ].join("\n");
}

/** O que o assistente deve olhar, por tipo de analise. */
const TASKS: Record<string, string> = {
  logs: [
    "Analise os eventos de auditoria e aponte o que foge do normal: rajada de punicoes,",
    "entradas em massa, mudancas de cargo em sequencia, exclusoes de canal, ou um mesmo",
    "autor concentrando acoes destrutivas. Ignore o que e rotina."
  ].join(" "),
  member: [
    "Analise o historico deste membro e diga se o comportamento pede atencao: conta nova",
    "com atividade intensa, advertencias repetidas, ou padrao de quem so quer aparecer."
  ].join(" "),
  image: [
    "Analise a imagem e diga se ha sinal de golpe, phishing, QR code suspeito, print de",
    "isencao de responsabilidade ou conteudo que viole regras de comunidade."
  ].join(" "),
  config: [
    "Avalie a configuracao deste modulo e sugira ajustes concretos. Aponte tanto o que",
    "esta permissivo demais quanto o que vai gerar atrito com a comunidade."
  ].join(" ")
};

const OUTPUT_SHAPE = [
  "Responda SOMENTE com um objeto JSON, sem texto fora dele:",
  '{"summary":"resumo em uma frase","risk":0-100,',
  '"findings":[{"title":"...","detail":"...","severity":"info|attention|urgent","suggestion":"..."}]}',
  "Use no maximo 5 findings. Se estiver tudo normal, devolva findings vazio e risk baixo."
].join(" ");

async function ask(task: string, context: string, log: Logger, label: string): Promise<Analysis> {
  const raw = await groqChat(
    [
      {
        role: "system",
        content: [
          "Voce e o assistente do Wumpus, que ajuda o dono de um servidor do Discord a entender o que acontece nele.",
          "Escreva em portugues do Brasil, direto e operacional.",
          "Nunca invente fato que nao esteja no material. Se faltar dado, diga o que falta.",
          TASKS[task] ?? "",
          OUTPUT_SHAPE
        ].join(" ")
      },
      { role: "user", content: context }
    ],
    { model: qualityModel(), maxTokens: 900, timeoutMs: 25_000 }
  );

  const analysis = parseAnalysis(raw);
  if (analysis.source === "unavailable") {
    log.warn("assistente sem resposta utilizavel", { label });
  }
  return analysis;
}

/** Analise de eventos de auditoria — "tem algo estranho acontecendo?". */
export async function analyzeLogs(guildId: string, events: AuditLite[], log: Logger): Promise<Analysis> {
  return ask("logs", `Eventos recentes:\n${buildLogDigest(events)}`, log, `logs:${guildId}`);
}

/** Analise de comportamento de um membro. */
export async function analyzeMember(guildId: string, digest: string, log: Logger): Promise<Analysis> {
  return ask("member", digest, log, `member:${guildId}`);
}

/** Aconselhamento de configuracao de um modulo. */
export async function adviseConfig(guildId: string, module: string, config: unknown, log: Logger): Promise<Analysis> {
  return ask(
    "config",
    `Modulo: ${module}\nConfiguracao atual:\n${JSON.stringify(config, null, 2).slice(0, 4000)}`,
    log,
    `config:${guildId}:${module}`
  );
}

/**
 * Analise de imagem.
 *
 * Usa o modelo com visao e manda a URL direto. A imagem nao e baixada aqui —
 * quem ja tem o anexo e o automod, que pode chamar isto com a URL do Discord.
 */
export async function analyzeImage(guildId: string, imageUrl: string, log: Logger): Promise<Analysis> {
  const raw = await groqChat(
    [
      {
        role: "system",
        content: `${TASKS.image} ${OUTPUT_SHAPE}`
      },
      {
        role: "user",
        content: [
          { type: "text" as const, text: "O que esta nesta imagem?" },
          { type: "image_url" as const, image_url: { url: imageUrl } }
        ]
      }
    ],
    { model: visionModel(), maxTokens: 900, timeoutMs: 25_000 }
  );

  const analysis = parseAnalysis(raw);
  if (analysis.source === "unavailable") {
    log.warn("analise de imagem sem resposta utilizavel", { guildId });
  }
  return analysis;
}

/** Texto pronto para mandar no Discord, com o risco e as acoes sugeridas. */
export function formatAnalysis(analysis: Analysis, heading: string): string {
  if (analysis.source === "unavailable") {
    return `**${heading}**\nO assistente nao conseguiu analisar agora. Tente de novo em instantes.`;
  }

  const icon: Record<Severity, string> = { info: "•", attention: "⚠️", urgent: "🚨" };

  const lines = [
    `**${heading}** · risco **${analysis.risk}/100**`,
    analysis.summary,
    ""
  ];

  for (const finding of analysis.findings) {
    lines.push(`${icon[finding.severity]} **${finding.title}**`);
    if (finding.detail) lines.push(finding.detail);
    if (finding.suggestion) lines.push(`↳ ${finding.suggestion}`);
  }

  if (!analysis.findings.length) {
    lines.push("Nada fora do normal na janela analisada.");
  }

  return lines.join("\n").slice(0, 1900);
}
