import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type NoticeTone = "info" | "warning" | "error";

const toneClasses: Record<NoticeTone, string> = {
  info: "border-info/25 bg-info/5 text-foreground",
  warning: "border-warn/25 bg-warn/10 text-foreground",
  error: "border-destructive/25 bg-destructive/10 text-destructive",
};

export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-lg border px-3 py-2.5 text-sm", toneClasses[tone], className)}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
