import { createServerFn } from "@tanstack/react-start";

type AnalyzeInput = {
  kind: "ticket" | "form";
  title: string;
  body: string;
  extra?: string;
};

/**
 * Analise de IA do painel — Groq (endpoint compativel com OpenAI).
 *
 * Antes isto procurava `XAI_API_KEY`, que nao existe neste ambiente: o painel
 * respondia "IA indisponivel" em toda analise. As credenciais reais do projeto
 * sao do Groq (`WUMPUS_GROQ_API_KEY` / `WUMPUS_GROQ_MODEL`).
 *
 * O bot usa o mesmo provedor em `src/bot/ai.ts`, para as duas pontas darem a
 * mesma resposta sobre o mesmo material.
 */
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM: Record<AnalyzeInput["kind"], string> = {
  ticket:
    "Você é o Wumpus, assistente de staff de Discord. Analise o atendimento e responda em português do Brasil, curto e operacional. Nunca invente fatos que não estejam no histórico. Estrutura: 1) Resumo em 2 linhas 2) Risco (baixo/médio/alto) 3) Próxima ação sugerida para a equipe 4) Tom sugerido na resposta. Não escreva a mensagem final pronta para o cliente se faltar contexto.",
  form:
    "Você é o Wumpus, revisor de candidaturas de staff. Responda em português do Brasil. Estrutura: 1) Qualidade das respostas 2) Sinais de risco (vazio, genérico, idade da conta se citada) 3) Recomendação: aprovar, pedir mais dados ou recusar 4) Motivo curto para o staff. Nunca envie isso ao candidato."
};

export const analyzeWithGrok = createServerFn({ method: "POST" })
  .validator((input: AnalyzeInput) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.WUMPUS_GROQ_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "IA indisponível neste ambiente." };
    }

    const model = process.env.WUMPUS_GROQ_MODEL || "openai/gpt-oss-120b";

    // Timeout: sem ele a rota pendura o painel quando o provedor nao responde.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          max_tokens: 700,
          temperature: 0.2,
          messages: [
            { role: "system", content: SYSTEM[data.kind] },
            {
              role: "user",
              content: `${data.title}\n\n${data.body}${data.extra ? `\n\nContexto extra:\n${data.extra}` : ""}`
            }
          ]
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        return { ok: false as const, error: `Falha na IA (${res.status}).` };
      }

      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = body.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) return { ok: false as const, error: "A IA não devolveu texto." };
      return { ok: true as const, text };
    } catch {
      return { ok: false as const, error: "Não foi possível falar com a IA." };
    } finally {
      clearTimeout(timer);
    }
  });
