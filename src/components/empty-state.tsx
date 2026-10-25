import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3 px-4 py-6 text-center", className)}>
      {Icon ? (
        <Icon className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
      ) : null}
      <h2 className="m-0 text-base font-semibold tracking-tight">{title}</h2>
      {description ? <p className="m-0 text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
