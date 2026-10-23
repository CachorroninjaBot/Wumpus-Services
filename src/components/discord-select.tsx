import { SearchSelect } from "@/components/search-select";
import { useWumpus } from "@/lib/wumpus/store";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  kind: "text" | "category" | "role";
  placeholder?: string;
  className?: string;
};

/** Keep canonical Discord names so configurations can resolve per server in a group. */
export function DiscordSelect({ id, value, onChange, kind, placeholder = "Selecione…", className }: Props) {
  const guildId = useWumpus((s) => s.activeGuildId);
  const channels = useWumpus((s) => s.channels[guildId] ?? []);
  const roles = useWumpus((s) => s.roles[guildId] ?? []);
  const options = kind === "role"
    ? roles.filter((role) => role.id !== guildId).map((role) => ({ id: role.id, name: `@${role.name}` }))
    : channels.filter((channel) => channel.type === kind).map((channel) => ({ id: channel.id, name: `${kind === "text" ? "#" : ""}${channel.name}` }));

  const selected = options.find((option) => option.id === value || option.name.replace(/^[#▰@ ]+/, "") === value.replace(/^[#▰@ ]+/, ""));
  return <SearchSelect id={id} value={selected?.id ?? ""} options={options.map((option) => ({ id: option.id, label: option.name }))} onChange={onChange} placeholder={placeholder} className={className} />;
}

export function DiscordMultiSelect({ value, onChange, kind = "role", placeholder }: {
  value: string[]; onChange: (value: string[]) => void; kind?: "role" | "text" | "category"; placeholder?: string;
}) {
  const guildId = useWumpus((s) => s.activeGuildId);
  const roles = useWumpus((s) => s.roles[guildId] ?? []);
  const channels = useWumpus((s) => s.channels[guildId] ?? []);
  const entities = kind === "role" ? roles.filter((role) => role.id !== guildId).map((role) => ({ id: role.id, name: role.name })) : channels.filter((channel) => channel.type === kind).map((channel) => ({ id: channel.id, name: channel.name }));
  const available = entities.filter((entity) => !value.includes(entity.id) && !value.includes(entity.name));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">{value.map((ref) => {
        const entity = entities.find((item) => item.id === ref || item.name === ref);
        return <button type="button" key={ref} onClick={() => onChange(value.filter((item) => item !== ref))} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted" aria-label={`Remover ${kind === "role" ? "cargo" : "canal"} ${entity?.name ?? ref}`}>{kind === "role" ? "@" : "#"}{entity?.name ?? ref} ×</button>;
      })}</div>
      <SearchSelect value="" options={available.map((entity) => ({ id: entity.id, label: `${kind === "role" ? "@" : "#"}${entity.name}` }))} onChange={(id) => onChange([...value, id])} placeholder={available.length ? placeholder ?? (kind === "role" ? "Adicionar cargo…" : "Adicionar canal…") : value.length ? "Todos selecionados" : "Nenhuma opção disponível"} disabled={!available.length} />
    </div>
  );
}
