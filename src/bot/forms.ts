/**
 * Formularios (candidaturas) — construcao profissional.
 *
 * O modelo antigo era uma lista de perguntas de texto. Isso nao cobre o que um
 * formulario de verdade precisa: escolher entre opcoes, marcar um assunto,
 * limitar tamanho por campo, exigir ou nao cada resposta.
 *
 * COMO O FLUXO FUNCIONA (e por que assim):
 *
 * O Discord NAO aceita select menu dentro de modal na versao de discord.js
 * deste projeto (14.22 — o suporte chegou na 14.23). Entao o fluxo e em duas
 * etapas, que e exatamente o que tickets.bot e tickettool fazem:
 *
 *   1. a pessoa escolhe nas selecoes (mensagem efemera);
 *   2. o modal abre com as perguntas de texto, ja sabendo o que foi escolhido.
 *
 * As escolhas ficam num RASCUNHO persistido, nao no `custom_id`: o Discord
 * limita o id a 100 caracteres, e carregar resposta ali quebraria com o
 * primeiro texto mais longo.
 */
import {
  ActionRowBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Guild,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction
} from "discord.js";
import { bool, isEnabled, list, moduleConfig, num, str } from "./config.ts";
import { id } from "./ids.ts";
import { auditAndLog } from "./logs.ts";
import type { Logger } from "./logger.ts";
import { buildPanelPayload } from "./panels.ts";
import { asSendable, resolveChannel, resolveRoles } from "./resolve.ts";
import { mutate, nextId, read } from "./store.ts";

export type SubmissionStatus = "pending" | "approved" | "rejected";

export type FieldType = "short" | "paragraph" | "select";

export type FormField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  /** So para `select`. */
  options: string[];
  /** So para texto. */
  maxLength: number;
};

export type FormSubmission = {
  id: number;
  guildId: string;
  userId: string;
  questions: string[];
  answers: string[];
  status: SubmissionStatus;
  reviewedBy: string | null;
  reviewReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  channelId: string | null;
  messageId: string | null;
};

/** O modal do Discord aceita 5 componentes no total. */
export const MODAL_TEXT_LIMIT = 5;
/** Um select aceita 25 opcoes; e 5 selects cabem numa mensagem. */
export const SELECT_OPTION_LIMIT = 25;
export const SELECT_ROW_LIMIT = 5;

const DEFAULT_QUESTIONS = [
  "Qual o seu nome ou apelido?",
  "Por que quer fazer parte da equipe?",
  "Qual a sua experiencia relevante?"
];

const TYPES: FieldType[] = ["short", "paragraph", "select"];

function normalizeType(value: unknown): FieldType {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "select" || text === "choice" || text === "escolha") return "select";
  if (text === "short" || text === "curto" || text === "text") return "short";
  return "paragraph";
}

/**
 * Converte a config do painel em campos tipados.
 *
 * Aceita o formato novo (`fields`) e o antigo (`questions: string[]`), para nao
 * quebrar servidor que ja configurou o formulario antes desta versao.
 */
export function parseFields(config: Record<string, unknown> | null): FormField[] {
  const raw = config?.fields;

  if (Array.isArray(raw) && raw.length) {
    const fields: FormField[] = [];

    raw.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const row = item as Record<string, unknown>;

      const label = String(row.label ?? row.question ?? "").trim();
      if (!label) return;

      const type = normalizeType(row.type);
      const options = Array.isArray(row.options)
        ? row.options.map((option) => String(option).trim()).filter(Boolean).slice(0, SELECT_OPTION_LIMIT)
        : [];

      // Um select sem opcoes nao tem como funcionar: cai para texto em vez de
      // gerar um menu vazio que a pessoa nao consegue responder.
      const effective: FieldType = type === "select" && options.length < 2 ? "paragraph" : type;

      fields.push({
        id: String(row.id ?? `f${index + 1}`).slice(0, 40) || `f${index + 1}`,
        label,
        type: effective,
        required: row.required !== false,
        options,
        maxLength: Math.max(1, Math.min(1000, Math.trunc(Number(row.maxLength ?? 500)) || 500))
      });
    });

    if (fields.length) return fields;
  }

  // Formato antigo: lista de perguntas de texto.
  const legacy = list(config, "questions").filter(Boolean);
  const questions = legacy.length ? legacy : DEFAULT_QUESTIONS;

  return questions.map((question, index) => ({
    id: `q${index}`,
    label: question,
    type: index === 0 ? "short" : "paragraph",
    required: true,
    options: [],
    maxLength: index === 0 ? 100 : 1000
  }));
}

