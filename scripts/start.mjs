import { spawn } from "node:child_process";

if (process.env.DISCORD_TOKEN) {
  const bot = spawn(process.execPath, ["scripts/bot.mjs"], { stdio: "inherit", env: process.env });
  bot.on("exit", (code) => {
    if (code && code !== 0) console.error("[bot] saiu com código", code);
  });
} else {
  console.log("[bot] sem DISCORD_TOKEN — só o painel sobe.");
}

await import("../.output/server/index.mjs");
