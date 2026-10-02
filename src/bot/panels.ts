/**
 * Payloads do Discord — paineis e logs em Components V2.
 *
 * Components V2 permite titulo, texto e separadores dentro de um unico
 * container, em vez de empilhar embeds. O container aceita ActionRow, entao
 * botoes continuam funcionando.
 *
 * Uma mensagem com o flag V2 NAO pode ter `content` nem `embeds` — misturar
 * os dois formatos e erro 400. Por isso o container e sempre a mensagem toda.
 */
import { id } from "./ids.ts";

export const IS_COMPONENTS_V2 = 1 << 15;

/**
 * Orcamento de texto de uma mensagem V2.
 *
 * O Discord soma os caracteres de TODOS os text displays e recusa acima de
 * 4000. Como o painel passou a poder ter cabecalho, corpo e rodape, o corte
 * tem de considerar o TOTAL — cortar cada bloco isolado ainda estoura a soma.
 */
const TEXT_BUDGET = 4000;
const HEADER_MAX = 300;
const FOOTER_MAX = 300;
const BODY_MAX = TEXT_BUDGET - HEADER_MAX - FOOTER_MAX;

export type ButtonSpec = {
  label: string;
  customId: string;
  /** 1 primary · 2 secondary · 3 success · 4 danger · 5 link */
  style?: 1 | 2 | 3 | 4 | 5;
  emoji?: string;
  disabled?: boolean;
};

export type LogField = { name: string; value: string; inline?: boolean };

/** Converte "#7c5cff" no inteiro que o Discord espera. */
export function hexToInt(hex: string, fallback = 0x7c5cff): number {
  const parsed = Number.parseInt(String(hex ?? "").replace("#", ""), 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function textDisplay(content: string) {
  return { type: 10, content: String(content).slice(0, 4000) };
}

function separator() {
  return { type: 14, divider: true, spacing: 1 };
}

function actionRow(buttons: ButtonSpec[]) {
  return {
    type: 1,
    components: buttons.slice(0, 5).map((button) => ({
      type: 2,
      style: button.style ?? 2,
      label: button.label.slice(0, 80),
      custom_id: button.customId.slice(0, 100),
      ...(button.emoji ? { emoji: { name: button.emoji } } : {}),
      ...(button.disabled ? { disabled: true } : {})
    }))
  };
}

function container(accentColor: string, children: unknown[]) {
  return { type: 17, accent_color: hexToInt(accentColor), components: children };
}

/**
 * Log operacional — usado por moderação, automod, segurança e tickets.
 * `title` vira cabecalho; `fields` viram blocos rotulados, nao tabela.
 */
export function buildLogPayload(input: {
  title: string;
  description: string;
  accentColor?: string;
  fields?: LogField[];
}) {
  const children: unknown[] = [textDisplay(`## ${input.title}\n${input.description}`)];

  const fields = (input.fields ?? []).filter((field) => field.value && field.value.trim());
  if (fields.length) {
    children.push(separator());
    children.push(
      textDisplay(fields.map((field) => `**${field.name}**\n${field.value}`).join("\n\n"))
    );
  }

  return {
    flags: IS_COMPONENTS_V2,
    components: [container(input.accentColor ?? "#7c5cff", children)]
  };
}

/**
 * Painel publicavel — o que o cliente ve no canal e clica.
 * Sem botoes o painel ainda e valido (vira um aviso), entao nao falha.
 */
export function buildPanelPayload(input: {
  title: string;
  description: string;
  accentColor?: string;
  buttons?: ButtonSpec[];
  footer?: string;
  /**
   * Linha acima do titulo.
   *
   * Existe porque uma mensagem V2 NAO aceita `content`: identificar o autor de
   * uma candidatura ("Candidatura de <@…> · #12") e mencionar os revisores
   * precisa acontecer DENTRO do container. Mencoes em text display notificam
   * normalmente, entao o ping continua funcionando.
   */
  header?: string;
}) {
  const children: unknown[] = [];

  const header = (input.header ?? "").trim();
  if (header) children.push(textDisplay(header.slice(0, HEADER_MAX)));

  children.push(textDisplay(`## ${input.title}\n${input.description}`.slice(0, BODY_MAX)));

  const buttons = input.buttons ?? [];
  if (buttons.length) {
    children.push(separator());
    children.push(actionRow(buttons));
  }

  if (input.footer?.trim()) {
    children.push(separator());
    // O corte envolve o prefixo `-# `: cortar so o texto deixaria o bloco com
    // 3 caracteres a mais e estouraria o teto da soma.
    children.push(textDisplay(`-# ${input.footer.trim()}`.slice(0, FOOTER_MAX)));
  }

  return {
    flags: IS_COMPONENTS_V2,
    components: [container(input.accentColor ?? "#7c5cff", children)]
  };
}

/**
 * Botoes padrao de um painel.
 *
 * Tickets e formularios usam o MESMO id de abertura: quem decide se abre um
 * departamento ou um modal e o handler, nao o botao. Assim um painel ja
 * publicado continua funcionando se a config mudar depois.
 */
export function defaultButtons(module: string): ButtonSpec[] {
  if (module === "tickets") {
    return [{ label: "Abrir atendimento", customId: id("ticket", "open"), style: 1, emoji: "🎫" }];
  }
  if (module === "forms") {
    return [{ label: "Candidatar-se", customId: id("form", "open"), style: 1, emoji: "📝" }];
  }
  return [];
}
