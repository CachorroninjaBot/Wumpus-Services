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
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsc = join(root, "node_modules", "typescript", "bin", "tsc");

if (!existsSync(tsc)) {
  console.log("[typecheck] typescript nao encontrado — pulando.");
  process.exit(0);
}

console.log("[typecheck] rodando tsc --noEmit…");

const result = spawnSync(process.execPath, [tsc, "--noEmit"], {
  cwd: root,
  encoding: "utf8",
  timeout: 180_000,
});

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();

if (output) {
  console.log(output);
}

if (result.error) {
  console.log(`[typecheck] nao foi possivel rodar: ${result.error.message}`);
  process.exit(0);
}

if (result.status === 0) {
  console.log("[typecheck] sem erros de tipo.");
} else {
  // Contagem aproximada: cada erro comeca com "arquivo(linha,coluna): error".
  const errors = output.split("\n").filter((line) => line.includes("): error TS")).length;
  console.log(`[typecheck] ${errors} erro(s) de tipo — veja acima. O deploy segue.`);
}

process.exit(0);
