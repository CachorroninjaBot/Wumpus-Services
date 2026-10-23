import { BrandMark } from "@/components/brand";
import { ChevronDown } from "lucide-react";
import type { FormFieldConfig } from "@/lib/wumpus/store";

export function DiscordPanel({
  channel = "abrir-ticket",
  title,
  description,
  accent = "#28655b",
  buttons,
  format = "v2",
}: {
  channel?: string;
  title: string;
  description: string;
  accent?: string;
  buttons: string[];
  format?: "v2" | "embed";
}) {
  return (
    <div className="discord-window" aria-hidden="true">
      <div className="discord-top">
        <span className="discord-dot" />
        <span className="discord-dot" />
        <span className="discord-dot" />
        <span className="ml-2 truncate">Aurora Store — Discord</span>
      </div>
      <div className="discord-body">
        <div className="discord-rail">
          <BrandMark size={42} />
          <span className="size-10 rounded-[14px] bg-discord-surface" />
          <span className="size-10 rounded-[14px] bg-discord-surface" />
        </div>
        <div className="discord-channel">
          <p className="m-0 text-[13px] font-semibold text-discord-text">#{channel}</p>
          <p className="mt-1 mb-0 text-[12px] text-discord-muted">Prévia visual do painel</p>
          <div className="mt-4 flex gap-3">
            <BrandMark size={38} />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[13px] font-semibold text-white">
                Wumpus <span className="ml-1 rounded-[3px] bg-discord px-1 py-px text-[9px] font-bold uppercase">bot</span>
              </p>
              {format === "v2" ? (
                <div className="discord-v2">
                  <p className="discord-kicker">Components V2</p>
                  <p className="m-0 mt-2 text-[15px] font-semibold text-white">{title}</p>
                  <p className="mt-1.5 mb-0 text-[13px] leading-relaxed text-discord-text">{description}</p>
                  <div className="discord-sep" />
                  <div className="flex flex-wrap gap-2">
                    {buttons.map((label) => (
                      <span key={label} className="discord-btn primary">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="discord-embed" style={{ borderLeftColor: accent }}>
                  <p className="m-0 text-[15px] font-semibold text-white">{title}</p>
                  <p className="mt-1.5 mb-0 text-[13px] leading-relaxed text-discord-text">{description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {buttons.map((label) => (
                      <span key={label} className="discord-btn primary">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DiscordModalPreview({
  title,
  questions,
}: {
  title: string;
  questions: string[];
}) {
  return (
    <div className="rounded-2xl bg-discord-surface p-4 text-discord-text shadow-border" aria-hidden="true">
      <p className="m-0 text-[11px] font-semibold tracking-[0.14em] text-discord-muted uppercase">Modal do Discord</p>
      <p className="mt-2 mb-3 text-[16px] font-semibold text-white">{title}</p>
      <div className="space-y-3">
        {questions.slice(0, 5).map((q) => (
          <div key={q}>
            <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wide text-discord-label">{q}</p>
            <div className="h-9 rounded-md bg-discord-surface-deep" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <span className="discord-btn">Cancelar</span>
        <span className="discord-btn primary">Enviar</span>
      </div>
    </div>
  );
}

export function DiscordFormPreview({
  title,
  description,
  buttonLabel,
  fields,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  fields: FormFieldConfig[];
}) {
  const selects = fields.filter((field) => field.type === "select").slice(0, 5);
  const textFields = fields.filter((field) => field.type !== "select").slice(0, 5);

  return (
    <div className="discord-window" aria-hidden="true">
      <div className="discord-top">
        <span className="discord-dot" /><span className="discord-dot" /><span className="discord-dot" />
        <span className="ml-2 truncate">Aurora Store — Discord</span>
      </div>
      <div className="discord-body">
        <div className="discord-rail"><BrandMark size={42} /><span className="size-10 rounded-[14px] bg-discord-surface" /></div>
        <div className="discord-channel">
          <p className="m-0 text-[13px] font-semibold text-discord-text">#formularios</p>
          <p className="mt-1 mb-0 text-[12px] text-discord-muted">Prévia visual do formulário</p>
          <div className="mt-4 flex gap-3">
            <BrandMark size={38} />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[13px] font-semibold text-white">Wumpus <span className="ml-1 rounded-[3px] bg-discord px-1 py-px text-[9px] font-bold uppercase">bot</span></p>
              <div className="discord-v2">
                <p className="m-0 mt-1 text-[15px] font-semibold text-white">{title || "Formulário"}</p>
                <p className="mt-1.5 mb-0 text-[13px] leading-relaxed text-discord-text">{description || "Preencha as perguntas abaixo para enviar sua resposta."}</p>
                <div className="discord-sep" />
                <span className="discord-btn primary">{buttonLabel || "Preencher formulário"}</span>
              </div>

              {selects.length ? (
                <div className="mt-4 rounded-lg bg-discord-surface px-3 py-3">
                  <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-discord-muted">Etapa 1 · escolhas</p>
                  <p className="mb-0 mt-1 text-[12px] text-discord-text">Escolha uma opção para continuar</p>
                  <div className="mt-3 space-y-2">
                    {selects.map((field) => (
                      <div key={field.id} className="rounded-md border border-white/10 bg-discord-surface-deep px-3 py-2.5">
                        <span className="flex items-center justify-between gap-2 text-xs text-discord-text"><span className="truncate">{field.label || "Escolha uma opção"}{field.required ? " *" : ""}</span><ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-discord-muted" /></span>
                        <span className="mt-1 block truncate text-[10px] text-discord-muted">{field.options.slice(0, 4).join(" · ") || "Adicione opções no editor"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 rounded-lg bg-discord-surface px-3 py-3">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-discord-muted">{selects.length ? "Etapa 2 · perguntas" : "Formulário"}</p>
                <p className="mb-3 mt-1 text-[15px] font-semibold text-white">{title || "Formulário"}</p>
                <div className="space-y-3">
                  {textFields.length ? textFields.map((field) => (
                    <div key={field.id}>
                      <p className="m-0 mb-1 text-[11px] font-semibold text-discord-label">{field.label || "Pergunta"}{field.required ? <span className="ml-1 text-red-300">*</span> : null}</p>
                      <div className="flex min-h-9 items-center rounded-md bg-discord-surface-deep px-2.5 text-[11px] text-discord-muted">{field.placeholder || "Sua resposta…"}</div>
                    </div>
                  )) : <p className="m-0 text-xs text-discord-muted">Adicione uma pergunta de texto ou escolha.</p>}
                </div>
                <div className="mt-4 flex justify-end gap-2"><span className="discord-btn">Cancelar</span><span className="discord-btn primary">Enviar</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
