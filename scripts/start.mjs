import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

/**
 * O bot roda como processo separado do painel, de proposito: uma falha no bot
 * nao pode derrubar a dashboard. `src/bot/index.ts` e TypeScript e o Node 24
 * executa direto (type stripping nativo).
 */
const token = process.env.DISCORD_TOKEN || process.env.WUMPUS_DISCORD_TOKEN;

if (token) {
  const bot = spawn(process.execPath, [join(root, "src", "bot", "index.ts")], {
    stdio: "inherit",
    env: process.env,
    cwd: root,
  });
  bot.on("exit", (code) => {
    if (code && code !== 0) console.error("[bot] saiu com código", code);
  });
} else {
  console.log("[bot] sem token do Discord — só o painel sobe.");
}

await import(join(root, ".output", "server", "index.mjs"));
