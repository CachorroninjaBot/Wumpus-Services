import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
//#region node_modules/.nitro/vite/services/ssr/assets/runtime.server-DWU5ehgX.js
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
			serverGroups: Array.isArray(parsed?.serverGroups) ? parsed.serverGroups : [],
			articles: parsed?.articles && typeof parsed.articles === "object" ? parsed.articles : {},
			outbox: Array.isArray(parsed?.outbox) ? parsed.outbox : []
		};
	} catch {
		return {
			updatedAt: 0,
			guilds: {},
			serverGroups: [],
			articles: {},
			outbox: []
		};
	}
}
async function readBotCollection(name) {
	try {
		const directory = process.env.WUMPUS_DATA_DIR || join(process.cwd(), "data");
		const parsed = JSON.parse(await readFile(join(directory, `${name}.json`), "utf8"));
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
async function writeBotCollection(name, rows) {
	const directory = process.env.WUMPUS_DATA_DIR || join(process.cwd(), "data");
	await mkdir(directory, { recursive: true });
	const path = join(directory, `${name}.json`);
	const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
	await writeFile(temporaryPath, JSON.stringify(rows, null, 2));
	await rename(temporaryPath, path);
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
//#endregion
export { writeRuntime as a, writeBotCollection as i, readBotCollection as n, readRuntime as r, enqueueOutbox as t };
