import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { searchArticles } from "@/lib/wumpus/engine";
import { useModule, useWumpus } from "@/lib/wumpus/store";

export const Route = createFileRoute("/app/knowledge")({ component: KnowledgePage });

function KnowledgePage() {
  const gid = useWumpus((s) => s.activeGuildId);
  const allArticles = useWumpus((s) => s.articles);
  const articles = allArticles.filter((a) => a.guildId === gid);
  const add = useWumpus((s) => s.addArticle);
  const update = useWumpus((s) => s.updateArticle);
  const remove = useWumpus((s) => s.deleteArticle);
  const kcfg = useModule("knowledge");
  const updateConfig = useWumpus((s) => s.updateConfig);

  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const hits = useMemo(
    () => searchArticles(q, articles, Boolean(kcfg.config.requireApprovedArticles)),
    [q, articles, kcfg.config.requireApprovedArticles],
  );

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <h1 className="m-0 text-xl font-semibold tracking-tight">Inteligência</h1>
        <Card>
          <Label>Perguntar à base</Label>
          <Input
            className="mt-1"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Como recebo o produto?"
          />
          <ul className="mt-3 m-0 space-y-2 p-0">
            {(q ? hits : articles).map((a) => (
              <li key={a.id} className="rounded-xl bg-muted px-3 py-2">
                <div className="flex items-center gap-2">
                  <p className="m-0 text-sm font-medium">{a.title}</p>
                  {a.approved ? <Badge tone="ok">aprovado</Badge> : <Badge>rascunho</Badge>}
                </div>
                <p className="m-0 text-sm text-muted-foreground">{a.body}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => update(a.id, { approved: !a.approved })}>
                    {a.approved ? "Desaprovar" : "Aprovar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>
                    Remover
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="space-y-3">
          <h2 className="mt-0 text-base font-semibold">Novo artigo</h2>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Resposta aprovada" />
          <Button
            onClick={() => {
              if (!title.trim() || !body.trim()) return;
              add(title.trim(), body.trim(), []);
              setTitle("");
              setBody("");
            }}
          >
            Publicar
          </Button>
        </Card>
      </div>
      <Card className="h-fit space-y-4">
        <h2 className="mt-0 text-base font-semibold">Regras da base</h2>
        <p className="m-0 text-sm text-muted-foreground">
          A IA de ticket usa só artigos aprovados. Nunca responde sozinha no canal do cliente.
        </p>
        <div className="flex items-center justify-between">
          <Label>Só artigos aprovados</Label>
          <Switch
            checked={Boolean(kcfg.config.requireApprovedArticles)}
            onCheckedChange={(v) => updateConfig("knowledge", { requireApprovedArticles: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label>Sugerir no chat</Label>
          <Switch
            checked={Boolean(kcfg.config.autoSuggest)}
            onCheckedChange={(v) => updateConfig("knowledge", { autoSuggest: v })}
          />
        </div>
      </Card>
    </div>
  );
}
