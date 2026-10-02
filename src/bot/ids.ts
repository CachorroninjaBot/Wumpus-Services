/**
 * Identificadores de componentes (custom_id) — versionados e centralizados.
 *
 * No bot antigo cada handler montava e lia o proprio custom_id por string
 * solta ("tkt:open:2", "form:ok:123"), e um formato novo quebrava o antigo em
 * silencio. Aqui todo id nasce de `id()` e todo handler le por `parseId()`,
 * entao a versao fica explicita e uma mudanca de formato e detectavel.
 *
 * Um custom_id do Discord tem no maximo 100 caracteres.
 */
const PREFIX = "wumpus";
const VERSION = "v1";

export type ParsedId = {
  kind: string;
  action: string;
  args: string[];
};

/** Monta um custom_id. Ex.: id("ticket", "open", "Suporte") -> "wumpus:v1:ticket:open:Suporte". */
export function id(...parts: Array<string | number>): string {
  return [PREFIX, VERSION, ...parts.map(String)].join(":").slice(0, 100);
}

/** Le um custom_id. Devolve `null` para id de outra versao/origem — o handler ignora. */
export function parseId(raw: string): ParsedId | null {
  const parts = raw.split(":");
  if (parts.length < 4) return null;
  if (parts[0] !== PREFIX || parts[1] !== VERSION) return null;

  const [, , kind, action, ...args] = parts;
  if (!kind || !action) return null;
  return { kind, action, args };
}
