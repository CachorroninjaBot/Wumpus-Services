/**
 * Modelo de paineis e tipos de atendimento.
 *
 * Ate a versao anterior existia UM painel por servidor, descrito por campos
 * soltos na config (`panelChannelId`, `panelTitle`, ...). Agora existem varios
 * paineis, cada um com seu canal e uma selecao de tipos. Os campos antigos
 * continuam valendo como fallback: quem nunca abriu a tela nova segue com o
 * painel unico, e os custom_ids ja publicados continuam resolvendo.
 *
 * Modulo puro de proposito: o dashboard, o preflight e o bot precisam da
 * MESMA normalizacao, e os testes nao carregam `discord.js`.
 */

export type TicketPanel = {
  id: string;
  name: string;
  channelId: string;
  title: string;
  description: string;
  accentColor: string;
  footer: string;
  buttonLabel: string;
  buttonEmoji: string;
  buttonStyle: 1 | 2 | 3 | 4;
  /** `select` abre um menu com os tipos do painel; `buttons` mostra um botao por tipo. */
  displayMode: "select" | "buttons";
  buttonDisplayStyle: 1 | 2 | 3 | 4;
  menuPrompt: string;
  menuPlaceholder: string;
  /** Tipos deste painel. Vazio = nenhum; ausente na config = todos. */
  typeIds: string[];
};

export type TicketType = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  categoryId: string;
  staffRoleIds: string[];
  inheritStaff: boolean;
  welcomeMessage: string;
  intakeQuestions: string[];
};

type Config = Record<string, unknown> | null | undefined;
type ConfigObject = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Igual a `asList`, mas preserva entradas vazias: o preflight precisa ver. */
function rawList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim());
}

