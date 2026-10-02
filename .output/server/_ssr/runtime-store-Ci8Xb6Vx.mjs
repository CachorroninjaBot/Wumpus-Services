import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
import { dirname, join } from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
//#region node_modules/.nitro/vite/services/ssr/assets/runtime-store-Ci8Xb6Vx.js
/**
* Acesso ao arquivo de runtime — SERVER-ONLY.
*
* O sufixo `.server.ts` e a convencao do TanStack Start para modulo que so
* pode rodar no servidor: o import-protection do build recusa que qualquer
* codigo de cliente chegue aqui. Isso importa porque este arquivo usa
* `node:fs`, que nao existe no navegador.
*
* O painel publica aqui; o bot (outro processo) le o mesmo arquivo.
*/
function runtimePath() {
	return process.env.WUMPUS_RUNTIME_PATH || join(process.cwd(), "data", "wumpus-runtime.json");
}
async function readRuntime() {
	try {
		const raw = await readFile(runtimePath(), "utf8");
		const parsed = JSON.parse(raw);
		return {
			updatedAt: Number(parsed?.updatedAt) || 0,
			guilds: parsed?.guilds && typeof parsed.guilds === "object" ? parsed.guilds : {},
			articles: parsed?.articles && typeof parsed.articles === "object" ? parsed.articles : {},
			outbox: Array.isArray(parsed?.outbox) ? parsed.outbox : []
		};
	} catch {
		return {
			updatedAt: 0,
			guilds: {},
			articles: {},
			outbox: []
		};
	}
}
/**
* Enfileira um pedido de publicacao.
*
* A fila e limitada: sem teto, um bot que nao sobe deixaria o arquivo crescer
* sem parar. Descarta os mais antigos ja concluidos primeiro, depois os
* pendentes mais velhos.
*/
async function enqueueOutbox(job) {
	const current = await readRuntime();
	current.outbox = [...current.outbox ?? [], job].slice(-100);
	current.updatedAt = Date.now();
	await writeRuntime(current);
}
async function writeRuntime(next) {
	const path = runtimePath();
	await mkdir(dirname(path), { recursive: true });
	const tmp = `${path}.tmp`;
	await writeFile(tmp, JSON.stringify(next, null, 2));
	await rename(tmp, path);
}
/**
* Ponte painel -> bot.
*
* O bot roda em outro processo e le `data/wumpus-runtime.json`. Estas server
* functions sao o unico caminho pelo qual o painel escreve esse arquivo.
*
* Estavam definidas e sem nenhum chamador: o painel salvava so no localStorage
* e o bot nunca via configuracao alguma. Era isso que tornava todo campo da
* dashboard decorativo.
*
* O acesso a disco vive em `runtime.server.ts` (server-only); aqui ficam apenas
* os wrappers chamaveis pelo cliente.
*/
var publishGuildRuntime_createServerFn_handler = createServerRpc({
	id: "30a37a9ee6e9b3f9bcacb568570cc71457d80b8808ca78d33d208fee7b93418f",
	name: "publishGuildRuntime",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => publishGuildRuntime.__executeServer(opts));
var publishGuildRuntime = createServerFn({ method: "POST" }).validator((input) => input).handler(publishGuildRuntime_createServerFn_handler, async ({ data }) => {
	const current = await readRuntime();
	current.guilds[data.guildId] = {
		...current.guilds[data.guildId],
		...data.modules,
		...data.name ? { name: data.name } : {}
	};
	if (data.articles) current.articles = {
		...current.articles,
		[data.guildId]: data.articles
	};
	current.updatedAt = Date.now();
	await writeRuntime(current);
	return {
		ok: true,
		updatedAt: current.updatedAt
	};
});
var requestPanelPublish_createServerFn_handler = createServerRpc({
	id: "b5230e82ec52d306c1c899b8f05536cf0e83719f5d257c240dc52d74cb23ad88",
	name: "requestPanelPublish",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => requestPanelPublish.__executeServer(opts));
var requestPanelPublish = createServerFn({ method: "POST" }).validator((input) => input).handler(requestPanelPublish_createServerFn_handler, async ({ data }) => {
	const job = {
		id: `out_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
		guildId: data.guildId,
		kind: "panel",
		target: data.target,
		channelRef: data.channelRef,
		createdAt: Date.now(),
		status: "queued"
	};
	await enqueueOutbox(job);
	return {
		ok: true,
		jobId: job.id
	};
});
var getPublishStatus_createServerFn_handler = createServerRpc({
	id: "b9a31d924c524dddaf890676d785aa8d2a8d9127a7a46441da06dd50c4eef0e6",
	name: "getPublishStatus",
	filename: "src/lib/wumpus/runtime-store.ts"
}, (opts) => getPublishStatus.__executeServer(opts));
var getPublishStatus = createServerFn({ method: "POST" }).validator((input) => input).handler(getPublishStatus_createServerFn_handler, async ({ data }) => {
	return ((await readRuntime()).outbox ?? []).filter((job) => job.guildId === data.guildId).slice(-20).map((job) => ({
		id: job.id,
		target: job.target,
		channelRef: job.channelRef,
		status: job.status,
		...job.detail ? { detail: job.detail } : {},
		...job.channelId ? { channelId: job.channelId } : {},
		...job.messageId ? { messageId: job.messageId } : {},
		createdAt: job.createdAt,
		...job.at ? { at: job.at } : {}
	}));
});
//#endregion
export { getPublishStatus_createServerFn_handler, publishGuildRuntime_createServerFn_handler, requestPanelPublish_createServerFn_handler };
