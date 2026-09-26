import { Routes, type Client, type Message } from "discord.js";
import { getPool, recordAuditEvent } from "../server/db/index.js";
import { groqChat, qualityModel, fastModel } from "./llm.js";

/**
 * Base de conhecimento: respostas assistidas a partir de conteudo APROVADO.
 *
 * Regra que define o modulo: a resposta nasce SEMPRE de um artigo aprovado.
 * A IA, quando ligada, apenas reescreve esse artigo de forma mais natural —
 * nunca inventa nem completa com conhecimento proprio. Se nenhum artigo
 * servir, o bot fica quieto: e melhor nao responder do que responder errado.
 *
 * Diferente da IA de apoio a staff (que e interna e efemera), esta resposta e
 * publica por natureza — por isso a exigencia de artigo aprovado.
 */

type Logger = {
  info: (message: string, extra?: Record<string, unknown>) => void;
  error: (message: string, extra?: Record<string, unknown>) => void;
};

export type KnowledgeConfig = {
  answerChannelId?: string;
  useAi?: boolean;
  requireApprovedArticles?: boolean;
  suggestInAllChannels?: boolean;
  similarityThreshold?: number;
  maxArticlesPerSearch?: number;
  cooldownSeconds?: number;
  minQuestionLength?: number;
  includeArticleLink?: boolean;
};

type Article = {
  id: number;
  title: string;
  body: string;
  tags: string[];
  status: string;
};

const MIN_QUERY_CHARS = 12;
const MIN_SCORE = 3;
const MAX_ARTICLES = 25;
const REPLY_COOLDOWN_MS = 20_000;

/** Evita responder duas vezes a mesma pergunta seguida. */
const lastReply = new Map<string, number>();

/** Palavras sem valor de busca: sem isso, "como" casaria com tudo. */
const STOPWORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "de", "do", "da", "dos", "das", "em", "no", "na",
  "nos", "nas", "para", "por", "com", "sem", "que", "qual", "quais", "como", "quando",
  "onde", "porque", "porquê", "e", "ou", "se", "meu", "minha", "meu", "eu", "voce",
  "você", "tem", "ter", "ser", "esta", "está", "isso", "esse", "essa", "ao", "aos",
  "the", "of", "is", "are", "how", "what", "where", "why", "my"
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

async function loadArticles(guildId: string, onlyApproved: boolean): Promise<Article[]> {
  const result = await getPool().query<Article>(
    `select id, title, body, tags, status from knowledge_articles
     where guild_id = $1 ${onlyApproved ? "and status = 'approved'" : "and status <> 'archived'"}
     order by updated_at desc limit $2`,
    [guildId, MAX_ARTICLES]
  );
  return result.rows;
}

/**
 * Pontua cada artigo pela sobreposicao de termos.
 * Peso maior para titulo e tags: sao a intencao declarada do artigo.
 */
function scoreArticle(article: Article, terms: string[]): number {
  const title = article.title.toLowerCase();
  const body = article.body.toLowerCase();
  const tags = article.tags.map((tag) => tag.toLowerCase());

  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 3;
    if (tags.some((tag) => tag.includes(term))) score += 2;
    if (body.includes(term)) score += 1;
  }
  return score;
}

export function bestMatch(articles: Article[], question: string, minScore = MIN_SCORE): { article: Article; score: number } | null {
  const terms = tokenize(question);
  if (!terms.length) return null;

  let best: { article: Article; score: number } | null = null;
  for (const article of articles) {
    const score = scoreArticle(article, terms);
    if (!best || score > best.score) best = { article, score };
  }

  if (!best || best.score < minScore) return null;
  return best;
}

