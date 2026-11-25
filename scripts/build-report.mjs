import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const viteCli = join(root, "node_modules", "vite", "bin", "vite.js");

/**
 * `--max-old-space-size` limita só a heap JS do processo principal. Boa parte
 * do pico vem da memória nativa (Rolldown/oxc, lightningcss) e das threads que
 * esses pools abrem, dimensionadas pelas CPUs visíveis — em container isso pode
 * ser bem mais do que o orçamento de RAM. `RAYON_NUM_THREADS`/`UV_THREADPOOL_SIZE`
 * contêm esse paralelismo, e o `NODE_OPTIONS` repassa um teto de heap aos
 * processos `node` filhos (Nitro), que não herdam a flag da linha de comando.
 */
const result = spawnSync(process.execPath, ["--max-old-space-size=384", viteCli, "build", "--logLevel", "error"], {
  cwd: root,
  encoding: "utf8",
  timeout: 300_000,
  env: {
    ...process.env,
    RAYON_NUM_THREADS: process.env.RAYON_NUM_THREADS ?? "2",
    UV_THREADPOOL_SIZE: process.env.UV_THREADPOOL_SIZE ?? "2",
    NODE_OPTIONS: [process.env.NODE_OPTIONS, "--max-old-space-size=768"].filter(Boolean).join(" "),
  },
});

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();

if (result.error || result.status !== 0) {
  if (output) {
    const lines = output.split(/\r?\n/);
    const details = lines.slice(-30).join("\n");
    console.error(details);
    if (lines.length > 30) console.error("[build] Saída reduzida às últimas 30 linhas.");
  }
  if (result.error) console.error(`[build] ${result.error.message}`);
  console.error("[build] Falhou. Veja os detalhes acima.");
  process.exit(result.status || 1);
}

console.log("[build] Dashboard pronta.");
