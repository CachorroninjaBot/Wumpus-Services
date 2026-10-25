import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <header className="border-b border-border pb-3">
        <h2 className="m-0 text-base font-semibold">{title}</h2>
        {description ? (
          <p className="mb-0 mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}