/** Reescreve o artigo de forma natural — usando SOMENTE o que o artigo diz. */
async function composeWithAi(article: Article, question: string): Promise<string | null> {
  try {
    const result = await groqChat({
      model: fastModel(),
      fallbackModel: qualityModel(),
      temperature: 0.3,
      maxTokens: 500,
      timeoutMs: 15_000,
      maxRetries: 1,
      purpose: "knowledge_rewrite",
      messages: [
        {
          role: "system",
          content:
            "Voce responde duvidas de membros usando SOMENTE o artigo fornecido. " +
            "Nunca acrescente informacao que nao esteja nele. Se o artigo nao responder " +
            "a pergunta, diga que a equipe vai ajudar. Seja breve e cordial, em portugues do Brasil."
        },
        {
          role: "user",
          content: `Pergunta do membro: ${question}\n\nArtigo aprovado "${article.title}":\n${article.body}`
        }
      ]
    });
    return result.text || null;
  } catch {
    return null;
  }
}

/**
 * Responde no canal configurado quando a pergunta casa com um artigo aprovado.
 * Qualquer falha e silenciosa do ponto de vista do membro: o pior caso e o bot
 * nao responder, nunca responder errado.
 */
export async function answerFromKnowledge(
  client: Client,
  message: Message,
  config: KnowledgeConfig,
  log: Logger
): Promise<void> {
  const guildId = message.guild?.id;
  const channelId = message.channelId;
  const content = message.content?.trim() ?? "";
  if (!guildId) return;

  const minLen = config.minQuestionLength ?? MIN_QUERY_CHARS;
  if (content.length < minLen) return;

  // Canal de respostas: se suggestInAllChannels, atua em qualquer canal.
  // Senão, só no canal configurado.
  const answerChannelId = typeof config.answerChannelId === "string" ? config.answerChannelId : "";
  const suggestEverywhere = config.suggestInAllChannels === true;
  if (!suggestEverywhere && (!answerChannelId || answerChannelId !== channelId)) return;
  // Se não sugerir em todos, precisa do canal configurado
  if (suggestEverywhere && !answerChannelId && !suggestEverywhere) return;

  const cooldownMs = (config.cooldownSeconds ?? 20) * 1000;
  const cooldownKey = `${guildId}:${channelId}`;
  if (Date.now() - (lastReply.get(cooldownKey) ?? 0) < cooldownMs) return;

  const onlyApproved = config.requireApprovedArticles !== false;
  const articles = await loadArticles(guildId, onlyApproved).catch(() => [] as Article[]);
  const minScore = config.similarityThreshold ? Math.round(config.similarityThreshold * 5) : MIN_SCORE;
  const match = bestMatch(articles, content, minScore);
  if (!match) return;

  lastReply.set(cooldownKey, Date.now());

  const useAi = config.useAi !== false;
  const aiAnswer = useAi ? await composeWithAi(match.article, content) : null;
  const includeLink = config.includeArticleLink !== false;

  const body = aiAnswer ?? match.article.body;
  const reply = [
    aiAnswer ? body : `**${match.article.title}**\n${body}`,
    "",
    `-# Base de conhecimento · artigo #${match.article.id}${aiAnswer ? " · resposta assistida por IA" : ""}${includeLink ? "" : ""}`
  ]
    .join("\n")
    .slice(0, 1_900);

  try {
    await client.rest.post(Routes.channelMessages(channelId), {
      body: {
        content: reply,
        message_reference: { message_id: message.id }
      }
    });
  } catch (error) {
    log.error("falha ao responder pela base de conhecimento", { error: String(error) });
    return;
  }

  await recordAuditEvent({
    guildId,
    module: "knowledge",
    eventType: "knowledge_answered",
    actorId: message.author.id,
    channelId,
    severity: "info",
    data: {
      articleId: match.article.id,
      score: match.score,
      usedAi: Boolean(aiAnswer),
      questionLength: content.length
    }
  }).catch(() => undefined);

  log.info("respondeu pela base de conhecimento", {
    guildId,
    articleId: match.article.id,
    score: match.score,
    usedAi: Boolean(aiAnswer)
  });
}
