import { getPool } from "../server/db/index.js";

/**
 * IA de apoio interno da equipe.
 *
 * Regra de produto, e o motivo desta API nao ter nenhum metodo de envio:
 * a IA NUNCA responde no canal nem executa acao no Discord. Ela produz uma
 * analise e sugestoes que aparecem apenas para quem pediu (resposta efemera).
 * A decisao e sempre humana.
 */

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 20_000;
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
    // A consulta veio em ordem decrescente; devolvemos em ordem cronologica.
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

  return [
    "Voce e o assistente interno de uma equipe de suporte no Discord.",
    "Sua funcao e ajudar a EQUIPE a entender e resolver um atendimento.",
    "Voce NAO fala com o cliente e NAO executa acoes. Apenas orienta quem pediu.",
    "",
    `Atendimento #${context.ticketId} · status ${context.status} · prioridade ${context.priority}`,
    `Departamento: ${context.department ?? "nao informado"}`,
    `Assunto: ${context.subject || "nao informado"}`,
    "",
    "Historico do atendimento:",
    transcript,
    "",
    "Dados das plataformas internas:",
    sourceBlock,
    "",
    "Responda EXATAMENTE neste formato, em portugues do Brasil:",
    "ANALISE: um paragrafo objetivo explicando o problema provavel e o que verificar.",
    "SUGESTOES: ate 3 linhas, cada uma comecando por '- ', com a melhor resposta ou proximo passo.",
    "",
    "Se a informacao for insuficiente, diga o que falta saber em vez de inventar."
  ].join("\n");
}

function parseModelOutput(text: string): { analysis: string; suggestions: string[] } {
  const analysisMatch = /ANALISE:\s*([\s\S]*?)(?=\nSUGESTOES:|$)/i.exec(text);
  const suggestionsMatch = /SUGESTOES:\s*([\s\S]*)$/i.exec(text);

  const analysis = (analysisMatch?.[1] ?? text).trim();
  const suggestions = (suggestionsMatch?.[1] ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);

  return { analysis, suggestions };
}

export async function analyzeTicket(input: {
  ticketId: number;
  guildId: string;
  requestedBy: string;
}): Promise<AnalysisResult> {
  const apiKey = process.env.WUMPUS_GROQ_API_KEY;
  const model = process.env.WUMPUS_GROQ_MODEL ?? "openai/gpt-oss-120b";
  if (!apiKey) throw new Error("WUMPUS_GROQ_API_KEY nao esta configurada.");

  const context = await loadTicketContext(input.ticketId, input.guildId);
  if (!context) throw new Error("Atendimento nao encontrado.");

  const sources = await Promise.all(internalSources().map(consultSource));

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        { role: "system", content: "Voce apoia uma equipe de suporte. Nunca fale como se fosse o atendente." },
        { role: "user", content: buildPrompt(context, sources) }
      ]
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Provedor de IA respondeu ${response.status}: ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = payload.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Resposta da IA sem conteudo.");

  const { analysis, suggestions } = parseModelOutput(raw);

  await getPool().query(
    `insert into ai_analyses (guild_id, ticket_id, requested_by, model, context, analysis, suggestions)
     values ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)`,
    [
      input.guildId,
      input.ticketId,
      input.requestedBy,
      model,
      JSON.stringify({
        messageCount: context.messages.length,
        department: context.department,
        sources: sources.map((entry) => ({ name: entry.name, ok: entry.ok }))
      }),
      analysis,
      JSON.stringify(suggestions)
    ]
  );

  return { analysis, suggestions, model, sources };
}
