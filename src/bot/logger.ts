/**
 * Logger do bot — uma linha por evento, no mesmo formato do servidor.
 *
 * Regra: logar NUNCA pode derrubar um handler. Se a escrita falhar, o bot
 * segue; um erro de log nao pode virar erro de atendimento.
 */
export type Logger = {
  info: (message: string, extra?: Record<string, unknown>) => void;
  warn: (message: string, extra?: Record<string, unknown>) => void;
  error: (message: string, extra?: Record<string, unknown>) => void;
};

function detail(extra?: Record<string, unknown>): string {
  if (!extra) return "";
  return Object.entries(extra)
    .map(([key, value]) => `${key}=${value}`)
    .join(" · ");
}

function emit(level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>): void {
  const suffix = detail(extra);
  const line = suffix ? `[bot] ${message}  ${suffix}` : `[bot] ${message}`;

  try {
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  } catch {
    // stdout indisponivel: nao ha o que fazer, e nao pode propagar.
  }
}

export const consoleLogger: Logger = {
  info: (message, extra) => emit("info", message, extra),
  warn: (message, extra) => emit("warn", message, extra),
  error: (message, extra) => emit("error", message, extra)
};
