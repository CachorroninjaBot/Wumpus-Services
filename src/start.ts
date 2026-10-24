import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

const csrfMiddleware = createCsrfMiddleware({ filter: (context) => context.handlerType === "serverFn" });

const securityHeaders = createMiddleware().server(async ({ next }) => {
  setResponseHeader("X-Content-Type-Options", "nosniff");
  setResponseHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  setResponseHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  setResponseHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  setResponseHeader(
    "Content-Security-Policy",
    "base-uri 'self'; object-src 'none'; frame-ancestors 'self' https://discord.com https://*.discord.com https://discordapp.com https://*.discordapp.com https://*.discordsays.com",
  );
  if (process.env.NODE_ENV === "production") {
    setResponseHeader("Strict-Transport-Security", "max-age=31536000");
  }
  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, securityHeaders],
}));
