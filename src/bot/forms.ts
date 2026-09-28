import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Routes,
  type Client,
  type Interaction,
  type ModalSubmitInteraction
} from "discord.js";
import { getPool, resolveModuleConfig, recordAuditEvent } from "../server/db/index.js";

type Logger = {
  info: (message: string, extra?: Record<string, unknown>) => void;
  error: (message: string, extra?: Record<string, unknown>) => void;
};

const DEFAULT_QUESTIONS = [
  "Qual o seu nome ou apelido?",
  "Por que quer fazer parte da equipe?",
  "Qual a sua experiência relevante?"
];

function resolveQuestions(config: Record<string, unknown>): string[] {
  const raw = Array.isArray(config.questions)
    ? (config.questions as unknown[]).filter((q): q is string => typeof q === "string" && q.trim().length > 0)
    : [];
  return (raw.length ? raw : DEFAULT_QUESTIONS).slice(0, 5);
}

export async function handleFormOpen(
  interaction: Interaction,
  log: Logger
): Promise<void> {
  if (!interaction.isButton() || !interaction.guild) return;

  const guildId = interaction.guild.id;
  const config = await resolveModuleConfig(guildId, "forms");
  if (!config.enabled) {
    await interaction.reply({ content: "As candidaturas estão pausadas neste servidor.", flags: 64 });
    return;
  }

  const cooldownHours = typeof config.config.cooldownHours === "number"
    ? Math.max(0, Math.min(Math.ceil(config.config.cooldownHours), 720))
    : 24;
  if (cooldownHours > 0) {
    const recent = await getPool().query(
      `select 1 from form_submissions where guild_id = $1 and user_id = $2 and created_at > now() - make_interval(hours => $3) limit 1`,
      [guildId, interaction.user.id, cooldownHours]
    );
    if (recent.rowCount && recent.rowCount > 0) {
      await interaction.reply({
        content: `Você já enviou uma candidatura recentemente. Aguarde ${cooldownHours}h.`,
        flags: 64
      });
      return;
    }
  }

  const minDays = typeof config.config.minAccountAgeDays === "number" ? config.config.minAccountAgeDays : 0;
  if (minDays > 0) {
    const accountAge = (Date.now() - interaction.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    if (accountAge < minDays) {
      await interaction.reply({
        content: `Sua conta precisa ter pelo menos ${minDays} dia(s) para se candidatar.`,
        flags: 64
      });
      return;
    }
  }

  const maxSubmissions = typeof config.config.maxSubmissionsPerUser === "number"
    ? config.config.maxSubmissionsPerUser
    : 3;
  const userSubmissions = await getPool().query(
    `select count(*)::integer as cnt from form_submissions where guild_id = $1 and user_id = $2`,
    [guildId, interaction.user.id]
  );
  if ((userSubmissions.rows[0]?.cnt ?? 0) >= maxSubmissions) {
    await interaction.reply({
      content: `Você atingiu o limite de ${maxSubmissions} envio(s).`,
      flags: 64
    });
    return;
  }

  const questions = resolveQuestions(config.config);
  const modal = new ModalBuilder()
    .setCustomId(`wumpus:form:modal:${guildId}`)
    .setTitle(String(config.config.panelTitle ?? "Candidatura").slice(0, 45));

  for (let i = 0; i < questions.length; i++) {
    const label = questions[i].slice(0, 45);
    const input = new TextInputBuilder()
      .setCustomId(`q${i}`)
      .setLabel(label)
      .setStyle(i === 0 ? TextInputStyle.Short : TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(i === 0 ? 100 : 1000);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  }

  await interaction.showModal(modal);
}

export async function handleFormModalSubmit(
  interaction: ModalSubmitInteraction,
  client: Client | null,
  log: Logger
): Promise<void> {
  if (!interaction.guild) return;
  await interaction.deferReply({ flags: 64 });

  const guildId = interaction.guild.id;
  const config = await resolveModuleConfig(guildId, "forms");
  if (!config.enabled) {
    await interaction.editReply("As candidaturas estão pausadas neste servidor.");
    return;
  }

  const questions = resolveQuestions(config.config);
  const answers: Record<string, string> = {};
  for (let i = 0; i < questions.length; i++) {
    const value = interaction.fields.getTextInputValue(`q${i}`)?.trim() ?? "";
    if (!value) {
      await interaction.editReply("Preencha todas as perguntas.");
      return;
    }
    answers[questions[i]] = value.slice(0, 1000);
  }

  const reviewerRoleIds = Array.isArray(config.config.reviewerRoleIds)
    ? (config.config.reviewerRoleIds as string[])
    : [];

  const formResult = await getPool().query<{ id: number }>(
    `select id from forms where guild_id = $1 and is_active = true order by created_at limit 1`,
    [guildId]
  );
  let formId = formResult.rows[0]?.id;
  if (!formId) {
    const created = await getPool().query<{ id: number }>(
      `insert into forms (guild_id, name, description, reviewer_role_ids, fields)
       values ($1, 'Candidaturas', 'Formulário padrão', $2, $3::jsonb) returning id`,
      [guildId, reviewerRoleIds, JSON.stringify(questions.map((q) => ({ label: q, type: "text" })))]
    );
    formId = created.rows[0].id;
  }

  const result = await getPool().query<{ id: number }>(
    `insert into form_submissions (form_id, guild_id, user_id, answers, status)
     values ($1, $2, $3, $4::jsonb, 'pending') returning id`,
    [formId, guildId, interaction.user.id, JSON.stringify({ ...answers, submittedAt: new Date().toISOString() })]
  );
  const submissionId = result.rows[0].id;

  const reviewChannelId =
    typeof config.config.reviewChannelId === "string" ? config.config.reviewChannelId : "";
  if (reviewChannelId && client) {
    const roleMentions = reviewerRoleIds.length
      ? reviewerRoleIds.map((id) => `<@&${id}>`).join(" ")
      : "";
    const answerBlock = Object.entries(answers)
      .map(([q, a]) => `**${q}**\n${a}`)
      .join("\n\n")
      .slice(0, 1800);
    await client.rest
      .post(Routes.channelMessages(reviewChannelId), {
        body: {
          content: `📝 Nova candidatura #${submissionId} de <@${interaction.user.id}> ${roleMentions}\n\n${answerBlock}`.slice(0, 2000),
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 3, label: "Aprovar", custom_id: `wumpus:form:approve:${submissionId}` },
                { type: 2, style: 4, label: "Rejeitar", custom_id: `wumpus:form:reject:${submissionId}` }
              ]
            }
          ]
        }
      })
      .catch(() => undefined);
  }

  await recordAuditEvent({
    guildId,
    module: "forms",
    eventType: "form_submitted",
    actorId: interaction.user.id,
    data: { submissionId, questionCount: questions.length }
  }).catch(() => undefined);

  await interaction.editReply(`Candidatura #${submissionId} enviada! A equipe vai analisar.`);
  log.info("candidatura enviada", { guildId, submissionId, userId: interaction.user.id });
}

