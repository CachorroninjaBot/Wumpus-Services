import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

if (process.env.DISCORD_TOKEN) {
  const bot = spawn(process.execPath, [join(root, "scripts", "bot.mjs")], {
    stdio: "inherit",
    env: process.env,
    cwd: root,
  });
  bot.on("exit", (code) => {
    if (code && code !== 0) console.error("[bot] saiu com código", code);
  });
} else {
  console.log("[bot] sem DISCORD_TOKEN — só o painel sobe.");
}

await import(join(root, ".output", "server", "index.mjs"));
