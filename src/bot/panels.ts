/**
 * Construtores de payload do Discord.
 *
 * Dois formatos suportados, exatamente como o produto pede:
 *  - embed: mensagem classica com embed + botoes.
 *  - components_v2: layout novo, usando o flag IS_COMPONENTS_V2 (32768),
 *    Container (17), Text Display (10), Separator (14) e Action Row (1).
 *
 * Importante: com IS_COMPONENTS_V2 nao se pode usar `content` nem `embeds`
 * no nivel superior — o conteudo vive dentro do Container.
 *
 * Atualizacao: logs e alertas internos (AutoMod, anti-raid/anti-nuke,
 * atendimento) tambem migraram para Components V2. `buildLogPayload`
 * mantem a mesma assinatura para nao exigir mudanca nos chamadores —
 * so o payload devolvido mudou de embed para Container V2.
 */

export type PanelFormat = "components_v2" | "embed";

/** Flag oficial que habilita o layout de componentes V2. */
export const IS_COMPONENTS_V2 = 1 << 15; // 32768

export const BUTTON_PRIMARY = 1;
export const BUTTON_SECONDARY = 2;
export const BUTTON_SUCCESS = 3;
export const BUTTON_DANGER = 4;

export type PanelButton = {
  /** custom_id do botao; sempre comecando por "wumpus:". */
  id: string;
  label: string;
  style?: number;
  emoji?: string;
};

export type PanelSpec = {
  module: string;
  format: PanelFormat;
  title: string;
  description: string;
  accentColor: string;
  buttons: PanelButton[];
};

export function hexToInt(hex: string): number {
  const clean = (hex ?? "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return 0x7c5cff;
  return Number.parseInt(clean, 16);
}

function actionRow(buttons: PanelButton[]): Record<string, unknown> {
  return {
    type: 1,
    components: buttons.slice(0, 5).map((button) => ({
      type: 2,
      style: button.style ?? BUTTON_PRIMARY,
      label: button.label.slice(0, 80),
      custom_id: button.id.slice(0, 100),
      ...(button.emoji ? { emoji: { name: button.emoji } } : {})
    }))
  };
}

/** Botoes padrao por modulo, para a dashboard nao precisar inventar custom_id. */
export function defaultButtons(module: string): PanelButton[] {
  if (module === "forms") {
    return [{ id: "wumpus:form:open", label: "Enviar candidatura", style: BUTTON_PRIMARY, emoji: "📝" }];
  }
  if (module === "tickets") {
    return [{ id: "wumpus:ticket:open", label: "Abrir atendimento", style: BUTTON_PRIMARY, emoji: "🎫" }];
  }
  if (module === "reports") {
    return [{ id: "wumpus:report:open", label: "Enviar denúncia", style: BUTTON_DANGER, emoji: "🚨" }];
  }
  return [];
}

export function buildPanelPayload(spec: PanelSpec): Record<string, unknown> {
  const color = hexToInt(spec.accentColor);
  const row = actionRow(spec.buttons);

  if (spec.format === "components_v2") {
    const children: Array<Record<string, unknown>> = [
      { type: 10, content: `## ${spec.title}\n${spec.description}` }
    ];
    if (spec.buttons.length) {
      children.push({ type: 14, divider: true, spacing: 1 });
      children.push(row);
    }
    return {
      flags: IS_COMPONENTS_V2,
      components: [{ type: 17, accent_color: color, components: children }]
    };
  }

  return {
    embeds: [
      {
        title: spec.title,
        description: spec.description,
        color,
        footer: { text: "Wumpus" }
      }
    ],
    ...(spec.buttons.length ? { components: [row] } : {})
  };
}

/**
 * Payload de log/alerta interno (AutoMod, anti-raid, anti-nuke, atendimento).
 *
 * Agora em Components V2: Container com titulo+descricao em um Text Display,
 * um Separator, e um segundo Text Display com os campos formatados em
 * negrito. Fica visualmente mais limpo que o embed antigo e alinhado com o
 * resto do produto, que ja usa V2 nos paineis publicados.
 */
export function buildLogPayload(input: {
  title: string;
  description: string;
  accentColor?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}): Record<string, unknown> {
  const color = hexToInt(input.accentColor ?? "#7c5cff");
  const title = input.title.slice(0, 256);
  const description = input.description.slice(0, 4000);
  const fields = (input.fields ?? []).slice(0, 25);

  const children: Array<Record<string, unknown>> = [
    { type: 10, content: `## ${title}\n${description}` }
  ];

  if (fields.length) {
    children.push({ type: 14, divider: true, spacing: 1 });
    children.push({
      type: 10,
      content: fields
        .map((field) => `**${field.name.slice(0, 256)}**\n${field.value.slice(0, 1024)}`)
        .join("\n\n")
    });
  }

  return {
    flags: IS_COMPONENTS_V2,
    components: [{ type: 17, accent_color: color, components: children }]
  };
}