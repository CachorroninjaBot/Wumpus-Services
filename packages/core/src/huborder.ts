import { z } from "zod";

export const hubOrderTicketKinds = ["bot", "server", "website", "wumpus", "other"] as const;
export const hubOrderTicketKindSchema = z.enum(hubOrderTicketKinds);
export type HubOrderTicketKind = z.infer<typeof hubOrderTicketKindSchema>;

export type HubOrderService = {
  id: HubOrderTicketKind;
  label: string;
  description: string;
  emoji: string;
};

export const defaultHubOrderServices: readonly HubOrderService[] = [
  { id: "bot", label: "Bot personalizado", description: "Comandos, automações e integrações para Discord.", emoji: "🤖" },
  { id: "server", label: "Servidor Discord", description: "Estrutura, permissões e experiência de comunidade.", emoji: "🏗️" },
  { id: "website", label: "Site ou sistema", description: "Landing pages, dashboards e ferramentas web.", emoji: "🧩" },
  { id: "wumpus", label: "Wumpus", description: "Gestão profissional para a sua comunidade.", emoji: "🛡️" },
  { id: "other", label: "Outro projeto", description: "Conte à equipe o que você precisa construir.", emoji: "✨" }
] as const;

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor hexadecimal, como #8175FF.");

export const hubOrderPanelConfigSchema = z.object({
  format: z.enum(["components_v2", "embed"]).default("components_v2"),
  title: z.string().trim().min(3).max(100).default("HubOrder · iniciar encomenda"),
  description: z.string().trim().min(10).max(1_000).default("Conte o que você quer criar. Nós organizamos o briefing, orçamento e acompanhamento em um atendimento privado."),
  footer: z.string().trim().min(3).max(200).default("Escolha uma categoria para começar seu briefing."),
  accentColor: colorSchema.default("#8175FF"),
  ticketPrefix: z.string().trim().regex(/^[a-z0-9-]{2,20}$/i, "Use apenas letras, números e hífens.").default("pedido"),
  allowMultipleOpenTickets: z.boolean().default(false),
  feedbackEnabled: z.boolean().default(true)
});

export type HubOrderPanelConfig = z.infer<typeof hubOrderPanelConfigSchema>;

export function defaultHubOrderPanelConfig(): HubOrderPanelConfig {
  return hubOrderPanelConfigSchema.parse({});
}

export function parseHubOrderPanelConfig(input: unknown): HubOrderPanelConfig {
  return hubOrderPanelConfigSchema.parse(input);
}

export function hexToDiscordColor(value: string): number {
  return Number.parseInt(value.replace("#", ""), 16);
}
