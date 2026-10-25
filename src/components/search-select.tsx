import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SearchOption = { id: string; label: string; description?: string; icon?: ReactNode };

export function SearchSelect({
  id, value, options, placeholder, eyebrow, onChange, className, disabled = false,
}: {
  id?: string; value: string; options: SearchOption[]; placeholder: string; eyebrow?: string;
  onChange: (value: string) => void; className?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const listId = `${id ?? generatedId}-options`;
  const selected = options.find((option) => option.id === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return needle ? options.filter((option) => `${option.label} ${option.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(needle)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const dismiss = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  const choose = (option: SearchOption) => { onChange(option.id); setOpen(false); setQuery(""); setActiveIndex(0); };
  const move = (step: number) => setActiveIndex((index) => Math.max(0, Math.min(filtered.length - 1, index + step)));

  return <div id={id} ref={rootRef} className="relative w-full">
    <button type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
      onClick={() => { setOpen((current) => !current); setQuery(""); setActiveIndex(Math.max(0, options.findIndex((option) => option.id === value))); }}
      onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActiveIndex(Math.max(0, options.findIndex((option) => option.id === value))); } }}
      className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl border border-input bg-card px-3 text-left text-foreground outline-none transition-[border-color,box-shadow,background] hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", open && "border-primary/60", className)}>
      {selected?.icon ? <span className="shrink-0">{selected.icon}</span> : null}
      <span className="min-w-0 flex-1">
        {eyebrow ? <span className="block text-xs font-medium text-muted-foreground">{eyebrow}</span> : null}
        <span className={cn("block truncate text-sm font-semibold", !selected && "font-medium text-muted-foreground")}>{selected?.label ?? placeholder}</span>
        {selected?.description ? <span className="block truncate text-xs text-muted-foreground">{selected.description}</span> : null}
      </span>
      <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
    </button>
    {open ? <div className="absolute left-0 top-[calc(100%+0.45rem)] z-50 w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-[0_14px_38px_-16px_rgb(0_0_0/0.55)]">
      <div className="border-b border-border p-2">
        <div className="flex h-10 items-center gap-2 rounded-lg bg-muted/65 px-3 focus-within:ring-2 focus-within:ring-ring">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input ref={searchRef} role="combobox" aria-expanded={open} aria-controls={listId}
            aria-activedescendant={filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
              if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
              if (event.key === "Enter" && filtered[activeIndex]) { event.preventDefault(); choose(filtered[activeIndex]!); }
              if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
            }}
            placeholder="Buscar…" aria-label="Buscar opções" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
          {query ? <button type="button" onClick={() => { setQuery(""); setActiveIndex(0); }} className="rounded px-1 text-xs text-muted-foreground hover:text-foreground">Limpar</button> : null}
        </div>
      </div>
      <div id={listId} role="listbox" aria-label={eyebrow ?? placeholder} className="max-h-64 overflow-y-auto p-1.5">
        {filtered.length ? filtered.map((option, index) => <button key={option.id} id={`${listId}-${index}`} type="button" role="option" aria-selected={option.id === value}
          onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option)}
          className={cn("flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors", index === activeIndex ? "bg-secondary text-foreground" : "text-foreground hover:bg-muted")}>
          {option.icon ? <span className="shrink-0">{option.icon}</span> : null}
          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{option.label}</span>{option.description ? <span className="block truncate text-xs text-muted-foreground">{option.description}</span> : null}</span>
          {option.id === value ? <Check aria-hidden="true" className="size-4 shrink-0 text-primary" /> : null}
        </button>) : <p className="m-0 px-3 py-5 text-center text-sm text-muted-foreground">Nenhum resultado para “{query}”.</p>}
      </div>
      <p className="m-0 border-t border-border px-3 py-2 text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "opção" : "opções"}</p>
    </div> : null}
  </div>;
}
