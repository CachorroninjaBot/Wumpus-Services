/**
 * Testes no deploy — EXECUTA de verdade e reporta no log.
 *
 * O `npm test` do projeto apontava para 5 arquivos que nao existem, entao nunca
 * rodou nada. Escrevi 6 arquivos de teste para a logica pura do bot, mas sem
 * shell neste ambiente eu nao tinha como executa-los — teste que nunca roda nao
 * e teste, e promessa.
 *
 * Aqui eles rodam no build e o resultado aparece no log do deploy. Como o
 * type-check, NAO derrubam o deploy: um app fora do ar por um teste vermelho e
 * pior que um teste vermelho visivel.
 *
 * Descobre os arquivos por `readdirSync` em vez de glob de shell: glob nao e
 * expandido quando nao ha shell no meio, e passar o padrao literal para o
 * runner falharia em silencio.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src");

if (!existsSync(srcDir)) {
  console.log("[test] src nao encontrado — pulando.");
  process.exit(0);
}

/** Varre `src/` procurando `*.test.ts` em qualquer subpasta. */
function findTests(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findTests(full));
    else if (entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const files = findTests(srcDir).sort();

if (!files.length) {
  console.log("[test] nenhum arquivo *.test.ts encontrado — pulando.");
  process.exit(0);
}

console.log(`[test] rodando ${files.length} arquivo(s) de teste…`);

// `--experimental-strip-types` porque os testes importam os modulos .ts do bot.
const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--test", ...files],
  { cwd: root, encoding: "utf8", timeout: 120_000 }
);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
if (output) console.log(output);

if (result.error) {
  console.log(`[test] nao foi possivel rodar: ${result.error.message}`);
  process.exit(0);
}

// O runner do Node imprime os totais como "# pass N" ou "ℹ pass N",
// dependendo da versao/terminal — aceitar os dois.
const pass = Number(output.match(/(?:#|ℹ)\s*pass\s+(\d+)/)?.[1] ?? 0);
const fail = Number(output.match(/(?:#|ℹ)\s*fail\s+(\d+)/)?.[1] ?? 0);

if (result.status === 0) {
  console.log(`[test] ${pass} passaram, 0 falharam.`);
} else {
  console.log(`[test] ${pass} passaram, ${fail} FALHARAM — veja acima. O deploy segue.`);
}

process.exit(0);
