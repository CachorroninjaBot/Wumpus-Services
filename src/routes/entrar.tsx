import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { checkOwnerCredentials } from "@/lib/wumpus/owner-credentials";

const KEY = "wumpus-demo-v2";

export const Route = createFileRoute("/entrar")({ component: EntrarPage });

function persistOwnerSession(username: string) {
  if (typeof window === "undefined") return;
  let slice: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) slice = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    slice = {};
  }
  slice.sessionUser = {
    id: "u_owner",
    username: username.trim().toLowerCase() || "admin",
    globalName: username.trim() || "admin",
    isAdmin: true,
    signedIn: true,
  };
  localStorage.setItem(KEY, JSON.stringify(slice));
}

function EntrarPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-sm space-y-4">
        <BrandMark />
        <div>
          <h1 className="m-0 text-xl font-semibold">Entrar no painel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tickets, forms, moderação e config. Área do dono.</p>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!checkOwnerCredentials(name, pass)) {
              setError("Usuário ou senha incorretos.");
              return;
            }
            persistOwnerSession(name);
            navigate({ to: "/app" });
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
