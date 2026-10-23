import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const viteCli = join(root, "node_modules", "vite", "bin", "vite.js");

const result = spawnSync(process.execPath, ["--max-old-space-size=384", viteCli, "build", "--logLevel", "error"], {
  cwd: root,
  encoding: "utf8",
  timeout: 300_000,
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
