import type { ModuleId } from "../core/brand";

/* ------------------------------------------------------------------ *
 * Especificacao dos campos de cada modulo.
 *
 * Canais e cargos agora usam seletores visuais, alimentados pelo que o bot
 * sincroniza do Discord. O valor gravado continua sendo o ID numerico — o
 * que muda e como o usuario escolhe: em vez de colar um ID, ele ve o nome.
 * ------------------------------------------------------------------ */

export type GuildAssetsLite = {
  channels: Array<{ id: string; name: string; type: number; parentId: string | null; position: number }>;
  roles: Array<{ id: string; name: string; color: number; position: number; managed: boolean }>;
};

export type ChannelFilter = "text" | "category" | "any";

type FieldBase = { key: string; label: string; help?: string; section?: string };

export type Field =
  | (FieldBase & { type: "boolean" })
  | (FieldBase & { type: "number"; min?: number; max?: number })
  | (FieldBase & { type: "text"; maxLength?: number; placeholder?: string })
  | (FieldBase & { type: "longtext"; maxLength?: number; placeholder?: string })
  | (FieldBase & { type: "color" })
  | (FieldBase & { type: "select"; options: Array<{ value: string; label: string }> })
  | (FieldBase & { type: "list"; placeholder?: string })
  | (FieldBase & { type: "channel"; filter?: ChannelFilter })
  | (FieldBase & { type: "channel-list"; filter?: ChannelFilter })
  | (FieldBase & { type: "role-list" })
  | (FieldBase & { type: "snowflake" });

/** Tipos de canal do Discord que recebem mensagens (texto, anúncio, fórum). */
const TEXT_CHANNEL_TYPES = [0, 5, 15];
const CATEGORY_TYPE = 4;

const panelFormat: Field = {
  key: "panelFormat",
  label: "Formato do painel",
  type: "select",
  options: [
    { value: "components_v2", label: "Components V2 (moderno e interativo)" },
    { value: "embed", label: "Embed tradicional" }
  ],
  help: "Components V2 permite botões e layout mais rico."
};

const panelTitle: Field = { key: "panelTitle", label: "Título do painel", type: "text", maxLength: 100 };
const panelDescription: Field = {
  key: "panelDescription",
  label: "Descrição do painel",
  type: "longtext",
  maxLength: 800
};
const panelColor: Field = { key: "panelAccentColor", label: "Cor de destaque", type: "color" };

