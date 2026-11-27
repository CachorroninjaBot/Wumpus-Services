/**
 * Preflight do painel de atendimento.
 *
 * Roda antes de publicar: erro bloqueia o envio ao bot, aviso deixa publicar.
 * Nao importa `engine.ts` de proposito — os testes carregam este modulo com
 * type-stripping e o engine usa import sem extensao, que o Node nao resolve.
 */
import { normalizeTicketPanels, panelTicketTypes, ticketTypeList } from "./ticket-panels.ts";

export type PreflightIssue = { level: "error" | "warn"; message: string };

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

export function ticketPanelPreflight(config: Record<string, unknown>): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const push = (level: PreflightIssue["level"], message: string) => issues.push({ level, message });

  const types = ticketTypeList(config);
  if (!types.length) push("error", "Adicione pelo menos um tipo de atendimento.");

  const seenNames = new Set<string>();
  types.forEach((type, index) => {
    const name = type.name.trim();
    if (!name) {
      push("error", `O tipo ${index + 1} está sem nome.`);
    } else {
      const key = name.toLowerCase();
      if (seenNames.has(key)) push("error", `Dois tipos usam o nome "${name}". Use nomes diferentes.`);
      else seenNames.add(key);
      if (name.length > 100) push("error", `O nome do tipo "${name}" passa de 100 caracteres.`);
    }

    if (type.intakeQuestions.length > 5) {
      push("error", `O tipo "${name || index + 1}" tem mais de 5 perguntas no formulário.`);
    }
    for (const question of type.intakeQuestions) {
      if (!question) {
        push("error", `O tipo "${name || index + 1}" tem uma pergunta vazia.`);
      } else if (question.length > 45) {
        push(
          "error",
          `A pergunta "${question.slice(0, 40)}…" passa de 45 caracteres (limite do Discord).`,
        );
      }
    }
  });

  const panels = normalizeTicketPanels(config);
  if (!panels.length) push("error", "Crie pelo menos um painel de atendimento.");

  const usedChannels = new Set<string>();
  const usedNames = new Set<string>();
  panels.forEach((panel) => {
    const label = panels.length > 1 ? `do painel "${panel.name}"` : "do painel";
    if (!panel.channelId) push("error", `Escolha o canal ${label}.`);

    const active = panelTicketTypes(config, panel);
    if (!active.length) push("error", `Adicione pelo menos um tipo ${label}.`);
    if (panel.displayMode === "buttons" && active.length > 5) {
      push(
        "error",
        `O painel "${panel.name}" usa um botão por tipo; o Discord aceita no máximo 5. Use o formato de menu ou reduza os tipos.`,
      );
    }
    if (panel.buttonLabel.length > 80) {
      push("warn", `O texto do botão do painel "${panel.name}" será cortado em 80 caracteres.`);
    }

    const nameKey = panel.name.toLowerCase();
    if (usedNames.has(nameKey)) push("warn", `Dois painéis usam o nome "${panel.name}".`);
    usedNames.add(nameKey);

    if (panel.channelId) {
      if (usedChannels.has(panel.channelId)) {
        push(
          "warn",
          `Dois painéis publicam no mesmo canal. O segundo pode substituir a mensagem do primeiro.`,
        );
      }
      usedChannels.add(panel.channelId);
    }
  });

  if (!asString(config.categoryId).trim()) {
    push("warn", "Defina a categoria onde os canais de atendimento serão criados.");
  }
  if (!asList(config.staffRoleIds).length) {
    push("warn", "Nenhum cargo de equipe definido: o ticket abre sem ninguém ver além do autor.");
  }
  const naming = asString(config.namingPattern).trim();
  if (!/\{(user|department|number)\}/.test(naming)) {
    push("warn", "O padrão de nome não usa {user}, {department} ou {number}: todos os canais ficam iguais.");
  }
  const sla = Number(config.slaWarningMinutes);
  if (!Number.isFinite(sla) || sla <= 0) {
    push("warn", "SLA de aviso desligado: a equipe não recebe alerta de ticket parado.");
  }

  return issues;
}

export function hasBlockingIssues(issues: PreflightIssue[]): boolean {
  return issues.some((issue) => issue.level === "error");
}
