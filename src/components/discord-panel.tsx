import { BrandMark } from "@/components/brand";

export function DiscordPanel({
  channel = "abrir-ticket",
  title,
  description,
  accent = "#7c5cff",
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
    <div className="discord-window">
      <div className="discord-top">
        <span className="discord-dot" />
        <span className="discord-dot" />
        <span className="discord-dot" />
        <span className="ml-2 truncate">Aurora Store — Discord</span>
      </div>
      <div className="discord-body">
        <div className="discord-rail">
          <BrandMark size={42} />
          <span className="size-10 rounded-[14px] bg-[#313338]" />
          <span className="size-10 rounded-[14px] bg-[#313338]" />
        </div>
        <div className="discord-channel">
          <p className="m-0 text-[13px] font-semibold text-[#f2f3f5]">#{channel}</p>
          <p className="mt-1 mb-0 text-[12px] text-[#949ba4]">Painel publicado pelo Wumpus</p>
          <div className="mt-4 flex gap-3">
            <BrandMark size={38} />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[13px] font-semibold text-white">
                Wumpus <span className="ml-1 rounded-[3px] bg-[#5865f2] px-1 py-px text-[9px] font-bold uppercase">bot</span>
              </p>
              {format === "v2" ? (
                <div className="discord-v2" style={{ borderColor: accent }}>
                  <p className="discord-kicker">Components V2</p>
                  <p className="m-0 mt-2 text-[15px] font-semibold text-white">{title}</p>
                  <p className="mt-1.5 mb-0 text-[13px] leading-relaxed text-[#dbdee1]">{description}</p>
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
                  <p className="mt-1.5 mb-0 text-[13px] leading-relaxed text-[#dbdee1]">{description}</p>
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
    <div className="rounded-2xl bg-[#313338] p-4 text-[#dbdee1] shadow-border">
      <p className="m-0 text-[11px] font-semibold tracking-[0.14em] text-[#949ba4] uppercase">Modal do Discord</p>
      <p className="mt-2 mb-3 text-[16px] font-semibold text-white">{title}</p>
      <div className="space-y-3">
        {questions.slice(0, 5).map((q) => (
          <div key={q}>
            <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#b5bac1]">{q}</p>
            <div className="h-9 rounded-md bg-[#1e1f22]" />
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
