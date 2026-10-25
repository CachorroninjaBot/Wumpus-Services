import { z } from "zod";
import { moduleDefaults as coreModuleDefaults } from "../../core/module-defaults.ts";
import { moduleDefaults as dashboardModuleDefaults } from "./defaults.ts";
import { SESSION_TOKEN_MAX_LENGTH } from "./session-token.ts";

const moduleDefaults = Object.fromEntries(
  Object.entries(coreModuleDefaults).map(([moduleName, defaults]) => [
    moduleName,
    { ...defaults, ...dashboardModuleDefaults[moduleName as keyof typeof dashboardModuleDefaults] },
  ]),
);

const enumValues: Record<string, readonly string[]> = {
  action: ["delete", "warn", "timeout", "review"],
  raidMode: ["smart", "strict", "passive"],
  response: ["alert", "lockdown_review", "auto"],
  panelFormat: ["components_v2", "embed"],
  departmentDisplayMode: ["select", "buttons"],
  type: ["short", "paragraph", "select"],
};

function matchesDefault(value: unknown, example: unknown, depth = 0, key = "", requireKeys = false): boolean {
  if (depth > 8) return false;
  if (Array.isArray(example)) {
    if (!Array.isArray(value) || value.length > 100) return false;
    const itemExample = example[0];
    return itemExample === undefined
      ? value.every((item) => typeof item === "string" && item.length <= 256)
      : value.every((item) => matchesDefault(item, itemExample, depth + 1, "", key !== "fields"));
  }
  if (example !== null && typeof example === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    const keys = Object.keys(example);
    return Object.keys(record).every((key) => keys.includes(key)) &&
      (!requireKeys || keys.every((key) => key in record)) &&
      keys.every((childKey) => !(childKey in record) || matchesDefault(record[childKey], (example as Record<string, unknown>)[childKey], depth + 1, childKey));
  }
  if (typeof example === "string") {
    return typeof value === "string" && value.length <= 4000 && (!enumValues[key] || enumValues[key]!.includes(value));
  }
  if (typeof example === "number") return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000;
  if (typeof example === "boolean") return typeof value === "boolean";
  return value === example;
}

const modulesSchema = z.record(z.string(), z.record(z.string(), z.unknown())).superRefine((modules, ctx) => {
  for (const [moduleName, config] of Object.entries(modules)) {
    const defaults = moduleDefaults[moduleName as keyof typeof moduleDefaults];
    if (!defaults) {
      ctx.addIssue({ code: "custom", message: `Módulo desconhecido: ${moduleName}.` });
      continue;
    }
    if (Object.keys(config).some((key) => key !== "enabled" && !(key in defaults))) {
      ctx.addIssue({ code: "custom", message: `A configuração de ${moduleName} contém campos desconhecidos.` });
      continue;
    }
    if ("enabled" in config && typeof config.enabled !== "boolean") {
      ctx.addIssue({ code: "custom", message: `O campo enabled de ${moduleName} precisa ser booleano.` });
    }
    for (const [key, value] of Object.entries(config)) {
      if (key !== "enabled" && !matchesDefault(value, defaults[key])) {
        ctx.addIssue({ code: "custom", message: `Valor inválido para ${moduleName}.${key}.` });
      }
    }
  }
});

