import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { exchangeDiscordCode } from "@/lib/discord/oauth";

const KEY = "wumpus-demo-v2";

export const Route = createFileRoute("/auth/discord/callback")({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code : "",
    error: typeof s.error === "string" ? s.error : "",
  }),
  component: CallbackPage,
});

function CallbackPage() {
  const { code, error } = Route.useSearch();
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Falando com o Discord…");

  useEffect(() => {
    if (error) {
      setMsg("Login cancelado no Discord.");
      return;
    }
    if (!code) {
      setMsg("Código ausente.");
      return;
    }
    void exchangeDiscordCode({ data: { code } }).then((res) => {
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      try {
        const raw = localStorage.getItem(KEY);
        const slice = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        slice.sessionUser = {
          id: res.user.id,
          username: res.user.username,
          globalName: res.user.globalName,
          isAdmin: true,
          signedIn: true,
        };
        slice.discordGuilds = res.guilds;
        localStorage.setItem(KEY, JSON.stringify(slice));
      } catch {
        /* quota */
      }
      navigate({ to: "/app" });
    });
  }, [code, error, navigate]);

  return <main className="grid min-h-dvh place-items-center bg-background text-muted-foreground">{msg}</main>;
}
