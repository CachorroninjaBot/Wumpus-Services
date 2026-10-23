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
  console.log("[testes] Pasta de código não encontrada; verificação ignorada.");
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
  console.log("[testes] Nenhum teste cadastrado.");
  process.exit(0);
}

console.log(`[testes] Verificando ${files.length} arquivos…`);

// `--experimental-strip-types` porque os testes importam os modulos .ts do bot.
const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--test", "--test-concurrency=4", ...files],
  { cwd: root, encoding: "utf8", timeout: 120_000 }
);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();

if (result.error) {
  console.error(`[testes] Não foi possível executar: ${result.error.message}`);
  process.exit(0);
}

// O runner do Node imprime os totais como "# pass N" ou "ℹ pass N",
// dependendo da versao/terminal — aceitar os dois.
const pass = Number(output.match(/(?:#|ℹ)\s*pass\s+(\d+)/)?.[1] ?? 0);
const fail = Number(output.match(/(?:#|ℹ)\s*fail\s+(\d+)/)?.[1] ?? 0);

if (result.status === 0) {
  console.log(`[testes] ${pass} aprovados.`);
} else {
  console.error(`[testes] ${fail} falharam (${pass} aprovados).`);
  const failureStart = output.lastIndexOf("✖ failing tests:");
  const failureOutput = failureStart >= 0 ? output.slice(failureStart) : output;
  const failures = [...failureOutput.matchAll(/test at ([^\r\n]+)\r?\n✖ ([^\r\n]+?) \([^)]+\)/g)];

  for (const [index, match] of failures.entries()) {
    if (index >= 5) break;
    const blockStart = match.index ?? 0;
    const next = failures[index + 1]?.index ?? failureOutput.length;
    const block = failureOutput.slice(blockStart, next);
    const mismatch = block.match(/^\s*([^\s]+)\s*!==\s*([^\s]+)\s*$/m);
    const assertion = block.match(/AssertionError(?: \[[^\]]+\])?: ([^\r\n]+)/);
    console.error(`[falha] ${match[1]} — ${match[2]}`);
    if (mismatch) console.error(`[falha] Esperado ${mismatch[2]}; recebido ${mismatch[1]}.`);
    else if (assertion) console.error(`[falha] ${assertion[1]}`);
  }

  if (!failures.length) {
    const excerpt = failureOutput.split(/\r?\n/).filter(Boolean).slice(0, 10).join("\n");
    if (excerpt) console.error(excerpt);
  } else if (failures.length > 5) {
    console.error(`[falha] Mais ${failures.length - 5} falha(s) omitida(s).`);
  }

  console.error("[testes] O deploy segue; revise as falhas antes de publicar novas alterações.");
}

process.exit(0);