export const publishInputSchema = z.object({
  token: z.string().min(1).max(SESSION_TOKEN_MAX_LENGTH),
  guildId: z.string().regex(/^\d{17,20}$/),
  name: z.string().max(100).optional(),
  modules: modulesSchema,
  articles: z.array(z.object({
    id: z.string().min(1).max(100),
    title: z.string().max(200),
    body: z.string().max(8000),
    tags: z.array(z.string().max(64)).max(25),
    category: z.string().max(80).optional(),
    exampleQuestions: z.array(z.string().max(200)).max(12).optional(),
    approved: z.boolean(),
  }).strict()).max(200).optional(),
}).strict().superRefine((input, ctx) => {
  if (JSON.stringify(input).length > 64_000) {
    ctx.addIssue({ code: "custom", message: "A configuração excede o limite de tamanho." });
  }
  const fields = input.modules.forms?.fields;
  if (Array.isArray(fields)) {
    const textFields = fields.filter((field) => field && typeof field === "object" && (field as Record<string, unknown>).type !== "select");
    const selectFields = fields.filter((field) => field && typeof field === "object" && (field as Record<string, unknown>).type === "select");
    if (fields.length > 10 || textFields.length > 5 || selectFields.length > 5) {
      ctx.addIssue({ code: "custom", message: "O Discord aceita até 5 perguntas de texto e 5 escolhas por formulário." });
    }
    fields.forEach((field, index) => {
      if (!field || typeof field !== "object") return;
      const row = field as Record<string, unknown>;
      if (typeof row.label !== "string" || !row.label.trim() || row.label.length > 45) {
        ctx.addIssue({ code: "custom", message: `A pergunta ${index + 1} precisa ter um rótulo de até 45 caracteres.` });
      }
      if (typeof row.placeholder === "string" && row.placeholder.length > 100) {
        ctx.addIssue({ code: "custom", message: `O exemplo da pergunta ${index + 1} deve ter até 100 caracteres.` });
      }
      if (row.type === "select") {
        const options = Array.isArray(row.options) ? row.options : [];
        if (options.length < 2 || options.length > 25 || options.some((option) => typeof option !== "string" || option.length > 100)) {
          ctx.addIssue({ code: "custom", message: `A pergunta ${index + 1} precisa ter de 2 a 25 opções de até 100 caracteres.` });
        }
      } else {
        const minLength = typeof row.minLength === "number" ? row.minLength : 0;
        const maxLength = typeof row.maxLength === "number" ? row.maxLength : 1000;
        if (minLength < 0 || minLength > maxLength || maxLength > 4000) {
          ctx.addIssue({ code: "custom", message: `Confira o tamanho mínimo e máximo da pergunta ${index + 1}.` });
        }
      }
    });
  }

  const ticketConfig = input.modules.tickets;
  const departments = ticketConfig?.departmentSettings;
  if (Array.isArray(departments)) {
    if (departments.length > 25) {
      ctx.addIssue({ code: "custom", message: "O Discord aceita até 25 tipos de atendimento por painel." });
    }
    const names = new Set<string>();
    const ids = new Set<string>();
    departments.forEach((department, index) => {
      if (!department || typeof department !== "object" || Array.isArray(department)) return;
      const item = department as Record<string, unknown>;
      const id = typeof item.id === "string" ? item.id.trim() : "";
      if (!id || id.length > 64) {
        ctx.addIssue({ code: "custom", message: `O tipo de atendimento ${index + 1} precisa de um identificador válido.` });
      }
      if (id && ids.has(id)) {
        ctx.addIssue({ code: "custom", message: `O identificador do tipo de atendimento “${id}” está duplicado.` });
      }
      ids.add(id);
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!name || name.length > 100) {
        ctx.addIssue({ code: "custom", message: `O tipo de atendimento ${index + 1} precisa de um nome de até 100 caracteres.` });
      }
      const normalizedName = name.toLocaleLowerCase("pt-BR");
      if (normalizedName && names.has(normalizedName)) {
        ctx.addIssue({ code: "custom", message: `O tipo de atendimento “${name}” está duplicado.` });
      }
      names.add(normalizedName);
      if (typeof item.description === "string" && item.description.length > 100) {
        ctx.addIssue({ code: "custom", message: `A descrição de “${name}” deve ter até 100 caracteres.` });
      }
      if (typeof item.emoji === "string" && item.emoji.length > 32) {
        ctx.addIssue({ code: "custom", message: `O emoji de “${name}” deve ter até 32 caracteres.` });
      }
      if (typeof item.welcomeMessage === "string" && item.welcomeMessage.length > 2000) {
        ctx.addIssue({ code: "custom", message: `A mensagem de boas-vindas de “${name}” deve ter até 2.000 caracteres.` });
      }
      if (Array.isArray(item.staffRoleIds) && item.staffRoleIds.length > 25) {
        ctx.addIssue({ code: "custom", message: `“${name}” pode ter no máximo 25 cargos de atendimento.` });
      }
      if (Array.isArray(item.intakeQuestions)) {
        if (item.intakeQuestions.length > 5 || item.intakeQuestions.some((question) => typeof question !== "string" || !question.trim() || question.length > 45)) {
          ctx.addIssue({ code: "custom", message: `“${name}” pode ter até 5 perguntas, cada uma com rótulo de até 45 caracteres.` });
        }
      }
    });
  }
  if (typeof ticketConfig?.panelButtonLabel === "string" && ticketConfig.panelButtonLabel.length > 80) {
    ctx.addIssue({ code: "custom", message: "O texto do botão de tickets deve ter até 80 caracteres." });
  }
  if (typeof ticketConfig?.panelButtonEmoji === "string" && ticketConfig.panelButtonEmoji.length > 32) {
    ctx.addIssue({ code: "custom", message: "O emoji do botão de tickets deve ter até 32 caracteres." });
  }
  if (typeof ticketConfig?.panelFooter === "string" && ticketConfig.panelFooter.length > 300) {
    ctx.addIssue({ code: "custom", message: "O rodapé do painel de tickets deve ter até 300 caracteres." });
  }
  if (typeof ticketConfig?.departmentMenuPrompt === "string" && ticketConfig.departmentMenuPrompt.length > 2000) {
    ctx.addIssue({ code: "custom", message: "A mensagem de escolha do departamento deve ter até 2.000 caracteres." });
  }
  if (typeof ticketConfig?.departmentMenuPlaceholder === "string" && ticketConfig.departmentMenuPlaceholder.length > 150) {
    ctx.addIssue({ code: "custom", message: "O texto do menu de departamentos deve ter até 150 caracteres." });
  }
  for (const key of ["panelButtonStyle", "departmentButtonStyle"]) {
    if (ticketConfig?.[key] !== undefined && ![1, 2, 3, 4].includes(Number(ticketConfig[key]))) {
      ctx.addIssue({ code: "custom", message: `Estilo inválido para tickets.${key}.` });
    }
  }
  if (ticketConfig?.departmentDisplayMode === "buttons" && Array.isArray(departments) && departments.length > 5) {
    ctx.addIssue({ code: "custom", message: "O modo de botões aceita até 5 tipos de atendimento." });
  }
});
