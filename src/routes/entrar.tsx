import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { checkOwnerCredentials } from "@/lib/wumpus/owner-credentials";
import { useWumpus } from "@/lib/wumpus/store";

export const Route = createFileRoute("/entrar")({ component: EntrarPage });

function EntrarPage() {
  const hydrate = useWumpus((s) => s.hydrate);
  const hydrated = useWumpus((s) => s.hydrated);
  const signedIn = useWumpus((s) => s.sessionUser.signedIn);
  const signIn = useWumpus((s) => s.signIn);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && signedIn) navigate({ to: "/app" });
  }, [hydrated, signedIn, navigate]);

  if (!hydrated) {
    return <div className="grid min-h-dvh place-items-center text-muted-foreground">Carregando…</div>;
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-sm space-y-4">
        <BrandMark />
        <div>
          <h1 className="m-0 text-xl font-semibold">Entrar no painel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Área do dono. Tickets, forms, moderação e config ficam atrás desta senha.</p>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (checkOwnerCredentials(name, pass)) {
              signIn(name.trim() || "admin");
              navigate({ to: "/app" });
            } else {
              setError("Usuário ou senha incorretos.");
            }
          }}
        >
          <div>
            <Label>Usuário</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" />
          </div>
          <div>
            <Label>Senha</Label>
            <Input
              className="mt-1"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error ? <p className="m-0 text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>
        <Link to="/" className="text-sm text-muted-foreground">
          Voltar
        </Link>
      </Card>
    </main>
  );
}