/** Campos que vao para o modal (texto). */
export function textFields(fields: FormField[]): FormField[] {
  return fields.filter((field) => field.type !== "select").slice(0, MODAL_TEXT_LIMIT);
}

/** Campos de selecao, que viram menus na mensagem. */
export function selectFields(fields: FormField[]): FormField[] {
  return fields.filter((field) => field.type === "select").slice(0, SELECT_ROW_LIMIT);
}

/* ------------------------------------------------------------- rascunho --- */

export type FormDraft = {
  key: string;
  guildId: string;
  userId: string;
  values: Record<string, string>;
  createdAt: string;
};

const DRAFT_TTL_MS = 15 * 60_000;

/** Cria (ou reinicia) o rascunho de um formulario em andamento. */
export async function startDraft(guildId: string, userId: string): Promise<FormDraft> {
  const draft: FormDraft = {
    key: `${guildId}:${userId}`,
    guildId,
    userId,
    values: {},
    createdAt: new Date().toISOString()
  };

  await mutate<FormDraft>("form_drafts", (rows) => {
    const kept = rows.filter(
      (row) => row.key !== draft.key && Date.now() - Date.parse(row.createdAt) < DRAFT_TTL_MS
    );
    kept.push(draft);
    return kept;
  });

  return draft;
}

export async function readDraft(guildId: string, userId: string): Promise<FormDraft | null> {
  const rows = await read<FormDraft>("form_drafts");
  const found = rows.find((row) => row.key === `${guildId}:${userId}`);
  if (!found) return null;
  if (Date.now() - Date.parse(found.createdAt) > DRAFT_TTL_MS) return null;
  return found;
}

/** Grava uma escolha no rascunho e devolve o estado atualizado. */
export async function saveChoice(
  guildId: string,
  userId: string,
  fieldId: string,
  value: string
): Promise<FormDraft | null> {
  let updated: FormDraft | null = null;

  await mutate<FormDraft>("form_drafts", (rows) => {
    const row = rows.find((entry) => entry.key === `${guildId}:${userId}`);
    if (!row) return rows;
    row.values[fieldId] = value.slice(0, 100);
    updated = row;
    return rows;
  });

  return updated;
}

export async function clearDraft(guildId: string, userId: string): Promise<void> {
  await mutate<FormDraft>("form_drafts", (rows) => rows.filter((row) => row.key !== `${guildId}:${userId}`));
}

/* ----------------------------------------------------------- construcao --- */

/** Modal com os campos de texto, ja sabendo o que foi escolhido antes. */
export function buildFormModal(fields: FormField[], modalKey: string, chosen: Record<string, string> = {}): ModalBuilder {
  const text = textFields(fields);
  const effective = text.length
    ? text
    : [{ id: "obs", label: "Observacoes", type: "paragraph" as FieldType, required: false, options: [], maxLength: 500 }];

  const title = Object.values(chosen).length ? `Candidatura · ${Object.values(chosen)[0]!.slice(0, 30)}` : "Candidatura";
  const modal = new ModalBuilder().setCustomId(modalKey).setTitle(title.slice(0, 45));

  effective.forEach((field) => {
    const input = new TextInputBuilder()
      .setCustomId(field.id)
      .setLabel(field.label.slice(0, 45))
      .setStyle(field.type === "short" ? TextInputStyle.Short : TextInputStyle.Paragraph)
      .setRequired(field.required)
      .setMaxLength(field.maxLength);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  });

  return modal;
}

/**
 * Linhas de selecao, marcando o que ja foi escolhido.
 *
 * O `default` importa: sem ele, a pessoa que volta para trocar uma resposta ve
 * o menu vazio e nao sabe o que ja tinha escolhido.
 */
export function buildSelectRows(fields: FormField[], chosen: Record<string, string>) {
  return selectFields(fields).map((field) => {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(id("form", "pick", field.id))
      .setPlaceholder(field.label.slice(0, 100))
      .setMinValues(field.required ? 1 : 0)
      .setMaxValues(1)
      .addOptions(
        field.options.map((option) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(option.slice(0, 100))
            .setValue(option.slice(0, 100))
            .setDefault(chosen[field.id] === option)
        )
      );

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
  });
}

