import { r as createServerFn } from "./ssr.mjs";
import { r as SESSION_TOKEN_MAX_LENGTH } from "./session-token-CaBlZnli.mjs";
import { c as string, o as object, t as _enum } from "../_libs/zod.mjs";
import { n as enforceRequestLimit, t as createServerRpc } from "./request-limits.server-D3WMs2Xr.mjs";
import { _ as requireGuildFeature } from "./session-access.server-BEsHDisY.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/analyze-Daj_d14P.js
var analyzeInputSchema = object({
	token: string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
	guildId: string().regex(/^\d{17,20}$/),
	kind: _enum(["ticket", "form"]),
	title: string().trim().min(1).max(200),
	body: string().max(12e3),
	extra: string().max(8e3).optional()
}).strict();
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
var ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
var SYSTEM = {
	ticket: "Você é o Wumpus, assistente de staff de Discord. Analise o atendimento e responda em português do Brasil, curto e operacional. Nunca invente fatos que não estejam no histórico. Estrutura: 1) Resumo em 2 linhas 2) Risco (baixo/médio/alto) 3) Próxima ação sugerida para a equipe 4) Tom sugerido na resposta. Não escreva a mensagem final pronta para o cliente se faltar contexto.",
	form: "Você é o Wumpus, revisor de candidaturas de staff. Responda em português do Brasil. Estrutura: 1) Qualidade das respostas 2) Sinais de risco (vazio, genérico, idade da conta se citada) 3) Recomendação: aprovar, pedir mais dados ou recusar 4) Motivo curto para o staff. Nunca envie isso ao candidato."
};
var analyzeWithGrok_createServerFn_handler = createServerRpc({
	id: "f34dffdf3ceb3926a04d3a357b73c5534a46b6db3875e1f151de016d002ca894",
	name: "analyzeWithGrok",
	filename: "src/lib/wumpus/analyze.ts"
}, (opts) => analyzeWithGrok.__executeServer(opts));
var analyzeWithGrok = createServerFn({ method: "POST" }).validator((input) => analyzeInputSchema.parse(input)).handler(analyzeWithGrok_createServerFn_handler, async ({ data }) => {
	const session = await requireGuildFeature(data.token, data.guildId, "ai");
	enforceRequestLimit("ai-analysis", 20, 6e5, session.userId);
	const apiKey = process.env.WUMPUS_GROQ_API_KEY;
	if (!apiKey) return {
		ok: false,
		error: "IA indisponível neste ambiente."
	};
	const model = process.env.WUMPUS_GROQ_MODEL || "openai/gpt-oss-120b";
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 2e4);
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
				temperature: .2,
				messages: [{
					role: "system",
					content: SYSTEM[data.kind]
				}, {
					role: "user",
					content: `${data.title}\n\n${data.body}${data.extra ? `\n\nContexto extra:\n${data.extra}` : ""}`
				}]
			}),
			signal: controller.signal
		});
		if (!res.ok) return {
			ok: false,
			error: `Falha na IA (${res.status}).`
		};
		const text = (await res.json()).choices?.[0]?.message?.content?.trim() ?? "";
		if (!text) return {
			ok: false,
			error: "A IA não devolveu texto."
		};
		return {
			ok: true,
			text
		};
	} catch {
		return {
			ok: false,
			error: "Não foi possível falar com a IA."
		};
	} finally {
		clearTimeout(timer);
	}
});
//#endregion
export { analyzeWithGrok_createServerFn_handler };
