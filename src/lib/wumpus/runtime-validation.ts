import { z } from "zod";
import { moduleDefaults as coreModuleDefaults } from "../../core/module-defaults.ts";
import { moduleDefaults as dashboardModuleDefaults } from "./defaults.ts";

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
  type: ["short", "paragraph", "select"],
};

function matchesDefault(value: unknown, example: unknown, depth = 0, key = "", requireKeys = false): boolean {
  if (depth > 8) return false;
  if (Array.isArray(example)) {
    if (!Array.isArray(value) || value.length > 100) return false;
    const itemExample = example[0];
    return itemExample === undefined
      ? value.every((item) => typeof item === "string" && item.length <= 256)
      : value.every((item) => matchesDefault(item, itemExample, depth + 1, "", true));
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
  token: z.string().min(1).max(4096),
  guildId: z.string().regex(/^\d{17,20}$/),
  name: z.string().max(100).optional(),
  modules: modulesSchema,
  articles: z.array(z.object({
    id: z.string().min(1).max(100),
    title: z.string().max(200),
    body: z.string().max(8000),
    tags: z.array(z.string().max(64)).max(25),
    approved: z.boolean(),
  }).strict()).max(200).optional(),
}).strict().superRefine((input, ctx) => {
  if (JSON.stringify(input).length > 64_000) {
    ctx.addIssue({ code: "custom", message: "A configuração excede o limite de tamanho." });
  }
});
