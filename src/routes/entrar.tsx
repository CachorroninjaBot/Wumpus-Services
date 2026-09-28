import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDiscordLoginUrl } from "@/lib/discord/oauth";

export const Route = createFileRoute("/entrar")({ component: EntrarPage });

function EntrarPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-sm space-y-4">
        <BrandMark />
        <div>
          <h1 className="m-0 text-xl font-semibold">Entrar no painel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Login oficial com a tua conta Discord. Só servidores que tu administra aparecem.</p>
        </div>
        <Button
          className="w-full"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void getDiscordLoginUrl().then((res) => {
              if (!res.ok) {
                setError(res.error);
                setBusy(false);
                return;
              }
              window.location.href = res.url;
            });
          }}
        >
          Entrar com Discord
        </Button>
        {error ? <p className="m-0 text-sm text-destructive">{error}</p> : null}
        <Link to="/" className="text-sm text-muted-foreground">
          Voltar
        </Link>
      </Card>
    </main>
  );
}