function isRecord(value: unknown): value is ConfigObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function records(value: unknown): ConfigObject[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function buttonStyle(value: unknown, fallback: 1 | 2 | 3 | 4): 1 | 2 | 3 | 4 {
  const parsed = Number(value);
  return [1, 2, 3, 4].includes(parsed) ? (parsed as 1 | 2 | 3 | 4) : fallback;
}

export function legacyTicketTypeId(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `legacy-${slug || "tipo"}`;
}

/**
 * Tipos configurados, ja incluindo os apelidos legados de `departments`.
 *
 * `departmentSettings` manda; nomes em `departments` que nao aparecem la
 * entram como tipo sintetico para nao sumir da tela de quem configurou antes.
 */
export function ticketTypeList(config: Config): TicketType[] {
  const settings = records(config?.departmentSettings);
  const types: TicketType[] = [];
  const seen = new Set<string>();

  for (const entry of settings) {
    const name = asString(entry.name).trim() || asString(entry.id).trim();
    if (!name) continue;
    const id = asString(entry.id).trim() || legacyTicketTypeId(name);
    if (seen.has(id)) continue;
    seen.add(id);
    types.push({
      id,
      name,
      description: asString(entry.description).trim(),
      emoji: asString(entry.emoji).trim(),
      categoryId: asString(entry.categoryId).trim(),
      staffRoleIds: asList(entry.staffRoleIds),
      inheritStaff: entry.inheritStaff !== false,
      welcomeMessage: asString(entry.welcomeMessage).trim(),
      intakeQuestions: rawList(entry.intakeQuestions),
    });
  }

  for (const name of asList(config?.departments)) {
    if (types.some((type) => type.name.toLowerCase() === name.toLowerCase())) continue;
    const id = legacyTicketTypeId(name);
    if (seen.has(id)) continue;
    seen.add(id);
    types.push({
      id,
      name,
      description: "",
      emoji: "",
      categoryId: "",
      staffRoleIds: [],
      inheritStaff: true,
      welcomeMessage: "",
      intakeQuestions: [],
    });
  }

  return types;
}

/** Resolve por id, depois por nome (menu antigo mandava o nome), depois id legado. */
export function findTicketType(config: Config, ref: string): TicketType | undefined {
  const wanted = ref.trim();
  if (!wanted) return undefined;
  const types = ticketTypeList(config);
  return (
    types.find((type) => type.id === wanted) ??
    types.find((type) => type.name.toLowerCase() === wanted.toLowerCase()) ??
    types.find((type) => legacyTicketTypeId(type.name) === legacyTicketTypeId(wanted))
  );
}

function normalizePanel(source: ConfigObject, index: number, fallbackTypeIds: string[]): TicketPanel | null {
  const id = asString(source.id).trim();
  if (!id) return null;
  const name = asString(source.name).trim() || `Painel ${index + 1}`;
  const typeIds = Array.isArray(source.typeIds)
    ? asList(source.typeIds)
    : fallbackTypeIds;
  return {
    id,
    name,
    channelId: asString(source.channelId).trim(),
    title: asString(source.title).trim() || "Central de atendimento",
    description:
      asString(source.description).trim() ||
      "Abra um atendimento privado e fale com a equipe.",
    accentColor: asString(source.accentColor).trim() || "#28655b",
    footer: asString(source.footer).trim(),
    buttonLabel: asString(source.buttonLabel).trim() || "Abrir atendimento",
    buttonEmoji: asString(source.buttonEmoji).trim(),
    buttonStyle: buttonStyle(source.buttonStyle, 1),
    displayMode: source.displayMode === "buttons" ? "buttons" : "select",
    buttonDisplayStyle: buttonStyle(source.buttonDisplayStyle, 2),
    menuPrompt: asString(source.menuPrompt).trim() || "Escolha o tipo de atendimento:",
    menuPlaceholder: asString(source.menuPlaceholder).trim() || "Escolha o tipo",
    typeIds,
  };
}

/**
 * Paineis efetivos do servidor.
 *
 * Se `ticketPanels` existe e tem ao menos um painel valido, ele manda. Senao,
 * sintetiza o painel unico a partir dos campos antigos — exatamente o que os
 * paineis ja publicados esperam.
 */
export function normalizeTicketPanels(config: Config): TicketPanel[] {
  const fallbackTypeIds = ticketTypeList(config).map((type) => type.id);
  const saved = records(config?.ticketPanels)
    .map((entry, index) => normalizePanel(entry, index, fallbackTypeIds))
    .filter((panel): panel is TicketPanel => panel !== null);

  if (saved.length) return saved;

  return [
    {
      id: "default",
      name: "Painel principal",
      channelId: asString(config?.panelChannelId).trim(),
      title: asString(config?.panelTitle).trim() || "Central de atendimento",
      description:
        asString(config?.panelDescription).trim() ||
        "Abra um atendimento privado e fale com a equipe.",
      accentColor: asString(config?.panelAccentColor).trim() || "#28655b",
      footer: asString(config?.panelFooter).trim(),
      buttonLabel: asString(config?.panelButtonLabel).trim() || "Abrir atendimento",
      buttonEmoji: asString(config?.panelButtonEmoji).trim(),
      buttonStyle: buttonStyle(config?.panelButtonStyle, 1),
      displayMode: config?.departmentDisplayMode === "buttons" ? "buttons" : "select",
      buttonDisplayStyle: buttonStyle(config?.departmentButtonStyle, 2),
      menuPrompt:
        asString(config?.departmentMenuPrompt).trim() || "Escolha o tipo de atendimento:",
      menuPlaceholder: asString(config?.departmentMenuPlaceholder).trim() || "Escolha o tipo",
      typeIds: fallbackTypeIds,
    },
  ];
}

export function findTicketPanel(
  config: Config,
  panelId: string | undefined,
): TicketPanel | undefined {
  const panels = normalizeTicketPanels(config);
  if (!panelId) return panels[0];
  return panels.find((panel) => panel.id === panelId);
}

/** Tipos de um painel, na ordem configurada. */
export function panelTicketTypes(config: Config, panel: TicketPanel): TicketType[] {
  const types = ticketTypeList(config);
  if (!panel.typeIds.length) return [];
  const byId = new Map(types.map((type) => [type.id, type]));
  return panel.typeIds
    .map((id) => byId.get(id))
    .filter((type): type is TicketType => type !== undefined);
}
