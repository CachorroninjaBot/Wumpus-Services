import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

const PRELOAD_RETRY_KEY = "wumpus:preload-retry-at";
const PRELOAD_RETRY_WINDOW_MS = 30_000;

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
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
  });

  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(PRELOAD_RETRY_KEY);
    } catch {
      // O navegador pode bloquear o armazenamento da sessão.
    }
  }, PRELOAD_RETRY_WINDOW_MS);
}

export function getRouter() {
  return createRouter({ routeTree, defaultErrorComponent: AppErrorComponent });
}
