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
    { key: "announceLeaveChannelId", label: "Canal de saídas", type: "channel", section: "Anúncios" },
    { key: "nicknameOnJoin", label: "Sugerir apelido na entrada", type: "boolean", help: "Não aplica sozinho: só registra a sugestão para a equipe.", section: "Anúncios" }
  ],
  statistics: [
    { key: "retentionDays", label: "Guardar histórico (dias)", type: "number", min: 30, max: 730, section: "Retenção" },
    { key: "anonymizeUsers", label: "Anonimizar pessoas nas estatísticas", type: "boolean", help: "Guarda contagens, não identidade.", section: "Retenção" },
    { key: "trackMessages", label: "Contar mensagens", type: "boolean", help: "Apenas contagem. O conteúdo não é gravado.", section: "O que medir" },
    { key: "trackVoice", label: "Contar tempo em voz", type: "boolean", section: "O que medir" },
    { key: "trackJoins", label: "Contar entradas e saídas", type: "boolean", section: "O que medir" },
    { key: "trackTickets", label: "Contar atendimentos", type: "boolean", section: "O que medir" },
    { key: "digestChannelId", label: "Canal do resumo diário", type: "channel", section: "Resumo" },
    { key: "digestHourUtc", label: "Hora do resumo (UTC)", type: "number", min: 0, max: 23, section: "Resumo" }
  ],
  staff: [
    { key: "staffRoleIds", label: "Cargos da equipe", type: "role-list", section: "Equipe" },
    { key: "logChannelId", label: "Canal de registro", type: "channel", section: "Equipe" },
    { key: "shiftLogChannelId", label: "Canal de plantão", type: "channel", section: "Equipe" },
    { key: "performanceWindowDays", label: "Janela de desempenho (dias)", type: "number", min: 7, max: 180, section: "Desempenho" },
    { key: "inactivityDays", label: "Dias sem ação para marcar inativo", type: "number", min: 3, max: 90, section: "Desempenho" },
    { key: "requireReason", label: "Exigir motivo nas ações da equipe", type: "boolean", section: "Regras" },
    { key: "pingOnClaim", label: "Avisar quando alguém assumir um atendimento", type: "boolean", section: "Regras" }
  ],
  roles: [
    { key: "allowAiDrafts", label: "Permitir rascunhos com IA", type: "boolean", help: "A IA sugere; você aprova antes de aplicar.", section: "IA" },
    { key: "syncNames", label: "Sincronizar nomes de cargos", type: "boolean", section: "Sincronização" },
    { key: "autoRemoveOnLeave", label: "Remover cargos temporários ao sair", type: "boolean", section: "Sincronização" },
    { key: "protectedRoleIds", label: "Cargos protegidos", type: "role-list", help: "Nunca entram em rascunho automático.", section: "Proteção" },
    { key: "mentionableByDefault", label: "Novos cargos mencionáveis", type: "boolean", section: "Padrões" },
    { key: "hoistNewRoles", label: "Exibir novos cargos separadamente", type: "boolean", section: "Padrões" },
    { key: "maxRolesPerMember", label: "Máximo de cargos por membro", type: "number", min: 1, max: 250, section: "Padrões" }
  ],
  automations: [
    { key: "requireApprovalForDestructiveActions", label: "Exigir aprovação em ações destrutivas", type: "boolean", section: "Segurança" },
    { key: "dryRun", label: "Modo ensaio (não executa, só registra)", type: "boolean", section: "Segurança" },
    { key: "maxActionsPerHour", label: "Máximo de ações por hora", type: "number", min: 1, max: 500, section: "Limites" },
    { key: "allowChannelCreate", label: "Permitir criar canais", type: "boolean", section: "Permissões da automação" },
    { key: "allowRoleAssign", label: "Permitir atribuir cargos", type: "boolean", section: "Permissões da automação" },
    { key: "logChannelId", label: "Canal de registro", type: "channel", section: "Canais" },
    { key: "notifyChannelId", label: "Canal de avisos", type: "channel", section: "Canais" }
  ],
  integrations: [
    { key: "webhookAllowlist", label: "Destinos permitidos", type: "list", placeholder: "https://exemplo.com/webhook", section: "Saída" },
    { key: "signingSecretConfigured", label: "Assinatura configurada", type: "boolean", help: "Nunca coloque tokens aqui: apenas o indicador.", section: "Saída" },
    { key: "timeoutMs", label: "Tempo limite da chamada (ms)", type: "number", min: 500, max: 15000, section: "Saída" },
    { key: "retryCount", label: "Tentativas em falha", type: "number", min: 0, max: 5, section: "Saída" },
    { key: "includeGuildId", label: "Incluir o ID do servidor no payload", type: "boolean", section: "Saída" },
    { key: "allowIncoming", label: "Aceitar webhooks de entrada", type: "boolean", help: "Desligado por padrão. Só ligue com assinatura configurada.", section: "Entrada" }
  ],
  moderation: [
    { key: "logChannelId", label: "Canal de registros", type: "channel", section: "Canais" },
    { key: "appealChannelId", label: "Canal de recursos", type: "channel", section: "Canais" },
    { key: "staffRoleIds", label: "Cargos da equipe", type: "role-list", section: "Equipe" },
    { key: "defaultTimeoutMinutes", label: "Duração padrão do timeout (min)", type: "number", min: 1, max: 40320, section: "Punições" },
    { key: "escalateAfterStrikes", label: "Advertências até escalar", type: "number", min: 1, max: 20, section: "Punições" },
    { key: "banDeleteDays", label: "Apagar histórico no ban (dias)", type: "number", min: 0, max: 7, section: "Punições" },
    { key: "dmOnPunish", label: "Avisar a pessoa em privado", type: "boolean", section: "Comunicação" },
    { key: "requireEvidence", label: "Exigir evidência antes de aplicar", type: "boolean", section: "Comunicação" }
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
    { key: "scanImages", label: "Ler texto em imagens (OCR)", type: "boolean", section: "Conteúdo" },
    { key: "blockedTerms", label: "Termos bloqueados", type: "list", section: "Conteúdo" },
    { key: "blockedDomains", label: "Domínios bloqueados", type: "list", placeholder: "exemplo.com", section: "Conteúdo" }
  ],
  security: [
    { key: "alertChannelId", label: "Canal de alertas", type: "channel", section: "Alertas" },
    { key: "alertStaffRoleIds", label: "Cargos avisados no alerta", type: "role-list", section: "Alertas" },
    { key: "response", label: "Resposta a incidentes", type: "select", section: "Resposta", options: [
      { value: "alert", label: "Apenas alertar a equipe" },
      { value: "timeout_suspect", label: "Timeout preventivo no suspeito" },
      { value: "lockdown_review", label: "Bloqueio preventivo e revisão" }
    ] },
    { key: "raidJoinThreshold", label: "Entradas para considerar raid", type: "number", min: 3, max: 500, section: "Anti-raid" },
    { key: "raidWindowSeconds", label: "Janela da raid (segundos)", type: "number", min: 10, max: 3600, section: "Anti-raid" },
    { key: "minAccountAgeHours", label: "Idade mínima da conta (horas)", type: "number", min: 0, max: 720, section: "Anti-raid" },
    { key: "quarantineNewMembers", label: "Isolar contas novas durante raid", type: "boolean", section: "Anti-raid" },
    { key: "nukeActionThreshold", label: "Ações destrutivas para nuke", type: "number", min: 2, max: 100, section: "Anti-nuke" },
    { key: "nukeWindowSeconds", label: "Janela do nuke (segundos)", type: "number", min: 10, max: 3600, section: "Anti-nuke" },
    { key: "timeoutMinutes", label: "Timeout preventivo (min)", type: "number", min: 1, max: 1440, section: "Anti-nuke" },
    { key: "trustedRoleIds", label: "Cargos confiáveis", type: "role-list", help: "Nunca entram em contenção automática.", section: "Confiança" }
  ],
  logs: [
    { key: "channelId", label: "Canal de logs", type: "channel", section: "Destino" },
    { key: "retentionDays", label: "Guardar logs (dias)", type: "number", min: 30, max: 730, section: "Destino" },
    { key: "ignoreChannelIds", label: "Canais ignorados", type: "channel-list", section: "Destino" },
    { key: "logModeration", label: "Registrar moderação", type: "boolean", section: "Eventos" },
    { key: "logMembers", label: "Registrar entradas e saídas", type: "boolean", section: "Eventos" },
    { key: "logMessages", label: "Registrar edições de mensagens", type: "boolean", section: "Eventos" },
    { key: "logVoice", label: "Registrar voz", type: "boolean", section: "Eventos" },
    { key: "logRoles", label: "Registrar cargos", type: "boolean", section: "Eventos" },
    { key: "logChannels", label: "Registrar canais", type: "boolean", section: "Eventos" },
    { key: "logBans", label: "Registrar bans", type: "boolean", section: "Eventos" },
    { key: "ignoreBotMessages", label: "Ignorar mensagens de bots", type: "boolean", section: "Eventos" }
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
    { key: "aiSupportEnabled", label: "IA de apoio à equipe", type: "boolean", help: "Adiciona o botão de análise no log. A IA sugere; nunca responde ao cliente.", section: "Fluxo" },
    { key: "closeAfterHours", label: "Fechar após (horas)", type: "number", min: 1, max: 720, section: "Fluxo" },
    { key: "maxOpenPerUser", label: "Atendimentos abertos por pessoa", type: "number", min: 1, max: 10, section: "Fluxo" },
    { key: "pingStaffOnOpen", label: "Mencionar a equipe ao abrir", type: "boolean", section: "Fluxo" },
    { key: "feedbackEnabled", label: "Pedir feedback ao encerrar", type: "boolean", section: "Fluxo" },
    { key: "namingPattern", label: "Nome do canal", type: "text", maxLength: 80, placeholder: "atendimento-{user}", help: "Use {user} para o nome da pessoa.", section: "Mensagens" },
    { key: "welcomeMessage", label: "Mensagem de boas-vindas", type: "longtext", maxLength: 500, section: "Mensagens" }
  ],
  forms: [
    { key: "reviewerRoleIds", label: "Cargos revisores", type: "role-list", section: "Revisão" },
    { key: "reviewChannelId", label: "Canal de revisão", type: "channel", section: "Revisão" },
    { key: "notifyReviewers", label: "Avisar revisores em cada envio", type: "boolean", section: "Revisão" },
    { key: "useAiPreReview", label: "Pré-análise com IA", type: "boolean", section: "Revisão" },
    { key: "cooldownHours", label: "Intervalo entre envios (horas)", type: "number", min: 0, max: 720, section: "Limites" },
    { key: "minAccountAgeDays", label: "Idade mínima da conta (dias)", type: "number", min: 0, max: 365, section: "Limites" },
    { ...panelFormat, section: "Painel" },
    { ...panelTitle, section: "Painel" },
    { ...panelDescription, section: "Painel" },
    { ...panelColor, section: "Painel" }
  ],
  knowledge: [
    { key: "answerChannelId", label: "Canal de respostas", type: "channel", help: "Só neste canal o bot responde usando artigos aprovados.", section: "Canal" },
    { key: "useAi", label: "Usar IA nas respostas", type: "boolean", help: "A IA só reescreve o artigo aprovado. Nunca inventa.", section: "IA" },
    { key: "preferFastModel", label: "Preferir modelo rápido", type: "boolean", help: "gpt-oss-20b para reescrita. Desligue para usar o 120B.", section: "IA" },
    { key: "requireApprovedArticles", label: "Exigir artigos aprovados", type: "boolean", section: "Regras" },
    { key: "mentionRequired", label: "Só responder se o bot for mencionado", type: "boolean", section: "Regras" },
    { key: "minQuestionLength", label: "Tamanho mínimo da pergunta", type: "number", min: 6, max: 200, section: "Regras" },
    { key: "cooldownSeconds", label: "Intervalo entre respostas (s)", type: "number", min: 5, max: 300, section: "Regras" },
    { key: "fallbackMessage", label: "Mensagem se nenhum artigo servir", type: "longtext", maxLength: 300, help: "Vazio = o bot fica quieto.", section: "Regras" }
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
    { key: "retainExtractedText", label: "Guardar o texto extraído", type: "boolean", help: "Desligado por padrão, por privacidade.", section: "Privacidade" },
    { key: "reviewChannelId", label: "Canal de revisão visual", type: "channel", section: "Privacidade" }
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

          // No escopo de GRUPO o valor e o NOME do canal. Um grupo cobre varios
          // servidores, e um ID fixo so valeria em um deles; com o nome, cada
          // servidor resolve para o seu proprio canal.
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

          // No escopo de GRUPO o valor e o NOME dos cargos. Mesmo motivo dos
          // canais: cada servidor tem os seus proprios cargos, entao o grupo
          // guarda nomes e cada servidor resolve para os seus IDs.
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
              placeholder={field.placeholder ?? (field.type === "snowflake" ? "ID numérico do Discord" : "")}
              maxLength={field.type === "text" ? field.maxLength : undefined}
              disabled={disabled}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
            {field.help ? <small>{field.help}</small> : null}
          </label>
        );
      })}
    </div>
  );
}
