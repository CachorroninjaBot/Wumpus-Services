import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3 px-4 py-6 text-center", className)}>
      {icon ? <div className="mx-auto flex justify-center">{icon}</div> : null}
      <h2 className="m-0 text-base font-semibold">{title}</h2>
      {description ? <p className="m-0 text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
