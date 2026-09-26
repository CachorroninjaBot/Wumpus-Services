import { getPool } from "../server/db/index.js";
import { groqChat, qualityModel, fastModel } from "./llm.js";

/**
 * IA de apoio interno da equipe.
 *
 * Regra de produto, e o motivo desta API nao ter nenhum metodo de envio:
 * a IA NUNCA responde no canal nem executa acao no Discord. Ela produz uma
 * analise e sugestoes que aparecem apenas para quem pediu (resposta efemera).
 * A decisao e sempre humana.
 *
 * Melhorias:
 *  - Retry automatico com backoff (via llm.ts).
 *  - Fallback de modelo: se o 120B falhar, tenta o modelo rapido.
 *  - Prompt mais estruturado com contexto enriquecido.
 */

const MAX_MESSAGES = 30;

export type InternalSource = { name: string; url: string; hint?: string };

export type TicketContext = {
  ticketId: number;
  guildId: string;
  department: string | null;
  subject: string;
  status: string;
  priority: string;
  openerId: string;
  createdAt: string;
  messages: Array<{ authorId: string; authorName: string | null; content: string; createdAt: string }>;
  events: Array<{ eventType: string; actorId: string | null; createdAt: string }>;
};

export type AnalysisResult = {
  analysis: string;
  suggestions: string[];
  model: string;
  sources: Array<{ name: string; ok: boolean; summary: string }>;
  retries: number;
};

/** Plataformas internas autorizadas, lidas de WUMPUS_INTERNAL_APIS (JSON). */
export function internalSources(): InternalSource[] {
  const raw = process.env.WUMPUS_INTERNAL_APIS;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is InternalSource => {
        if (typeof entry !== "object" || entry === null) return false;
        const candidate = entry as Partial<InternalSource>;
        return typeof candidate.name === "string" && typeof candidate.url === "string";
      })
      .slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Consulta uma plataforma interna. Falha de uma fonte nao derruba a analise:
 * a equipe recebe a analise e sabe exatamente o que ficou indisponivel.
 */
async function consultSource(source: InternalSource): Promise<{ name: string; ok: boolean; summary: string }> {
  try {
    const response = await fetch(source.url, {
      headers: {
        accept: "application/json",
        ...(process.env.WUMPUS_INTERNAL_KEY ? { "x-internal-key": process.env.WUMPUS_INTERNAL_KEY } : {})
      },
      signal: AbortSignal.timeout(6_000)
    });
    if (!response.ok) {
      return { name: source.name, ok: false, summary: `respondeu ${response.status}` };
    }
    const text = await response.text();
    return { name: source.name, ok: true, summary: text.slice(0, 1500) };
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "tempo esgotado" : "sem resposta";
    return { name: source.name, ok: false, summary: reason };
  }
}

export async function loadTicketContext(ticketId: number, guildId: string): Promise<TicketContext | null> {
  const db = getPool();
  const ticket = await db.query<{
    id: number;
    department: string | null;
    subject: string;
    status: string;
    priority: string;
    openerId: string;
    createdAt: Date;
  }>(
    `select id, department, subject, status, priority, opener_id as "openerId", created_at as "createdAt"
     from tickets where id = $1 and guild_id = $2`,
    [ticketId, guildId]
  );
  const row = ticket.rows[0];
  if (!row) return null;

  const [messages, events] = await Promise.all([
    db.query<{ authorId: string; authorName: string | null; content: string; createdAt: Date }>(
      `select author_id as "authorId", author_name as "authorName", content, created_at as "createdAt"
       from ticket_messages where ticket_id = $1 order by created_at desc limit $2`,
      [ticketId, MAX_MESSAGES]
    ),
    db.query<{ eventType: string; actorId: string | null; createdAt: Date }>(
      `select event_type as "eventType", actor_id as "actorId", created_at as "createdAt"
       from ticket_events where ticket_id = $1 order by created_at`,
      [ticketId]
    )
  ]);

  return {
    ticketId: row.id,
    guildId,
    department: row.department,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    openerId: row.openerId,
    createdAt: row.createdAt.toISOString(),
    messages: messages.rows.reverse().map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
    events: events.rows.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() }))
  };
}