export const moduleFields: Record<ModuleId, Field[]> = {
  servers: [
    { key: "syncEveryMinutes", label: "Sincronizar a cada (minutos)", type: "number", min: 5, max: 1440, section: "Sincronização" },
    { key: "syncRoles", label: "Sincronizar cargos", type: "boolean", section: "Sincronização" },
    { key: "syncChannels", label: "Sincronizar canais", type: "boolean", section: "Sincronização" },
    { key: "announceJoinChannelId", label: "Canal de boas-vindas", type: "channel", section: "Anúncios" },
    { key: "joinMessage", label: "Mensagem de boas-vindas", type: "longtext", maxLength: 500, placeholder: "Use {user} para mencionar a pessoa.", section: "Anúncios" },
    { key: "announceLeaveChannelId", label: "Canal de saídas", type: "channel", section: "Anúncios" },
    { key: "leaveMessage", label: "Mensagem de saída", type: "longtext", maxLength: 500, placeholder: "Use {user} para o nome da pessoa.", section: "Anúncios" },
    { key: "nicknameOnJoin", label: "Sugerir apelido na entrada", type: "boolean", help: "Não aplica sozinho: só registra a sugestão para a equipe.", section: "Anúncios" },
    { key: "maintenanceMode", label: "Modo manutenção", type: "boolean", help: "Ao ativar, o bot envia a mensagem abaixo em vez de responder normalmente.", section: "Manutenção" },
    { key: "maintenanceMessage", label: "Mensagem de manutenção", type: "longtext", maxLength: 500, section: "Manutenção" }
  ],
  statistics: [
    { key: "retentionDays", label: "Guardar histórico (dias)", type: "number", min: 30, max: 730, section: "Retenção" },
    { key: "anonymizeUsers", label: "Anonimizar pessoas nas estatísticas", type: "boolean", help: "Guarda contagens, não identidade.", section: "Retenção" },
    { key: "trackMessages", label: "Contar mensagens", type: "boolean", help: "Apenas contagem. O conteúdo não é gravado.", section: "O que medir" },
    { key: "trackVoice", label: "Contar tempo em voz", type: "boolean", section: "O que medir" },
    { key: "trackJoins", label: "Contar entradas e saídas", type: "boolean", section: "O que medir" },
    { key: "trackTickets", label: "Contar atendimentos", type: "boolean", section: "O que medir" },
    { key: "trackReactions", label: "Contar reações", type: "boolean", section: "O que medir" },
    { key: "trackCommands", label: "Contar comandos usados", type: "boolean", section: "O que medir" },
    { key: "digestChannelId", label: "Canal do resumo diário", type: "channel", section: "Resumo" },
    { key: "digestHourUtc", label: "Hora do resumo (UTC)", type: "number", min: 0, max: 23, section: "Resumo" },
    { key: "highlightTopMembers", label: "Destaques no resumo", type: "number", min: 0, max: 20, help: "Quantos membros mais ativos aparecem no resumo.", section: "Resumo" },
    { key: "exportFormat", label: "Formato de exportação", type: "select", section: "Exportação", options: [
      { value: "json", label: "JSON" },
      { value: "csv", label: "CSV" }
    ]}
  ],
  staff: [
    { key: "staffRoleIds", label: "Cargos da equipe", type: "role-list", section: "Equipe" },
    { key: "logChannelId", label: "Canal de registro", type: "channel", section: "Equipe" },
    { key: "shiftLogChannelId", label: "Canal de plantão", type: "channel", section: "Equipe" },
    { key: "escalationRoleId", label: "Cargo de escalonamento", type: "role-list", help: "Notificado quando um atendimento é escalonado.", section: "Equipe" },
    { key: "performanceWindowDays", label: "Janela de desempenho (dias)", type: "number", min: 7, max: 180, section: "Desempenho" },
    { key: "inactivityDays", label: "Dias sem ação para marcar inativo", type: "number", min: 3, max: 90, section: "Desempenho" },
    { key: "responseTimeGoalMinutes", label: "Meta de tempo de resposta (min)", type: "number", min: 5, max: 480, help: "Atendimentos que ultrapassam isso ganham alerta.", section: "Desempenho" },
    { key: "maxConcurrentTickets", label: "Atendimentos simultâdos por staff", type: "number", min: 1, max: 50, section: "Limites" },
    { key: "autoArchiveDays", label: "Auto-arquivar após (dias)", type: "number", min: 1, max: 90, help: "Atendimentos fechados são arquivados automaticamente.", section: "Limites" },
    { key: "requireReason", label: "Exigir motivo nas ações da equipe", type: "boolean", section: "Regras" },
    { key: "pingOnClaim", label: "Avisar quando alguém assumir um atendimento", type: "boolean", section: "Regras" }
  ],
  roles: [
    { key: "allowAiDrafts", label: "Permitir rascunhos com IA", type: "boolean", help: "A IA sugere; você aprova antes de aplicar.", section: "IA" },
    { key: "syncNames", label: "Sincronizar nomes de cargos", type: "boolean", section: "Sincronização" },
    { key: "autoSyncIntervalHours", label: "Intervalo de sincronização automática (h)", type: "number", min: 1, max: 168, section: "Sincronização" },
    { key: "autoRemoveOnLeave", label: "Remover cargos temporários ao sair", type: "boolean", section: "Sincronização" },
    { key: "protectedRoleIds", label: "Cargos protegidos", type: "role-list", help: "Nunca entram em rascunho automático.", section: "Proteção" },
    { key: "defaultRoleIds", label: "Cargos atribuídos na entrada", type: "role-list", help: "Dados automaticamente a novos membros.", section: "Padrões" },
    { key: "mentionableByDefault", label: "Novos cargos mencionáveis", type: "boolean", section: "Padrões" },
    { key: "hoistNewRoles", label: "Exibir novos cargos separadamente", type: "boolean", section: "Padrões" },
    { key: "maxRolesPerMember", label: "Máximo de cargos por membro", type: "number", min: 1, max: 250, section: "Padrões" },
    { key: "hierarchyLimit", label: "Limite de hierarquia", type: "number", min: 1, max: 50, help: "Cargos acima deste limite não são alterados pelo bot.", section: "Padrões" }
  ],
  automations: [
    { key: "requireApprovalForDestructiveActions", label: "Exigir aprovação em ações destrutivas", type: "boolean", section: "Segurança" },
    { key: "dryRun", label: "Modo ensaio (não executa, só registra)", type: "boolean", section: "Segurança" },
    { key: "retryOnFailure", label: "Tentar novamente em caso de falha", type: "boolean", section: "Segurança" },
    { key: "maxRetries", label: "Tentativas máximas", type: "number", min: 0, max: 10, section: "Segurança" },
    { key: "maxActionsPerHour", label: "Máximo de ações por hora", type: "number", min: 1, max: 500, section: "Limites" },
    { key: "cooldownSeconds", label: "Intervalo entre ações (s)", type: "number", min: 0, max: 300, section: "Limites" },
    { key: "allowChannelCreate", label: "Permitir criar canais", type: "boolean", section: "Permissões da automação" },
    { key: "allowRoleAssign", label: "Permitir atribuir cargos", type: "boolean", section: "Permissões da automação" },
    { key: "allowSendMessage", label: "Permitir enviar mensagens", type: "boolean", section: "Permissões da automação" },
    { key: "allowNicknameChange", label: "Permitir alterar apelidos", type: "boolean", section: "Permissões da automação" },
    { key: "logChannelId", label: "Canal de registro", type: "channel", section: "Canais" },
    { key: "notifyChannelId", label: "Canal de avisos", type: "channel", section: "Canais" }
  ],
  integrations: [
    { key: "webhookAllowlist", label: "Destinos permitidos", type: "list", placeholder: "https://exemplo.com/webhook", section: "Saída" },
    { key: "signingSecretConfigured", label: "Assinatura configurada", type: "boolean", help: "Nunca coloque tokens aqui: apenas o indicador.", section: "Saída" },
    { key: "timeoutMs", label: "Tempo limite da chamada (ms)", type: "number", min: 500, max: 15000, section: "Saída" },
    { key: "retryCount", label: "Tentativas em falha", type: "number", min: 0, max: 5, section: "Saída" },
    { key: "rateLimitPerMinute", label: "Limite de chamadas por minuto", type: "number", min: 1, max: 1000, section: "Saída" },
    { key: "includeGuildId", label: "Incluir o ID do servidor no payload", type: "boolean", section: "Saída" },
    { key: "logPayloads", label: "Registrar payloads enviados", type: "boolean", help: "Útil para debug. Desligue em produção para economizar espaço.", section: "Saída" },
    { key: "allowIncoming", label: "Aceitar webhooks de entrada", type: "boolean", help: "Desligado por padrão. Só ligue com assinatura configurada.", section: "Entrada" },
    { key: "healthCheckIntervalMinutes", label: "Verificação de saúde (min)", type: "number", min: 1, max: 60, section: "Monitoramento" }
  ],
  moderation: [
    { key: "logChannelId", label: "Canal de registros", type: "channel", section: "Canais" },
    { key: "appealChannelId", label: "Canal de recursos", type: "channel", section: "Canais" },
    { key: "staffRoleIds", label: "Cargos da equipe", type: "role-list", section: "Equipe" },
    { key: "defaultTimeoutMinutes", label: "Duração padrão do timeout (min)", type: "number", min: 1, max: 40320, section: "Punições" },
    { key: "escalateAfterStrikes", label: "Advertências até escalar", type: "number", min: 1, max: 20, section: "Punições" },
    { key: "maxStrikesBeforeBan", label: "Advertências até ban", type: "number", min: 1, max: 50, section: "Punições" },
    { key: "strikeExpiryDays", label: "Validade das advertências (dias)", type: "number", min: 1, max: 365, help: "Advertências expiram automaticamente.", section: "Punições" },
    { key: "banDeleteDays", label: "Apagar histórico no ban (dias)", type: "number", min: 0, max: 7, section: "Punições" },
    { key: "autoUnmuteAfterTimeout", label: "Desmutar automaticamente", type: "boolean", section: "Punições" },
    { key: "dmOnPunish", label: "Avisar a pessoa em privado", type: "boolean", section: "Comunicação" },
    { key: "requireEvidence", label: "Exigir evidência antes de aplicar", type: "boolean", section: "Comunicação" },
    { key: "publicLogging", label: "Logs públicos", type: "boolean", help: "Exibe punições em canal público.", section: "Comunicação" },
    { key: "pardonsEnabled", label: "Permitir perdão de advertências", type: "boolean", section: "Comunicação" }
  ],
  automod: [
    { key: "logChannelId", label: "Canal de registros", type: "channel", section: "Canais" },
    { key: "ignoredChannelIds", label: "Canais ignorados", type: "channel-list", section: "Canais" },
    { key: "ignoredRoleIds", label: "Cargos ignorados", type: "role-list", help: "Além de quem já tem Gerenciar mensagens.", section: "Canais" },
    { key: "action", label: "Ação ao detectar", type: "select", section: "Resposta", options: [
      { value: "delete", label: "Apagar a mensagem" },
      { value: "warn", label: "Avisar o autor" },
      { value: "timeout", label: "Aplicar timeout" },
      { value: "review", label: "Enviar para revisão" }
    ] },
    { key: "warnMessage", label: "Aviso ao autor", type: "text", maxLength: 200, section: "Resposta" },
    { key: "messageLimit", label: "Mensagens por janela", type: "number", min: 3, max: 30, section: "Spam" },
    { key: "windowSeconds", label: "Janela (segundos)", type: "number", min: 3, max: 120, section: "Spam" },
    { key: "duplicateLimit", label: "Repetições permitidas", type: "number", min: 2, max: 10, section: "Spam" },
    { key: "mentionLimit", label: "Menções máximas por mensagem", type: "number", min: 2, max: 50, section: "Spam" },
    { key: "timeoutMinutes", label: "Timeout ao punir (min)", type: "number", min: 1, max: 1440, section: "Spam" },
    { key: "blockInvites", label: "Bloquear convites de outros servidores", type: "boolean", section: "Conteúdo" },
    { key: "blockLinks", label: "Bloquear todos os links", type: "boolean", help: "Ative apenas se quiser bloquear qualquer link.", section: "Conteúdo" },
    { key: "allowedDomains", label: "Domínios permitidos", type: "list", placeholder: "exemplo.com", help: "Links destes domínios passam mesmo com bloqueio de links.", section: "Conteúdo" },
    { key: "scanImages", label: "Ler texto em imagens (OCR)", type: "boolean", section: "Conteúdo" },
    { key: "blockedTerms", label: "Termos bloqueados", type: "list", section: "Conteúdo" },
    { key: "blockedDomains", label: "Domínios bloqueados", type: "list", placeholder: "exemplo.com", section: "Conteúdo" },
    { key: "capsThresholdPercent", label: "Limite de maiúsculas (%)", type: "number", min: 50, max: 100, help: "Mensagens com mais que isso em maiúsculas são flagged. 0 = desativado.", section: "Avançado" },
    { key: "antiGhostPing", label: "Detectar ghost pings", type: "boolean", help: "Alerta quando alguém menciona e apaga a mensagem.", section: "Avançado" }
  ],
  security: [
    { key: "alertChannelId", label: "Canal de alertas", type: "channel", section: "Alertas" },
    { key: "alertStaffRoleIds", label: "Cargos avisados no alerta", type: "role-list", section: "Alertas" },
    { key: "alertOnMassBan", label: "Alertar em ban em massa", type: "boolean", section: "Alertas" },
    { key: "alertOnMassChannelDelete", label: "Alertar em exclusão de canais", type: "boolean", section: "Alertas" },
    { key: "response", label: "Resposta a incidentes", type: "select", section: "Resposta", options: [
      { value: "alert", label: "Apenas alertar a equipe" },
      { value: "timeout_suspect", label: "Timeout preventivo no suspeito" },
      { value: "lockdown_review", label: "Bloqueio preventivo e revisão" }
    ] },
    { key: "lockdownMessage", label: "Mensagem de lockdown", type: "longtext", maxLength: 500, section: "Resposta" },
    { key: "raidMode", label: "Modo anti-raid", type: "select", section: "Anti-raid", options: [
      { value: "smart", label: "Inteligente (analisa padrões)" },
      { value: "strict", label: "Estrito (qualquer suspeita)" },
      { value: "passive", label: "Passivo (só alerta)" }
    ] },
    { key: "raidJoinThreshold", label: "Entradas para considerar raid", type: "number", min: 3, max: 500, section: "Anti-raid" },
    { key: "raidWindowSeconds", label: "Janela da raid (segundos)", type: "number", min: 10, max: 3600, section: "Anti-raid" },
    { key: "minAccountAgeHours", label: "Idade mínima da conta (horas)", type: "number", min: 0, max: 720, section: "Anti-raid" },
    { key: "quarantineNewMembers", label: "Isolar contas novas durante raid", type: "boolean", section: "Anti-raid" },
    { key: "autoBanRepeatOffenders", label: "Banir reincidentes automaticamente", type: "boolean", help: "Contas que causam mais de um incidente.", section: "Anti-raid" },
    { key: "nukeActionThreshold", label: "Ações destrutivas para nuke", type: "number", min: 2, max: 100, section: "Anti-nuke" },
    { key: "nukeWindowSeconds", label: "Janela do nuke (segundos)", type: "number", min: 10, max: 3600, section: "Anti-nuke" },
    { key: "timeoutMinutes", label: "Timeout preventivo (min)", type: "number", min: 1, max: 1440, section: "Anti-nuke" },
    { key: "trustedRoleIds", label: "Cargos confiáveis", type: "role-list", help: "Nunca entram em contenção automática.", section: "Confiança" },
    { key: "whitelistRoleIds", label: "Cargos na whitelist", type: "role-list", help: "Ignorados completamente pelo anti-raid.", section: "Confiança" }
  ],
  logs: [
    { key: "channelId", label: "Canal de logs", type: "channel", section: "Destino" },
    { key: "retentionDays", label: "Guardar logs (dias)", type: "number", min: 30, max: 730, section: "Destino" },
    { key: "ignoreChannelIds", label: "Canais ignorados", type: "channel-list", section: "Destino" },
    { key: "compactMode", label: "Modo compacto", type: "boolean", help: "Logs mais concisos, menos detalhes.", section: "Destino" },
    { key: "includeTimestamp", label: "Incluir timestamp nos logs", type: "boolean", section: "Destino" },
    { key: "logModeration", label: "Registrar moderação", type: "boolean", section: "Eventos" },
    { key: "logMembers", label: "Registrar entradas e saídas", type: "boolean", section: "Eventos" },
    { key: "logMessages", label: "Registrar edições de mensagens", type: "boolean", section: "Eventos" },
    { key: "logVoice", label: "Registrar voz", type: "boolean", section: "Eventos" },
    { key: "logRoles", label: "Registrar cargos", type: "boolean", section: "Eventos" },
    { key: "logChannels", label: "Registrar canais", type: "boolean", section: "Eventos" },
    { key: "logBans", label: "Registrar bans", type: "boolean", section: "Eventos" },
    { key: "logThreadEvents", label: "Registrar threads", type: "boolean", section: "Eventos" },
    { key: "logStageEvents", label: "Registrar palcos", type: "boolean", section: "Eventos" },
    { key: "logScheduledEvents", label: "Registrar eventos agendados", type: "boolean", section: "Eventos" },
    { key: "logAutoMod", label: "Registrar AutoMod", type: "boolean", section: "Eventos" },
    { key: "ignoreBotMessages", label: "Ignorar mensagens de bots", type: "boolean", section: "Eventos" },
    { key: "mentionOnCritical", label: "Mencionar cargo em eventos críticos", type: "boolean", section: "Alertas" },
    { key: "mentionRoleId", label: "Cargo mencionado em alertas", type: "role-list", section: "Alertas" }
  ],
  tickets: [
    { key: "panelChannelId", label: "Canal do painel", type: "channel", section: "Painel" },
    { key: "categoryId", label: "Categoria dos atendimentos", type: "channel", filter: "category", section: "Painel" },
    { ...panelFormat, section: "Painel" },
    { ...panelTitle, section: "Painel" },
    { ...panelDescription, section: "Painel" },
    { ...panelColor, section: "Painel" },
    { key: "staffRoleIds", label: "Cargos de atendimento", type: "role-list", section: "Equipe" },
    { key: "transcriptChannelId", label: "Canal de transcrições", type: "channel", section: "Equipe" },
    { key: "logChannelId", label: "Canal dos logs de atendimento", type: "channel", help: "Onde o bot publica o resumo de cada atendimento com o botão de análise por IA.", section: "Equipe" },
    { key: "escalationRoleId", label: "Cargo de escalonamento", type: "role-list", section: "Equipe" },
    { key: "aiSupportEnabled", label: "IA de apoio à equipe", type: "boolean", help: "Adiciona o botão de análise no log. A IA sugere; nunca responde ao cliente.", section: "Fluxo" },
    { key: "closeAfterHours", label: "Fechar após (horas)", type: "number", min: 1, max: 720, section: "Fluxo" },
    { key: "autoCloseInactiveHours", label: "Fechar inativos após (horas)", type: "number", min: 1, max: 720, section: "Fluxo" },
    { key: "maxOpenPerUser", label: "Atendimentos abertos por pessoa", type: "number", min: 1, max: 10, section: "Fluxo" },
    { key: "pingStaffOnOpen", label: "Mencionar a equipe ao abrir", type: "boolean", section: "Fluxo" },
    { key: "feedbackEnabled", label: "Pedir feedback ao encerrar", type: "boolean", section: "Fluxo" },
    { key: "reopenEnabled", label: "Permitir reabrir atendimento", type: "boolean", section: "Fluxo" },
    { key: "priorityEnabled", label: "Sistema de prioridade", type: "boolean", section: "Fluxo" },
    { key: "slaWarningMinutes", label: "Alerta de SLA (min)", type: "number", min: 5, max: 1440, help: "Alerta quando um atendimento fica sem resposta por este tempo.", section: "Fluxo" },
    { key: "namingPattern", label: "Nome do canal", type: "text", maxLength: 80, placeholder: "atendimento-{user}", help: "Use {user} para o nome da pessoa.", section: "Mensagens" },
    { key: "welcomeMessage", label: "Mensagem de boas-vindas", type: "longtext", maxLength: 500, section: "Mensagens" },
    { key: "tags", label: "Tags disponíveis", type: "list", placeholder: "suporte, compra, denúncia", help: "A equipe seleciona ao abrir o atendimento.", section: "Organização" }
  ],
  forms: [
    { key: "reviewerRoleIds", label: "Cargos revisores", type: "role-list", section: "Revisão" },
    { key: "reviewChannelId", label: "Canal de revisão", type: "channel", section: "Revisão" },
    { key: "notifyReviewers", label: "Avisar revisores em cada envio", type: "boolean", section: "Revisão" },
    { key: "useAiPreReview", label: "Pré-análise com IA", type: "boolean", section: "Revisão" },
    { key: "requireReasonOnReject", label: "Exigir motivo ao rejeitar", type: "boolean", section: "Revisão" },
    { key: "cooldownHours", label: "Intervalo entre envios (horas)", type: "number", min: 0, max: 720, section: "Limites" },
    { key: "minAccountAgeDays", label: "Idade mínima da conta (dias)", type: "number", min: 0, max: 365, section: "Limites" },
    { key: "maxSubmissionsPerUser", label: "Envios por pessoa", type: "number", min: 1, max: 50, section: "Limites" },
    { key: "anonymousSubmissions", label: "Envios anônimos", type: "boolean", help: "O nome do candidato fica oculto para os revisores.", section: "Limites" },
    { key: "autoRejectAfterDays", label: "Rejeitar automaticamente após (dias)", type: "number", min: 0, max: 365, help: "0 = não rejeitar automaticamente.", section: "Limites" },
    { key: "archiveApprovedAfterDays", label: "Arquivar aprovados após (dias)", type: "number", min: 0, max: 365, section: "Limites" },
    { ...panelFormat, section: "Painel" },
    { ...panelTitle, section: "Painel" },
    { ...panelDescription, section: "Painel" },
    { ...panelColor, section: "Painel" }
  ],
  knowledge: [
    { key: "answerChannelId", label: "Canal de respostas", type: "channel", help: "Só neste canal o bot responde usando artigos aprovados.", section: "Canal" },
    { key: "useAi", label: "Usar IA nas respostas", type: "boolean", help: "A IA só reescreve o artigo aprovado. Nunca inventa.", section: "IA" },
    { key: "preferFastModel", label: "Preferir modelo rápido", type: "boolean", help: "gpt-oss-20b para reescrita. Desligue para usar o 120B.", section: "IA" },
    { key: "similarityThreshold", label: "Limiar de similaridade", type: "number", min: 0, max: 1, help: "0.6 = razoável. Aumente para respostas mais precisas.", section: "IA" },
    { key: "maxArticlesPerSearch", label: "Artigos por busca", type: "number", min: 1, max: 20, section: "IA" },
    { key: "requireApprovedArticles", label: "Exigir artigos aprovados", type: "boolean", section: "Regras" },
    { key: "mentionRequired", label: "Só responder se o bot for mencionado", type: "boolean", section: "Regras" },
    { key: "minQuestionLength", label: "Tamanho mínimo da pergunta", type: "number", min: 6, max: 200, section: "Regras" },
    { key: "cooldownSeconds", label: "Intervalo entre respostas (s)", type: "number", min: 5, max: 300, section: "Regras" },
    { key: "autoSuggest", label: "Sugestão automática", type: "boolean", help: "Sugere artigos mesmo em canais não configurados.", section: "Regras" },
    { key: "includeArticleLink", label: "Incluir link do artigo na resposta", type: "boolean", section: "Regras" },
    { key: "fallbackMessage", label: "Mensagem se nenhum artigo servir", type: "longtext", maxLength: 300, help: "Vazio = o bot fica quieto.", section: "Regras" },
    { key: "logSearches", label: "Registrar buscas", type: "boolean", section: "Monitoramento" },
    { key: "logChannelId", label: "Canal de logs de busca", type: "channel", section: "Monitoramento" }
  ],
  ocr: [
    { key: "provider", label: "Provedor de leitura", type: "select", section: "Leitura", options: [
      { value: "hybrid", label: "Híbrido (leitura + revisão visual)" },
      { value: "haiz", label: "Somente leitura especializada" },
      { value: "groq", label: "Somente visão" }
    ] },
    { key: "language", label: "Idioma", type: "select", section: "Leitura", options: [
      { value: "pt", label: "Português" },
      { value: "en", label: "Inglês" },
      { value: "es", label: "Espanhol" }
    ] },
    { key: "model", label: "Modelo de visão", type: "text", maxLength: 120, section: "Leitura" },
    { key: "maxImageMb", label: "Tamanho máximo da imagem (MB)", type: "number", min: 1, max: 25, section: "Leitura" },
    { key: "confidenceThreshold", label: "Limiar de confiança", type: "number", min: 0, max: 1, help: "Resultados abaixo disso são ignorados.", section: "Leitura" },
    { key: "retainExtractedText", label: "Guardar o texto extraído", type: "boolean", help: "Desligado por padrão, por privacidade.", section: "Privacidade" },
    { key: "reviewChannelId", label: "Canal de revisão visual", type: "channel", section: "Privacidade" },
    { key: "autoDeleteSuspicious", label: "Apagar imagens suspeitas", type: "boolean", help: "Remove automaticamente imagens com conteúdo bloqueado.", section: "Privacidade" },
    { key: "cacheResults", label: "Cachear resultados", type: "boolean", help: "Evita reler a mesma imagem.", section: "Desempenho" },
    { key: "cacheTtlMinutes", label: "Duração do cache (min)", type: "number", min: 1, max: 1440, section: "Desempenho" },
    { key: "logChannelId", label: "Canal de logs OCR", type: "channel", section: "Monitoramento" }
  ]
};

