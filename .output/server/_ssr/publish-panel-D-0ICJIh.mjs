import { r as createServerFn } from "./ssr.mjs";
import { o as getStoredSessionToken, r as SESSION_TOKEN_MAX_LENGTH } from "./session-token-CaBlZnli.mjs";
import { c as string, o as object, t as _enum } from "../_libs/zod.mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
import { B as requestPanelPublish, P as getPublishStatus } from "./router-DlyrBhH9.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/publish-panel-D-0ICJIh.js
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
var analyzeWithGrok = createServerFn({ method: "POST" }).validator((input) => analyzeInputSchema.parse(input)).handler(createSsrRpc("f34dffdf3ceb3926a04d3a357b73c5534a46b6db3875e1f151de016d002ca894"));
async function publishPanelAndWait(input) {
	const token = getStoredSessionToken();
	if (!token) throw new Error("Entre novamente com Discord para publicar este painel.");
	const request = await requestPanelPublish({ data: {
		token,
		...input
	} });
	for (let attempt = 0; attempt < 30; attempt++) {
		await new Promise((resolve) => window.setTimeout(resolve, 1e3));
		const result = (await getPublishStatus({ data: {
			token,
			guildId: input.guildId
		} })).find((row) => row.id === request.jobId);
		if (result && result.status !== "queued") return result;
	}
	return null;
}
function publishResultMessage(result) {
	if (!result) return "Pedido enviado ao bot; o resultado ainda não chegou.";
	if (result.status === "done") return `Publicado no canal "${result.channelRef}".`;
	if (result.status === "failed") return result.detail ?? "O bot não conseguiu publicar o painel.";
	return "O bot ainda está processando a publicação.";
}
//#endregion
export { publishPanelAndWait as n, publishResultMessage as r, analyzeWithGrok as t };
