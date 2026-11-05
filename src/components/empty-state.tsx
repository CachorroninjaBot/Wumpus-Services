import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Estado vazio.
 *
 * `empty` (padrão) = nunca houve dados aqui. A tela deve ENSINAR o que é esse
 * espaço e oferecer a ação que cria o primeiro item.
 *
 * `filtered` = existem dados, mas o filtro/busca atual não casou nada. Aqui a
 * ação certa é relaxar o filtro, não criar dado novo. Antes os dois casos eram
 * idênticos, então o usuário não sabia se o servidor estava vazio ou se ele só
 * tinha filtrado demais.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "empty",
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Ação secundária (ex.: "Limpar filtros" ao lado da ação principal). */
  secondaryAction?: ReactNode;
  variant?: "empty" | "filtered";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-3 px-4 py-8 text-center",
        variant === "filtered" && "py-6",
        className,
      )}
    >
      {icon ? (
        <div className="mx-auto flex justify-center text-muted-foreground">{icon}</div>
      ) : null}
      <h2 className="m-0 text-base font-semibold">{title}</h2>
      {description ? (
        <p className="mx-auto m-0 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
      {action || secondaryAction ? (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