/* ------------------------------------------------------------------ *
 * Seletores visuais
 * ------------------------------------------------------------------ */

export function readField(config: Record<string, unknown>, key: string): unknown {
  return config[key];
}

function matchesFilter(type: number, filter: ChannelFilter): boolean {
  if (filter === "category") return type === CATEGORY_TYPE;
  if (filter === "text") return TEXT_CHANNEL_TYPES.includes(type);
  return type !== CATEGORY_TYPE;
}

function roleColor(color: number): string {
  if (!color) return "var(--text-3)";
  return `#${color.toString(16).padStart(6, "0")}`;
}

/**
 * Seletor de canal agrupado por categoria.
 *
 * Detalhe que evita perda de dado: se o valor atual nao estiver na lista
 * sincronizada (canal apagado, ou bot ainda sem sincronizar), ele vira uma
 * opcao propria. Assim abrir a tela nunca apaga uma configuracao valida.
 */
function ChannelSelect({
  id,
  value,
  assets,
  filter,
  disabled,
  onChange
}: {
  id: string;
  value: string;
  assets: GuildAssetsLite | null;
  filter: ChannelFilter;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  const channels = (assets?.channels ?? []).filter((channel) => matchesFilter(channel.type, filter));

  if (!assets || (!channels.length && !value)) {
    return (
      <input
        id={id}
        value={value}
        placeholder="ID numérico do Discord"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  const categories = [...channels]
    .filter((channel) => channel.type === CATEGORY_TYPE)
    .sort((a, b) => a.position - b.position);
  const leaves = [...channels]
    .filter((channel) => channel.type !== CATEGORY_TYPE)
    .sort((a, b) => a.position - b.position);
  const known = new Set(channels.map((channel) => channel.id));

  return (
    <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      <option value="">— não definir —</option>
      {value && !known.has(value) ? <option value={value}>ID atual: {value}</option> : null}
      {categories.map((category) => {
        const children = leaves.filter((channel) => channel.parentId === category.id);
        return (
          <optgroup key={category.id} label={`# ${category.name}`}>
            <option value={category.id}># {category.name} (categoria)</option>
            {children.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </optgroup>
        );
      })}
      {leaves.some((channel) => !channel.parentId || !categories.some((c) => c.id === channel.parentId)) ? (
        <optgroup label="Sem categoria">
          {leaves
            .filter((channel) => !channel.parentId || !categories.some((c) => c.id === channel.parentId))
            .map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
        </optgroup>
      ) : null}
    </select>
  );
}

/**
 * Seletor de cargos por marcacao.
 *
 * Cargos gerenciados por integracao aparecem desabilitados: nao fazem sentido
 * para equipe nem para confianca, e escolher um deles seria um erro silencioso.
 */
function RolePicker({
  value,
  assets,
  disabled,
  onChange
}: {
  value: string[];
  assets: GuildAssetsLite | null;
  disabled: boolean;
  onChange: (next: string[]) => void;
}) {
  if (!assets || !assets.roles.length) {
    return (
      <input
        value={value.join(", ")}
        placeholder="IDs separados por vírgula"
        disabled={disabled}
        onChange={(event) =>
          onChange(
            event.target.value
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean)
          )
        }
      />
    );
  }

  const roles = [...assets.roles].sort((a, b) => b.position - a.position);
  const known = new Set(roles.map((role) => role.id));
  const unknown = value.filter((id) => !known.has(id));

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((entry) => entry !== id) : [...value, id]);
  }

  return (
    <div className="role-picker">
      {roles.map((role) => (
        <label key={role.id} className={role.managed ? "is-managed" : ""}>
          <input
            type="checkbox"
            checked={value.includes(role.id)}
            disabled={disabled || role.managed}
            onChange={() => toggle(role.id)}
          />
          <span className="role-dot" style={{ background: roleColor(role.color) }} />
          <span className="role-name">{role.name}</span>
          {role.managed ? <em>gerenciado</em> : null}
        </label>
      ))}
      {unknown.map((id) => (
        <label key={id}>
          <input type="checkbox" checked disabled={disabled} onChange={() => toggle(id)} />
          <span className="role-dot" style={{ background: "var(--text-3)" }} />
          <span className="role-name">ID atual: {id}</span>
        </label>
      ))}
    </div>
  );
}

function ChannelPicker({
  value,
  assets,
  filter,
  disabled,
  onChange
}: {
  value: string[];
  assets: GuildAssetsLite | null;
  filter: ChannelFilter;
  disabled: boolean;
  onChange: (next: string[]) => void;
}) {
  const channels = (assets?.channels ?? []).filter((channel) => matchesFilter(channel.type, filter) && channel.type !== CATEGORY_TYPE);

  if (!assets || !channels.length) {
    return (
      <input
        value={value.join(", ")}
        placeholder="IDs separados por vírgula"
        disabled={disabled}
        onChange={(event) =>
          onChange(
            event.target.value
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean)
          )
        }
      />
    );
  }

  const known = new Set(channels.map((channel) => channel.id));
  const unknown = value.filter((id) => !known.has(id));

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((entry) => entry !== id) : [...value, id]);
  }

  return (
    <div className="role-picker">
      {channels
        .sort((a, b) => a.position - b.position)
        .map((channel) => (
          <label key={channel.id}>
            <input type="checkbox" checked={value.includes(channel.id)} disabled={disabled} onChange={() => toggle(channel.id)} />
            <span className="role-dot" style={{ background: "var(--brand)" }} />
            <span className="role-name">#{channel.name}</span>
          </label>
        ))}
      {unknown.map((id) => (
        <label key={id}>
          <input type="checkbox" checked disabled={disabled} onChange={() => toggle(id)} />
          <span className="role-dot" style={{ background: "var(--text-3)" }} />
          <span className="role-name">ID atual: {id}</span>
        </label>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Renderizador
 * ------------------------------------------------------------------ */

export function ModuleFieldsForm({
  module,
  config,
  disabled,
  assets,
  scope = "server",
  onChange
}: {
  module: ModuleId;
  config: Record<string, unknown>;
  disabled: boolean;
  assets?: GuildAssetsLite | null;
  scope?: "server" | "group";
  onChange: (key: string, value: unknown) => void;
}) {
  const fields = moduleFields[module] ?? [];
  const hasAssets = Boolean(assets && (assets.channels.length || assets.roles.length));
  const sections: Array<{ title: string | null; fields: Field[] }> = [];
  for (const field of fields) {
    const title = field.section ?? null;
    const last = sections.at(-1);
    if (!last || last.title !== title) sections.push({ title, fields: [field] });
    else last.fields.push(field);
  }

  function renderField(field: Field) {
    const id = `field-${module}-${field.key}`;
    const value = readField(config, field.key);

    if (field.type === "boolean") {
      return (
        <label className="field field-toggle" key={field.key}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(event) => onChange(field.key, event.target.checked)}
          />
          <span className="switch">
            <i />
          </span>
          <span className="field-text">
            <strong>{field.label}</strong>
            {field.help ? <small>{field.help}</small> : null}
          </span>
        </label>
      );
    }

    if (field.type === "select") {
      return (
        <label className="field" key={field.key} htmlFor={id}>
          <span>{field.label}</span>
          <select
            id={id}
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            onChange={(event) => onChange(field.key, event.target.value)}
          >
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {field.help ? <small>{field.help}</small> : null}
        </label>
      );
    }

    if (field.type === "number") {
      return (
        <label className="field" key={field.key} htmlFor={id}>
          <span>{field.label}</span>
          <input
            id={id}
            type="number"
            min={field.min}
            max={field.max}
            value={typeof value === "number" ? value : ""}
            disabled={disabled}
            onChange={(event) => onChange(field.key, event.target.value === "" ? "" : Number(event.target.value))}
          />
          {field.help ? <small>{field.help}</small> : null}
        </label>
      );
    }

    if (field.type === "color") {
      return (
        <label className="field" key={field.key} htmlFor={id}>
          <span>{field.label}</span>
          <div className="color-field">
            <input
              id={id}
              type="color"
              value={typeof value === "string" ? value : "#7c5cff"}
              disabled={disabled}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
            <b>{typeof value === "string" ? value.toUpperCase() : "#7C5CFF"}</b>
          </div>
          {field.help ? <small>{field.help}</small> : null}
        </label>
      );
    }

    if (field.type === "channel") {
      const filter = field.filter ?? "text";
      const text = typeof value === "string" ? value : "";

      if (scope === "group") {
        return (
          <label className="field" key={field.key} htmlFor={id}>
            <span>{field.label}</span>
            <div className="channel-name-field">
              <b>{filter === "category" ? "🗂️" : "#"}</b>
              <input
                id={id}
                value={text}
                placeholder={filter === "category" ? "nome-da-categoria" : "logs"}
                disabled={disabled}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            </div>
            <small>
              {field.help ? `${field.help} ` : ""}
              Cada servidor usa o seu próprio canal com este nome. Se não existir, o bot fica sem canal.
            </small>
          </label>
        );
      }

      return (
        <label className="field" key={field.key} htmlFor={id}>
          <span>{field.label}</span>
          <ChannelSelect
            id={id}
            value={text}
            assets={assets ?? null}
            filter={filter}
            disabled={disabled}
            onChange={(next) => onChange(field.key, next)}
          />
          <small>
            {field.help ? `${field.help} ` : ""}
            {hasAssets ? "" : "O bot ainda não sincronizou os canais deste servidor."}
          </small>
        </label>
      );
    }

    if (field.type === "role-list") {
      const list = Array.isArray(value) ? (value as unknown[]).map(String) : [];

      if (scope === "group") {
        return (
          <label className="field field-wide" key={field.key} htmlFor={id}>
            <span>{field.label}</span>
            <div className="channel-name-field">
              <b>@</b>
              <input
                id={id}
                value={list.join(", ")}
                placeholder="equipe, moderador"
                disabled={disabled}
                onChange={(event) =>
                  onChange(
                    field.key,
                    event.target.value
                      .split(",")
                      .map((entry) => entry.trim())
                      .filter(Boolean)
                  )
                }
              />
            </div>
            <small>
              {field.help ? `${field.help} ` : ""}
              Cada servidor usa os seus próprios cargos com estes nomes. Cargos de integração são ignorados.
            </small>
          </label>
        );
      }

      return (
        <div className="field field-wide" key={field.key}>
          <span>{field.label}</span>
          <RolePicker
            value={list}
            assets={assets ?? null}
            disabled={disabled}
            onChange={(next) => onChange(field.key, next)}
          />
          <small>
            {field.help ? `${field.help} ` : ""}
            {hasAssets ? "" : "O bot ainda não sincronizou os cargos deste servidor."}
          </small>
        </div>
      );
    }

    if (field.type === "list") {
      const list = Array.isArray(value) ? (value as unknown[]).map(String) : [];
      return (
        <label className="field field-wide" key={field.key} htmlFor={id}>
          <span>{field.label}</span>
          <input
            id={id}
            value={list.join(", ")}
            placeholder={field.placeholder ?? "Separe por vírgula"}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                field.key,
                event.target.value
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean)
              )
            }
          />
          {field.help ? <small>{field.help}</small> : null}
        </label>
      );
    }

    if (field.type === "longtext") {
      const text = typeof value === "string" ? value : "";
      return (
        <label className="field field-wide" key={field.key} htmlFor={id}>
          <span>{field.label}</span>
          <textarea
            id={id}
            rows={3}
            value={text}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            disabled={disabled}
            onChange={(event) => onChange(field.key, event.target.value)}
          />
          <small>
            {text.length}
            {field.maxLength ? `/${field.maxLength}` : ""}
          </small>
        </label>
      );
    }

    return (
      <label className="field" key={field.key} htmlFor={id}>
        <span>{field.label}</span>
        <input
          id={id}
          value={typeof value === "string" ? value : ""}
          placeholder={"placeholder" in field ? (field.placeholder ?? "") : (field.type === "snowflake" ? "ID numérico do Discord" : "")}
          maxLength={field.type === "text" ? field.maxLength : undefined}
          disabled={disabled}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
        {field.help ? <small>{field.help}</small> : null}
      </label>
    );
  }

  return (
    <div className="field-grid">
      {sections.map((section) => (
        <div key={section.title ?? "__root"} className="field-wide">
          {section.title ? (
            <h4 style={{ margin: "0 0 12px", color: "var(--text-3)", fontSize: "9.5px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              {section.title}
            </h4>
          ) : null}
          <div className="field-grid">
            {section.fields.map((field) => renderField(field))}
          </div>
        </div>
      ))}
    </div>
  );
}
