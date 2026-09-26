import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { botStatus, startBot, stopBot } from "../bot/index.js";
import { brand } from "../core/brand.js";
import { closePool, databaseHealthy, getPool, migrate } from "./db/index.js";
import { registerRoutes } from "./routes.js";
import { startMetricsFlush, flushMetrics } from "./metrics.js";
import { purgeExpiredSessions } from "./db/sessions.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// dist/server/index.js -> dist/web (build do Vite)
const webRoot = path.resolve(here, "../web");
const port = Number(process.env.PORT ?? 80);
const host = "0.0.0.0";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    serializers: {
      req(request) {
        return { method: request.method, url: request.url };
      },
      res(reply) {
        return { statusCode: reply.statusCode };
      }
    }
  },
  trustProxy: true
});

/** Adapta o log do Fastify para a interface que o bot espera. */
const botLog = {
  info: (message: string, extra?: Record<string, unknown>) => app.log.info(extra ?? {}, `[BOT] ${message}`),
  warn: (message: string, extra?: Record<string, unknown>) => app.log.warn(extra ?? {}, `[BOT] ${message}`),
  error: (message: string, extra?: Record<string, unknown>) => app.log.error(extra ?? {}, `[BOT] ${message}`)
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

  // Flush periódico de métricas (a cada 30s)
  startMetricsFlush(30_000);

  // Limpeza de sessões expiradas (a cada 10 min)
  setInterval(() => { void purgeExpiredSessions().catch(() => undefined); }, 10 * 60_000);

  // Heartbeat de serviços (a cada 2 min)
  setInterval(async () => {
    const dbOk = await databaseHealthy();
    const bot = botStatus();
    const services = [
      { service: "database", status: dbOk ? "operational" : "offline", metadata: {} },
      { service: "bot", status: bot.running ? "operational" : "offline", metadata: { mode: bot.mode, security: bot.security, automod: bot.automod } },
      { service: "api", status: "operational", metadata: { uptime: Math.floor(process.uptime()) } }
    ];
    const db = getPool();
    for (const svc of services) {
      await db.query(
        `insert into service_health (service, status, metadata, last_heartbeat_at)
         values ($1, $2, $3::jsonb, now())
         on conflict (service) do update set status = excluded.status, metadata = excluded.metadata, last_heartbeat_at = now()`,
        [svc.service, svc.status, JSON.stringify(svc.metadata)]
      ).catch(() => undefined);
    }
  }, 2 * 60_000);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
