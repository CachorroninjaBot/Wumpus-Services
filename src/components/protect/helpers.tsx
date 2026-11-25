import { Input, Label } from "@/components/ui/input";
import type { ReactNode } from "react";

export function Field({
  id,
  label,
  children,
  hint,
}: {
  id?: string;
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="m-0 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
  disabled = false,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <Field id={id} label={label} hint={hint}>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))
        }
      />
    </Field>
  );
}
