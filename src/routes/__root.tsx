import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import "../styles.css";

const APP_NAME = "Wumpus";
const PRELOAD_RETRY_KEY = "wumpus:preload-retry-at";
const PRELOAD_RETRY_WINDOW_MS = 30_000;

function AssetLoadRecovery() {
  useEffect(() => {
    const handlePreloadError = (event: Event) => {
      let lastRetryAt: number;
      try {
        lastRetryAt = Number(sessionStorage.getItem(PRELOAD_RETRY_KEY) ?? 0);
      } catch {
        return;
      }
      if (Date.now() - lastRetryAt < PRELOAD_RETRY_WINDOW_MS) return;

      try {
        sessionStorage.setItem(PRELOAD_RETRY_KEY, String(Date.now()));
      } catch {
        return;
      }

      event.preventDefault();
      window.location.reload();
    };

    window.addEventListener("vite:preloadError", handlePreloadError);
    const retryWindow = window.setTimeout(() => {
      try {
        sessionStorage.removeItem(PRELOAD_RETRY_KEY);
      } catch {
        // O navegador pode bloquear o armazenamento da sessão.
      }
    }, PRELOAD_RETRY_WINDOW_MS);

    return () => {
      window.removeEventListener("vite:preloadError", handlePreloadError);
      window.clearTimeout(retryWindow);
    };
  }, []);

  return null;
}

function FigmaCaptureScript() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.location.hash.includes("figmacapture=")) return;
    const script = document.createElement("script");
    script.src = "https://mcp.figma.com/mcp/html-to-design/capture.js";
    script.async = true;
    document.head.append(script);
    return () => script.remove();
  }, []);
  return null;
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: "A central de comando da sua comunidade no Discord." },
      { name: "theme-color", content: "#f5f2ea" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/favicon.svg" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthProvider>
          <AssetLoadRecovery />
          <FigmaCaptureScript />
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
