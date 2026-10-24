import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getMyGuildAccessDiagnostics,
  saveMyGuildSelection,
  type GuildAccessDiagnostics,
} from "@/lib/wumpus/session";
import { cn } from "@/lib/utils";

export function GuildSelectionPanel() {
  const [diagnostics, setDiagnostics] = useState<GuildAccessDiagnostics | null>(null);
  const [selectedGuildIds, setSelectedGuildIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirtyRef = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMyGuildAccessDiagnostics({ data: {} });
      setDiagnostics(result);
      if (!dirtyRef.current) setSelectedGuildIds(result.selectedGuildIds);
    } catch (cause) {
      console.error("Não foi possível carregar os servidores disponíveis para a conta.", cause);
      setError(
        cause instanceof Error ? cause.message : "Não foi possível consultar os servidores.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async () => {
    if (!diagnostics) return;
    setSaving(true);
    setError(null);
    try {
      await saveMyGuildSelection({ data: { guildIds: selectedGuildIds } });
      dirtyRef.current = false;
      window.location.assign("/entrar");
    } catch (cause) {
      console.error("Não foi possível salvar a seleção de servidores.", cause);
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a seleção.");
      setSaving(false);
    }
  }, [diagnostics, selectedGuildIds]);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-semibold">Servidores para gerenciar</h2>
          <p className="mb-0 mt-1 text-sm text-muted-foreground">
            Escolha em quais servidores o Wumpus deve atuar. Você pode alterar essa seleção depois.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void refresh()}>
          {loading ? "Verificando…" : diagnostics ? "Verificar novamente" : "Verificar servidores"}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {loading && !diagnostics ? (
        <p role="status" className="m-0 text-sm text-muted-foreground">
          Consultando sua conta Discord, o plano e a conexão do bot…
        </p>
      ) : null}

      {diagnostics ? (
        <>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-y border-border py-3 text-sm">
            <dt className="text-muted-foreground">Servidores que você possui</dt>
            <dd className="m-0 text-right font-medium">{diagnostics.ownedGuildCount}</dd>
            <dt className="text-muted-foreground">Servidores detectados no bot</dt>
            <dd className="m-0 text-right font-medium">{diagnostics.botGuildCount}</dd>
            <dt className="text-muted-foreground">Em comum</dt>
            <dd className="m-0 text-right font-medium">{diagnostics.matchingGuildCount}</dd>
            <dt className="text-muted-foreground">Disponíveis para esta conta</dt>
            <dd className="m-0 text-right font-medium">{diagnostics.eligibleGuildCount}</dd>
            <dt className="text-muted-foreground">Plano</dt>
            <dd className="m-0 text-right font-medium">
              {diagnostics.planName ?? "Nenhum"}
              {diagnostics.planLimit === null && diagnostics.planName
                ? " · sem limite"
                : diagnostics.planLimit
                  ? ` · até ${diagnostics.planLimit}`
                  : ""}
            </dd>
          </dl>
          <p className="m-0 text-sm leading-6">{diagnostics.recommendation}</p>
          {diagnostics.availableGuilds.length ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="m-0 text-xs text-muted-foreground">
                  {selectedGuildIds.length} selecionado(s)
                  {diagnostics.planLimit === null
                    ? " · sem limite de quantidade"
                    : ` · limite de ${diagnostics.planLimit}`}
                </p>
                <Button
                  size="sm"
                  disabled={!dirtyRef.current || saving || !diagnostics.planName}
                  onClick={() => void save()}
                >
                  {saving ? "Salvando…" : "Salvar seleção"}
                </Button>
              </div>
              {!diagnostics.planName ? (
                <p className="m-0 text-sm text-muted-foreground">
                  Um plano ativo é necessário para escolher servidores.
                </p>
              ) : (
                <ul className="m-0 max-h-64 space-y-1 overflow-y-auto p-0">
                  {diagnostics.availableGuilds.map((guild) => {
                    const checked = selectedGuildIds.includes(guild.id);
                    const atLimit =
                      diagnostics.planLimit !== null &&
                      selectedGuildIds.length >= diagnostics.planLimit;
                    const disabled = guild.linkedElsewhere || (!checked && atLimit);
                    return (
                      <li key={guild.id} className="list-none">
                        <label
                          className={cn(
                            "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm",
                            disabled
                              ? "cursor-not-allowed opacity-55"
                              : "cursor-pointer hover:bg-muted/70",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={(event) => {
                              const next = event.target.checked
                                ? [...selectedGuildIds, guild.id]
                                : selectedGuildIds.filter((id) => id !== guild.id);
                              dirtyRef.current = true;
                              setSelectedGuildIds(next);
                            }}
                            className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          />
                          <span className="min-w-0 flex-1 truncate font-medium">{guild.name}</span>
                          {guild.linkedElsewhere ? (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              Vinculado a outra conta
                            </span>
                          ) : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <>
              <p className="m-0 text-sm text-muted-foreground">
                Nenhum servidor elegível foi encontrado.{" "}
                <a href="/entrar?reconectar=1" className="font-medium text-primary hover:underline">
                  Atualize a conexão com o Discord
                </a>{" "}
                depois de confirmar que o Wumpus está no servidor.
              </p>
              {diagnostics.ownedGuilds.length ? (
                <ul className="m-0 max-h-48 space-y-1 overflow-y-auto p-0 text-sm">
                  {diagnostics.ownedGuilds.map((guild) => (
                    <li
                      key={guild.id}
                      className="flex min-h-10 items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2"
                    >
                      <span className="min-w-0 truncate font-medium">{guild.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {!diagnostics.botAvailable
                          ? "Verificação indisponível"
                          : guild.botPresent
                            ? "Wumpus detectado"
                            : "Wumpus não detectado"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
          <p className="m-0 text-xs text-muted-foreground">
            Diagnóstico: <code>{diagnostics.issue}</code> · atualizado às{" "}
            {new Date(diagnostics.checkedAt).toLocaleTimeString("pt-BR")}
          </p>
        </>
      ) : null}
    </Card>
  );
}
