import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import "../styles.css";

const APP_NAME = "Wumpus";

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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "description", content: "A central de comando da sua comunidade no Discord." },
      { name: "theme-color", content: "#f5f2ea" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/favicon.svg" },
    ],
  }),
  component: () => (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthProvider>
          <FigmaCaptureScript />
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
