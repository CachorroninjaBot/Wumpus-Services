/**
 * Type-check no deploy — REPORTA sem derrubar.
 *
 * Por que nao falha o build: o `vite build` faz transpile sem checagem de
 * tipos, entao o projeto passou meses com o `npm test`/`check:auth` apontando
 * para arquivos inexistentes e nenhuma verificacao real acontecendo. Ligar o
 * `tsc` como bloqueante de uma vez derrubaria o deploy por erros acumulados —
 * e um deploy quebrado e pior que um erro de tipo visivel.
 *
 * Entao: roda o compilador, imprime TUDO e sai com 0 sempre. Os erros aparecem
 * no log do deploy (e o assistente consegue ler), e quando o projeto estiver
 * limpo da para trocar por bloqueante.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
const cacheDir = join(root, "node_modules", ".cache");
const buildInfo = join(cacheDir, "wumpus-typecheck.tsbuildinfo");

if (!existsSync(tsc)) {
  console.log("[tipos] Verificação ignorada: TypeScript não encontrado.");
  process.exit(0);
}

console.log("[tipos] Conferindo o código…");
mkdirSync(cacheDir, { recursive: true });

const result = spawnSync(process.execPath, [tsc, "--noEmit", "--incremental", "--tsBuildInfoFile", buildInfo], {
  cwd: root,
  encoding: "utf8",
  timeout: 180_000,
});

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();

if (output) {
  console.error(output);
}

if (result.error) {
  console.error(`[tipos] Não foi possível verificar: ${result.error.message}`);
  process.exit(0);
}

if (result.status === 0) {
  console.log("[tipos] Código sem erros de tipo.");
} else {
  // Contagem aproximada: cada erro comeca com "arquivo(linha,coluna): error".
  const errors = output.split("\n").filter((line) => line.includes("): error TS")).length;
  console.error(`[tipos] ${errors} problema(s) encontrado(s). O deploy segue; revise os detalhes acima.`);
}

process.exit(0);
