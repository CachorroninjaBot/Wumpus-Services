import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DiscordModalPreview, DiscordPanel } from "@/components/discord-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDesc, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { analyzeWithGrok } from "@/lib/wumpus/analyze";
import { asString, planAllows } from "@/lib/wumpus/engine";
import { uid } from "@/lib/utils";
import { useActiveGuild, useGuildMembers, useModule, useWumpus, type FormFieldConfig } from "@/lib/wumpus/store";
import { formatRelative } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/forms")({ component: FormsPage });

function FormsPage() {
  const gid = useWumpus((s) => s.activeGuildId);
  const questionsMap = useWumpus((s) => s.formQuestions);
  const questions = questionsMap[gid] ?? [];
  const setQuestions = useWumpus((s) => s.setQuestions);
  const allSubs = useWumpus((s) => s.submissions);
  const submissions = allSubs.filter((x) => x.guildId === gid);
  const members = useGuildMembers();
  const fcfg = useModule("forms");
  const updateConfig = useWumpus((s) => s.updateConfig);
  const setEnabled = useWumpus((s) => s.setModuleEnabled);
  const submitForm = useWumpus((s) => s.submitForm);
  const reviewForm = useWumpus((s) => s.reviewForm);
  const setAiNote = useWumpus((s) => s.setSubmissionAiNote);
  const user = useWumpus((s) => s.sessionUser);
  const guild = useActiveGuild();
  const publishPanel = useWumpus((s) => s.publishPanel);
  const formsAllowed = planAllows(guild.plan, "forms");
  const aiAllowed = planAllows(guild.plan, "ai") && Boolean(fcfg.config.useAiPreReview);

  // Campos do formulário: a fonte de verdade é `config.fields` — o mesmo que o
  // bot lê. O fallback converte a lista antiga de perguntas, para não perder
  // quem já tinha configurado antes desta versão.
  const storedFields = Array.isArray(fcfg.config.fields) ? (fcfg.config.fields as FormFieldConfig[]) : [];
  const fields: FormFieldConfig[] = storedFields.length
    ? storedFields
    : questions.map((q) => ({
        id: q.id,
        label: q.label,
        type: "paragraph" as const,
        required: q.required,
        options: [],
        maxLength: 500,
      }));
  const setFields = useWumpus((s) => s.setFormFields);
  const patchField = (id: string, patch: Partial<FormFieldConfig>) =>
    setFields(fields.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  const removeField = (id: string) => setFields(fields.filter((field) => field.id !== id));
  const addField = () =>
    setFields([
      ...fields,
      { id: uid("f"), label: "Nova pergunta", type: "paragraph", required: true, options: [], maxLength: 500 },
    ]);

  const [selected, setSelected] = useState(submissions.find((s) => s.status === "pending")?.id ?? submissions[0]?.id);
  const [reason, setReason] = useState("");
  const [sim, setSim] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const sub = submissions.find((s) => s.id === selected) ?? null;
  const pending = submissions.filter((s) => s.status === "pending").length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto m-0 text-xl font-semibold tracking-tight">Candidaturas</h1>
        <Badge tone="warn">{pending} na fila</Badge>
        <Button size="sm" onClick={() => setSim(true)} disabled={!formsAllowed}>
          Simular envio
        </Button>
      </div>
      {!formsAllowed ? (
        <p className="m-0 rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn">
          Plano Essencial inclui candidatura. Se o envio falhar, a ShardPay é quem trava a licença.
        </p>
      ) : null}

      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">Caixa</TabsTrigger>
          <TabsTrigger value="form">Formulário</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
            <Card className="p-2">
              {submissions.map((s) => {
                const who = members.find((m) => m.id === s.userId);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelected(s.id);
                      setReason(s.reason);
                    }}
                    className={`flex w-full flex-col rounded-xl px-3 py-2.5 text-left ${sub?.id === s.id ? "bg-muted" : "hover:bg-muted/50"}`}
                  >
                    <span className="text-sm font-medium">{who?.displayName ?? s.userId}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(s.createdAt)} · {s.status}
                    </span>
                  </button>
                );
              })}
              {submissions.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Nenhuma candidatura ainda.</p>
              ) : null}
            </Card>
            {sub ? (
              <Card>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="m-0 text-lg font-semibold">
                    {members.find((m) => m.id === sub.userId)?.displayName}
                  </h2>
                  <Badge
                    tone={sub.status === "approved" ? "ok" : sub.status === "rejected" ? "danger" : "warn"}
                  >
                    {sub.status}
                  </Badge>
                </div>
                <dl className="mt-4 space-y-3">
                  {questions.map((q) => (
                    <div key={q.id}>
                      <dt className="text-xs text-muted-foreground">{q.label}</dt>
                      <dd className="m-0 text-sm">{sub.answers[q.id] || "—"}</dd>
                    </div>
                  ))}
                </dl>
                {sub.aiNote ? (
                  <p className="mt-4 rounded-xl bg-primary/10 px-3 py-2 text-sm whitespace-pre-wrap">{sub.aiNote}</p>
                ) : null}
                {sub.status === "pending" ? (
                  <div className="mt-4 space-y-3">
                    <Label>Motivo (obrigatório na recusa)</Label>
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          const r = reviewForm(sub.id, "approved", reason, user.id);
                          if (!r.ok) alert(r.error);
                        }}
                      >
                        Aprovar
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          const r = reviewForm(sub.id, "rejected", reason, user.id);
                          if (!r.ok) alert(r.error);
                        }}
                      >
                        Recusar
                      </Button>
                      {aiAllowed ? (
                        <Button
                          variant="outline"
                          disabled={aiBusy}
                          onClick={async () => {
                            setAiBusy(true);
                            const body = questions
                              .map((q) => `${q.label}: ${sub.answers[q.id] ?? ""}`)
                              .join("\n");
                            const res = await analyzeWithGrok({
                              data: { kind: "form", title: "Candidatura", body },
                            });
                            setAiBusy(false);
                            setAiNote(sub.id, res.ok ? res.text : res.error);
                          }}
                        >
                          {aiBusy ? "Revisando…" : "Pré-review com IA"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    {sub.reason || "Sem motivo registrado."}
                  </p>
                )}
              </Card>
            ) : (
              <Card className="grid min-h-48 place-items-center text-sm text-muted-foreground">
                Selecione uma candidatura.
              </Card>
            )}
          </div>
        </TabsContent>
        <TabsContent value="form" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="m-0 text-base font-semibold">Perguntas do formulário</h2>
              <Switch checked={fcfg.enabled} onCheckedChange={(v) => setEnabled("forms", v)} />
            </div>
            <p className="mt-0 mb-3 text-xs text-muted-foreground">
              O Discord aceita até 5 campos de texto no modal. Campos de escolha são menus e ficam fora desse limite.
            </p>
            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.id} className="space-y-2 rounded-xl bg-muted/40 p-3">
                  <div className="flex gap-2">
                    <Input
                      value={field.label}
                      onChange={(e) => patchField(field.id, { label: e.target.value })}
                      placeholder="Pergunta"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remover"
                      onClick={() => removeField(field.id)}
                      disabled={fields.length <= 1}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <NativeSelect
                      value={field.type}
                      onChange={(e) => patchField(field.id, { type: e.target.value as FormFieldConfig["type"] })}
                      className="w-44"
                    >
                      <option value="short">Resposta curta</option>
                      <option value="paragraph">Texto longo</option>
                      <option value="select">Escolha única</option>
                    </NativeSelect>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch checked={field.required} onCheckedChange={(v) => patchField(field.id, { required: v })} />
                      Obrigatória
                    </label>
                  </div>
                  {field.type === "select" ? (
                    <div>
                      <Label className="text-xs">Opções (uma por linha)</Label>
                      <Textarea
                        className="mt-1"
                        value={field.options.join("\n")}
                        onChange={(e) =>
                          patchField(field.id, {
                            options: e.target.value
                              .split("\n")
                              .map((line) => line.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder={"Dúvida\nDenúncia\nParceria"}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
              {fields.length < 10 ? (
                <Button variant="outline" size="sm" onClick={addField}>
                  <Plus className="size-4" /> Pergunta
                </Button>
              ) : null}
            </div>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Exigir motivo na recusa</Label>
                <Switch
                  checked={Boolean(fcfg.config.requireReasonOnReject)}
                  onCheckedChange={(v) => updateConfig("forms", { requireReasonOnReject: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Pré-review com IA</Label>
                <Switch
                  checked={Boolean(fcfg.config.useAiPreReview)}
                  onCheckedChange={(v) => updateConfig("forms", { useAiPreReview: v })}
                />
              </div>
              <div>
                <Label>Cooldown (horas)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  defaultValue={Number(fcfg.config.cooldownHours ?? 24)}
                  onBlur={(e) => updateConfig("forms", { cooldownHours: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Título do painel</Label>
                <Input
                  className="mt-1"
                  defaultValue={asString(fcfg.config.panelTitle)}
                  onBlur={(e) => updateConfig("forms", { panelTitle: e.target.value })}
                />
              </div>
            </div>
          </Card>
          <div className="space-y-4">
            <DiscordPanel
              channel="candidaturas"
              title={asString(fcfg.config.panelTitle)}
              description={asString(fcfg.config.panelDescription)}
              buttons={["Candidatar-se"]}
            />
            <Button variant="outline" onClick={() => publishPanel("forms")}>
              Publicar painel na fila
            </Button>
            <DiscordModalPreview title={asString(fcfg.config.panelTitle)} questions={questions.map((q) => q.label)} />
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={sim} onOpenChange={setSim}>
        <DialogContent>
          <DialogTitle>Enviar candidatura</DialogTitle>
          <DialogDesc>Respeita cooldown, idade da conta e limite por pessoa.</DialogDesc>
          <SimForm
            members={members}
            questions={questions}
            onSubmit={(userId, answers) => {
              const r = submitForm(userId, answers);
              if (!r.ok) alert(r.error);
              else setSim(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SimForm({
  members,
  questions,
  onSubmit,
}: {
  members: ReturnType<typeof useGuildMembers>;
  questions: { id: string; label: string }[];
  onSubmit: (userId: string, answers: Record<string, string>) => void;
}) {
  const [userId, setUserId] = useState(members[0]?.id ?? "");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(userId, answers);
      }}
    >
      <Label>Membro</Label>
      <NativeSelect value={userId} onChange={(e) => setUserId(e.target.value)}>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.displayName}
          </option>
        ))}
      </NativeSelect>
      {questions.map((q) => (
        <div key={q.id}>
          <Label>{q.label}</Label>
          <Textarea
            className="mt-1"
            value={answers[q.id] ?? ""}
            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
            required
          />
        </div>
      ))}
      <Button type="submit" className="w-full">
        Enviar
      </Button>
    </form>
  );
}