export async function handleFormReview(
  interaction: Interaction,
  rawSubmissionId: string,
  decision: "approved" | "rejected",
  client: Client | null,
  log: Logger
): Promise<void> {
  if (!interaction.isButton() || !interaction.guild) return;
  await interaction.deferReply({ flags: 64 });

  const submissionId = Number(rawSubmissionId);
  if (!Number.isSafeInteger(submissionId)) {
    await interaction.editReply("Candidatura inválida.");
    return;
  }

  const guildId = interaction.guild.id;
  const config = await resolveModuleConfig(guildId, "forms");
  const reviewerRoleIds = Array.isArray(config.config.reviewerRoleIds)
    ? (config.config.reviewerRoleIds as string[])
    : [];

  const member = interaction.member;
  if (reviewerRoleIds.length && member && "roles" in member) {
    const roles = member.roles as { cache: { some: (fn: (r: { id: string }) => boolean) => boolean } };
    const isReviewer = roles.cache.some((r) => reviewerRoleIds.includes(r.id));
    if (!isReviewer && interaction.guild.ownerId !== interaction.user.id) {
      await interaction.editReply("Apenas revisores podem avaliar candidaturas.");
      return;
    }
  }

  const result = await getPool().query<{ id: number; userId: string; status: string }>(
    `select id, user_id as "userId", status from form_submissions where id = $1 and guild_id = $2`,
    [submissionId, guildId]
  );
  const submission = result.rows[0];
  if (!submission) {
    await interaction.editReply("Candidatura não encontrada.");
    return;
  }
  if (submission.status !== "pending") {
    await interaction.editReply(
      `Essa candidatura já foi ${submission.status === "approved" ? "aprovada" : "rejeitada"}.`
    );
    return;
  }

  await getPool().query(
    `update form_submissions set status = $1, reviewed_by = $2, reviewed_at = now() where id = $3 and guild_id = $4`,
    [decision, interaction.user.id, submissionId, guildId]
  );

  await recordAuditEvent({
    guildId,
    module: "forms",
    eventType: decision === "approved" ? "form_approved" : "form_rejected",
    actorId: interaction.user.id,
    targetId: submission.userId,
    data: { submissionId }
  }).catch(() => undefined);

  const label = decision === "approved" ? "aprovada" : "rejeitada";
  await interaction.editReply(`Candidatura #${submissionId} ${label}.`);

  if (client) {
    try {
      const dm = await client.users.createDM(submission.userId);
      await client.rest.post(Routes.channelMessages(dm.id), {
        body: {
          content:
            decision === "approved"
              ? `Sua candidatura #${submissionId} foi **aprovada**. A equipe entrará em contato se precisar de mais informações.`
              : `Sua candidatura #${submissionId} foi **rejeitada**. Você pode tentar novamente mais tarde, se permitido.`
        }
      });
    } catch {
      /* DM fechada */
    }
  }

  log.info(`candidatura ${label}`, {
    guildId,
    submissionId,
    reviewedBy: interaction.user.id,
    userId: submission.userId
  });
}
