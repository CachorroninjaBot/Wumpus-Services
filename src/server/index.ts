import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { botStatus, startBot, stopBot } from "../bot/index.js";
import { brand } from "../core/brand.js";
import { closePool, databaseHealthy, migrate } from "./db/index.js";
import { registerRoutes } from "./routes.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// dist/server/index.js -> dist/web (build do Vite)
const webRoot = path.resolve(here, "../web");
const port = Number(process.env.PORT ?? 80);
const host = "0.0.0.0";

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? "info" },
  trustProxy: true
});

/** Adapta o log do Fastify para a interface que o bot espera. */
const botLog = {
  info: (message: string, extra?: Record<string, unknown>) => app.log.info(extra ?? {}, message),
  error: (message: string, extra?: Record<string, unknown>) => app.log.error(extra ?? {}, message)
};

await app.register(fastifyCookie, {
  secret: process.env.WUMPUS_SESSION_SECRET ?? ""
});
await app.register(fastifyStatic, {
  root: webRoot,
  wildcard: false,
  index: false
});

await registerRoutes(app);

app.get("/", async (_request, reply) => reply.redirect("/wumpus"));

app.get("/healthz", async () => ({
  status: "ok",
  service: brand.slug,
  version: brand.version
}));

/**
 * `security` responde a pergunta que importa em producao: a protecao
 * anti-raid/anti-nuke esta de fato armada?
 */
app.get("/api/status", async () => {
  const bot = botStatus();
  return {
    service: brand.name,
    version: brand.version,
    stage: "prototype",
    database: (await databaseHealthy()) ? "connected" : "unavailable",
    bot: process.env.WUMPUS_DISCORD_TOKEN ? "configured" : "not_configured",
    botRunning: bot.running,
    botMode: bot.mode,
    security: bot.security,
    automod: bot.automod
  };
});

app.setNotFoundHandler((request, reply) => {
  if (request.raw.url?.startsWith("/api") || request.raw.url?.startsWith("/auth")) {
    return reply.code(404).send({ error: "not_found" });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return reply.code(405).send({ error: "method_not_allowed" });
  }
  return reply.type("text/html; charset=utf-8").sendFile("index.html");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    app.log.info(`recebido ${signal}, encerrando`);
    await stopBot().catch(() => undefined);
    await app.close();
    await closePool();
    process.exit(0);
  });
}

try {
  await migrate();
  app.log.info("schema do banco verificado");
  await app.listen({ port, host });
  app.log.info(`${brand.name} ${brand.version} ouvindo em http://${host}:${port}`);
  startBot(botLog);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
