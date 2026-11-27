/**
 * Pre-checagem de configuração antes de publicar.
 *
 * O bot já valida tudo na hora de publicar, mas o erro só aparecia depois do
 * pedido entrar na fila (falha assíncrona, no Discord). Estas regras são puras
 * e rodam na dashboard antes do clique: o que é erro bloqueia, o que é aviso
 * aparece mas deixa publicar.
 */
/** Sem dependência de `engine.ts`: os testes rodam este arquivo direto no Node. */
function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export type PreflightIssue = {
  level: "error" | "warn";
  message: string;
};

type DepartmentLike = {
  name?: string;
  intakeQuestions?: unknown;
};

function departmentsOf(config: Record<string, unknown>): DepartmentLike[] {
  const saved = Array.isArray(config.departmentSettings)
    ? config.departmentSettings.filter(
        (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
  if (saved.length) return saved.map((item) => ({ name: asString(item.name), intakeQuestions: item.intakeQuestions }));
  return asList(config.departments).map((name) => ({ name, intakeQuestions: [] }));
}

function questionsOf(department: DepartmentLike): string[] {
  return Array.isArray(department.intakeQuestions)
    ? department.intakeQuestions.filter((question): question is string => typeof question === "string")
    : [];
}

export function ticketPanelPreflight(config: Record<string, unknown>): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const departments = departmentsOf(config);
  const names = departments.map((department) => (department.name ?? "").trim());
  const displayMode = asString(config.departmentDisplayMode, "select");

  if (!asString(config.panelChannelId).trim()) {
    issues.push({ level: "error", message: "Escolha o canal onde o painel será publicado." });
  }
  if (!asString(config.categoryId).trim()) {
    issues.push({ level: "warn", message: "Sem categoria definida: os canais privados nascem na raiz do servidor." });
  }
  if (!departments.length) {
    issues.push({ level: "error", message: "Crie pelo menos um tipo de atendimento." });
  }
  if (names.some((name) => !name)) {
    issues.push({ level: "error", message: "Todo tipo de atendimento precisa de um nome." });
  }
  if (names.some((name) => name.length > 100)) {
    issues.push({ level: "error", message: "O nome de um tipo de atendimento passa de 100 caracteres." });
  }
  const normalized = names.filter(Boolean).map((name) => name.toLocaleLowerCase("pt-BR"));
  if (new Set(normalized).size !== normalized.length) {
    issues.push({ level: "error", message: "Há tipos de atendimento com nomes repetidos." });
  }
  if (displayMode === "buttons" && departments.length > 5) {
    issues.push({ level: "error", message: "No formato de botões, o Discord aceita no máximo 5 tipos de atendimento." });
  }
  for (const department of departments) {
    const questions = questionsOf(department);
    const label = (department.name ?? "").trim() || "sem nome";
    if (questions.length > 5) {
      issues.push({ level: "error", message: `“${label}” tem mais de 5 perguntas; o Discord aceita até 5.` });
    }
    if (questions.some((question) => !question.trim())) {
      issues.push({ level: "error", message: `“${label}” tem uma pergunta vazia.` });
    }
    if (questions.some((question) => question.length > 45)) {
      issues.push({ level: "error", message: `“${label}” tem pergunta acima de 45 caracteres.` });
    }
  }
  if (!asList(config.staffRoleIds).length) {
    issues.push({ level: "warn", message: "Nenhum cargo de equipe configurado: só quem tem Gerenciar servidor verá os tickets." });
  }
  const namingPattern = asString(config.namingPattern, "atendimento-{user}");
  if (!/\{(user|department|number)\}/.test(namingPattern)) {
    issues.push({ level: "warn", message: "O nome do canal não usa {user}, {department} nem {number}: todos ficariam com o mesmo nome." });
  }
  if (Number(config.slaWarningMinutes ?? 0) <= 0) {
    issues.push({ level: "warn", message: "Sem aviso de SLA: a equipe não será alertada sobre tickets parados." });
  }

  return issues;
}

export function hasBlockingIssues(issues: PreflightIssue[]): boolean {
  return issues.some((issue) => issue.level === "error");
}