/** Sobrou alguma selecao obrigatoria em aberto? */
export function pendingSelects(fields: FormField[], chosen: Record<string, string>): FormField[] {
  return selectFields(fields).filter((field) => field.required && !chosen[field.id]);
}

/** Resumo do que ja foi escolhido, para a mensagem intermediaria. */
export function describeChoices(fields: FormField[], chosen: Record<string, string>): string {
  const answered = selectFields(fields)
    .filter((field) => chosen[field.id])
    .map((field) => `**${field.label}** → ${chosen[field.id]}`);

  if (!answered.length) return "Escolha as opcoes abaixo para continuar.";

  const missing = pendingSelects(fields, chosen).map((field) => field.label);
  return [answered.join("\n"), missing.length ? `\nFalta: ${missing.join(", ")}` : ""].join("");
}

/* --------------------------------------------------------------- envio --- */

export type SubmitResult =
  | { ok: true; submission: FormSubmission }
  | { ok: false; error: string };

/**
 * Valida os limites configurados e grava o envio.
 *
 * A checagem de idade da conta e a de cooldown usam `createdTimestamp` real do
 * Discord e o historico gravado — nao ha como burlar reenviando.
 */
export async function submitForm(
  interaction: ModalSubmitInteraction,
  log: Logger
): Promise<SubmitResult> {
  const guild = interaction.guild;
  if (!guild) return { ok: false, error: "Este formulario so funciona em servidor." };

  const config = await moduleConfig(guild.id, "forms");
  if (!isEnabled(config)) {
    return { ok: false, error: "As candidaturas estao pausadas neste servidor." };
  }

  const minAgeDays = Math.trunc(num(config, "minAccountAgeDays", 0));
  if (minAgeDays > 0) {
    const ageDays = (Date.now() - interaction.user.createdTimestamp) / 86_400_000;
    if (ageDays < minAgeDays) {
      return {
        ok: false,
        error: `Sua conta precisa ter pelo menos **${minAgeDays} dia(s)**. A sua tem ${Math.floor(ageDays)}.`
      };
    }
  }

  const history = (await read<FormSubmission>("forms")).filter(
    (row) => row.guildId === guild.id && row.userId === interaction.user.id
  );

  const maxSubmissions = Math.max(1, Math.trunc(num(config, "maxSubmissionsPerUser", 3)));
  if (history.length >= maxSubmissions) {
    return { ok: false, error: `Voce ja atingiu o limite de ${maxSubmissions} candidatura(s).` };
  }

  const cooldownHours = Math.trunc(num(config, "cooldownHours", 0));
  if (cooldownHours > 0 && history.length) {
    const last = history
      .map((row) => Date.parse(row.createdAt))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => b - a)[0];

    if (last) {
      const elapsedHours = (Date.now() - last) / 3_600_000;
      if (elapsedHours < cooldownHours) {
        const remaining = Math.ceil(cooldownHours - elapsedHours);
        return { ok: false, error: `Aguarde **${remaining}h** para enviar outra candidatura.` };
      }
    }
  }

  const fields = parseFields(config);
  const draft = await readDraft(guild.id, interaction.user.id);
  const chosen = draft?.values ?? {};

  const usedQuestions: string[] = [];
  const answers: string[] = [];

  // Primeiro as escolhas: elas vieram da etapa anterior e sao a parte mais
  // importante do formulario (assunto, area, disponibilidade).
  for (const field of selectFields(fields)) {
    if (!chosen[field.id]) continue;
    usedQuestions.push(field.label);
    answers.push(chosen[field.id]!);
  }

  // `.values()` primeiro: numa Collection o segundo argumento do forEach e a
  // CHAVE (o customId, string), nao um indice.
  const byId = new Map(textFields(fields).map((field) => [field.id, field]));
  [...interaction.fields.fields.values()].forEach((entry) => {
    // `ModalData` e um union que inclui checkbox group, que nao tem `value`.
    const answer = "value" in entry && typeof entry.value === "string" ? entry.value : "";
    const field = byId.get(entry.customId);
    usedQuestions.push(field?.label ?? entry.customId);
    answers.push(answer.slice(0, 1000));
  });

  const submissionId = await nextId("forms");
  const anonymous = bool(config, "anonymousSubmissions", false);

  const submission: FormSubmission = {
    id: submissionId,
    guildId: guild.id,
    userId: interaction.user.id,
    questions: usedQuestions,
    answers,
    status: "pending",
    reviewedBy: null,
    reviewReason: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
    channelId: null,
    messageId: null
  };

  const reviewChannel = resolveChannel(guild, str(config, "reviewChannelId"));
  const target = asSendable(reviewChannel ?? interaction.channel);

  if (target) {
    try {
      const reviewers = resolveRoles(guild, list(config, "reviewerRoleIds"));
      const ping = bool(config, "notifyReviewers", true) && reviewers.length
        ? reviewers.map((role) => `<@&${role.id}>`).join(" ")
        : "";

      // Monta o painel fora do `send`: espalhar um valor tipado como `never`
      // dentro do literal e erro de tipo. O cast fica no argumento inteiro.
      const panel = buildPanelPayload({
        // O cabecalho e o ping vao DENTRO do container: uma mensagem com o flag
        // V2 nao aceita `content`, e misturar os dois e erro 400. Era por isso
        // que a candidatura era gravada mas nunca chegava ao canal de revisao.
        // Mencoes em text display notificam normalmente.
        header: [
          anonymous ? "Candidatura anônima" : `Candidatura de <@${interaction.user.id}> · **#${submissionId}**`,
          ping
        ].filter(Boolean).join("\n"),
        title: str(config, "panelTitle", "Candidatura"),
        description: usedQuestions
          .map((question, index) => `**${question}**\n${answers[index] ?? ""}`)
          .join("\n\n"),
        accentColor: str(config, "panelAccentColor", "#7c5cff"),
        buttons: [
          { label: "Aprovar", customId: id("form", "approve", submissionId), style: 3 },
          { label: "Recusar", customId: id("form", "reject", submissionId), style: 4 }
        ]
      });

      const message = await target.send({
        flags: panel.flags,
        components: panel.components
      } as never);

      submission.channelId = message.channelId;
      submission.messageId = message.id;
    } catch (error) {
      log.warn("candidatura gravada mas nao publicada", { guildId: guild.id, submissionId, error: String(error) });
    }
  }

  await mutate<FormSubmission>("forms", (rows) => {
    rows.push(submission);
    return rows;
  });

  await clearDraft(guild.id, interaction.user.id);

  await auditAndLog(
    guild,
    {
      module: "forms",
      category: "members",
      eventType: "form_submitted",
      actorId: interaction.user.id,
      severity: "info",
      title: `CANDIDATURA #${submissionId}`,
      description: anonymous
        ? "Nova candidatura anonima."
        : `<@${interaction.user.id}> enviou uma candidatura.`,
      accentColor: "#7c5cff",
      fields: usedQuestions.map((question, index) => ({
        name: question.slice(0, 100),
        value: (answers[index] ?? "").slice(0, 1000)
      }))
    },
    log
  );

  log.info("candidatura recebida", { guildId: guild.id, submissionId, userId: interaction.user.id });
  return { ok: true, submission };
}