function buildPrompt(context: TicketContext, sources: Array<{ name: string; ok: boolean; summary: string }>): string {
  const transcript = context.messages.length
    ? context.messages
        .map((entry) => `[${entry.createdAt}] ${entry.authorName ?? entry.authorId}: ${entry.content}`)
        .join("\n")
    : "(sem mensagens registradas)";

  const sourceBlock = sources.length
    ? sources.map((entry) => `- ${entry.name}: ${entry.ok ? entry.summary : `INDISPONIVEL (${entry.summary})`}`).join("\n")
    : "(nenhuma plataforma interna configurada)";

  const eventBlock = context.events.length
    ? context.events.map((entry) => `- ${entry.eventType} por ${entry.actorId ?? "sistema"} em ${entry.createdAt}`).join("\n")
    : "(sem eventos registrados)";

  // Calcula ha quanto tempo o ticket esta aberto
  const openMinutes = Math.round((Date.now() - new Date(context.createdAt).getTime()) / 60_000);
  const openDuration = openMinutes < 60
    ? `${openMinutes} minutos`
    : openMinutes < 1440
      ? `${Math.round(openMinutes / 60)} horas`
      : `${Math.round(openMinutes / 1440)} dias`;

  return [
    "Voce e o assistente interno de uma equipe de suporte no Discord.",
    "Sua funcao e ajudar a EQUIPE a entender e resolver um atendimento.",
    "Voce NAO fala com o cliente e NAO executa acoes. Apenas orienta quem pediu.",
    "",
    `Atendimento #${context.ticketId}`,
    `Status: ${context.status} | Prioridade: ${context.priority} | Aberto ha: ${openDuration}`,
    `Departamento: ${context.department ?? "nao informado"}`,
    `Assunto: ${context.subject || "nao informado"}`,
    "",
    "--- Historico do atendimento ---",
    transcript,
    "",
    "--- Eventos do atendimento ---",
    eventBlock,
    "",
    "--- Dados das plataformas internas ---",
    sourceBlock,
    "",
    "Responda EXATAMENTE neste formato, em portugues do Brasil:",
    "ANALISE: um paragrafo objetivo explicando o problema provavel, o historico de interacoes e o que verificar.",
    "SUGESTOES: ate 3 linhas, cada uma comecando por '- ', com a melhor resposta ou proximo passo concreto.",
    "PRIORIDADE: uma palavra (baixa, media, alta, urgente) baseada no conteudo e tempo aberto.",
    "",
    "Seja direto e pratico. Se a informacao for insuficiente, diga o que falta saber em vez de inventar.",
    "Considere o tempo que o ticket esta aberto: quanto mais tempo, maior a urgencia de uma resposta."
  ].join("\n");
}

function parseModelOutput(text: string): { analysis: string; suggestions: string[]; priority: string } {
  const analysisMatch = /ANALISE:\s*([\s\S]*?)(?=\nSUGESTOES:|$)/i.exec(text);
  const suggestionsMatch = /SUGESTOES:\s*([\s\S]*?)(?=\nPRIORIDADE:|$)/i.exec(text);
  const priorityMatch = /PRIORIDADE:\s*(\w+)/i.exec(text);

  const analysis = (analysisMatch?.[1] ?? text).trim();
  const suggestions = (suggestionsMatch?.[1] ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
  const priority = (priorityMatch?.[1] ?? "media").toLowerCase();

  return { analysis, suggestions, priority };
}

export async function analyzeTicket(input: {
  ticketId: number;
  guildId: string;
  requestedBy: string;
}): Promise<AnalysisResult> {
  const context = await loadTicketContext(input.ticketId, input.guildId);
  if (!context) throw new Error("Atendimento nao encontrado.");

  const sources = await Promise.all(internalSources().map(consultSource));

  const result = await groqChat({
    model: qualityModel(),
    fallbackModel: fastModel(),
    temperature: 0.2,
    maxTokens: 1000,
    timeoutMs: 25_000,
    maxRetries: 2,
    purpose: "ticket_analysis",
    messages: [
      { role: "system", content: "Voce apoia uma equipe de suporte. Nunca fale como se fosse o atendente. Responda sempre em portugues do Brasil." },
      { role: "user", content: buildPrompt(context, sources) }
    ]
  });

  const { analysis, suggestions, priority } = parseModelOutput(result.text);

  await getPool().query(
    `insert into ai_analyses (guild_id, ticket_id, requested_by, model, context, analysis, suggestions)
     values ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)`,
    [
      input.guildId,
      input.ticketId,
      input.requestedBy,
      result.model,
      JSON.stringify({
        messageCount: context.messages.length,
        department: context.department,
        sources: sources.map((entry) => ({ name: entry.name, ok: entry.ok })),
        priority,
        retries: result.retries
      }),
      analysis,
      JSON.stringify(suggestions)
    ]
  );

  return { analysis, suggestions, model: result.model, sources, retries: result.retries };
}
