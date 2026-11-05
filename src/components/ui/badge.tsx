import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide",
  {
    variants: {
      tone: {
        default: "bg-muted text-muted-foreground",
        primary: "bg-primary/15 text-primary",
        // /20 em vez de /15: no tema claro o /15 deixava o texto de status
        // perto do limite de 4.5:1 de contraste.
        ok: "bg-ok/20 text-ok",
        warn: "bg-warn/20 text-warn",
        danger: "bg-destructive/20 text-destructive",
        info: "bg-info/20 text-info",
      },
    },
    defaultVariants: { tone: "default" },
  },
);

export function Badge({
  className,
  tone,
  icon,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    /** Ícone à esquerda. Cor nunca deve ser o único sinal de status. */
    icon?: React.ReactNode;
  }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {icon ? <span className="shrink-0 [&>svg]:size-3">{icon}</span> : null}
      {children}
    </span>
  );
}
