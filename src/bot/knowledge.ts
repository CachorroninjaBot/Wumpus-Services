/**
 * Base de conhecimento.
 *
 * O painel tem a aba "Inteligencia" desde sempre, com artigos, tags e o botao
 * de aprovar. O bot nunca leu nada disso: nao havia caminho de codigo. Este
 * modulo fecha esse lado.
 *
 * Os artigos chegam pelo runtime (`articles[guildId]`), publicados junto com a
 * config. Busca e local — sem IA — e so depois de achar material relevante o
 * modelo entra, para escrever a resposta. Sem material, o bot fica calado:
 * responder sem base e como inventar.
 */
import type { Guild, Message } from "discord.js";
import { analyzeWithContext, fastModel, groqChat } from "./ai.ts";
import { bool, isEnabled, list, moduleConfig, num, str } from "./config.ts";
import { auditAndLog } from "./logs.ts";
import type { Logger } from "./logger.ts";
import { asSendable, resolveChannel, resolveRoles } from "./resolve.ts";
import { readRuntime } from "./runtime.ts";

export type KnowledgeArticle = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  approved: boolean;
};

export type SearchHit = { article: KnowledgeArticle; score: number };

const STOPWORDS = new Set([
  "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "um", "uma",
  "para", "por", "com", "que", "como", "se", "no", "na", "nos", "nas", "ao", "aos",
  "the", "of", "is", "it", "to", "and", "my", "me", "eu", "meu", "minha", "tem",
  "voce", "vocês", "você", "posso", "quero", "fazer", "onde", "qual", "quais"
]);

/** Normaliza e remove acentos: "configuração" e "configuracao" devem casar. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

/**
 * Pontua um artigo contra a pergunta.
 *
 * Peso maior no titulo e nas tags: quem pergunta "como abrir ticket" quer o
 * artigo chamado "Como abrir um ticket", nao um que cite a palavra de passagem.
 */
export function scoreArticle(article: KnowledgeArticle, query: string[]): number {
  if (!query.length) return 0;

  const title = new Set(tokens(article.title));
  const tags = new Set(article.tags.flatMap((tag) => tokens(tag)));
  const body = new Set(tokens(article.body));

  let hits = 0;
  for (const word of query) {
    if (title.has(word)) hits += 3;
    else if (tags.has(word)) hits += 2;
    else if (body.has(word)) hits += 1;
  }

  return hits / (query.length * 3);
}

/** Artigos aprovados do servidor, direto do runtime publicado. */
export async function loadArticles(guildId: string): Promise<KnowledgeArticle[]> {
  const runtime = await readRuntime();
  const rows = runtime.articles?.[guildId];
  return Array.isArray(rows) ? rows : [];
}

/**
 * Busca na base. `requireApproved` vem da config: com ele ligado, artigo nao
 * aprovado nao existe para o bot.
 */
export async function searchArticles(
  guildId: string,
  question: string,
  options: { limit?: number; minScore?: number; requireApproved?: boolean } = {}
): Promise<SearchHit[]> {
  const articles = await loadArticles(guildId);
  const query = tokens(question);

  return articles
    .filter((article) => (options.requireApproved === false ? true : article.approved))
    .map((article) => ({ article, score: scoreArticle(article, query) }))
    .filter((hit) => hit.score >= (options.minScore ?? 0.25))
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 5);
}

/**
 * Responde uma pergunta usando a base.
 *
 * Sem material relevante, devolve `null` — o bot nao chuta. Se a config definir
 * uma mensagem de fallback, ela e enviada por quem chamou.
 */
export async function answerQuestion(
  guild: Guild,
  question: string,
  log: Logger
): Promise<{ text: string; usedArticleIds: string[] } | null> {
  const config = await moduleConfig(guild.id, "knowledge");
  if (!isEnabled(config)) return null;
  if (!bool(config, "useAi", true)) return null;

  const minLength = Math.trunc(num(config, "minQuestionLength", 12));
  if (question.trim().length < minLength) return null;

  const hits = await searchArticles(guild.id, question, {
    limit: Math.max(1, Math.trunc(num(config, "maxArticlesPerSearch", 5))),
    minScore: num(config, "similarityThreshold", 0.6),
    requireApproved: bool(config, "requireApprovedArticles", true)
  });

  if (!hits.length) {
    log.info("sem material na base para a pergunta", { guildId: guild.id });
    return null;
  }

  const context = hits
    .map((hit, index) => `[${index + 1}] ${hit.article.title}\n${hit.article.body}`)
    .join("\n\n");

  const task = [
    "Responda a pergunta do membro usando APENAS o material abaixo.",
    "Se o material nao bastar, diga o que falta e sugira abrir um atendimento.",
    "Maximo de 5 linhas, tom direto e cordial.",
    "Nao mencione numeros de referencia como [1] na resposta."
  ].join(" ");

  const text = await analyzeWithContext({
    task,
    context: `Pergunta: ${question}\n\nMaterial da base:\n${context}`,
    maxTokens: 400
  });

  if (!text) return null;

  if (bool(config, "logSearches", false)) {
    await auditAndLog(
      guild,
      {
        module: "knowledge",
        category: "messages",
        eventType: "knowledge_answered",
        severity: "info",
        title: "RESPOSTA DA BASE",
        description: `Pergunta respondida com ${hits.length} artigo(s).`,
        accentColor: "#3ecf8e",
        fields: [
          { name: "Pergunta", value: question.slice(0, 500) },
          { name: "Artigos", value: hits.map((hit) => hit.article.title).join(", ").slice(0, 500) }
        ]
      },
      log
    );
  }

  return { text, usedArticleIds: hits.map((hit) => hit.article.id) };
}

