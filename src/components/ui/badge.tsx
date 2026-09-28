import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
  {
    variants: {
      tone: {
        default: "bg-muted text-muted-foreground",
        primary: "bg-primary/15 text-primary",
        ok: "bg-ok/15 text-ok",
        warn: "bg-warn/15 text-warn",
        danger: "bg-destructive/15 text-destructive",
        info: "bg-info/15 text-info",
      },
    },
    defaultVariants: { tone: "default" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
