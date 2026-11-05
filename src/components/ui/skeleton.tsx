import { cn } from "@/lib/utils";

/**
 * Bloco de carregamento com a forma do conteúdo final.
 *
 * Regra: skeleton imita o layout que vai chegar (mesma altura, mesma largura de
 * linha), nunca um spinner central. Assim a tela não "pula" quando os dados
 * entram — o texto simplesmente substitui o bloco no mesmo lugar.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("skeleton-shimmer rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/** Linha de texto: `lines` barras com a última mais curta, como um parágrafo real. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3.5", index === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

/** Card de KPI no formato real: ícone, rótulo, número grande e detalhe. */
export function SkeletonKpi({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-32 items-start gap-3 rounded-xl border border-border bg-card p-4",
        className,
      )}
      aria-hidden="true"
    >
      <Skeleton className="size-9 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

/** Lista de linhas com avatar/ícone — para tabelas e filas. */
export function SkeletonRows({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Envolve conteúdo em carregamento mantendo o leitor de tela informado.
 * O `aria-busy` é o que impede o leitor de anunciar meia tela de skeleton.
 */
export function LoadingRegion({
  loading,
  label = "Carregando",
  children,
}: {
  loading: boolean;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div aria-busy={loading} aria-live="polite">
      <span className="sr-only">{loading ? label : ""}</span>
      {children}
    </div>
  );
}
