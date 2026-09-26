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
const webRoot = path.resolve(here, "../web");
const port = Number(process.env.PORT ?? 80);
const host = "0.0.0.0";

/* ------------------------------------------------------------------ *
 * Logger customizado — formato limpo, uma linha por evento
 * ------------------------------------------------------------------ */

function ts(): string {
  return new Date().toLocaleString("pt-BR", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function logLine(level: string, msg: string, extra?: string): void {
  const prefix = level === "error" ? "❌" : level === "warn" ? "⚠️" : level === "bot" ? "🤖" : "▸";
  const line = extra ? `${prefix}  ${msg}  ${extra}` : `${prefix}  ${msg}`;
  console.log(`${ts()}  ${line}`);
}

/** Logger silencioso para o Fastify — não loga requests automaticamente */
const silentLogger = { level: "silent" } as const;

const app = Fastify({
  logger: silentLogger,
  trustProxy: true
});

// Impede o Cloudflare de injetar/modificar respostas (Rocket Loader, Auto Minify, beacon)
app.addHook("onSend", (_request, reply, _payload, done) => {
  const existing = String(reply.getHeader("Cache-Control") ?? "");
  if (!existing.includes("no-transform")) {
    reply.header("Cache-Control", existing ? `${existing}, no-transform` : "no-transform");
  }
  done();
});

/** Logger do bot — formato limpo com prefixo */
const botLog = {
  info: (message: string, extra?: Record<string, unknown>) => {
    const detail = extra ? Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(" · ") : "";
    logLine("bot", message, detail);
  },
  warn: (message: string, extra?: Record<string, unknown>) => {
    const detail = extra ? Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(" · ") : "";
    logLine("warn", `[BOT] ${message}`, detail);
  },
  error: (message: string, extra?: Record<string, unknown>) => {
    const detail = extra ? Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(" · ") : "";
    logLine("error", `[BOT] ${message}`, detail);
  }
};

/* ------------------------------------------------------------------ *
 * Log manual: apenas eventos importantes
 * ------------------------------------------------------------------ */

// Após registrar todas as rotas, adiciona um hook que loga apenas
// erros (4xx/5xx) e mutações (POST/PUT/PATCH/DELETE).
app.addHook("onResponse", (request, reply, done) => {
  const url = request.url ?? "";
  const method = request.method;
  const status = reply.statusCode;

  // Silencia assets, health, favicon
  if (url.startsWith("/assets/") || url === "/healthz" || url === "/favicon.ico") {
    done();
    return;
  }

  // Silencia GETs rotineiros (navegação, polling)
  if (method === "GET" && status < 400) {
    done();
    return;
  }

  // Erros
  if (status >= 400) {
    logLine("warn", `${method} ${url} → ${status}`, `${Math.round(reply.elapsedTime)}ms`);
  }
  // Auth e webhooks
  else if (url.startsWith("/auth/") || url.startsWith("/api/webhooks/")) {
    logLine("info", `${method} ${url} → ${status}`, `${Math.round(reply.elapsedTime)}ms`);
  }
  // Mutações (POST/PUT/PATCH/DELETE)
  else if (method !== "GET" && method !== "HEAD") {
    logLine("info", `${method} ${url} → ${status}`, `${Math.round(reply.elapsedTime)}ms`);
  }

  done();
});

await app.register(fastifyCookie, {
  secret: process.env.WUMPUS_SESSION_SECRET ?? ""
});
await app.register(fastifyStatic, {
  root: webRoot,
  wildcard: true,
  index: false,
  setHeaders(res, filePath) {
    // Assets com hash no nome: cache longo
    if (filePath.includes("/assets/")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
    }
    // HTML: sempre revalidar, sem transformação do Cloudflare
    else if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-transform, must-revalidate");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    }
  }
});

await registerRoutes(app);

app.get("/", async (_request, reply) => reply.redirect("/wumpus"));

app.get("/healthz", async () => ({
  status: "ok",
  service: brand.slug,
  version: brand.version
}));

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
  const url = request.raw.url ?? "";

  // API e auth: 404 limpo
  if (url.startsWith("/api") || url.startsWith("/auth")) {
    return reply.code(404).send({ error: "not_found" });
  }

  // Assets estáticos que não existem: 404 puro (não devolver index.html)
  if (url.startsWith("/assets/") || /\.(js|css|png|jpg|svg|woff2?|ico)$/.test(url)) {
    return reply.code(404).send("Not Found");
  }

  // POST/PUT/etc em rotas desconhecidas
  if (request.method !== "GET" && request.method !== "HEAD") {
    return reply.code(405).send({ error: "method_not_allowed" });
  }

  // SPA fallback — com headers anti-transformação pro Cloudflare não injetar scripts
  reply.header("Cache-Control", "no-cache, no-transform, must-revalidate");
  reply.header("X-Content-Type-Options", "nosniff");
  return reply.type("text/html; charset=utf-8").sendFile("index.html");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    logLine("info", `Encerrando (${signal})`);
    await stopBot().catch(() => undefined);
    await app.close();
    await closePool();
    process.exit(0);
  });
}

try {
  await migrate();
  logLine("info", "Banco de dados verificado");
  await app.listen({ port, host });
  logLine("info", `${brand.name} ${brand.version} ouvindo em :${port}`);
  startBot(botLog);

  startMetricsFlush(30_000);
  setInterval(() => { void purgeExpiredSessions().catch(() => undefined); }, 10 * 60_000);

  setInterval(async () => {
    const dbOk = await databaseHealthy();
    const bot = botStatus();
    const db = getPool();
    for (const svc of [
      { service: "database", status: dbOk ? "operational" : "offline", metadata: {} },
      { service: "bot", status: bot.running ? "operational" : "offline", metadata: { mode: bot.mode } },
      { service: "api", status: "operational", metadata: { uptime: Math.floor(process.uptime()) } }
    ]) {
      await db.query(
        `insert into service_health (service, status, metadata, last_heartbeat_at)
         values ($1, $2, $3::jsonb, now())
         on conflict (service) do update set status = excluded.status, metadata = excluded.metadata, last_heartbeat_at = now()`,
        [svc.service, svc.status, JSON.stringify(svc.metadata)]
      ).catch(() => undefined);
    }
  }, 2 * 60_000);
} catch (error) {
  logLine("error", "Falha ao iniciar", String(error));
  process.exit(1);
}