/**
 * Aprova ou recusa. Quando o servidor exige motivo, recusar sem motivo e
 * bloqueado — o candidato merece saber o porque.
 */
export async function reviewForm(
  guild: Guild,
  submissionId: number,
  reviewerId: string,
  decision: "approved" | "rejected",
  reason: string | null,
  log: Logger
): Promise<{ ok: boolean; error?: string; userId?: string }> {
  const config = await moduleConfig(guild.id, "forms");

  if (
    decision === "rejected" &&
    bool(config, "requireReasonOnReject", true) &&
    !(reason ?? "").trim()
  ) {
    return { ok: false, error: "Este servidor exige um motivo para recusar." };
  }

  let userId: string | undefined;
  let found = false;

  await mutate<FormSubmission>("forms", (rows) => {
    const row = rows.find(
      (entry) => entry.guildId === guild.id && entry.id === submissionId && entry.status === "pending"
    );
    if (!row) return rows;

    row.status = decision;
    row.reviewedBy = reviewerId;
    row.reviewReason = reason ? reason.slice(0, 500) : null;
    row.reviewedAt = new Date().toISOString();
    userId = row.userId;
    found = true;
    return rows;
  });

  if (!found) return { ok: false, error: "Candidatura nao encontrada ou ja revisada." };

  if (userId) {
    try {
      const user = await guild.client.users.fetch(userId);
      const verdict = decision === "approved" ? "aprovada" : "recusada";
      await user.send(
        `Sua candidatura em **${guild.name}** foi **${verdict}**.` +
        (reason?.trim() ? `\nMotivo: ${reason.trim()}` : "")
      );
    } catch {
      // DM fechada: a decisao continua valendo.
    }
  }

  await auditAndLog(
    guild,
    {
      module: "forms",
      category: "members",
      eventType: `form_${decision}`,
      actorId: reviewerId,
      targetId: userId,
      severity: "info",
      title: `CANDIDATURA #${submissionId} ${decision === "approved" ? "APROVADA" : "RECUSADA"}`,
      description: `<@${reviewerId}> ${decision === "approved" ? "aprovou" : "recusou"} a candidatura${userId ? ` de <@${userId}>` : ""}.`,
      accentColor: decision === "approved" ? "#3ecf8e" : "#ff5c6c",
      fields: reason?.trim() ? [{ name: "Motivo", value: reason.trim().slice(0, 1024) }] : []
    },
    log
  );

  log.info("candidatura revisada", { guildId: guild.id, submissionId, decision, reviewerId });
  return { ok: true, userId };
}

