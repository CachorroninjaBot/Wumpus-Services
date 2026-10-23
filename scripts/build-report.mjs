import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const viteCli = join(root, "node_modules", "vite", "bin", "vite.js");

console.log("[build] Gerando a dashboard…");
const result = spawnSync(process.execPath, [viteCli, "build", "--logLevel", "warn"], {
  cwd: root,
  encoding: "utf8",
  timeout: 300_000,
});

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();

if (result.error || result.status !== 0) {
  if (output) console.error(output);
  if (result.error) console.error(`[build] ${result.error.message}`);
  console.error("[build] Falhou. Veja os detalhes acima.");
  process.exit(result.status || 1);
}

if (output) console.log(output);
console.log("[build] Dashboard pronta.");