/** O bot deve responder nesta mensagem? */
export async function shouldAnswer(guild: Guild, message: Message): Promise<boolean> {
  const config = await moduleConfig(guild.id, "knowledge");
  if (!isEnabled(config)) return false;

  const answerChannel = resolveChannel(guild, str(config, "answerChannelId"));
  const inChannel = Boolean(answerChannel && answerChannel.id === message.channelId);
  const mentioned = message.mentions.users.has(guild.client.user!.id);

  if (bool(config, "mentionRequired", false)) return mentioned;
  if (bool(config, "suggestInAllChannels", false)) return mentioned || inChannel;
  return inChannel || mentioned;
}

/** Ponto de entrada do modulo a partir de uma mensagem. */
export async function handleKnowledgeMessage(message: Message, log: Logger): Promise<void> {
  const guild = message.guild;
  if (!guild || message.author.bot || !message.content) return;

  if (!(await shouldAnswer(guild, message))) return;

  // Pergunta e o texto sem a mencao ao bot.
  const question = message.content.replace(/<@!?\d+>/g, "").trim();
  if (!question) return;

  const config = await moduleConfig(guild.id, "knowledge");
  const cooldownSeconds = Math.trunc(num(config, "cooldownSeconds", 20));
  if (!claimCooldown(message.author.id, cooldownSeconds)) return;

  const typing = asSendable(message.channel);
  if (typing?.sendTyping) await typing.sendTyping().catch(() => undefined);

  const result = await answerQuestion(guild, question, log);

  if (!result) {
    const fallback = str(config, "fallbackMessage");
    if (fallback) await message.reply(fallback.slice(0, 2000)).catch(() => undefined);
    return;
  }

  const includeLink = bool(config, "includeArticleLink", true);
  const footer = includeLink && result.usedArticleIds.length
    ? `\n-# Base: ${result.usedArticleIds.length} artigo(s) da base do servidor.`
    : "";

  await message.reply({ content: `${result.text}${footer}`.slice(0, 2000) }).catch(() => undefined);

  log.info("resposta da base enviada", {
    guildId: guild.id,
    userId: message.author.id,
    articles: result.usedArticleIds.length
  });
}

/** Cooldown por usuario: evita que uma pergunta repetida vire varias chamadas de IA. */
const cooldowns = new Map<string, number>();

function claimCooldown(userId: string, seconds: number): boolean {
  if (seconds <= 0) return true;
  const now = Date.now();
  const last = cooldowns.get(userId);

  if (last && now - last < seconds * 1000) return false;

  cooldowns.set(userId, now);

  // Poda: sem isso o mapa cresce com todo mundo que ja perguntou algo.
  if (cooldowns.size > 2_000) {
    for (const [key, at] of cooldowns) {
      if (now - at > seconds * 1000) cooldowns.delete(key);
    }
  }

  return true;
}

/**
 * Rascunho de resposta para o staff (nunca enviado ao cliente).
 * Usa o modelo rapido: e sugestao, nao decisao.
 */
export async function draftReply(
  guild: Guild,
  history: string,
  staffRoles: string[]
): Promise<string | null> {
  const config = await moduleConfig(guild.id, "knowledge");
  if (!isEnabled(config)) return null;

  const model = bool(config, "preferFastModel", true) ? fastModel() : undefined;

  return groqChat(
    [
      {
        role: "system",
        content: [
          "Voce e o Wumpus, assistente de staff de Discord.",
          "Escreva um RASCUNHO de resposta para o membro, em portugues do Brasil.",
          "Curto, cordial, sem prometer o que nao esta no historico.",
          "Isto e sugestao para o staff revisar — nunca vai direto ao membro."
        ].join(" ")
      },
      { role: "user", content: `Historico do atendimento:\n${history}` }
    ],
    { model, maxTokens: 400, noCache: true }
  );
}