/** Painel publicavel do modulo de candidaturas. */
export async function buildFormPanel(guild: Guild) {
  const config = await moduleConfig(guild.id, "forms");

  return buildPanelPayload({
    title: str(config, "panelTitle", "Candidaturas"),
    description: str(config, "panelDescription", "Envie sua candidatura pelo formulario."),
    accentColor: str(config, "panelAccentColor", "#7c5cff"),
    buttons: [{ label: "Candidatar-se", customId: id("form", "open"), style: 1, emoji: "📝" }]
  });
}

/**
 * Abre o formulario para quem clicou.
 *
 * Se ha selecoes, mostra os menus primeiro; se so ha texto, vai direto ao modal.
 * Quem chama isto e o handler do botao "Candidatar-se".
 */
export async function openForm(
  interaction: { guild: Guild | null; user: { id: string }; reply: Function; showModal: Function },
  log: Logger
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const config = await moduleConfig(guild.id, "forms");
  if (!isEnabled(config)) {
    await interaction.reply({ content: "As candidaturas estao pausadas neste servidor.", ephemeral: true });
    return;
  }

  const fields = parseFields(config);
  const selects = selectFields(fields);

  if (!selects.length) {
    await interaction.showModal(buildFormModal(fields, id("form", "submit")));
    return;
  }

  const draft = await startDraft(guild.id, interaction.user.id);

  await interaction.reply({
    content: describeChoices(fields, draft.values),
    ephemeral: true,
    components: buildSelectRows(fields, draft.values)
  });
}

/**
 * Trata uma escolha feita.
 *
 * Quando falta alguma selecao obrigatoria, a mensagem e atualizada no lugar —
 * assim a pessoa ve o que ja respondeu em vez de acumular mensagens.
 */
export async function handleFormSelect(
  interaction: StringSelectMenuInteraction,
  fieldId: string,
  log: Logger
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const config = await moduleConfig(guild.id, "forms");
  const fields = parseFields(config);

  const value = interaction.values[0] ?? "";
  const draft = await saveChoice(guild.id, interaction.user.id, fieldId, value);

  if (!draft) {
    await interaction.reply({ content: "Este formulario expirou. Clique em **Candidatar-se** de novo.", ephemeral: true });
    return;
  }

  const missing = pendingSelects(fields, draft.values);

  if (missing.length) {
    await interaction.update({
      content: describeChoices(fields, draft.values),
      components: buildSelectRows(fields, draft.values)
    });
    log.info("escolha registrada no formulario", { guildId: guild.id, fieldId });
    return;
  }

  // Tudo escolhido: oferece o botao que abre o modal.
  await interaction.update({
    content: `${describeChoices(fields, draft.values)}\n\nTudo certo. Continue para responder as perguntas.`,
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 1, label: "Continuar", custom_id: id("form", "continue") }
        ]
      }
    ] as never
  });
}
