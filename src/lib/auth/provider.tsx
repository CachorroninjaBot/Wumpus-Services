import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { heartbeatDashboardSession } from "@/lib/wumpus/session";

/**
 * App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
 *
 *   <AuthProvider><Outlet /></AuthProvider>
 *
 * Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
 * its `useSession()` works standalone — so this is a passthrough today. It's
 * kept as the single, stable mount point for any future client-side providers
 * (e.g. a toast or theme provider) without churning the root shell.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <SessionPresence />
      {children}
    </>
  );
}

function SessionPresence() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (!pathname.startsWith("/app") && pathname !== "/admin") return;
    const heartbeat = () => {
      if (document.visibilityState === "visible") {
        void heartbeatDashboardSession({ data: {} }).then((result) => {
          if (result.ok) return;
          localStorage.removeItem("wumpus-demo-v2");
          window.location.replace("/entrar?motivo=sessao-expirada");
        }).catch(() => undefined);
      }
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 60_000);
    return () => window.clearInterval(timer);
  }, [pathname]);

  return null;
}
