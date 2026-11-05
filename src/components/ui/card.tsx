import { cn } from "@/lib/utils";

/**
 * Card de superfície.
 *
 * `default` é o container de seção: borda fina e fundo de card — é ele que
 * delimita áreas na página.
 *
 * `inset` é para conteúdo DENTRO de um card (linhas de lista, sub-blocos,
 * agrupamentos). Não tem borda: usa só um fundo levemente recuado. Antes todo
 * bloco aninhado repetia `border border-border`, o que criava caixas dentro de
 * caixas e deixava a tela com aparência de formulário.
 */
export function Card({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "inset" }) {
  return (
    <div
      className={cn(
        "rounded-xl text-card-foreground",
        variant === "default"
          ? "border border-border bg-card p-5"
          : "bg-muted/45 p-4",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold tracking-tight", className)} {...props} />;
}

export function CardDesc({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm text-muted-foreground", className)} {...props} />;
}
