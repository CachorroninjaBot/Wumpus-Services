const STOPWORDS = new Set([
  "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "um", "uma",
  "para", "por", "com", "que", "como", "se", "no", "na", "nos", "nas", "ao", "aos",
  "the", "of", "is", "it", "to", "and", "my", "me", "eu", "meu", "minha", "tem",
  "voce", "voces", "posso", "quero", "fazer", "onde", "qual", "quais", "isso"
]);

export const FAQ_MIN_OCCURRENCES = 5;
export const FAQ_MIN_UNIQUE_USERS = 3;

export function meetsFaqThreshold(occurrences: number, uniqueUsers: number): boolean {
  return occurrences >= FAQ_MIN_OCCURRENCES && uniqueUsers >= FAQ_MIN_UNIQUE_USERS;
}

export function normalizeFaqQuestion(text: string): string {
  return text
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
    .join(" ");
}

export function isLikelyQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  if (/[?？]/.test(trimmed)) return true;
  const normalized = trimmed
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[\s.,!;:]+/, "");
  return /^(como|qual|quais|quem|quando|onde|porque|por que|o que|quanto|quantos|quantas|sera que|alguem sabe|tem como|da para|posso|consigo|poderia|pode)\b/.test(normalized);
}

export function shouldRespondToKnowledgeMessage(input: {
  inAnswerChannel: boolean;
  mentionRequired: boolean;
  mentioned: boolean;
  respondInAllChannels: boolean;
  mentionsElsewhere: boolean;
  content: string;
}): boolean {
  if (input.inAnswerChannel) return !input.mentionRequired || input.mentioned;
  if (input.respondInAllChannels && isLikelyQuestion(input.content)) return true;
  return input.mentionsElsewhere && input.mentioned;
}

export function faqQuestionSimilarity(left: string, right: string): number {
  const a = new Set(normalizeFaqQuestion(left).split(" ").filter(Boolean));
  const b = new Set(normalizeFaqQuestion(right).split(" ").filter(Boolean));
  if (!a.size || !b.size) return 0;
  const overlap = [...a].filter((word) => b.has(word)).length;
  return overlap / (a.size + b.size - overlap);
}
