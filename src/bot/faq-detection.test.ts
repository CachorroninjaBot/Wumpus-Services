import assert from "node:assert/strict";
import { test } from "node:test";
import { faqQuestionSimilarity, isLikelyQuestion, meetsFaqThreshold, normalizeFaqQuestion, shouldRespondToKnowledgeMessage } from "./faq-detection.ts";

test("recognizes explicit and conversational Portuguese questions", () => {
  assert.equal(isLikelyQuestion("Como faço para abrir um ticket?"), true);
  assert.equal(isLikelyQuestion("Alguém sabe onde fica o formulário"), true);
  assert.equal(isLikelyQuestion("A equipe foi muito prestativa hoje"), false);
});

test("normalizes accents and ignores common filler words", () => {
  assert.equal(normalizeFaqQuestion("Como faço a configuração?"), "faco configuracao");
});

test("groups paraphrases by shared topic without matching unrelated questions", () => {
  assert.ok(faqQuestionSimilarity("Como abro um ticket de suporte?", "Como abrir ticket suporte") >= 0.5);
  assert.ok(faqQuestionSimilarity("Como recuperar minha conta?", "Qual o horário do evento?") < 0.5);
});

test("requires five repeats from at least three people before a FAQ suggestion", () => {
  assert.equal(meetsFaqThreshold(4, 3), false);
  assert.equal(meetsFaqThreshold(5, 2), false);
  assert.equal(meetsFaqThreshold(5, 3), true);
});

test("all-channel replies stay opt-in and only trigger on question-shaped messages", () => {
  const base = {
    inAnswerChannel: false,
    mentionRequired: false,
    mentioned: false,
    respondInAllChannels: false,
    mentionsElsewhere: false,
    content: "Como recupero minha conta?"
  };
  assert.equal(shouldRespondToKnowledgeMessage(base), false);
  assert.equal(shouldRespondToKnowledgeMessage({ ...base, respondInAllChannels: true }), true);
  assert.equal(shouldRespondToKnowledgeMessage({ ...base, respondInAllChannels: true, content: "A equipe é ótima" }), false);
  assert.equal(shouldRespondToKnowledgeMessage({ ...base, mentionsElsewhere: true, mentioned: true }), true);
});
